/**
 * Tests for lib/eventDuplication.ts — Part D ("שכפל אירוע") pure
 * template-building helpers, extracted out of app/(authenticated)/event/new.tsx
 * so field-copy/field-drop rules can be verified without mounting
 * EventScreen or Convex.
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';

import {
  buildDuplicateEventTemplate,
  type DuplicateSourceEvent,
  type DuplicateSourceTask,
  isDuplicateSaveBlockedByUnconfirmedDate,
  offsetsToDuplicateReminders,
} from '../../lib/eventDuplication';

function makeSource(
  overrides: Partial<DuplicateSourceEvent> = {}
): DuplicateSourceEvent {
  // A timed event: Aug 6, 2026 18:00–20:00 (2h duration), not all-day.
  const startTime = new Date(2026, 7, 6, 18, 0, 0, 0).getTime();
  const endTime = new Date(2026, 7, 6, 20, 0, 0, 0).getTime();
  return {
    title: 'טיול לחוות אקולוגית',
    description: 'לא לשכוח מגבת',
    startTime,
    endTime,
    allDay: false,
    location: 'חוות הבוסתן',
    onlineUrl: undefined,
    locationUrl: undefined,
    requiresRsvp: true,
    tasksVisibleToParticipants: true,
    importantItems: [{ id: 'imp-1', title: 'להביא כובע' }],
    reminders: [60],
    ...overrides,
  };
}

describe('buildDuplicateEventTemplate — field copy rules (Part D4)', () => {
  it('copies title/description/location/online/rsvp/task-visibility content fields', () => {
    const template = buildDuplicateEventTemplate(makeSource(), [], Date.now());
    expect(template.title).toBe('טיול לחוות אקולוגית');
    expect(template.notes).toBe('לא לשכוח מגבת');
    expect(template.location).toBe('חוות הבוסתן');
    expect(template.requiresRsvp).toBe(true);
    expect(template.tasksVisibleToParticipants).toBe(true);
  });

  it('[TEST 26] uses the caller-provided NEW date, never the source event date', () => {
    const source = makeSource(); // original date = Aug 6, 2026
    const newDate = new Date(2026, 8, 2, 0, 0, 0, 0).getTime(); // Sep 2, 2026
    const template = buildDuplicateEventTemplate(source, [], newDate);
    expect(template.date).toBe(newDate);
    expect(new Date(template.date).getMonth()).not.toBe(
      new Date(source.startTime).getMonth()
    );
  });

  it('preserves the original time-of-day and duration on the new date', () => {
    const source = makeSource(); // 18:00-20:00, 2h
    const newDate = new Date(2026, 8, 2, 0, 0, 0, 0).getTime();
    const template = buildDuplicateEventTemplate(source, [], newDate);
    expect(template.startTime).toBe('18:00');
    expect(template.endTime).toBe('20:00');
    expect(template.endDate).toBe(newDate); // same day, does not cross midnight
  });

  it('preserves a cross-midnight duration onto the new date', () => {
    const source = makeSource({
      startTime: new Date(2026, 7, 6, 23, 0, 0, 0).getTime(),
      endTime: new Date(2026, 7, 7, 1, 0, 0, 0).getTime(), // ends next day
    });
    const newDate = new Date(2026, 8, 2, 0, 0, 0, 0).getTime();
    const template = buildDuplicateEventTemplate(source, [], newDate);
    expect(template.startTime).toBe('23:00');
    expect(template.endTime).toBe('01:00');
    expect(template.endDate).toBe(new Date(2026, 8, 3, 0, 0, 0, 0).getTime());
  });

  it('an all-day source event produces an all-day duplicate with no time-of-day fields', () => {
    const source = makeSource({ allDay: true });
    const newDate = new Date(2026, 8, 2, 0, 0, 0, 0).getTime();
    const template = buildDuplicateEventTemplate(source, [], newDate);
    expect(template.isAllDay).toBe(true);
    expect(template.startTime).toBeUndefined();
    expect(template.endDate).toBeUndefined();
    expect(template.endTime).toBeUndefined();
  });
});

describe('buildDuplicateEventTemplate — participant/viewer state is NEVER copied (Part D6)', () => {
  it('the duplication template contains no RSVP/save/opt-out/attendee fields at all', () => {
    const template = buildDuplicateEventTemplate(makeSource(), [], Date.now());
    expect(template.participants).toEqual([]);
    expect(template.attachments).toEqual([]);
    expect(Object.keys(template)).not.toContain('rsvpStatus');
    expect(Object.keys(template)).not.toContain('isSavedToMyCalendar');
    expect(Object.keys(template)).not.toContain('attendees');
  });
});

describe('buildDuplicateEventTemplate — task duplication (Part D7)', () => {
  it('[TEST 24] duplicated tasks are fresh, unassigned, and incomplete', () => {
    const sourceTasks: DuplicateSourceTask[] = [
      { title: 'לקנות חטיפים' },
      { title: 'להביא רמקול' },
    ];
    const template = buildDuplicateEventTemplate(
      makeSource(),
      sourceTasks,
      Date.now()
    );
    expect(template.tasks).toHaveLength(2);
    for (const task of template.tasks) {
      expect(task.completed).toBe(false);
      expect(task).not.toHaveProperty('assigneeId');
      expect(task).not.toHaveProperty('assignedToUserId');
      expect(task.title.length).toBeGreaterThan(0);
    }
    expect(template.tasks.map((t) => t.title)).toEqual([
      'לקנות חטיפים',
      'להביא רמקול',
    ]);
  });

  it('drops blank/whitespace-only source task titles', () => {
    const sourceTasks: DuplicateSourceTask[] = [
      { title: '  ' },
      { title: 'משימה תקינה' },
    ];
    const template = buildDuplicateEventTemplate(
      makeSource(),
      sourceTasks,
      Date.now()
    );
    expect(template.tasks).toHaveLength(1);
    expect(template.tasks[0]?.title).toBe('משימה תקינה');
  });

  it('generates distinct ids for every duplicated task', () => {
    const sourceTasks: DuplicateSourceTask[] = [
      { title: 'משימה א' },
      { title: 'משימה ב' },
    ];
    const template = buildDuplicateEventTemplate(
      makeSource(),
      sourceTasks,
      Date.now()
    );
    const ids = template.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildDuplicateEventTemplate — "חשוב לזכור" duplication (Part D8)', () => {
  it('[TEST 25] copies important-item titles with freshly generated ids (no absolute date/time field exists on this model)', () => {
    const source = makeSource({
      importantItems: [
        { id: 'orig-1', title: 'חולצה לבנה' },
        { id: 'orig-2', title: 'בקבוק מים' },
      ],
    });
    const template = buildDuplicateEventTemplate(source, [], Date.now());
    expect(template.importantItems.map((i) => i.title)).toEqual([
      'חולצה לבנה',
      'בקבוק מים',
    ]);
    expect(template.importantItems[0]?.id).not.toBe('orig-1');
    expect(template.importantItems[1]?.id).not.toBe('orig-2');
  });

  it('handles a source event with no important items', () => {
    const source = makeSource({ importantItems: undefined });
    const template = buildDuplicateEventTemplate(source, [], Date.now());
    expect(template.importantItems).toEqual([]);
  });
});

describe('offsetsToDuplicateReminders / reminders (Part D9)', () => {
  it('copies relative reminder offsets verbatim (never an absolute timestamp)', () => {
    const source = makeSource({ reminders: [0, 60, 1440] });
    const template = buildDuplicateEventTemplate(source, [], Date.now());
    expect(template.remindersEnabled).toBe(true);
    expect(template.reminders.map((r) => r.offsetMinutes)).toEqual([
      0, 60, 1440,
    ]);
    expect(template.reminders.map((r) => r.preset)).toEqual([
      'at_event',
      'hour_before',
      'day_before',
    ]);
  });

  it('maps a non-preset offset to a custom reminder', () => {
    const reminders = offsetsToDuplicateReminders([45]);
    expect(reminders).toEqual([
      {
        preset: 'custom',
        offsetMinutes: 45,
        customValue: 45,
        customUnit: 'minutes',
      },
    ]);
  });

  it('a source event with no reminders configured disables reminders on the duplicate (safe default, Part D9)', () => {
    const source = makeSource({ reminders: [] });
    const template = buildDuplicateEventTemplate(source, [], Date.now());
    expect(template.remindersEnabled).toBe(false);
  });
});

describe('isDuplicateSaveBlockedByUnconfirmedDate (Stage 3 correction, Part 1)', () => {
  it('blocks save when duplication requires date confirmation and none has happened yet', () => {
    expect(isDuplicateSaveBlockedByUnconfirmedDate(true, false)).toBe(true);
  });

  it('allows save once the manager has interacted with the date picker', () => {
    expect(isDuplicateSaveBlockedByUnconfirmedDate(true, true)).toBe(false);
  });

  it('never blocks ordinary (non-duplicate) create/edit flows', () => {
    expect(isDuplicateSaveBlockedByUnconfirmedDate(false, false)).toBe(false);
    expect(isDuplicateSaveBlockedByUnconfirmedDate(false, true)).toBe(false);
  });
});
