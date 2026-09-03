/**
 * taskDueStatus
 *
 * Canonical "effective due timestamp" / "past due" logic for `tasks` rows —
 * extracted from the pre-existing private helpers in
 * `app/(authenticated)/tasks.tsx` (`dayEnd` / `getEffectiveDueTimestamp`,
 * used there to bucket the personal Tasks list into "עבר המועד" / "היום" /
 * "בהמשך" / "ללא תאריך") so the SAME real reminder-date field and the SAME
 * "past due" definition can be reused elsewhere (e.g. filtering standalone
 * general community reminders out of the active Community "תזכורות" tab
 * once their due time has passed) without inventing a second, conflicting
 * definition of "past due".
 *
 * The real reminder/due-date fields on a `tasks` row are:
 *   - `dueAt` — an exact timestamp, only ever set when `hasTime === true`
 *     (see `convex/tasks.ts` `create` / `update`, which zero out `dueAt`
 *     whenever `hasTime` is not `true`).
 *   - `dueDate` — a date-only (midnight) timestamp; when present without a
 *     specific time, the reminder is considered due through the END of that
 *     day (23:59:59.999), not at midnight.
 *   - Neither field set ("ללא תאריך" / no date) → there is NO reliable due
 *     timestamp. Such a reminder must be treated as NEVER past-due — this is
 *     a real, currently-reachable product state (see
 *     `app/(authenticated)/community-reminder/new.tsx`'s "ללא תאריך" date
 *     chip), not a data gap to paper over with a heuristic.
 *
 * `eventStartTime` / `eventAllDay` are included only because
 * `getEffectiveDueTimestamp` in `tasks.tsx` also feeds event-linked task rows
 * (which carry an event's start time instead of a `dueDate`); general
 * community reminders never populate these two fields.
 */

export interface TaskDueSchedule {
  dueDate?: number;
  dueAt?: number;
  eventStartTime?: number;
  eventAllDay?: boolean;
}

/** 23:59:59.999 of the day containing `timestampMs`, in local device time. */
export function dayEnd(timestampMs: number): number {
  const d = new Date(timestampMs);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * The real timestamp a task/reminder is "due" by, or `undefined` when the
 * task carries no reliable due/reminder timestamp at all (never past-due).
 */
export function getEffectiveTaskDueTimestamp(
  task: TaskDueSchedule
): number | undefined {
  if (task.dueAt !== undefined) return task.dueAt;
  if (task.eventStartTime !== undefined) {
    return task.eventAllDay ? dayEnd(task.eventStartTime) : task.eventStartTime;
  }
  if (task.dueDate !== undefined) return dayEnd(task.dueDate);
  return undefined;
}

/**
 * True only when there IS a reliable due timestamp AND it has already
 * passed relative to `nowMs`. A task/reminder with no due timestamp at all
 * is never past-due.
 */
export function isTaskPastDue(task: TaskDueSchedule, nowMs: number): boolean {
  const effectiveDue = getEffectiveTaskDueTimestamp(task);
  if (effectiveDue === undefined) return false;
  return effectiveDue < nowMs;
}

function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * "היום" / "מחר" / "אתמול" for near dates, else a compact Hebrew
 * day+short-month date (e.g. "12 בינו׳") — extracted from the pre-existing
 * private `formatDueDate` in `app/(authenticated)/community/[id].tsx`
 * (Community Reminders tab) so Community Main's "מה חשוב עכשיו" reminder
 * row (see BUG 3 of the Home-X/Community-Main QA fix) can reuse the exact
 * same date bucketing instead of inventing a second one.
 */
export function formatDueDate(ts: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  return new Date(ts).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Local device "HH:MM" for an exact `dueAt` timestamp. Only meaningful
 * when the reminder actually `hasTime` — callers must gate on that
 * themselves (see `formatReminderScheduleLabel` below for the gated,
 * ready-to-render combination).
 */
export function formatDueTime(dueAt: number): string {
  const d = new Date(dueAt);
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

/**
 * Compact "<date>" or "<date> · <time>" schedule label for a general
 * community reminder — reused by both the Community Reminders tab and
 * Community Main "מה חשוב עכשיו" (BUG 3 of the Home-X/Community-Main QA
 * fix) so the two surfaces can never drift into two different
 * date-formatting systems. `dueAt` is the ONLY source of truth for the
 * time portion, and only when `hasTime` is set — never derived from
 * `dueDate`'s local-day midnight, so a date-only reminder never shows a
 * fake `00:00`. Returns `undefined` when the reminder has no date at all
 * ("ללא תאריך").
 */
export function formatReminderScheduleLabel(
  schedule: Pick<TaskDueSchedule, 'dueDate' | 'dueAt'> & { hasTime?: boolean }
): string | undefined {
  if (schedule.dueDate === undefined) return undefined;
  const datePart = formatDueDate(schedule.dueDate);
  if (schedule.hasTime && schedule.dueAt !== undefined) {
    return `${datePart} · ${formatDueTime(schedule.dueAt)}`;
  }
  return datePart;
}
