/**
 * Tests for Stage 2A — the "ראשי" (Main) community-overview screen's
 * independently-bounded query helpers.
 *
 * These exercise the pure, DB-independent accumulator helpers extracted
 * from events.listCommunityMainOverview into communityCalendarState.ts:
 *   - createMainOverviewAccumulator
 *   - accumulateMainOverviewCandidate
 *   - isMainOverviewAccumulatorSatisfied
 *   - finalizeMainOverviewHasMore
 *
 * The actual bounded-index scan (`.withIndex('by_community_date', ...)
 * .gte('startTime', now)).paginate(...)`) inside listCommunityMainOverview
 * cannot be unit-tested without a Convex test harness (same precedent as
 * eventScaleBounding.test.ts / communityCalendarState.test.ts — this repo
 * only unit-tests the pure helpers, and verifies the query wiring by code
 * review). What IS fully covered here is the exact behavior the Stage 2A
 * prompt calls out under "TESTING — MAIN QUERY BOUNDING":
 *   - myEvents and pendingRsvpEvents are bounded independently.
 *   - one category filling its limit cannot consume the other's budget or
 *     hide items that belong in it (see the interleaved-candidates test).
 *   - an event can land in BOTH categories (intentional non-exclusive
 *     duplication — the auto-add + pending-RSVP case).
 *   - hasMore reflects "we stopped without knowing there isn't more",
 *     never an expensive exact remaining count.
 *   - scan-cap TRUNCATION (the 160-event hard cap hit while the underlying
 *     query is not done) is distinct from a category being "exhausted", and
 *     must set hasMore unconditionally — even for a category with ZERO
 *     matches — since hitting the cap is never proof there's nothing more
 *     past it. See the Stage 2A scale-edge-case investigation (a matching
 *     event sitting at scan position ~170 with a 160-event cap must not be
 *     reported as a false "no events" negative).
 */

import { describe, expect, it } from 'bun:test';
import {
  accumulateMainOverviewCandidate,
  computeCommunityEventPersonalCalendarState,
  createMainOverviewAccumulator,
  finalizeMainOverviewHasMore,
  isEventStartTimeEligibleForUpcomingScan,
  isMainOverviewAccumulatorSatisfied,
  type MainOverviewLimits,
} from '../../convex/communityCalendarState';

type FakeEvent = { id: string };

const LIMITS: MainOverviewLimits = { myEventsLimit: 2, pendingRsvpLimit: 2 };

function ev(id: string): FakeEvent {
  return { id };
}

describe('createMainOverviewAccumulator', () => {
  it('starts empty with both hasMore flags false', () => {
    const acc = createMainOverviewAccumulator<FakeEvent>();
    expect(acc).toEqual({
      myEvents: [],
      myEventsHasMore: false,
      pendingRsvpEvents: [],
      pendingRsvpHasMore: false,
    });
  });
});

describe('accumulateMainOverviewCandidate — independent bounding per category', () => {
  it('adds a candidate to myEvents only when isInPersonalCalendar', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('a'), isInPersonalCalendar: true, isPendingRsvp: false },
      LIMITS
    );
    expect(acc.myEvents).toEqual([ev('a')]);
    expect(acc.pendingRsvpEvents).toEqual([]);
  });

  it('adds a candidate to pendingRsvpEvents only when isPendingRsvp', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('a'), isInPersonalCalendar: false, isPendingRsvp: true },
      LIMITS
    );
    expect(acc.pendingRsvpEvents).toEqual([ev('a')]);
    expect(acc.myEvents).toEqual([]);
  });

  it('IMPORTANT AUTO-ADD CASE: a candidate can land in BOTH categories at once', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('trip'), isInPersonalCalendar: true, isPendingRsvp: true },
      LIMITS
    );
    expect(acc.myEvents).toEqual([ev('trip')]);
    expect(acc.pendingRsvpEvents).toEqual([ev('trip')]);
  });

  it('ignores a candidate matching neither category', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('other'), isInPersonalCalendar: false, isPendingRsvp: false },
      LIMITS
    );
    expect(acc.myEvents).toEqual([]);
    expect(acc.pendingRsvpEvents).toEqual([]);
  });

  it('never grows a category array past its limit — flips hasMore instead', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b', 'c', 'd']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    expect(acc.myEvents).toEqual([ev('a'), ev('b')]);
    expect(acc.myEventsHasMore).toBe(true);
  });

  it("one category filling up does NOT consume or starve the other's budget", () => {
    // 4 myEvents-only candidates, interleaved with 1 pendingRsvp-only
    // candidate arriving LAST — the pending item must still be captured,
    // proving myEvents filling up never silently ate the whole scan.
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b', 'c', 'd']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    acc = accumulateMainOverviewCandidate(
      acc,
      {
        item: ev('pending-1'),
        isInPersonalCalendar: false,
        isPendingRsvp: true,
      },
      LIMITS
    );
    expect(acc.myEvents).toEqual([ev('a'), ev('b')]);
    expect(acc.myEventsHasMore).toBe(true);
    expect(acc.pendingRsvpEvents).toEqual([ev('pending-1')]);
    expect(acc.pendingRsvpHasMore).toBe(false);
  });
});

describe('isMainOverviewAccumulatorSatisfied', () => {
  it('is false when neither category has reached its limit', () => {
    const acc = createMainOverviewAccumulator<FakeEvent>();
    expect(isMainOverviewAccumulatorSatisfied(acc, LIMITS)).toBe(false);
  });

  it('is false when only one category has reached its limit', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    expect(isMainOverviewAccumulatorSatisfied(acc, LIMITS)).toBe(false);
  });

  it('is true once BOTH categories reach their limit — scan can stop', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: true },
        LIMITS
      );
    }
    expect(isMainOverviewAccumulatorSatisfied(acc, LIMITS)).toBe(true);
  });
});

describe('finalizeMainOverviewHasMore', () => {
  it('leaves hasMore false for a category under its limit, even if the scan did not exhaust the community (satisfied-early stop, not cap truncation)', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('a'), isInPersonalCalendar: true, isPendingRsvp: false },
      LIMITS
    );
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(false);
  });

  it('conservatively sets hasMore when a category is exactly at its limit and the scan did not exhaust every event (satisfied-early stop)', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    // scanExhausted=false: we don't actually know whether a 3rd matching
    // event exists beyond what we scanned — prefer the bounded signal.
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(true);
  });

  // 5. scan exhausted + category below limit → hasMore false
  it('does NOT set hasMore when a category is exactly at its limit but the scan exhausted every upcoming event', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    // scanExhausted=true: the index scan reached the end of the
    // community's upcoming events — there is provably nothing more.
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: true,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(false);
  });

  // 1. scan exhausted + zero myEvents → myEventsHasMore false
  it('does NOT set hasMore for a category with zero matches when the scan genuinely exhausted every upcoming event', () => {
    const acc = createMainOverviewAccumulator<FakeEvent>();
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: true,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(false);
    expect(finalized.pendingRsvpHasMore).toBe(false);
  });

  // 2. scan truncated by cap + zero myEvents → myEventsHasMore true
  // This is the Stage 2A scale-edge-case regression: a match sitting past
  // the 160-event scan cap (e.g. scan position ~170) must never be reported
  // as "no events" just because zero matches were found within the capped
  // window — hitting the cap while `!isDone` is proof of nothing.
  it('sets hasMore true for a category with ZERO matches when the scan was truncated by the safety cap (not exhausted)', () => {
    const acc = createMainOverviewAccumulator<FakeEvent>();
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: true,
    });
    expect(finalized.myEvents).toEqual([]);
    expect(finalized.myEventsHasMore).toBe(true);
  });

  // 3. scan truncated + myEvents below limit → myEventsHasMore true
  it('sets hasMore true for a category BELOW its limit (but not zero) when the scan was truncated by the safety cap', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('a'), isInPersonalCalendar: true, isPendingRsvp: false },
      LIMITS
    );
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: true,
    });
    expect(finalized.myEvents).toEqual([ev('a')]);
    expect(finalized.myEventsHasMore).toBe(true);
  });

  // 4. scan truncated + zero pending RSVP → pendingRsvpHasMore true
  it('sets hasMore true for pendingRsvpEvents with zero matches when the scan was truncated by the safety cap', () => {
    const acc = createMainOverviewAccumulator<FakeEvent>();
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: true,
    });
    expect(finalized.pendingRsvpEvents).toEqual([]);
    expect(finalized.pendingRsvpHasMore).toBe(true);
  });

  it('scanTruncated applies to BOTH categories unconditionally, even when one category is fully satisfied and the other is empty', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: true,
    });
    expect(finalized.myEventsHasMore).toBe(true);
    expect(finalized.pendingRsvpEvents).toEqual([]);
    expect(finalized.pendingRsvpHasMore).toBe(true);
  });

  // 6. existing full-category overflow behavior remains correct
  it('preserves an already-true hasMore flag set mid-scan regardless of scanExhausted/scanTruncated', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    for (const id of ['a', 'b', 'c']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    expect(acc.myEventsHasMore).toBe(true);
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: true,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(true);
  });

  it('finalizes myEvents and pendingRsvp independently (satisfied-early stop)', () => {
    let acc = createMainOverviewAccumulator<FakeEvent>();
    // Only myEvents reaches its limit; pendingRsvp stays under.
    for (const id of ['a', 'b']) {
      acc = accumulateMainOverviewCandidate(
        acc,
        { item: ev(id), isInPersonalCalendar: true, isPendingRsvp: false },
        LIMITS
      );
    }
    acc = accumulateMainOverviewCandidate(
      acc,
      { item: ev('p1'), isInPersonalCalendar: false, isPendingRsvp: true },
      LIMITS
    );
    const finalized = finalizeMainOverviewHasMore(acc, LIMITS, {
      scanExhausted: false,
      scanTruncated: false,
    });
    expect(finalized.myEventsHasMore).toBe(true);
    expect(finalized.pendingRsvpHasMore).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// BUG FIX (manual QA) — all-day community event missing from Community
// Main. Root cause: listCommunityMainOverview / listCommunityAdditionalEventsPaged
// scoped their scan with a plain `startTime >= now` check, but an all-day
// event's `startTime` is stamped at LOCAL MIDNIGHT of its calendar day —
// almost always in the past relative to "now" once any time has elapsed
// that day — so it was silently excluded for its entire day, even though
// it correctly appears on Home (which scopes by day-range, not instant).
// isEventStartTimeEligibleForUpcomingScan is the extracted pure fix.
// ─────────────────────────────────────────────────────────────
describe('isEventStartTimeEligibleForUpcomingScan — BUG FIX (manual QA)', () => {
  const now = new Date(2026, 7, 15, 14, 0, 0, 0).getTime(); // Aug 15, 2026 14:00

  it('an all-day event stamped at TODAY local midnight (in the past relative to now) is eligible', () => {
    const startTime = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    expect(
      isEventStartTimeEligibleForUpcomingScan({ allDay: true, startTime }, now)
    ).toBe(true);
  });

  it('an all-day event stamped at TOMORROW local midnight is eligible', () => {
    const startTime = new Date(2026, 7, 16, 0, 0, 0, 0).getTime();
    expect(
      isEventStartTimeEligibleForUpcomingScan({ allDay: true, startTime }, now)
    ).toBe(true);
  });

  it('an all-day event from a previous day is still eligible here — "has it ended" is deferred to the client (hasEventEndedByNow), never decided in this scan-bound check', () => {
    const startTime = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();
    expect(
      isEventStartTimeEligibleForUpcomingScan({ allDay: true, startTime }, now)
    ).toBe(true);
  });

  it('a TIMED event that has not started yet remains eligible (existing behavior unchanged)', () => {
    const startTime = now + 60 * 60 * 1000; // 1h from now
    expect(
      isEventStartTimeEligibleForUpcomingScan({ allDay: false, startTime }, now)
    ).toBe(true);
  });

  it('a TIMED event that already started is NOT eligible (existing behavior unchanged)', () => {
    const startTime = now - 60 * 60 * 1000; // 1h ago
    expect(
      isEventStartTimeEligibleForUpcomingScan({ allDay: false, startTime }, now)
    ).toBe(false);
  });

  it('a TIMED event with no explicit allDay flag behaves like a timed event', () => {
    const startTime = now - 60 * 60 * 1000;
    expect(isEventStartTimeEligibleForUpcomingScan({ startTime }, now)).toBe(
      false
    );
  });

  it('RSVP/personal-calendar classification for an all-day event is identical to its timed equivalent — computeCommunityEventPersonalCalendarState never takes allDay as an input at all, so this bug fix cannot change participation classification', () => {
    // Same personal-calendar-relevant facts describe BOTH an all-day and a
    // timed version of "this event" (allDay only ever affects
    // startTime/endTime, which this pure classifier never sees).
    const allDayEventFacts = {
      isCreator: false,
      autoAddEnabled: true,
      requiresRsvp: true,
      rsvpStatus: 'maybe' as const,
      hasActiveSave: false,
      hasOptOut: false,
    };
    const timedEventFacts = { ...allDayEventFacts };
    expect(
      computeCommunityEventPersonalCalendarState(allDayEventFacts)
    ).toEqual(computeCommunityEventPersonalCalendarState(timedEventFacts));
    expect(
      computeCommunityEventPersonalCalendarState(allDayEventFacts)
        .isInPersonalCalendar
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// FOLLOW-UP FIX — replaces the previous flat `now - 48h` server-side scan
// lower bound (in listCommunityMainOverview / listCommunityAdditionalEventsPaged)
// with the caller-supplied `localDayStart` (client-computed device-local
// midnight — see lib/eventsTabDateHelpers.ts's getLocalDayStart). The
// actual server behavior is the CONJUNCTION of two independent checks:
//   1. the indexed scan's lower bound: `event.startTime >= localDayStart`
//      (previously `event.startTime >= now - 48h`)
//   2. isEventStartTimeEligibleForUpcomingScan(event, now) — unchanged
// This suite models that conjunction directly (no query runtime available
// in a unit test) to prove yesterday's all-day events can no longer reach
// step 2 at all — they are excluded at the indexed-scan boundary, so they
// never consume Main's accumulator slots or Additional Events' pagination
// rows, unlike the previous 48h-lookback behavior.
// ─────────────────────────────────────────────────────────────
describe('Main Overview / Additional Events scan window — localDayStart lower bound (FOLLOW-UP FIX)', () => {
  // Aug 15, 2026, 14:00 local — several hours into "today".
  const now = new Date(2026, 7, 15, 14, 0, 0, 0).getTime();
  const localDayStart = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();

  function isReachedByServerScan(event: {
    allDay?: boolean;
    startTime: number;
  }): boolean {
    return (
      event.startTime >= localDayStart &&
      isEventStartTimeEligibleForUpcomingScan(event, now)
    );
  }

  it('all-day TODAY (startTime === localDayStart) is included', () => {
    expect(
      isReachedByServerScan({ allDay: true, startTime: localDayStart })
    ).toBe(true);
  });

  it('all-day TODAY after several hours have elapsed (startTime < now but >= localDayStart) is included', () => {
    expect(
      isReachedByServerScan({ allDay: true, startTime: localDayStart })
    ).toBe(true);
  });

  it('all-day TOMORROW is included', () => {
    const startTime = new Date(2026, 7, 16, 0, 0, 0, 0).getTime();
    expect(isReachedByServerScan({ allDay: true, startTime })).toBe(true);
  });

  it('all-day YESTERDAY (startTime < localDayStart) is excluded — cannot consume scan/accumulator/pagination capacity', () => {
    const startTime = new Date(2026, 7, 14, 0, 0, 0, 0).getTime();
    expect(isReachedByServerScan({ allDay: true, startTime })).toBe(false);
  });

  it('a TIMED future event (startTime >= now) is included, unchanged', () => {
    const startTime = now + 60 * 60 * 1000;
    expect(isReachedByServerScan({ allDay: false, startTime })).toBe(true);
  });

  it('a TIMED event earlier today (localDayStart <= startTime < now) is excluded — never made eligible merely by localDayStart', () => {
    const startTime = new Date(2026, 7, 15, 9, 0, 0, 0).getTime(); // 09:00 today
    expect(isReachedByServerScan({ allDay: false, startTime })).toBe(false);
  });

  it('the exact localDayStart boundary is included for an all-day event', () => {
    expect(
      isReachedByServerScan({ allDay: true, startTime: localDayStart })
    ).toBe(true);
  });

  it('a timed event exactly at localDayStart (but before now) is excluded — timed eligibility is unaffected by the new lower bound', () => {
    expect(
      isReachedByServerScan({ allDay: false, startTime: localDayStart })
    ).toBe(false);
  });

  it('a timed event exactly at "now" is included — boundary unchanged from before this fix', () => {
    expect(isReachedByServerScan({ allDay: false, startTime: now })).toBe(true);
  });
});
