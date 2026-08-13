/**
 * STAGE 4 FINAL BEHAVIOR-ALIGNMENT PASS — pure-helper coverage.
 *
 * "חשוב לזכור" is event CONTENT, not a task/checklist — checkboxes now
 * exist ONLY on the personal task/subtasks copy created via
 * "הוסף למשימות שלי". This file covers the DB-independent pieces of that
 * model plus the two lifecycle rules introduced in this pass:
 *
 *   PART F/G/I — isEventEligibleForHomeImportantItemsPreview: the Home
 *     "חשוב לזכור" preview + "הוסף למשימות שלי" action must disappear once
 *     the source event has ended/is cancelled, reusing the exact same
 *     canonical `hasEventEndedByNow` rule already used to drop ended events
 *     from the community "תזכורות" → "מאירועים" grouped cards.
 *
 *   PART H2/H3 — isTaskPastDue (see taskDueStatus.test.ts for the full
 *     matrix): a standalone general community reminder whose real due
 *     timestamp has passed must drop out of the active "מהקהילה" section.
 *
 * Convex mutations/queries (events.update, tasks.addEventImportantItemsToMyTasks,
 * tasks.listCommunityRemindersPaged) reuse existing, already-authorized code
 * paths and are exercised via manual QA rather than a new Convex test
 * harness, per "do not introduce a heavy new testing framework."
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import { canManageEventReminderItem } from '../../lib/eventReminderPermissions';
import { isEventEligibleForHomeImportantItemsPreview } from '../../lib/homeImportantItemsPreview';
import { isTaskPastDue } from '../../lib/taskDueStatus';

describe('isEventEligibleForHomeImportantItemsPreview — PART F/G/I event-end lifecycle', () => {
  it('[#18] active/upcoming timed event → eligible', () => {
    const now = new Date(2026, 0, 15, 10, 0, 0, 0).getTime();
    const startTime = new Date(2026, 0, 15, 18, 0, 0, 0).getTime();
    const endTime = new Date(2026, 0, 15, 20, 0, 0, 0).getTime();
    expect(
      isEventEligibleForHomeImportantItemsPreview({ startTime, endTime }, now)
    ).toBe(true);
  });

  it('[#19] ended timed event (endTime passed) → NOT eligible', () => {
    const startTime = new Date(2026, 0, 15, 9, 0, 0, 0).getTime();
    const endTime = new Date(2026, 0, 15, 10, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 15, 0, 0, 0).getTime();
    expect(
      isEventEligibleForHomeImportantItemsPreview({ startTime, endTime }, now)
    ).toBe(false);
  });

  it('[#19] all-day event on a past day → NOT eligible', () => {
    const startTime = new Date(2026, 0, 14, 0, 0, 0, 0).getTime();
    const endTime = new Date(2026, 0, 14, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
    expect(
      isEventEligibleForHomeImportantItemsPreview(
        { startTime, endTime, allDay: true },
        now
      )
    ).toBe(false);
  });

  it("all-day event still today (before day's end) → eligible", () => {
    const startTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    const endTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 20, 0, 0, 0).getTime();
    expect(
      isEventEligibleForHomeImportantItemsPreview(
        { startTime, endTime, allDay: true },
        now
      )
    ).toBe(true);
  });
});

describe('isTaskPastDue — PART H2/H3 active general-reminder lifecycle (reuse coverage)', () => {
  it('[#13] incomplete active standalone reminder due later today → active-eligible', () => {
    const dueAt = new Date(2026, 0, 15, 20, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 9, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueAt }, now)).toBe(false);
  });

  it('[#16] reminder with a real due timestamp that has passed → NOT active', () => {
    const dueAt = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 16, 8, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueAt }, now)).toBe(true);
  });

  it('[#17] reminder due in the future → active', () => {
    const dueDate = new Date(2026, 0, 20, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueDate }, now)).toBe(false);
  });

  it('undated reminder ("ללא תאריך") never expires by date, regardless of age', () => {
    const now = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
    const muchLater = now + 90 * 24 * 60 * 60 * 1000;
    expect(isTaskPastDue({}, muchLater)).toBe(false);
  });
});

describe('canManageEventReminderItem — PART B/J reused for Event Details manager delete (future AND past events)', () => {
  it('a past event does not change the authorization rule — creator can still manage', () => {
    // canManageEventReminderItem has no time/date parameter at all — it is
    // purely identity/role-based, so it is inherently correct for both
    // future and past events without any extra "is this event over" gate.
    expect(
      canManageEventReminderItem({
        currentUserId: 'creator-1',
        eventCreatedBy: 'creator-1',
        myRole: 'member',
      })
    ).toBe(true);
  });

  it('a normal member cannot manage a past event either', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'member-1',
        eventCreatedBy: 'creator-1',
        myRole: 'member',
      })
    ).toBe(false);
  });
});
