/**
 * FIX C — tests for the pure decision helpers behind the Community Event
 * cancellation/early-removal feature:
 *
 *   - isCancelledEventWithinCommunityVisibilityWindow
 *     (lib/eventsTabDateHelpers.ts) — the single shared 24-hour boundary
 *     rule used by BOTH the UI (community/[id].tsx's "אירועים שבוטלו"
 *     filter, EventDetailsBottomSheet.tsx / event/[id].tsx's early-removal
 *     action gate) and the server
 *     (events.removeCancelledCommunityEvent, via
 *     resolveCommunityEventEarlyRemovalVerdict below).
 *
 *   - resolveCommunityEventEarlyRemovalVerdict
 *     (convex/communityCalendarState.ts) — the exact eligibility/
 *     authorization rule behind `events.removeCancelledCommunityEvent`.
 *     The mutation handler does nothing but resolve `event` and
 *     `canManage` from the database and hand them to this function
 *     unchanged (same precedent as `resolveDuplicationSourceVerdict`) — so
 *     every authorization/eligibility case can be verified here without a
 *     Convex mutation test harness (none exists in this repo — see
 *     eventScaleBounding.test.ts's precedent, which documents the same
 *     constraint for `getTaskCountsForEvents`).
 *
 * `canManage` itself (creator OR active community owner/admin) is derived
 * from the database inside the mutation handler using the exact same
 * `isActiveCommunityMember` + role-check pattern every other Community
 * Event management mutation in convex/events.ts already uses (cancelEvent,
 * update, the now-hardened deleteEvent) — this file does not re-implement
 * or test that DB-dependent membership resolution separately, only the
 * pure verdict function that consumes its boolean result. Manual code
 * review confirms the handler:
 *   - loads `event` via `ctx.db.get`
 *   - computes `canManage` via `isActiveCommunityMember(membership) &&
 *     (isCreator || isOwnerOrAdmin)` for a Community Event, else `false`
 *   - passes both, plus `Date.now()`, to
 *     `resolveCommunityEventEarlyRemovalVerdict` unchanged
 * — so a non-member/inactive-member/regular-member can never satisfy
 * `canManage`, exactly like every other management mutation in this file.
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import type { Id } from '../../convex/_generated/dataModel';
import {
  isCancelledEventRemovedFromCommunityDisplay,
  isRecentCancelledCommunityEventEligible,
  resolveCommunityEventEarlyRemovalVerdict,
  selectRecentCancelledCommunityEvents,
} from '../../convex/communityCalendarState';
import {
  CANCELLED_COMMUNITY_EVENT_VISIBILITY_WINDOW_MS,
  isCancelledEventWithinCommunityVisibilityWindow,
} from '../../lib/eventsTabDateHelpers';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('isCancelledEventWithinCommunityVisibilityWindow — shared 24h boundary (UI + backend)', () => {
  const now = 1_000_000_000_000; // arbitrary fixed instant

  it('is false when cancelledAt is undefined', () => {
    expect(
      isCancelledEventWithinCommunityVisibilityWindow(undefined, now)
    ).toBe(false);
  });

  it('is true just before the 24h boundary (23h59m59.999s elapsed)', () => {
    const cancelledAt = now - (DAY_MS - 1);
    expect(
      isCancelledEventWithinCommunityVisibilityWindow(cancelledAt, now)
    ).toBe(true);
  });

  it('is false at exactly the 24h boundary (elapsed === window)', () => {
    const cancelledAt = now - DAY_MS;
    expect(
      isCancelledEventWithinCommunityVisibilityWindow(cancelledAt, now)
    ).toBe(false);
  });

  it('is false just after the 24h boundary (24h + 1ms elapsed)', () => {
    const cancelledAt = now - (DAY_MS + 1);
    expect(
      isCancelledEventWithinCommunityVisibilityWindow(cancelledAt, now)
    ).toBe(false);
  });

  it('is true immediately after cancellation (0ms elapsed)', () => {
    expect(isCancelledEventWithinCommunityVisibilityWindow(now, now)).toBe(
      true
    );
  });

  it('exposes the window constant as exactly 24 hours', () => {
    expect(CANCELLED_COMMUNITY_EVENT_VISIBILITY_WINDOW_MS).toBe(DAY_MS);
  });
});

describe('isCancelledEventRemovedFromCommunityDisplay — events.listCommunityEventsTabPaged data-source filter', () => {
  it('excludes a cancelled event that was early-removed from Community display', () => {
    expect(
      isCancelledEventRemovedFromCommunityDisplay({
        status: 'cancelled',
        removedFromCommunityAt: 123,
      })
    ).toBe(true);
  });

  it('keeps a cancelled event visible during its 24h window when it has NOT been removed', () => {
    expect(
      isCancelledEventRemovedFromCommunityDisplay({
        status: 'cancelled',
        removedFromCommunityAt: undefined,
      })
    ).toBe(false);
  });

  it('never hides an active (non-cancelled) event, even if removedFromCommunityAt were somehow set', () => {
    expect(
      isCancelledEventRemovedFromCommunityDisplay({
        status: 'active',
        removedFromCommunityAt: 123,
      })
    ).toBe(false);
  });

  it('never hides an event with no status field (legacy/never-cancelled data)', () => {
    expect(
      isCancelledEventRemovedFromCommunityDisplay({
        status: undefined,
        removedFromCommunityAt: undefined,
      })
    ).toBe(false);
  });
});

describe('resolveCommunityEventEarlyRemovalVerdict — events.removeCancelledCommunityEvent eligibility', () => {
  const now = 1_000_000_000_000;
  const communityId = 'community_1' as never;

  function baseEvent(overrides: {
    communityId?: unknown;
    status?: 'active' | 'cancelled';
    cancelledAt?: number;
    removedFromCommunityAt?: number;
  }) {
    return {
      communityId,
      status: 'cancelled' as const,
      cancelledAt: now - HOUR_MS,
      removedFromCommunityAt: undefined,
      ...overrides,
    };
  }

  it('returns "not_found" when the event does not exist', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: null,
        canManage: true,
        now,
      })
    ).toBe('not_found');
  });

  it('returns "not_community_event" for a Personal Event, even for its own creator (canManage true would never happen for a personal event via the real handler, but the pure rule itself must still reject it)', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: {
          communityId: undefined,
          status: 'cancelled',
          cancelledAt: now - HOUR_MS,
          removedFromCommunityAt: undefined,
        },
        canManage: true,
        now,
      })
    ).toBe('not_community_event');
  });

  it('returns "forbidden" for a regular (non-owner/admin, non-creator) community member', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({}),
        canManage: false,
        now,
      })
    ).toBe('forbidden');
  });

  it('returns "forbidden" for an inactive/non-member — even with a crafted request carrying a valid eventId', () => {
    // The mutation handler always resolves `canManage: false` for a
    // non-member/inactive-member, regardless of what the event itself
    // looks like — modeled here directly via canManage: false.
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({}),
        canManage: false,
        now,
      })
    ).toBe('forbidden');
  });

  it('returns "not_cancelled" for an active (non-cancelled) Community Event, even for its creator/owner/admin', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ status: 'active', cancelledAt: undefined }),
        canManage: true,
        now,
      })
    ).toBe('not_cancelled');
  });

  it('returns "missing_cancelled_at" for a cancelled event with no cancelledAt (defensive — should never occur via cancelEvent, but must not throw unpredictably)', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ cancelledAt: undefined }),
        canManage: true,
        now,
      })
    ).toBe('missing_cancelled_at');
  });

  it('returns "ok" for the event creator, within the 24h window', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({}),
        canManage: true,
        now,
      })
    ).toBe('ok');
  });

  it('returns "ok" for an owner/admin who did not create the event, within the 24h window', () => {
    // canManage: true here models "active owner/admin" exactly the same
    // way as "creator" — resolveCommunityEventEarlyRemovalVerdict does not
    // distinguish between the two reasons, matching the product rule that
    // both are equally authorized (see the mutation handler's canManage
    // derivation: isCreator || isOwnerOrAdmin).
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({}),
        canManage: true,
        now,
      })
    ).toBe('ok');
  });

  it('returns "ok" just before the 24h boundary (23h59m59.999s since cancellation)', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ cancelledAt: now - (DAY_MS - 1) }),
        canManage: true,
        now,
      })
    ).toBe('ok');
  });

  it('returns "window_expired" at exactly the 24h boundary', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ cancelledAt: now - DAY_MS }),
        canManage: true,
        now,
      })
    ).toBe('window_expired');
  });

  it('returns "window_expired" after the 24h boundary (24h + 1ms since cancellation)', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ cancelledAt: now - (DAY_MS + 1) }),
        canManage: true,
        now,
      })
    ).toBe('window_expired');
  });

  it('returns "already_removed" for an event already removed from Community display, even while still inside the 24h window (idempotent — the mutation handler treats this as a no-op success, not an error)', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ removedFromCommunityAt: now - 10 }),
        canManage: true,
        now,
      })
    ).toBe('already_removed');
  });

  it('returns "already_removed" (not "window_expired") for an event removed while still in-window but checked again after the window has since expired', () => {
    // Idempotency must win over the window check — the event was validly
    // removed once; re-invoking later must still resolve as a no-op, never
    // an error, regardless of how much time has passed since.
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({
          cancelledAt: now - (DAY_MS + HOUR_MS),
          removedFromCommunityAt: now - HOUR_MS,
        }),
        canManage: true,
        now,
      })
    ).toBe('already_removed');
  });

  it('returns "forbidden" before "already_removed" for an unauthorized caller on an already-removed event — permission is always checked first, never leaking removal state to an unauthorized caller', () => {
    expect(
      resolveCommunityEventEarlyRemovalVerdict({
        event: baseEvent({ removedFromCommunityAt: now - 10 }),
        canManage: false,
        now,
      })
    ).toBe('forbidden');
  });
});

/**
 * FIX C.2 — tests for the pure decision helpers behind
 * `events.listRecentCancelledCommunityEvents` (Community Main's "מה חשוב
 * עכשיו" recent-cancellation candidates):
 *
 *   - isRecentCancelledCommunityEventEligible
 *   - selectRecentCancelledCommunityEvents
 *
 * Both are defined in convex/communityCalendarState.ts and reuse the SAME
 * `isCancelledEventWithinCommunityVisibilityWindow` 24h boundary tested
 * above — never a second definition of the window.
 */
describe('isRecentCancelledCommunityEventEligible — FIX C.2 recent-cancellation eligibility', () => {
  const now = 1_000_000_000_000;
  const communityId = 'community_1' as Id<'communities'>;
  const otherCommunityId = 'community_2' as Id<'communities'>;

  function baseEvent(overrides: {
    communityId?: Id<'communities'>;
    status?: 'active' | 'cancelled';
    cancelledAt?: number;
    removedFromCommunityAt?: number;
  }) {
    return {
      communityId,
      status: 'cancelled' as const,
      cancelledAt: now - HOUR_MS,
      removedFromCommunityAt: undefined,
      ...overrides,
    };
  }

  it('is eligible just inside the 24h window', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ cancelledAt: now - (DAY_MS - 1) }),
        now,
      })
    ).toBe(true);
  });

  it('is NOT eligible at exactly the 24h boundary', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ cancelledAt: now - DAY_MS }),
        now,
      })
    ).toBe(false);
  });

  it('is NOT eligible after the 24h boundary', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ cancelledAt: now - (DAY_MS + 1) }),
        now,
      })
    ).toBe(false);
  });

  it('is NOT eligible when removedFromCommunityAt is set (FIX C early removal parity)', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ removedFromCommunityAt: now - 10 }),
        now,
      })
    ).toBe(false);
  });

  it('is NOT eligible for an active (non-cancelled) event', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ status: 'active', cancelledAt: undefined }),
        now,
      })
    ).toBe(false);
  });

  it('is NOT eligible for a cancelled event with no cancelledAt', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ cancelledAt: undefined }),
        now,
      })
    ).toBe(false);
  });

  it('is NOT eligible when the event belongs to a different community', () => {
    expect(
      isRecentCancelledCommunityEventEligible({
        communityId,
        event: baseEvent({ communityId: otherCommunityId }),
        now,
      })
    ).toBe(false);
  });
});

describe('selectRecentCancelledCommunityEvents — FIX C.2 filter + sort + limit', () => {
  const now = 1_000_000_000_000;
  const communityId = 'community_1' as Id<'communities'>;
  const otherCommunityId = 'community_2' as Id<'communities'>;

  type Candidate = {
    _id: string;
    communityId?: Id<'communities'>;
    status?: 'active' | 'cancelled';
    cancelledAt?: number;
    removedFromCommunityAt?: number;
  };

  function cancelled(
    id: string,
    cancelledAt: number,
    overrides?: Partial<Candidate>
  ): Candidate {
    return {
      _id: id,
      communityId,
      status: 'cancelled',
      cancelledAt,
      removedFromCommunityAt: undefined,
      ...overrides,
    };
  }

  it('excludes cancellations outside the 24h window and orders newest-first', () => {
    const events: Candidate[] = [
      cancelled('older', now - HOUR_MS * 2),
      cancelled('newest', now - HOUR_MS),
      cancelled('expired', now - DAY_MS),
      cancelled('way_expired', now - (DAY_MS + HOUR_MS)),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result.map((e) => e._id)).toEqual(['newest', 'older']);
  });

  it('excludes an event already removed from Community display', () => {
    const events: Candidate[] = [
      cancelled('removed', now - HOUR_MS, { removedFromCommunityAt: now - 10 }),
      cancelled('kept', now - HOUR_MS * 2),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result.map((e) => e._id)).toEqual(['kept']);
  });

  it('excludes active/non-cancelled events', () => {
    const events: Candidate[] = [
      cancelled('active', now - HOUR_MS, {
        status: 'active',
        cancelledAt: undefined,
      }),
      cancelled('cancelled', now - HOUR_MS),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result.map((e) => e._id)).toEqual(['cancelled']);
  });

  it('excludes a cancelled event without cancelledAt', () => {
    const events: Candidate[] = [
      cancelled('missing_cancelled_at', now - HOUR_MS, {
        cancelledAt: undefined,
      }),
      cancelled('has_cancelled_at', now - HOUR_MS),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result.map((e) => e._id)).toEqual(['has_cancelled_at']);
  });

  it('excludes events from a different community', () => {
    const events: Candidate[] = [
      cancelled('other_community', now - HOUR_MS, {
        communityId: otherCommunityId,
      }),
      cancelled('this_community', now - HOUR_MS * 2),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result.map((e) => e._id)).toEqual(['this_community']);
  });

  it('respects the limit even when more eligible cancellations exist', () => {
    const events: Candidate[] = [
      cancelled('a', now - HOUR_MS),
      cancelled('b', now - HOUR_MS * 2),
      cancelled('c', now - HOUR_MS * 3),
      cancelled('d', now - HOUR_MS * 4),
    ];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      2
    );

    expect(result.map((e) => e._id)).toEqual(['a', 'b']);
  });

  it('returns an empty array when nothing is eligible', () => {
    const events: Candidate[] = [cancelled('expired', now - DAY_MS)];

    const result = selectRecentCancelledCommunityEvents(
      events,
      communityId,
      now,
      3
    );

    expect(result).toEqual([]);
  });
});
