/**
 * Manual QA follow-up — PARTS B/C/D pure-helper coverage.
 *
 * B: per-item manager delete authorization (canManageEventReminderItem)
 * C: canonical "הוסף למשימות שלי" bundle title/subtasks shape
 *    (buildImportantItemsBundleTaskTitle / buildImportantItemsBundleSubtasks)
 * D: Home "חשוב לזכור" compact preview shaping (getHomeImportantItemsPreview)
 *
 * These are the DB-independent pieces of each feature; the surrounding
 * Convex mutations/queries (events.update, tasks.addEventImportantItemsToMyTasks,
 * tasks.getMyImportantItemsBundleStatus) reuse existing, already-authorized
 * code paths and are exercised via manual QA (see the task's manual QA
 * checklist) rather than a new Convex test harness, per "do not introduce a
 * heavy new testing framework."
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import {
  buildImportantItemsBundleSubtasks,
  buildImportantItemsBundleTaskTitle,
} from '../../convex/taskUtils';
import { canManageEventReminderItem } from '../../lib/eventReminderPermissions';
import { getHomeImportantItemsPreview } from '../../lib/homeImportantItemsPreview';

describe('canManageEventReminderItem — PART B3 per-item delete authorization', () => {
  it('[#7] event creator can manage → true', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'u1',
        eventCreatedBy: 'u1',
        myRole: 'member',
      })
    ).toBe(true);
  });

  it('[#7] active community owner (non-creator) can manage → true', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'u2',
        eventCreatedBy: 'u1',
        myRole: 'owner',
      })
    ).toBe(true);
  });

  it('[#7] active community admin (non-creator) can manage → true', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'u2',
        eventCreatedBy: 'u1',
        myRole: 'admin',
      })
    ).toBe(true);
  });

  it('[#8] ordinary member (non-creator, no role) cannot manage → false', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'u2',
        eventCreatedBy: 'u1',
        myRole: 'member',
      })
    ).toBe(false);
  });

  it('[#8] undefined viewer (not signed in / not loaded) cannot manage → false', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: undefined,
        eventCreatedBy: 'u1',
        myRole: 'owner',
      })
    ).toBe(false);
  });

  it('[#8] undefined role and non-creator cannot manage → false', () => {
    expect(
      canManageEventReminderItem({
        currentUserId: 'u2',
        eventCreatedBy: 'u1',
        myRole: undefined,
      })
    ).toBe(false);
  });
});

describe('buildImportantItemsBundleTaskTitle / buildImportantItemsBundleSubtasks — PART C canonical conversion shape', () => {
  it('[#11] title matches the existing established format exactly', () => {
    expect(buildImportantItemsBundleTaskTitle('בוקר סרט')).toBe(
      'חשוב לזכור - בוקר סרט'
    );
  });

  it('[#9]/[#10] 3 important items → exactly 3 uncompleted subtasks preserving id/title', () => {
    const subtasks = buildImportantItemsBundleSubtasks([
      { id: 'a', title: 'להביא שמיכה' },
      { id: 'b', title: 'להביא כרית' },
      { id: 'c', title: 'להביא בובה' },
    ]);
    expect(subtasks).toHaveLength(3);
    expect(subtasks).toEqual([
      { id: 'a', title: 'להביא שמיכה', completed: false },
      { id: 'b', title: 'להביא כרית', completed: false },
      { id: 'c', title: 'להביא בובה', completed: false },
    ]);
  });

  it('zero important items → zero subtasks', () => {
    expect(buildImportantItemsBundleSubtasks([])).toEqual([]);
  });
});

describe('getHomeImportantItemsPreview — PART D2 Home compact preview', () => {
  it('[#15] zero items → empty preview, zero remaining', () => {
    const { preview, remainingCount } = getHomeImportantItemsPreview([]);
    expect(preview).toEqual([]);
    expect(remainingCount).toBe(0);
  });

  it('[#16] one item → shown, zero remaining', () => {
    const { preview, remainingCount } = getHomeImportantItemsPreview([
      { id: 'a', title: 'להביא שמיכה' },
    ]);
    expect(preview.map((i) => i.id)).toEqual(['a']);
    expect(remainingCount).toBe(0);
  });

  it('[#17] two items → both shown, zero remaining', () => {
    const { preview, remainingCount } = getHomeImportantItemsPreview([
      { id: 'a', title: 'להביא שמיכה' },
      { id: 'b', title: 'להביא כרית' },
    ]);
    expect(preview.map((i) => i.id)).toEqual(['a', 'b']);
    expect(remainingCount).toBe(0);
  });

  it('[#18] three or more items → only first 2 previewed + remainder count', () => {
    const { preview, remainingCount } = getHomeImportantItemsPreview([
      { id: 'a', title: 'להביא שמיכה' },
      { id: 'b', title: 'להביא כרית' },
      { id: 'c', title: 'להביא בובה' },
    ]);
    expect(preview.map((i) => i.id)).toEqual(['a', 'b']);
    expect(remainingCount).toBe(1);
  });

  it('[#18] five items → first 2 previewed + remainder of 3', () => {
    const { preview, remainingCount } = getHomeImportantItemsPreview([
      { id: 'a', title: '1' },
      { id: 'b', title: '2' },
      { id: 'c', title: '3' },
      { id: 'd', title: '4' },
      { id: 'e', title: '5' },
    ]);
    expect(preview).toHaveLength(2);
    expect(remainingCount).toBe(3);
  });
});
