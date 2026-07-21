import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { isActiveCommunityMember } from './communityMemberUtils';
import {
  getPersonalCompletion,
  hasExplicitAssigneeForCommunityActivity,
  isGeneralCommunityReminder,
} from './taskUtils';
import { createUserNotifications } from './userNotifications';

// ─────────────────────────────────────────────────────────────────────────────
// cancelPendingJobsForTaskHelper
//
// Cancels ALL pending scheduled-reminder rows for a task (every user).
// Used when the shared task is deleted, archived, updated, or globally ineligible.
// DO NOT call this for personal completion — use cancelPendingJobsForTaskAndUserHelper.
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelPendingJobsForTaskHelper(
  ctx: MutationCtx,
  taskId: Id<'tasks'>
): Promise<void> {
  const rows = await ctx.db
    .query('scheduledReminders')
    .withIndex('by_task', (q) => q.eq('taskId', taskId))
    .collect();

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    await ctx.scheduler.cancel(row.scheduledFunctionId);
    await ctx.db.patch(row._id, { status: 'canceled' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelPendingJobsForTaskAndUserHelper
//
// Cancels only the pending scheduled-reminder rows for a SINGLE user on a task.
// Called when a user personally marks a general community reminder as completed.
// Other users' pending rows are NOT affected.
// Uses the by_task_user compound index for efficient per-user lookup.
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelPendingJobsForTaskAndUserHelper(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
  userId: Id<'users'>
): Promise<void> {
  const rows = await ctx.db
    .query('scheduledReminders')
    .withIndex('by_task_user', (q) =>
      q.eq('taskId', taskId).eq('userId', userId)
    )
    .collect();

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    await ctx.scheduler.cancel(row.scheduledFunctionId);
    await ctx.db.patch(row._id, { status: 'canceled' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scheduleUserReminder
//
// Upsert a single user's scheduling row for one (task, reminderKey) slot:
//   A. Query all historical matching rows (any status) to derive unique createdAt
//   B. Cancel every matching pending row
//   C. Skip if scheduledFor is already in the past
//   D. Generate a unique identity timestamp (strictly > all historical rows)
//   E. Schedule fireReminder and insert the new pending row
// ─────────────────────────────────────────────────────────────────────────────

export const scheduleUserReminder = internalMutation({
  args: {
    taskId: v.id('tasks'),
    userId: v.id('users'),
    reminderKey: v.string(),
    scheduledFor: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { taskId, userId, reminderKey, scheduledFor }) => {
    // A. Query all historical rows for this task (any status).
    const allTaskRows = await ctx.db
      .query('scheduledReminders')
      .withIndex('by_task', (q) => q.eq('taskId', taskId))
      .collect();

    const matchingRows = allTaskRows.filter(
      (row) => row.userId === userId && row.reminderKey === reminderKey
    );

    // B. Cancel every matching pending row.
    const pendingMatchingRows = matchingRows.filter(
      (row) => row.status === 'pending'
    );

    for (const row of pendingMatchingRows) {
      await ctx.scheduler.cancel(row.scheduledFunctionId);
      await ctx.db.patch(row._id, { status: 'canceled' });
    }

    // C. Skip past times (after cancellation so stale jobs are always cleaned).
    if (scheduledFor <= Date.now()) {
      return null;
    }

    // C2. Scheduling-time eligibility guard — closes the queued-scheduling race.
    //
    // Because scheduling is enqueued via runAfter(0), a completion or deletion
    // mutation may commit before this scheduled mutation executes. Checking
    // eligibility here (inside the same internalMutation transaction) guarantees
    // that we never create a pending scheduledReminders row for a user or task
    // that is no longer eligible.
    //
    // Checks performed:
    //   1. Task still exists.
    //   2. Task is still a general community reminder (shared predicate).
    //      This also implies: communityId set, no sourceType, not deleted/archived,
    //      no explicit assignee.
    //   3. Community still exists.
    //   4. Recipient still has an active community membership.
    //   5. Recipient's personal completedAt is not set.
    //
    // notificationsEnabled is NOT checked here. Mute state is authoritative only
    // at fire time (fireReminder.D), preserving unmute-before-fire delivery.
    const task = await ctx.db.get(taskId);
    if (!task) return null;
    if (!isGeneralCommunityReminder(task)) return null;

    const community = await ctx.db.get(task.communityId);
    if (!community) return null;

    const membership = await ctx.db
      .query('communityMembers')
      .withIndex('by_community_user', (q) =>
        q.eq('communityId', task.communityId).eq('userId', userId)
      )
      .unique();
    if (!isActiveCommunityMember(membership)) return null;

    const personal = await getPersonalCompletion(ctx, taskId, userId);
    if (personal.completed) return null;

    // D. Generate a unique identity timestamp.
    // Must be strictly greater than every historical matching row's createdAt so
    // two rapid scheduling attempts for the same (taskId, userId, reminderKey)
    // within the same millisecond cannot share the same createdAt.
    const createdAt =
      matchingRows.length === 0
        ? Date.now()
        : Math.max(Date.now(), ...matchingRows.map((row) => row.createdAt + 1));

    // E. Schedule before inserting (schema requires scheduledFunctionId).
    const scheduledFunctionId = await ctx.scheduler.runAt(
      scheduledFor,
      internal.reminderScheduler.fireReminder,
      {
        taskId,
        recipientUserId: userId,
        reminderKey,
        scheduledFor,
        createdAt,
      }
    );

    await ctx.db.insert('scheduledReminders', {
      taskId,
      userId,
      scheduledFunctionId,
      reminderKey,
      scheduledFor,
      status: 'pending',
      createdAt,
    });

    return null;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// fireReminder — internalMutation (NOT internalAction)
//
// Runs as a mutation so that the eligibility check, bell write, push scheduling,
// and status update are all atomic in one transaction. Scheduled mutations also
// receive Convex's automatic retry-on-failure semantics, ensuring delivery
// resilience without manual retry logic.
//
// Full identity match (taskId + userId + reminderKey + scheduledFor + createdAt
// + pending) prevents an old canceled scheduled call that wakes late from
// matching a newer scheduling row that reused the same reminderKey.
// ─────────────────────────────────────────────────────────────────────────────

export const fireReminder = internalMutation({
  args: {
    taskId: v.id('tasks'),
    recipientUserId: v.id('users'),
    reminderKey: v.string(),
    scheduledFor: v.number(),
    createdAt: v.number(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { taskId, recipientUserId, reminderKey, scheduledFor, createdAt }
  ) => {
    // A. Find the exact scheduling row by full identity match.
    // Using only (taskId + userId + reminderKey) would allow an old canceled
    // scheduled call waking late to match a newly created row. The full 5-field
    // match (+ pending status) makes each scheduling attempt uniquely
    // identifiable so late-waking ghosts silently return without side effects.
    const allTaskRows = await ctx.db
      .query('scheduledReminders')
      .withIndex('by_task', (q) => q.eq('taskId', taskId))
      .collect();

    const scheduledReminder = allTaskRows.find(
      (row) =>
        row.userId === recipientUserId &&
        row.reminderKey === reminderKey &&
        row.scheduledFor === scheduledFor &&
        row.createdAt === createdAt &&
        row.status === 'pending'
    );

    if (!scheduledReminder) {
      // Row was canceled, replaced by a newer schedule, already sent, or never
      // successfully created. Do nothing.
      return null;
    }

    // B. Load and validate the task.
    const task = await ctx.db.get(taskId);

    if (!task) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    if (task.deletedAt !== undefined || task.archivedAt !== undefined) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    if (task.communityId === undefined) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    if (task.sourceType !== undefined) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    if (hasExplicitAssigneeForCommunityActivity(task)) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    // B2. For general community reminders, completion is per-user.
    // Check the recipient's personal completedAt — the shared task.completed field
    // is not authoritative for this task type after per-user completion was introduced.
    if (isGeneralCommunityReminder(task)) {
      const personal = await getPersonalCompletion(
        ctx,
        taskId,
        recipientUserId
      );
      if (personal.completed) {
        await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
        return null;
      }
    }

    // task.communityId is narrowed to Id<'communities'> here.
    const communityId = task.communityId;

    // C. Load and validate the community.
    const community = await ctx.db.get(communityId);

    if (!community) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    // D. Revalidate the recipient membership at fire time.
    // This is the authoritative mute check:
    //   - A member who muted after scheduling → no notification
    //   - A member who left or became inactive → no notification
    //   - A member who unmuted before firing → notification may be delivered
    const membership = await ctx.db
      .query('communityMembers')
      .withIndex('by_community_user', (q) =>
        q.eq('communityId', communityId).eq('userId', recipientUserId)
      )
      .unique();

    if (
      !isActiveCommunityMember(membership) ||
      membership.notificationsEnabled === false
    ) {
      await ctx.db.patch(scheduledReminder._id, { status: 'canceled' });
      return null;
    }

    // E. Build notification content from fresh task and community documents.
    // Never use content passed as scheduled-function arguments — those would
    // be stale after a title or community-name change.
    const title = `תזכורת מ${community.name}`;
    const body = task.title.trim();
    const screen = `/(authenticated)/community/${task.communityId}?tab=תזכורות`;

    // F. Create the in-app bell notification (unconditional — push opt-out does
    // not suppress the bell; sendPush handles opt-out independently).
    await createUserNotifications(ctx, {
      recipientUserIds: [recipientUserId],
      pushType: 'community_general_reminder_due',
      title,
      body,
      screen,
    });

    // G. Schedule push delivery (runs after this mutation commits).
    await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPush, {
      recipientUserIds: [recipientUserId],
      pushType: 'community_general_reminder_due',
      title,
      body,
      data: { screen },
      channelId: 'communities',
    });

    // H. Mark the row sent. Bell write, push scheduling, and status update are
    // all in this single mutation transaction.
    await ctx.db.patch(scheduledReminder._id, { status: 'sent' });

    return null;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelPendingRemindersForTask
//
// Cancels all pending scheduled-reminder rows for a task. Exposed as an
// internalMutation so it can be called from background jobs or future triggers.
// For synchronous inline use within tasks.ts, call cancelPendingJobsForTaskHelper
// directly instead.
// ─────────────────────────────────────────────────────────────────────────────

export const cancelPendingRemindersForTask = internalMutation({
  args: {
    taskId: v.id('tasks'),
  },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    await cancelPendingJobsForTaskHelper(ctx, taskId);
    return null;
  },
});
