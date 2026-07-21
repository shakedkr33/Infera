import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

// ─── Shared storage-deletion helper ──────────────────────────────────────────
//
// Scans EVERY task (except excludingTaskId) and EVERY event (except
// excludingEventId) for any reference to the given storageId before
// physically deleting the storage object.  The scan covers:
//
//   tasks.attachments[].storageId
//   tasks.subtasks[].image.storageId
//   tasks.subtasks[].attachment.storageId
//   events.attachments[].storageId
//
// If ANY remaining document references the ID the function returns without
// deleting — an orphaned storage object is always safer than destroying
// another document's file.
//
// Scaling note: this is O(T × subtasks_per_task + E × attachments_per_event)
// per physical deletion.  Deletion is a rare, user-initiated operation and
// community volumes at MVP are expected to remain well below thousands of
// documents, so the full scan is acceptable.  A storageId index on tasks
// would reduce this to O(1) lookups; that optimisation can be added later.
//
export async function safeDeleteStorageIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  exclude?: {
    taskId?: Id<'tasks'>;
    eventId?: Id<'events'>;
  }
): Promise<void> {
  const sid = storageId as string;

  // ── Events scan ────────────────────────────────────────────────────────────
  const allEvents = await ctx.db.query('events').collect();
  for (const event of allEvents) {
    if (
      exclude?.eventId &&
      (event._id as string) === (exclude.eventId as string)
    )
      continue;
    for (const att of event.attachments ?? []) {
      if ((att.storageId as string) === sid) return;
    }
  }

  // ── Tasks scan (attachments + subtask images/attachments) ──────────────────
  const allTasks = await ctx.db.query('tasks').collect();
  for (const task of allTasks) {
    if (exclude?.taskId && (task._id as string) === (exclude.taskId as string))
      continue;
    for (const att of task.attachments ?? []) {
      if ((att.storageId as string) === sid) return;
    }
    for (const st of task.subtasks ?? []) {
      if (st.image?.storageId && (st.image.storageId as string) === sid) return;
      if (
        st.attachment?.storageId &&
        (st.attachment.storageId as string) === sid
      )
        return;
    }
  }

  // No remaining references — physically delete.
  // Catch errors so a missing storage object does not crash the mutation.
  try {
    await ctx.storage.delete(storageId);
  } catch {
    // Already gone — not an error.
  }
}

/**
 * Returns true if any explicit assignee was provided for a community task.
 *
 * A community task with no explicit assignee is treated as a "general community
 * reminder" — visible to all members and eligible for shared due-reminder
 * scheduling. One with any explicit assignee is treated as assigned to specific
 * people and is excluded from shared scheduling.
 *
 * Extracted from tasks.ts so that reminderScheduler.ts can share the predicate
 * without duplicating it.
 */
export function hasExplicitAssigneeForCommunityActivity(args: {
  assignedTo?: Id<'users'>;
  assignedToMemberId?: Id<'members'>;
  assignedToUserIds?: Id<'users'>[];
  assignedToMemberIds?: Id<'members'>[];
}): boolean {
  return (
    (args.assignedToUserIds ?? []).length > 0 ||
    (args.assignedToMemberIds ?? []).length > 0 ||
    args.assignedTo !== undefined ||
    args.assignedToMemberId !== undefined
  );
}

// ─── Write-time cross-document storage reference check ───────────────────────
//
// Returns true if the given storageId is currently referenced by ANY task or
// event document OTHER than the document identified by `exclude`.
//
// Call this at mutation write-time for every *newly introduced* storageId
// (i.e. a storageId the client submits that was not already on this exact
// document) to prevent a client from hijacking a file that belongs to another
// document.
//
// Same scan coverage as safeDeleteStorageIfUnreferenced — the two helpers share
// the authoritative list of storage-reference locations so they cannot drift:
//
//   tasks.attachments[].storageId
//   tasks.subtasks[].image.storageId
//   tasks.subtasks[].attachment.storageId
//   events.attachments[].storageId
//
export async function isStorageReferencedByOtherDocument(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  exclude?: {
    taskId?: Id<'tasks'>;
    eventId?: Id<'events'>;
  }
): Promise<boolean> {
  const sid = storageId as string;

  const allEvents = await ctx.db.query('events').collect();
  for (const event of allEvents) {
    if (
      exclude?.eventId &&
      (event._id as string) === (exclude.eventId as string)
    )
      continue;
    for (const att of event.attachments ?? []) {
      if ((att.storageId as string) === sid) return true;
    }
  }

  const allTasks = await ctx.db.query('tasks').collect();
  for (const task of allTasks) {
    if (exclude?.taskId && (task._id as string) === (exclude.taskId as string))
      continue;
    for (const att of task.attachments ?? []) {
      if ((att.storageId as string) === sid) return true;
    }
    for (const st of task.subtasks ?? []) {
      if (st.image?.storageId && (st.image.storageId as string) === sid)
        return true;
      if (
        st.attachment?.storageId &&
        (st.attachment.storageId as string) === sid
      )
        return true;
    }
  }

  return false;
}

// ─── Deleted/archived general-community-reminder guard ───────────────────────
//
// isGeneralCommunityReminder excludes tasks where deletedAt or archivedAt is
// set (by design — scheduling must not treat them as active). This means a
// deleted/archived general community reminder evaluates to false there and
// falls through to isUserParticipantInTask, whose creator check (line 539 of
// tasks.ts: `if (task.createdBy === userId) return true`) would grant the
// original creator access.
//
// This predicate catches that case: it matches tasks that WERE general
// community reminders but have been deleted or archived. Any read-access guard
// must check this BEFORE calling isGeneralCommunityReminder and return null
// immediately when true — for EVERYONE, including the original creator.
//
export function isDeletedOrArchivedGeneralCommunityReminder(task: {
  communityId?: Id<'communities'>;
  sourceType?: string;
  deletedAt?: number;
  archivedAt?: number;
  assignedTo?: Id<'users'>;
  assignedToMemberId?: Id<'members'>;
  assignedToUserIds?: Id<'users'>[];
  assignedToMemberIds?: Id<'members'>[];
}): boolean {
  return (
    task.communityId !== undefined &&
    task.sourceType === undefined &&
    !hasExplicitAssigneeForCommunityActivity(task) &&
    (task.deletedAt !== undefined || task.archivedAt !== undefined)
  );
}

/**
 * Returns true if a task document represents a general community reminder —
 * i.e. a community-wide task that is not assigned to any specific user and has
 * no event-source link.
 *
 * This is the single authoritative predicate used across tasks.ts,
 * reminderScheduler.ts, and query logic so that all paths agree on what
 * constitutes a general community reminder.
 */
export function isGeneralCommunityReminder(task: {
  communityId?: Id<'communities'>;
  sourceType?: string;
  deletedAt?: number;
  archivedAt?: number;
  assignedTo?: Id<'users'>;
  assignedToMemberId?: Id<'members'>;
  assignedToUserIds?: Id<'users'>[];
  assignedToMemberIds?: Id<'members'>[];
}): task is typeof task & { communityId: Id<'communities'> } {
  return (
    task.communityId !== undefined &&
    task.sourceType === undefined &&
    !hasExplicitAssigneeForCommunityActivity(task) &&
    task.deletedAt === undefined &&
    task.archivedAt === undefined
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal completion helpers for general community reminders.
//
// These helpers read/write the completedAt field on taskParticipantSettings
// rows identified by the by_task_user index. They NEVER touch tasks.completed
// or tasks.completedAt.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the authenticated user's personal completion state for a task.
 * Missing settings row or absent completedAt → { completed: false }.
 * Does NOT fall back to tasks.completed for general community reminders.
 */
export async function getPersonalCompletion(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<'tasks'>,
  userId: Id<'users'>
): Promise<{ completed: boolean; completedAt?: number }> {
  const row = await ctx.db
    .query('taskParticipantSettings')
    .withIndex('by_task_user', (q) =>
      q.eq('taskId', taskId).eq('userId', userId)
    )
    .unique();

  if (!row || row.completedAt === undefined) {
    return { completed: false };
  }
  return { completed: true, completedAt: row.completedAt };
}

/**
 * Marks a user's personal completion on a task.
 * Upserts the settings row — patches existing or inserts minimal new row.
 * Preserves all unrelated fields (reminders, reminderType, leftAt, etc.).
 * Returns the timestamp written.
 */
export async function setPersonalCompleted(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
  userId: Id<'users'>
): Promise<number> {
  const now = Date.now();
  const row = await ctx.db
    .query('taskParticipantSettings')
    .withIndex('by_task_user', (q) =>
      q.eq('taskId', taskId).eq('userId', userId)
    )
    .unique();

  if (row) {
    await ctx.db.patch(row._id, { completedAt: now });
  } else {
    await ctx.db.insert('taskParticipantSettings', {
      taskId,
      userId,
      completedAt: now,
    });
  }
  return now;
}

/**
 * Clears a user's personal completion on a task.
 * Only patches completedAt to undefined — never deletes the row
 * (it may contain personal reminder settings or leftAt).
 */
export async function clearPersonalCompleted(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
  userId: Id<'users'>
): Promise<void> {
  const row = await ctx.db
    .query('taskParticipantSettings')
    .withIndex('by_task_user', (q) =>
      q.eq('taskId', taskId).eq('userId', userId)
    )
    .unique();

  if (row && row.completedAt !== undefined) {
    await ctx.db.patch(row._id, { completedAt: undefined });
  }
}
