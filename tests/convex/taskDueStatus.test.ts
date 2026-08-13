/**
 * taskDueStatus — real reminder due-timestamp + "past due" predicate.
 *
 * Covers the STAGE 4 ALIGNMENT PART H3 requirement: standalone general
 * community reminders whose real due timestamp (dueAt when hasTime, else
 * end-of-day of dueDate) has passed must be excluded from the active
 * Community "תזכורות" tab — while reminders with no date at all ("ללא
 * תאריך") must NEVER be treated as past-due, since there is no reliable
 * timestamp to compare.
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import {
  dayEnd,
  getEffectiveTaskDueTimestamp,
  isTaskPastDue,
} from '../../lib/taskDueStatus';

describe('dayEnd', () => {
  it('returns 23:59:59.999 of the same local day', () => {
    const midday = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
    const end = dayEnd(midday);
    const d = new Date(end);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
    expect(d.getDate()).toBe(15);
  });
});

describe('getEffectiveTaskDueTimestamp', () => {
  it('uses dueAt when present (exact time)', () => {
    const dueAt = new Date(2026, 0, 15, 14, 30, 0, 0).getTime();
    expect(getEffectiveTaskDueTimestamp({ dueAt, dueDate: 1 })).toBe(dueAt);
  });

  it('uses end-of-day of dueDate when dueAt is absent', () => {
    const dueDate = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    expect(getEffectiveTaskDueTimestamp({ dueDate })).toBe(dayEnd(dueDate));
  });

  it('returns undefined when neither dueAt nor dueDate is set ("ללא תאריך")', () => {
    expect(getEffectiveTaskDueTimestamp({})).toBeUndefined();
  });

  it('uses event start time for event-linked tasks without an explicit dueDate', () => {
    const eventStartTime = new Date(2026, 0, 15, 9, 0, 0, 0).getTime();
    expect(
      getEffectiveTaskDueTimestamp({ eventStartTime, eventAllDay: false })
    ).toBe(eventStartTime);
  });

  it('uses end-of-day for all-day event-linked tasks', () => {
    const eventStartTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    expect(
      getEffectiveTaskDueTimestamp({ eventStartTime, eventAllDay: true })
    ).toBe(dayEnd(eventStartTime));
  });
});

describe('isTaskPastDue — reliable due timestamp exists', () => {
  it('a reminder due earlier today (dueAt in the past) is past-due', () => {
    const dueAt = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 20, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueAt }, now)).toBe(true);
  });

  it('a reminder due later today (dueAt in the future) is NOT past-due', () => {
    const dueAt = new Date(2026, 0, 15, 22, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueAt }, now)).toBe(false);
  });

  it('a date-only reminder (no time) is still active for the rest of its due day', () => {
    const dueDate = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 23, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueDate }, now)).toBe(false);
  });

  it('a date-only reminder is past-due the day after', () => {
    const dueDate = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 16, 0, 30, 0, 0).getTime();
    expect(isTaskPastDue({ dueDate }, now)).toBe(true);
  });

  it('a future-dated reminder (tomorrow) is active today', () => {
    const dueDate = new Date(2026, 0, 16, 0, 0, 0, 0).getTime();
    const now = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
    expect(isTaskPastDue({ dueDate }, now)).toBe(false);
  });
});

describe('isTaskPastDue — no reliable due timestamp ("ללא תאריך")', () => {
  it('never treats an undated reminder as past-due, no matter how old', () => {
    const now = Date.now();
    expect(isTaskPastDue({}, now)).toBe(false);
    expect(isTaskPastDue({}, now + 365 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});
