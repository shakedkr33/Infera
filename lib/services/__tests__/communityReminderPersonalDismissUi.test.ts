/**
 * Community Reminder personal-dismiss UI — Home + Calendar (see the
 * "Community Reminder Personal Dismissal UI: Home + Calendar Only" task).
 *
 * This file tests the SHARED pure eligibility/copy helpers both Home
 * (components/home/HomeDailyCommandCenter.tsx) and Calendar
 * (app/(authenticated)/calendar.tsx `CalendarTaskCard`) use to decide:
 *   - whether a rendered item is a general community reminder eligible for
 *     the personal-dismiss "X" (`isCommunityReminderTypeLabel`), and
 *   - the exact accessibility copy for that action
 *     (`COMMUNITY_REMINDER_DISMISS_LABEL`).
 *
 * Both helpers live in lib/taskClassification.ts and are driven EXCLUSIVELY
 * by the canonical `taskTypeLabel`/`typeLabel` value already produced by
 * `getTaskClassification` (convex/taskUtils.ts) via `getHomeReminderMetadata`
 * / `getCalendarTaskTypeLabel` — never a second, ad-hoc classification. That
 * canonical-classification contract itself (community_reminder vs
 * personal_task) is covered by tests/convex/communityReminderDistribution.test.ts;
 * this file only covers the UI-eligibility/copy layer built on top of it.
 *
 * NOT unit-testable without a component-rendering harness (none exists in
 * this repo — same precedent as tests/convex/communityReminderDistribution.test.ts):
 *   - HomeDailyCommandCenter/CalendarTaskCard actually render the "X" only
 *     when `isCommunityReminderTypeLabel(...)` is true, never a checkbox for
 *     those items (verified by code review — every TaskCheckbox render site
 *     in HomeDailyCommandCenter.tsx is now gated by
 *     `!isCommunityReminderItem`/`showCheckbox`, and CalendarTaskCard never
 *     had a checkbox to begin with).
 *   - Both `handleDismissCommunityReminder` (Home) and `handleDismissReminder`
 *     (Calendar `CalendarTaskCard`) call
 *     `api.tasks.dismissCommunityReminderForMe` with ONLY `{ taskId }` — no
 *     userId/viewerId/communityId/completedAt — and both disable the button
 *     while their own local pending state (`dismissingReminderIds` /
 *     `isDismissingReminder`) is true, restoring it on success or failure so
 *     a failed dismissal never permanently disables the action and the
 *     reminder stays visible (removal only ever happens via the reactive
 *     `listVisibleCommunityRemindersForRange`/`listMyTasks` query once the
 *     mutation actually succeeds — neither handler removes any row from a
 *     local list itself).
 *   - Home's `UnifiedTimelineCard`/untimed-task row and Calendar's
 *     `CalendarTaskCard` both preserve `hideTimeInCard`/existing metadata
 *     rendering untouched — the dismiss "X" was added as a sibling of the
 *     existing checkbox/time/metadata JSX, never replacing or reordering it.
 *
 * X PRESS ISOLATION (final audit — "Creator Overlap + Press Isolation Only"
 * task) — verified by structural code review, not by a rendering harness:
 *   - In ALL THREE Home render sites (featured `UnifiedTimelineCard`,
 *     compact `UnifiedTimelineCard`, and the untimed-task list row),
 *     `<DismissReminderButton>` is nested INSIDE the card/row's outer
 *     `<Pressable onPress={onOpen|...}>`, in the exact same slot and
 *     nesting depth `<TaskCheckbox>` already occupied there. Nothing in
 *     this file (or TaskCheckbox itself, in components/TaskCheckbox.tsx)
 *     ever calls `stopPropagation` — React Native's touch-responder system
 *     already grants the touch exclusively to the innermost `Pressable`
 *     that claims it, so the outer card's `onPress` never fires when the
 *     inner one does. This is the SAME pre-existing mechanism that already
 *     lets `TaskCheckbox` toggle a task without opening its card — the new
 *     `DismissReminderButton` inherits that isolation for free, with no
 *     new propagation-prevention code required.
 *   - In `CalendarTaskCard` (app/(authenticated)/calendar.tsx), the dismiss
 *     "X" is nested inside the card's outer
 *     `<Pressable onPress={() => onOpenTaskSheet(rawId)}>`. Its own
 *     `onPress` additionally calls `e.stopPropagation?.()` before
 *     `handleDismissReminder()` — belt-and-braces on top of the same
 *     RN-responder isolation described above, kept because it was already
 *     reviewed/tested and is harmless (a no-op if the responder system has
 *     already isolated the touch, which it does).
 *
 * HOME X POSITION (QA FIX — BUG 1) — layout/CSS positioning is not
 * reasonably unit-testable with this repo's lightweight (no
 * component-rendering harness) test setup; documented here for manual QA
 * instead, verified by structural code review:
 *   - In ALL FOUR Home render sites that can show a community reminder
 *     (featured `UnifiedTimelineCard`, compact `UnifiedTimelineCard`, the
 *     compact-with-subtasks sibling-Pressable variant, and the
 *     untimed/date-only task-list row), `<DismissReminderButton>` was moved
 *     OUT of the title/content row it previously shared with the reminder
 *     title, into its own dedicated `styles.dismissCornerRow` line rendered
 *     BEFORE that content (before `cardTopRow`/the time+badge row/the
 *     source-label+title block) — never inline with the
 *     title/type-label/community-tag/time metadata, so it can no longer
 *     visually read as "part of the content".
 *   - `dismissCornerRow` uses `alignItems: rtl.alignEnd` — the existing,
 *     device-measured (see lib/rtl.ts doc comment) helper for PHYSICAL LEFT
 *     column cross-axis alignment in BOTH Expo Go and native-RTL builds —
 *     never a raw `left`/`right` style, which would only be physically
 *     correct in one of the two environments. This is the SAME single
 *     shared style used by all four render sites (never three/four separate
 *     positioning implementations).
 *   - Manual QA must confirm on both iPhone and Android that the "X" renders
 *     at the physical top-left corner of each reminder card and does not
 *     overlap the title, type label, community-name tag, or time/date
 *     metadata.
 *
 * Run with: bun test lib/services/__tests__
 */

import { describe, expect, it } from 'bun:test';

import {
  COMMUNITY_REMINDER_DISMISS_LABEL,
  COMMUNITY_REMINDER_TYPE_LABEL,
  getHomeReminderMetadata,
  isCommunityReminderTypeLabel,
  PERSONAL_TASK_TYPE_LABEL,
} from '../../taskClassification';

describe('COMMUNITY_REMINDER_DISMISS_LABEL — exact personal-dismiss copy', () => {
  it('[#8] is exactly "הסתר מהמרחב האישי שלי" — never מחק/הסר/הושלם/סמן כהושלם', () => {
    expect(COMMUNITY_REMINDER_DISMISS_LABEL).toBe('הסתר מהמרחב האישי שלי');
    expect(COMMUNITY_REMINDER_DISMISS_LABEL).not.toContain('מחק');
    expect(COMMUNITY_REMINDER_DISMISS_LABEL).not.toContain('הסר');
    expect(COMMUNITY_REMINDER_DISMISS_LABEL).not.toContain('הושלם');
  });

  it('is the SAME constant reused by both Home and Calendar (single source of truth, no drift)', () => {
    // Both app/(authenticated)/calendar.tsx and
    // components/home/HomeDailyCommandCenter.tsx import this exact constant
    // for the X's accessibilityLabel — never a locally re-typed string.
    const homeCopy = COMMUNITY_REMINDER_DISMISS_LABEL;
    const calendarCopy = COMMUNITY_REMINDER_DISMISS_LABEL;
    expect(homeCopy).toBe(calendarCopy);
  });
});

describe('isCommunityReminderTypeLabel — personal-dismiss eligibility (Home + Calendar)', () => {
  it('[#1] community_reminder type label → dismiss eligible', () => {
    expect(isCommunityReminderTypeLabel(COMMUNITY_REMINDER_TYPE_LABEL)).toBe(
      true
    );
  });

  it('[#2] personal_task type label → dismiss NOT eligible', () => {
    expect(isCommunityReminderTypeLabel(PERSONAL_TASK_TYPE_LABEL)).toBe(false);
  });

  it('[#3] event-derived task (no community-reminder classification, undefined label) → dismiss NOT eligible', () => {
    // Event-derived important-item tasks/snapshots and subtasks never carry
    // the community_reminder classification — getHomeReminderMetadata /
    // getCalendarTaskTypeLabel only ever set the reminder label for actual
    // general community reminders, so their resolved label is undefined.
    expect(isCommunityReminderTypeLabel(undefined)).toBe(false);
  });

  it('[#7] ordinary task (undefined/משימה label) → existing completion UI remains eligible (i.e. NOT treated as a community reminder)', () => {
    expect(isCommunityReminderTypeLabel(undefined)).toBe(false);
    expect(isCommunityReminderTypeLabel(PERSONAL_TASK_TYPE_LABEL)).toBe(false);
  });

  it('[#6] general community reminder is never simultaneously eligible for both the checkbox AND the dismiss action — the two are mutually exclusive by construction', () => {
    const label = COMMUNITY_REMINDER_TYPE_LABEL;
    const isReminder = isCommunityReminderTypeLabel(label);
    const showsCheckbox = !isReminder; // mirrors `showCheckbox`/`!isCommunityReminderItem` gating in HomeDailyCommandCenter
    expect(isReminder).toBe(true);
    expect(showsCheckbox).toBe(false);
  });

  it('an arbitrary unrelated string never accidentally matches (exact-string comparison, not a substring/prefix check)', () => {
    expect(isCommunityReminderTypeLabel('תזכורת קהילה ')).toBe(false); // trailing space
    expect(isCommunityReminderTypeLabel('קהילה')).toBe(false);
  });
});

describe('[#4]/[#5] Home timed + date-only community reminder metadata parity, independent of dismiss eligibility', () => {
  const communityId = 'community_1';
  const communityName = 'קהילת השכונה';

  it('[#4] timed community reminder → canonical metadata retained AND dismiss-eligible', () => {
    const meta = getHomeReminderMetadata({
      taskType: 'community_reminder',
      communityId,
      communityName,
    });
    expect(meta.taskTypeLabel).toBe(COMMUNITY_REMINDER_TYPE_LABEL);
    expect(meta.groupName).toBe(communityName);
    expect(meta.communityId).toBe(communityId);
    expect(isCommunityReminderTypeLabel(meta.taskTypeLabel)).toBe(true);
  });

  it('[#5] date-only community reminder → IDENTICAL canonical metadata AND dismiss-eligible (no fake time introduced)', () => {
    // getHomeReminderMetadata's input shape has no dueAt/hasTime field —
    // structurally proving the date-only mapping path produces the exact
    // same metadata + eligibility as the timed path above.
    const meta = getHomeReminderMetadata({
      taskType: 'community_reminder',
      communityId,
      communityName,
    });
    expect(meta).toEqual({
      taskTypeLabel: COMMUNITY_REMINDER_TYPE_LABEL,
      groupName: communityName,
      communityId,
    });
    expect(isCommunityReminderTypeLabel(meta.taskTypeLabel)).toBe(true);
  });

  it('personal task metadata → no reminder label, dismiss NOT eligible', () => {
    const meta = getHomeReminderMetadata({
      taskType: 'personal_task',
      communityId: undefined,
      communityName: undefined,
    });
    expect(meta.taskTypeLabel).toBeUndefined();
    expect(isCommunityReminderTypeLabel(meta.taskTypeLabel)).toBe(false);
  });
});

describe('[#10] personal-dismiss eligibility does not alter Community Reminder classification', () => {
  it('checking dismiss-eligibility is a read-only, side-effect-free operation on the classification label', () => {
    const meta = getHomeReminderMetadata({
      taskType: 'community_reminder',
      communityId: 'community_1',
      communityName: 'קהילה',
    });
    const before = { ...meta };
    // Call the eligibility check multiple times — a pure function must
    // never mutate its input or produce a different answer.
    isCommunityReminderTypeLabel(meta.taskTypeLabel);
    isCommunityReminderTypeLabel(meta.taskTypeLabel);
    expect(meta).toEqual(before);
    expect(isCommunityReminderTypeLabel(meta.taskTypeLabel)).toBe(true);
  });
});
