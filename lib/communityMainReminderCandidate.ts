/**
 * Pure selection helper for surfacing an active general community reminder
 * inside the community Main "מה חשוב עכשיו" section (PART B of the
 * community-reminder distribution fix).
 *
 * Deliberately takes an already-bounded reminder list (the same paged query
 * the Reminders tab uses, see convex/tasks.ts `listCommunityRemindersPaged`)
 * — it must NEVER be called with an unbounded/full-community scan. This
 * keeps "מה חשוב עכשיו" bounded exactly like the rest of that section.
 *
 * Reuses the SAME due-timestamp/past-due definition as the Reminders tab
 * (lib/taskDueStatus.ts) so Main and the Reminders tab never disagree about
 * what counts as "active".
 */

import {
  getEffectiveTaskDueTimestamp,
  isTaskPastDue,
  type TaskDueSchedule,
} from './taskDueStatus';

export interface MainReminderCandidate extends TaskDueSchedule {
  _id: string;
  title: string;
}

export interface MainReminderSelection<T extends MainReminderCandidate> {
  /** Reminders that are still active (not past due) — bounded, same length as input at most. */
  activeReminders: T[];
  /** The single nearest-due active reminder, or null when none are active. */
  nearest: T | null;
}

/**
 * Filters out past-due reminders and orders the remainder by nearest
 * effective due timestamp first (reminders with no due timestamp sort
 * last — they are never "imminent"). Never mutates the input array.
 */
export function selectMainReminderCandidates<T extends MainReminderCandidate>(
  reminders: T[],
  nowMs: number
): MainReminderSelection<T> {
  const activeReminders = reminders
    .filter((reminder) => !isTaskPastDue(reminder, nowMs))
    .slice()
    .sort((a, b) => {
      const dueA = getEffectiveTaskDueTimestamp(a) ?? Number.POSITIVE_INFINITY;
      const dueB = getEffectiveTaskDueTimestamp(b) ?? Number.POSITIVE_INFINITY;
      return dueA - dueB;
    });

  return {
    activeReminders,
    nearest: activeReminders[0] ?? null,
  };
}

// NOTE: a previous (uncommitted) version of Community Main's "מה חשוב עכשיו"
// integration paginated through `listCommunityRemindersPaged` in small
// bounded pages and used a `shouldAdvanceReminderPage` sparse-page
// continuation rule here to decide when it was worth fetching one more
// page. That pagination approach has been replaced by a single dedicated,
// date-bounded query (`api.tasks.listVisibleCommunityRemindersForRange`,
// scoped to one community) — see convex/tasks.ts and TabMain in
// app/(authenticated)/community/[id].tsx — so `shouldAdvanceReminderPage`
// no longer has a caller and was removed rather than left as dead code.
