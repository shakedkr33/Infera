/**
 * Tests for Stage 4 — Community "תזכורות" tab: EVENT-BASED "חשוב לזכור"
 * groups.
 *
 * Covers the pure, DB-independent eligibility + batch-filter helpers added
 * to communityCalendarState.ts for
 * events.listCommunityEventReminderGroupsPaged:
 *   - isEventImportantItemsGroupEligible
 *   - filterEventsEligibleForReminderGroups
 *
 * The actual bounded-index scan (`.withIndex('by_community_date', ...)`)
 * cannot be unit-tested without a Convex test harness (same precedent as
 * eventScaleBounding.test.ts / mainOverviewAccumulator.test.ts) — this repo
 * only unit-tests the pure helpers and verifies the query's bounding /
 * sparse-page contract by code review (see the Stage 4 report).
 *
 * "Has this event ended" (all-day boundary / ended-event exclusion) is
 * intentionally decided client-side via lib/eventsTabDateHelpers's
 * hasEventEndedByNow (already covered by eventsTabDateHelpers.test.ts) —
 * see communityCalendarState.ts's isEventImportantItemsGroupEligible doc
 * comment for why. This file additionally exercises that exact helper
 * directly to cover the Stage 4 prompt's required scenarios #13/#15
 * end-to-end (eligible-by-personal-calendar, but excluded once ended).
 */

import { describe, expect, it } from 'bun:test';
import {
  filterEventsEligibleForReminderGroups,
  isEventImportantItemsGroupEligible,
} from '../../convex/communityCalendarState';
import { hasEventEndedByNow } from '../../lib/eventsTabDateHelpers';

const ITEM_A = { id: 'a', title: 'כובע' };
const ITEM_B = { id: 'b', title: 'בקבוק מים' };
const ITEM_C = { id: 'c', title: 'נעליים סגורות' };

describe('isEventImportantItemsGroupEligible', () => {
  it('[#1] personally included event with important items → eligible', () => {
    expect(
      isEventImportantItemsGroupEligible({
        importantItemsCount: 3,
        isCancelled: false,
        isInPersonalCalendar: true,
      })
    ).toBe(true);
  });

  it('[#2] event not personally included → not eligible', () => {
    expect(
      isEventImportantItemsGroupEligible({
        importantItemsCount: 3,
        isCancelled: false,
        isInPersonalCalendar: false,
      })
    ).toBe(false);
  });

  it('[#10] event with zero important items → no reminder group, even if personally included', () => {
    expect(
      isEventImportantItemsGroupEligible({
        importantItemsCount: 0,
        isCancelled: false,
        isInPersonalCalendar: true,
      })
    ).toBe(false);
  });

  it('[#14] cancelled event → not eligible even if personally included', () => {
    expect(
      isEventImportantItemsGroupEligible({
        importantItemsCount: 3,
        isCancelled: true,
        isInPersonalCalendar: true,
      })
    ).toBe(false);
  });
});

type FakeEvent = {
  _id: string;
  createdBy: string;
  status?: 'active' | 'cancelled';
  requiresRsvp?: boolean;
  importantItems?: Array<{ id: string; title: string }>;
};

const VIEWER = 'user_viewer';
const OTHER_USER = 'user_other';

function makeEvent(overrides: Partial<FakeEvent> & { _id: string }): FakeEvent {
  return {
    createdBy: OTHER_USER,
    status: 'active',
    requiresRsvp: false,
    importantItems: [ITEM_A],
    ...overrides,
  };
}

describe('filterEventsEligibleForReminderGroups — Stage 4 eligibility matrix', () => {
  const noSignals = {
    autoAddEnabled: false,
    savedIds: new Set<string>(),
    optOutIds: new Set<string>(),
  };

  it('[#1] personally included via active save + important items → eligible group', () => {
    const events = [
      makeEvent({ _id: 'e1', importantItems: [ITEM_A, ITEM_B, ITEM_C] }),
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      { ...noSignals, savedIds: new Set(['e1']) }
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#2] event not personally included (no auto-add/save/rsvp/creator) → not eligible', () => {
    const events = [makeEvent({ _id: 'e1' })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      noSignals
    );
    expect(result).toEqual([]);
  });

  it('[#3] Auto-Add ON → eligible', () => {
    const events = [makeEvent({ _id: 'e1' })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      { ...noSignals, autoAddEnabled: true }
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#4] explicit opt-out + Auto-Add ON → not eligible (opt-out always wins)', () => {
    const events = [makeEvent({ _id: 'e1' })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      {
        ...noSignals,
        autoAddEnabled: true,
        optOutIds: new Set(['e1']),
      }
    );
    expect(result).toEqual([]);
  });

  it('[#5] RSVP yes on an RSVP-required event → eligible', () => {
    const events = [makeEvent({ _id: 'e1', requiresRsvp: true })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map([['e1', 'yes']]),
      noSignals
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#6] RSVP maybe on an RSVP-required event → eligible', () => {
    const events = [makeEvent({ _id: 'e1', requiresRsvp: true })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map([['e1', 'maybe']]),
      noSignals
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#7] creator → eligible even with no other signal', () => {
    const events = [
      makeEvent({ _id: 'e1', createdBy: VIEWER, requiresRsvp: true }),
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      noSignals
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#8] owner/admin role alone is NOT a reason — not eligible (no isCreator/autoAdd/save/rsvp signal)', () => {
    // Role-based bypass is intentionally not modeled here at all — the
    // helper only ever receives isCreator/autoAddEnabled/hasActiveSave/
    // rsvpStatus/hasOptOut, matching Stage 1D's removal of any
    // owner/admin personal-calendar bypass. A non-creator owner/admin
    // with none of those signals must resolve not-eligible.
    const events = [makeEvent({ _id: 'e1', requiresRsvp: true })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      noSignals
    );
    expect(result).toEqual([]);
  });

  it('[#9] RSVP = no + Auto-Add ON on the same event → still eligible (personally included via auto-add)', () => {
    const events = [makeEvent({ _id: 'e1', requiresRsvp: true })];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map([['e1', 'no']]),
      { ...noSignals, autoAddEnabled: true }
    );
    expect(result.map((e) => e._id)).toEqual(['e1']);
  });

  it('[#10] event with zero important items → excluded even when personally included', () => {
    const events = [
      makeEvent({ _id: 'e1', importantItems: [] }),
      makeEvent({ _id: 'e2', importantItems: undefined }),
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      { ...noSignals, autoAddEnabled: true }
    );
    expect(result).toEqual([]);
  });

  it('[#11] multiple important items on the same event stay on ONE event entry (no per-item fan-out)', () => {
    const events = [
      makeEvent({ _id: 'e1', importantItems: [ITEM_A, ITEM_B, ITEM_C] }),
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      { ...noSignals, autoAddEnabled: true }
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.importantItems).toHaveLength(3);
  });

  it('[#12] multiple eligible events → separate groups, ineligible ones excluded', () => {
    const events = [
      makeEvent({ _id: 'e1', importantItems: [ITEM_A] }), // eligible via auto-add
      makeEvent({ _id: 'e2', importantItems: [] }), // no items → excluded
      makeEvent({ _id: 'e3', createdBy: VIEWER, importantItems: [ITEM_B] }), // eligible via creator
      makeEvent({
        _id: 'e4',
        importantItems: [ITEM_C],
        status: 'cancelled',
      }), // cancelled → excluded
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      { ...noSignals, autoAddEnabled: true }
    );
    expect(result.map((e) => e._id)).toEqual(['e1', 'e3']);
  });

  it('[#14] cancelled event → excluded even when otherwise personally included', () => {
    const events = [
      makeEvent({ _id: 'e1', createdBy: VIEWER, status: 'cancelled' }),
    ];
    const result = filterEventsEligibleForReminderGroups(
      events,
      VIEWER,
      new Map(),
      noSignals
    );
    expect(result).toEqual([]);
  });
});

describe('event-ended exclusion (client-side hasEventEndedByNow) — Stage 4 #13/#15', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0, 0).getTime(); // Aug 15, 2026 12:00

  it('[#13] an ended timed event is excluded from the active Reminders tab', () => {
    const endTime = new Date(2026, 7, 15, 10, 0, 0, 0).getTime();
    const group = { startTime: endTime - 3_600_000, endTime, allDay: false };
    expect(hasEventEndedByNow(group, now)).toBe(true);
  });

  it('[#13] an ongoing (not yet ended) timed event remains active', () => {
    const endTime = new Date(2026, 7, 15, 18, 0, 0, 0).getTime();
    const group = { startTime: endTime - 3_600_000, endTime, allDay: false };
    expect(hasEventEndedByNow(group, now)).toBe(false);
  });

  it('[#15] an all-day event earlier today has NOT ended (relevance boundary = end of local day)', () => {
    const startTime = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    const group = { startTime, endTime: startTime, allDay: true };
    expect(hasEventEndedByNow(group, now)).toBe(false);
  });

  it('[#15] an all-day event from a previous day has ended', () => {
    const startTime = new Date(2026, 7, 14, 0, 0, 0, 0).getTime();
    const group = { startTime, endTime: startTime, allDay: true };
    expect(hasEventEndedByNow(group, now)).toBe(true);
  });
});
