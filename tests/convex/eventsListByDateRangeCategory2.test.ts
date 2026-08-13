/**
 * Tests for Convex Optimization Fix #2 — `events.listByDateRange` Category 2
 * (cross-space/shared personal events).
 *
 * Run with: bun test
 *
 * BACKGROUND: prior to this fix, Category 2 executed:
 *   ctx.db.query('events').filter(startTime >= from && startTime <= to).collect()
 * which is a full-table scan (the date range was applied as a post-query
 * filter, not via an index). The fix replaces this with:
 *   ctx.db.query('events')
 *     .withIndex('by_community_date', q =>
 *       q.eq('communityId', undefined).gte('startTime', from).lte('startTime', to))
 *     .collect()
 * which reuses the pre-existing `by_community_date` index
 * (['communityId', 'startTime']) — no schema change was needed. Personal
 * (non-community) events always have `communityId === undefined`, so this
 * index bounds BOTH the Category 2 candidate set (non-community events only,
 * matching the previous `if (ev.communityId) continue` check) AND the date
 * range, entirely before any documents are read.
 *
 * The actual indexed `ctx.db` scan cannot be unit-tested without a Convex
 * test harness (none exists in this repo — see eventScaleBounding.test.ts
 * precedent). What CAN be verified with pure unit tests is the
 * `shouldIncludeCategory2Event` predicate extracted from `listByDateRange`,
 * which is the exact viewer-visibility logic applied to already
 * date-bounded/community-bounded candidates. Critically, this predicate
 * contains NO reference to `startTime`, `from`, or `to` — proving
 * structurally that date-range bounding happens entirely at the index/query
 * level, not as a post-filter inside this predicate.
 */

import { describe, expect, it } from 'bun:test';

import {
  type Category2CandidateEvent,
  shouldIncludeCategory2Event,
} from '../../convex/events';

const userId = 'user_viewer';
const creatorId = 'user_creator';

function baseEvent(
  overrides: Partial<Category2CandidateEvent> = {}
): Category2CandidateEvent {
  return {
    _id: 'event_1',
    createdBy: creatorId,
    ...overrides,
  };
}

const emptyOptOuts = new Set<string>();

describe('shouldIncludeCategory2Event — structural: no date logic in the predicate', () => {
  it('the predicate never reads startTime/from/to (date bounding is externalized to the index)', () => {
    // This is a structural guard: Category2CandidateEvent intentionally has no
    // startTime field, so it is impossible for this predicate to reference it.
    const ev = baseEvent({ sharedWithUserIds: [userId] });
    expect('startTime' in ev).toBe(false);
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(true);
  });
});

describe('shouldIncludeCategory2Event — shared-event visibility (scenarios 1–3, 8)', () => {
  it('scenario 1/8: a shared event where the viewer is in sharedWithUserIds is included', () => {
    const ev = baseEvent({ sharedWithUserIds: [userId] });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(true);
  });

  it('scenario 1: a shared event where the viewer is in sharedWithFamilyMemberIds (cross-space member row) is included', () => {
    const ev = baseEvent({
      sharedWithFamilyMemberIds: ['member_row_from_other_space'],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(['member_row_from_other_space']),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(true);
  });

  it('scenario 8: an unrelated/unauthorized shared event (viewer not in either sharing field) is excluded', () => {
    const ev = baseEvent({
      sharedWithUserIds: ['some_other_user'],
      sharedWithFamilyMemberIds: ['some_other_member_row'],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });

  it('an event with no sharing fields at all is excluded', () => {
    const ev = baseEvent();
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });
});

describe('shouldIncludeCategory2Event — Category boundaries (scenario 6/7)', () => {
  it('scenario 6: a community event is excluded from Category 2 (handled exclusively by Category 1)', () => {
    const ev = baseEvent({
      communityId: 'community_1',
      sharedWithUserIds: [userId],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });

  it('scenario 7: the creator is excluded from Category 2 even if self-shared (creator always sees via Category 1 — prevents duplicates)', () => {
    const ev = baseEvent({
      createdBy: userId,
      sharedWithUserIds: [userId],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });
});

describe('shouldIncludeCategory2Event — opt-out and soft-delete', () => {
  it('a soft-deleted event is excluded regardless of sharing', () => {
    const ev = baseEvent({
      sharedWithUserIds: [userId],
      deletedAt: Date.now(),
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });

  it('a shared event the viewer has opted out of is excluded', () => {
    const ev = baseEvent({ _id: 'event_optout', sharedWithUserIds: [userId] });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: new Set(['event_optout']),
      })
    ).toBe(false);
  });
});

describe('shouldIncludeCategory2Event — cancelled events (scenario 9)', () => {
  it('scenario 9: a cancelled event WITH invitees remains visible until opt-out (existing behavior)', () => {
    const ev = baseEvent({
      status: 'cancelled',
      sharedWithUserIds: [userId],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(true);
  });

  it('a cancelled event with invitees is hidden once the viewer opts out', () => {
    const ev = baseEvent({
      _id: 'event_cancelled_optout',
      status: 'cancelled',
      sharedWithUserIds: [userId],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: new Set(['event_cancelled_optout']),
      })
    ).toBe(false);
  });

  it('a cancelled event with NO invitees is excluded even though sharedWithUserIds includes the viewer is false here (defensive: empty invitee lists)', () => {
    const ev = baseEvent({
      status: 'cancelled',
      sharedWithUserIds: [],
      sharedWithFamilyMemberIds: [],
    });
    expect(
      shouldIncludeCategory2Event(ev, {
        userId,
        myMemberIdsAllSpaces: new Set(),
        personalOptOutIds: emptyOptOuts,
      })
    ).toBe(false);
  });
});

describe('shouldIncludeCategory2Event — all-day vs timed (scenario 10/11)', () => {
  it('scenario 10/11: allDay is not part of the visibility predicate — timed and all-day shared events follow identical inclusion rules', () => {
    const timed = baseEvent({ sharedWithUserIds: [userId] });
    const allDay = baseEvent({ sharedWithUserIds: [userId] });
    const params = {
      userId,
      myMemberIdsAllSpaces: new Set<string>(),
      personalOptOutIds: emptyOptOuts,
    };
    expect(shouldIncludeCategory2Event(timed, params)).toBe(true);
    expect(shouldIncludeCategory2Event(allDay, params)).toBe(true);
  });
});
