/**
 * Canonical task/reminder classification labels — shared between the Convex
 * server classification (convex/taskUtils.ts) and every client surface that
 * renders a task/reminder type chip (Home, Calendar, Community Main), so the
 * label can never drift between screens.
 *
 * A "general community reminder" (see convex/taskUtils.ts
 * `isGeneralCommunityReminder`) must always be labelled `תזכורת קהילה`,
 * never `משימה` — regardless of which screen renders it or who created it.
 */

export const COMMUNITY_REMINDER_TYPE_LABEL = 'תזכורת קהילה';
export const PERSONAL_TASK_TYPE_LABEL = 'משימה';

export type TaskClassification = 'community_reminder' | 'personal_task';

/** Maps the canonical classification to its user-facing Hebrew label. */
export function getTaskTypeLabel(classification: TaskClassification): string {
  return classification === 'community_reminder'
    ? COMMUNITY_REMINDER_TYPE_LABEL
    : PERSONAL_TASK_TYPE_LABEL;
}

/**
 * Home-surface reminder metadata derived from a `listMyTasks` row — used by
 * BOTH the timed (`todayTasks`) and date-only/untimed (`selectedDayUntimedTasks`)
 * mappers in `app/(authenticated)/index.tsx` so they can never drift apart
 * (BUG 2 fix: a general community reminder must carry the exact same
 * `תזכורת קהילה` + community-name metadata on Home regardless of whether it
 * has a specific time — classification is a property of the ITEM, never of
 * `dueAt`/`hasTime`).
 */
export interface HomeReminderMetadataSource {
  taskType?: TaskClassification;
  communityId?: unknown;
  communityName?: string;
}

export interface HomeReminderMetadata {
  taskTypeLabel: string | undefined;
  groupName: string | undefined;
  communityId: string | undefined;
}

export function getHomeReminderMetadata(
  task: HomeReminderMetadataSource
): HomeReminderMetadata {
  const isCommunityReminder = task.taskType === 'community_reminder';
  return {
    taskTypeLabel: isCommunityReminder
      ? COMMUNITY_REMINDER_TYPE_LABEL
      : undefined,
    groupName: isCommunityReminder ? task.communityName : undefined,
    communityId:
      isCommunityReminder && task.communityId !== undefined
        ? String(task.communityId)
        : undefined,
  };
}

/**
 * Exact accessibility label / copy for the personal-dismiss ("הסתר מהמרחב
 * האישי שלי") action shown on Home and Calendar for general community
 * reminders ONLY (never inside Community Main / Community "תזכורות" — see
 * `dismissCommunityReminderForMe` in convex/tasks.ts). A single shared
 * constant so the exact wording can never drift between the two surfaces.
 */
export const COMMUNITY_REMINDER_DISMISS_LABEL = 'הסתר מהמרחב האישי שלי';

/**
 * True when a rendered card's resolved type label identifies it as a
 * general community reminder — the ONLY items eligible for the
 * personal-dismiss action on Home/Calendar. Reuses the SAME
 * `taskTypeLabel`/`typeLabel` value already derived exclusively from the
 * canonical `getTaskClassification`/`getHomeReminderMetadata`/
 * `getCalendarTaskTypeLabel` helpers — never a second, ad-hoc
 * classification check.
 */
export function isCommunityReminderTypeLabel(
  typeLabel: string | undefined
): boolean {
  return typeLabel === COMMUNITY_REMINDER_TYPE_LABEL;
}
