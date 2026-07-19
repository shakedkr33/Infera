import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { insertCommunityActivity } from './communityActivities';
import { isActiveCommunityMember } from './communityMemberUtils';
import { createUserNotifications } from './userNotifications';

const taskReminderTypeValidator = v.union(
  v.literal('none'),
  v.literal('morning'),
  v.literal('evening'),
  v.literal('at_time'),
  v.literal('hour_before'),
  v.literal('custom')
);

const taskPersistedReminderTypeValidator = v.union(
  v.literal('morning'),
  v.literal('evening'),
  v.literal('at_time'),
  v.literal('hour_before'),
  v.literal('custom')
);

const taskReminderUnitValidator = v.union(
  v.literal('minutes'),
  v.literal('hours'),
  v.literal('days')
);

const taskReminderValidator = v.object({
  id: v.string(),
  type: taskPersistedReminderTypeValidator,
  customAmount: v.optional(v.number()),
  customUnit: v.optional(taskReminderUnitValidator),
  customReminderAt: v.optional(v.number()),
  label: v.optional(v.string()),
});

const taskRecurrenceTypeValidator = v.union(
  v.literal('none'),
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('specific_days')
);

const MAX_TASK_ATTACHMENTS = 4;

/** Client sends same shape as events.create attachments (no uploadedBy/uploadedAt). */
const taskAttachmentArgValidator = v.object({
  storageId: v.id('_storage'),
  originalName: v.string(),
  displayName: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
});

const taskSubtaskImageValidator = v.object({
  storageId: v.id('_storage'),
  mimeType: v.string(),
  sizeBytes: v.number(),
  createdAt: v.number(),
});

const taskSubtaskAttachmentValidator = v.object({
  id: v.string(),
  type: v.union(v.literal('image'), v.literal('file')),
  storageId: v.id('_storage'),
  mimeType: v.string(),
  sizeBytes: v.number(),
  createdAt: v.number(),
  originalName: v.optional(v.string()),
  displayName: v.optional(v.string()),
});

const taskSubtaskValidator = v.object({
  id: v.string(),
  title: v.string(),
  completed: v.boolean(),
  /** @deprecated prefer attachment */
  image: v.optional(taskSubtaskImageValidator),
  attachment: v.optional(taskSubtaskAttachmentValidator),
});

const clearableTaskFieldValidator = v.union(
  v.literal('description'),
  v.literal('dueDate'),
  v.literal('hasTime'),
  v.literal('dueAt'),
  v.literal('reminderType'),
  v.literal('customReminderAt'),
  v.literal('recurrenceType'),
  v.literal('selectedWeekdays'),
  v.literal('subtasks'),
  v.literal('allowParticipantEditing'),
  v.literal('assignedTo'),
  v.literal('assignedToMemberId'),
  v.literal('assignedToUserIds'),
  v.literal('assignedToMemberIds'),
  v.literal('reminders'),
  v.literal('attachments')
);

const editableTaskCategories = new Set([
  'personal',
  'shopping',
  'family',
  'work',
]);

function validateTaskCategory(category: string | undefined): void {
  if (category !== undefined && !editableTaskCategories.has(category)) {
    throw new Error('קטגוריית משימה לא תקינה');
  }
}

function validateTaskSchedule(args: {
  dueDate?: number;
  hasTime?: boolean;
  dueAt?: number;
  recurrenceType?: 'none' | 'daily' | 'weekly' | 'specific_days';
  customReminderAt?: number;
  reminders?: {
    customReminderAt?: number;
  }[];
}): void {
  if (args.recurrenceType && args.recurrenceType !== 'none' && !args.dueDate) {
    throw new Error('אי אפשר להגדיר חזרה ללא תאריך');
  }
  if (args.dueAt !== undefined && args.hasTime !== true) {
    throw new Error('שעה למשימה דורשת סימון שעה');
  }
  const reminderBaseTimestamp =
    args.dueAt ??
    (args.dueDate !== undefined
      ? args.dueDate + 9 * 60 * 60 * 1000
      : undefined);
  if (args.customReminderAt !== undefined) {
    const now = Date.now();
    if (args.customReminderAt < now) {
      throw new Error('התזכורת לא יכולה להיות בעבר');
    }
    if (
      reminderBaseTimestamp !== undefined &&
      args.customReminderAt > reminderBaseTimestamp
    ) {
      throw new Error('התזכורת חייבת להיות לפני מועד המשימה');
    }
  }
  for (const reminder of args.reminders ?? []) {
    if (reminder.customReminderAt === undefined) continue;
    const now = Date.now();
    if (reminder.customReminderAt < now) {
      throw new Error('התזכורת לא יכולה להיות בעבר');
    }
    if (
      reminderBaseTimestamp !== undefined &&
      reminder.customReminderAt > reminderBaseTimestamp
    ) {
      throw new Error('התזכורת חייבת להיות לפני מועד המשימה');
    }
  }
}

type TaskReminderInput = {
  id: string;
  type: 'morning' | 'evening' | 'at_time' | 'hour_before' | 'custom';
  customAmount?: number;
  customUnit?: 'minutes' | 'hours' | 'days';
  customReminderAt?: number;
  label?: string;
};

type TaskScheduleInput = {
  dueDate?: number;
  hasTime?: boolean;
  dueAt?: number;
};

function reminderBaseTimestamp(
  schedule: TaskScheduleInput
): number | undefined {
  if (schedule.dueAt !== undefined) return schedule.dueAt;
  if (schedule.dueDate !== undefined) {
    return schedule.dueDate + 9 * 60 * 60 * 1000;
  }
  return undefined;
}

function reminderOffsetMinutes(
  reminder: TaskReminderInput
): number | undefined {
  if (
    reminder.customAmount === undefined ||
    reminder.customUnit === undefined
  ) {
    return undefined;
  }
  if (reminder.customUnit === 'hours') return reminder.customAmount * 60;
  if (reminder.customUnit === 'days') return reminder.customAmount * 1440;
  return reminder.customAmount;
}

function resolveReminderTimestamp(
  reminder: TaskReminderInput,
  schedule: TaskScheduleInput
): number | undefined {
  if (reminder.type === 'morning') {
    return schedule.dueDate !== undefined
      ? schedule.dueDate + 9 * 60 * 60 * 1000
      : undefined;
  }
  if (reminder.type === 'evening') {
    return schedule.dueDate !== undefined
      ? schedule.dueDate + 18 * 60 * 60 * 1000
      : undefined;
  }
  if (reminder.type === 'at_time') {
    return schedule.hasTime === true ? schedule.dueAt : undefined;
  }
  if (reminder.type === 'hour_before') {
    return schedule.hasTime === true && schedule.dueAt !== undefined
      ? schedule.dueAt - 60 * 60 * 1000
      : undefined;
  }

  const offsetMinutes = reminderOffsetMinutes(reminder);
  const baseTimestamp = reminderBaseTimestamp(schedule);
  if (offsetMinutes !== undefined && baseTimestamp !== undefined) {
    return baseTimestamp - offsetMinutes * 60 * 1000;
  }
  return reminder.customReminderAt;
}

function normalizeRemindersForSchedule(
  reminders: TaskReminderInput[] | undefined,
  schedule: TaskScheduleInput,
  now: number
): TaskReminderInput[] | undefined {
  if (schedule.dueDate === undefined) return undefined;
  const cleaned = (reminders ?? []).flatMap((reminder) => {
    const reminderAt = resolveReminderTimestamp(reminder, schedule);
    if (reminderAt === undefined || reminderAt < now) return [];
    if (reminder.type !== 'custom') return [reminder];
    return [{ ...reminder, customReminderAt: reminderAt }];
  });
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeCustomReminderAtForSchedule(
  customReminderAt: number | undefined,
  schedule: TaskScheduleInput,
  now: number
): number | undefined {
  if (customReminderAt === undefined || customReminderAt < now) {
    return undefined;
  }
  const baseTimestamp = reminderBaseTimestamp(schedule);
  if (baseTimestamp !== undefined && customReminderAt > baseTimestamp) {
    return undefined;
  }
  return customReminderAt;
}

function storageIdsFromTaskAttachments(
  attachments: { storageId: Id<'_storage'> }[] | null | undefined
): Set<string> {
  const s = new Set<string>();
  for (const a of attachments ?? []) {
    s.add(a.storageId as string);
  }
  return s;
}

function storageIdsFromSubtaskImages(
  subtasks:
    | {
        image?: { storageId: Id<'_storage'> } | undefined;
        attachment?: { storageId: Id<'_storage'> } | undefined;
      }[]
    | null
    | undefined
): Set<string> {
  const s = new Set<string>();
  for (const st of subtasks ?? []) {
    if (st.image?.storageId) {
      s.add(st.image.storageId as string);
    }
    if (st.attachment?.storageId) {
      s.add(st.attachment.storageId as string);
    }
  }
  return s;
}

function sanitizeSubtasks(
  subtasks:
    | {
        id: string;
        title: string;
        completed: boolean;
        image?: {
          storageId: Id<'_storage'>;
          mimeType: string;
          sizeBytes: number;
          createdAt: number;
        };
        attachment?: {
          id: string;
          type: 'image' | 'file';
          storageId: Id<'_storage'>;
          mimeType: string;
          sizeBytes: number;
          createdAt: number;
          originalName?: string;
          displayName?: string;
        };
      }[]
    | undefined
):
  | {
      id: string;
      title: string;
      completed: boolean;
      image?: {
        storageId: Id<'_storage'>;
        mimeType: string;
        sizeBytes: number;
        createdAt: number;
      };
      attachment?: {
        id: string;
        type: 'image' | 'file';
        storageId: Id<'_storage'>;
        mimeType: string;
        sizeBytes: number;
        createdAt: number;
        originalName?: string;
        displayName?: string;
      };
    }[]
  | undefined {
  if (!subtasks) return undefined;
  const cleaned = subtasks
    .map((subtask) => {
      const row: {
        id: string;
        title: string;
        completed: boolean;
        image?: {
          storageId: Id<'_storage'>;
          mimeType: string;
          sizeBytes: number;
          createdAt: number;
        };
        attachment?: {
          id: string;
          type: 'image' | 'file';
          storageId: Id<'_storage'>;
          mimeType: string;
          sizeBytes: number;
          createdAt: number;
          originalName?: string;
          displayName?: string;
        };
      } = {
        id: subtask.id,
        title: subtask.title.trim(),
        completed: subtask.completed,
      };
      if (subtask.attachment) {
        row.attachment = subtask.attachment;
      } else if (subtask.image) {
        row.image = subtask.image;
      }
      return row;
    })
    .filter((subtask) => subtask.title.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function stampTaskAttachments(
  attachments: {
    storageId: Id<'_storage'>;
    originalName: string;
    displayName: string;
    mimeType: string;
    sizeBytes: number;
  }[],
  userId: Id<'users'>,
  existing: Doc<'tasks'> | null,
  now: number
): {
  storageId: Id<'_storage'>;
  originalName: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  uploadedBy: Id<'users'>;
}[] {
  const existingByStorageId = new Map(
    (existing?.attachments ?? []).map((a) => [a.storageId as string, a])
  );
  return attachments.map((a) => {
    const prev = existingByStorageId.get(a.storageId as string);
    return {
      ...a,
      uploadedBy: prev?.uploadedBy ?? userId,
      uploadedAt: prev?.uploadedAt ?? now,
    };
  });
}

async function getCommunityMembership(
  ctx: QueryCtx | MutationCtx,
  communityId: Id<'communities'>,
  userId: Id<'users'>
) {
  return await ctx.db
    .query('communityMembers')
    .withIndex('by_community_user', (q) =>
      q.eq('communityId', communityId).eq('userId', userId)
    )
    .unique();
}

async function resolveCurrentEventImportantItemTask(
  ctx: QueryCtx,
  task: Doc<'tasks'>
): Promise<Doc<'tasks'> | null> {
  if (task.sourceType !== 'community_event_important_item') {
    return task;
  }

  if (!task.sourceEventId) {
    return null;
  }

  const event = await ctx.db.get(task.sourceEventId);
  if (!event) {
    return null;
  }

  const currentImportantItemIds = new Set(
    (event.importantItems ?? []).map((item) => item.id)
  );

  const isCurrentItem = [task.sourceImportantItemId, task._id as string].some(
    (id) => id !== undefined && currentImportantItemIds.has(id)
  );

  if (!isCurrentItem) {
    return null;
  }

  return {
    ...task,
    dueDate: event.startTime,
  };
}

function getImportantItemDueDate(eventStart: number): number | undefined {
  if (eventStart < Date.now()) {
    return undefined;
  }
  return eventStart;
}

function isPersonalTaskForUser(
  task: Doc<'tasks'>,
  userId: Doc<'users'>['_id']
): boolean {
  if (task.createdBy === userId) {
    return true;
  }

  if (task.assignedTo === userId) {
    return true;
  }

  if ((task.assignedToUserIds ?? []).some((id) => id === userId)) {
    return true;
  }

  return (
    task.assignedTo === undefined &&
    task.communityId === undefined &&
    task.sourceType === undefined
  );
}

/**
 * A task is "personally deletable" (soft-delete allowed) only if:
 * - The current user created it (createdBy === userId), AND
 * - It is NOT a community reminder (communityId set without sourceType).
 *
 * Important items copied from an event (sourceType === 'community_event_important_item')
 * ARE deletable even when communityId is set — they are personal copies owned by the user.
 *
 * Community/event-assigned tasks from the eventTasks table are handled separately
 * and are not represented by this function.
 */
function isPersonallyDeletableTask(
  task: Doc<'tasks'>,
  userId: Id<'users'>
): boolean {
  if (task.createdBy !== userId) return false;
  // Community reminders (communityId set, no sourceType) are community-shared, not personal
  if (task.communityId !== undefined && task.sourceType === undefined)
    return false;
  return true;
}

/**
 * Returns true if userId is the creator or an active assignee of the task.
 * Used to gate participant-level read/write access.
 */
function isUserParticipantInTask(
  task: Doc<'tasks'>,
  userId: Id<'users'>
): boolean {
  if (task.createdBy === userId) return true;
  if (task.assignedTo === userId) return true;
  return (task.assignedToUserIds ?? []).some((id) => id === userId);
}

/** When no assignee was chosen in the UI, persist creator as assignee (no orphan tasks). */
function normalizeAssigneesForWrite(
  fallbackUserId: Id<'users'>,
  input: {
    assignedTo?: Id<'users'>;
    assignedToMemberId?: Id<'members'>;
    assignedToUserIds?: Id<'users'>[];
    assignedToMemberIds?: Id<'members'>[];
  }
): {
  assignedTo: Id<'users'> | undefined;
  assignedToMemberId: Id<'members'> | undefined;
  assignedToUserIds: Id<'users'>[];
  assignedToMemberIds: Id<'members'>[];
} {
  const userIds = Array.from(new Set(input.assignedToUserIds ?? []));
  const memberIds = Array.from(new Set(input.assignedToMemberIds ?? []));
  let assignedTo = input.assignedTo;
  let assignedToMemberId = input.assignedToMemberId;

  const empty =
    userIds.length === 0 &&
    memberIds.length === 0 &&
    assignedTo === undefined &&
    assignedToMemberId === undefined;

  if (empty) {
    return {
      assignedTo: fallbackUserId,
      assignedToMemberId: undefined,
      assignedToUserIds: [fallbackUserId],
      assignedToMemberIds: [],
    };
  }

  if (userIds.length > 0 && assignedTo === undefined) {
    assignedTo = userIds[0];
  }
  if (memberIds.length > 0 && assignedToMemberId === undefined) {
    assignedToMemberId = memberIds[0];
  }

  return {
    assignedTo,
    assignedToMemberId,
    assignedToUserIds: userIds,
    assignedToMemberIds: memberIds,
  };
}

function hadExplicitAssigneeForCommunityActivity(args: {
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

// ─────────────────────────────────────────────────────────────
// שליפת תזכורות שהושלמו לאחרונה לקהילה (עד 30 יום)
// ─────────────────────────────────────────────────────────────
export const listCompletedCommunityReminders = query({
  args: {
    communityId: v.id('communities'),
    since: v.number(),
  },
  handler: async (ctx, { communityId, since }) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_community', (q) => q.eq('communityId', communityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('completed'), true),
          q.eq(q.field('assignedTo'), undefined),
          q.gte(q.field('completedAt'), since)
        )
      )
      .order('desc')
      .collect();
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת תזכורות קהילה עם cursor pagination (לביצועים)
// ─────────────────────────────────────────────────────────────
export const listCommunityRemindersPaged = query({
  args: {
    communityId: v.id('communities'),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, { communityId, cursor, numItems }) => {
    const result = await ctx.db
      .query('tasks')
      .withIndex('by_community', (q) => q.eq('communityId', communityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('completed'), false),
          q.eq(q.field('assignedTo'), undefined)
        )
      )
      .paginate({ cursor, numItems: numItems ?? 20 });
    const resolvedPage = await Promise.all(
      result.page.map((task) => resolveCurrentEventImportantItemTask(ctx, task))
    );

    return {
      ...result,
      page: resolvedPage.filter((task): task is Doc<'tasks'> => task !== null),
    };
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת משימות פתוחות לפי קהילה
// ─────────────────────────────────────────────────────────────
export const listByCommunity = query({
  args: { communityId: v.id('communities') },
  handler: async (ctx, { communityId }) => {
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_community', (q) => q.eq('communityId', communityId))
      .filter((q) =>
        q.and(
          q.eq(q.field('completed'), false),
          q.eq(q.field('assignedTo'), undefined)
        )
      )
      .order('asc')
      .collect();
    const resolvedRows = await Promise.all(
      rows.map((task) => resolveCurrentEventImportantItemTask(ctx, task))
    );

    return resolvedRows.filter((task): task is Doc<'tasks'> => task !== null);
  },
});

export const listEventImportantItems = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(eventId);
    if (!event) return [];
    if (!event.communityId) {
      return (event.importantItems ?? []).map((item) => ({
        id: item.id,
        title: item.title,
      }));
    }

    const communityId = event.communityId;
    const membership = await ctx.db
      .query('communityMembers')
      .withIndex('by_community_user', (q) =>
        q.eq('communityId', communityId).eq('userId', userId)
      )
      .unique();
    if (!isActiveCommunityMember(membership)) return [];

    const rows = (
      await ctx.db
        .query('tasks')
        .withIndex('by_community', (q) => q.eq('communityId', communityId))
        .collect()
    )
      .filter(
        (task) =>
          task.sourceType === 'community_event_important_item' &&
          task.sourceEventId === eventId &&
          task.assignedTo === undefined
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    if (rows.length === 0) {
      return (event.importantItems ?? []).map((item) => ({
        id: item.id,
        title: item.title,
      }));
    }

    return rows.map((task) => ({
      id: task._id as string,
      title: task.title,
    }));
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת כל המשימות שהמשתמש מעורב בהן (ללא סינון לפי space)
// מחזיר:
//   1. משימות שנוצרו על ידי המשתמש (by_creator)
//   2. משימות שהוקצו לו כ-assignedTo הראשי (by_assigned)
//   3. משימות שנוצרו על ידי חברי ה-space שלו שבהן הוא
//      מופיע ב-assignedToUserIds (assignee משני)
// ─────────────────────────────────────────────────────────────
export const listMyTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const taskMap = new Map<string, Doc<'tasks'>>();

    const addTask = (task: Doc<'tasks'>): void => {
      const key = task._id as string;
      if (!taskMap.has(key)) taskMap.set(key, task);
    };

    // ── 1. Tasks where current user is primary assignee ────────────────────
    const assignedTasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned', (q) => q.eq('assignedTo', userId))
      .filter((q) => q.eq(q.field('deletedAt'), undefined))
      .collect();
    for (const task of assignedTasks) addTask(task);

    // ── 2. Tasks created by current user ───────────────────────────────────
    const createdTasks = await ctx.db
      .query('tasks')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .filter((q) => q.eq(q.field('deletedAt'), undefined))
      .collect();
    for (const task of createdTasks) addTask(task);

    // ── 3. Tasks created by space co-members where user is secondary assignee
    // (handles the case where assignedToUserIds includes userId but
    //  assignedTo points to a different primary assignee)
    const memberRows = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const spaceIds = [...new Set(memberRows.map((m) => m.spaceId))];

    for (const spaceId of spaceIds) {
      const spaceMemberRows = await ctx.db
        .query('members')
        .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
        .collect();

      const coMemberUserIds = spaceMemberRows
        .filter((m) => m.userId !== undefined && m.userId !== userId)
        .map((m) => m.userId as Id<'users'>);

      for (const coUserId of coMemberUserIds) {
        const coTasks = await ctx.db
          .query('tasks')
          .withIndex('by_creator', (q) => q.eq('createdBy', coUserId))
          .filter((q) => q.eq(q.field('deletedAt'), undefined))
          .collect();

        for (const task of coTasks) {
          if (taskMap.has(task._id as string)) continue;
          const userIds = (task.assignedToUserIds ?? []) as Id<'users'>[];
          if (userIds.includes(userId)) {
            addTask(task);
          }
        }
      }
    }

    const tasks = [...taskMap.values()];

    // Batch-fetch community names for tasks that have communityId, so the
    // Tasks screen can render the community chip without a separate query.
    const uniqueCommunityIds = [
      ...new Set(
        tasks
          .map((t) => t.communityId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      ),
    ];
    const communityNameMap = new Map<string, string>();
    await Promise.all(
      uniqueCommunityIds.map(async (communityId) => {
        const community = await ctx.db.get(communityId);
        if (community?.name) {
          communityNameMap.set(String(communityId), community.name);
        }
      })
    );

    // Batch-resolve member assignee display names directly from the DB.
    // This mirrors the resolution used in getTaskDetails so task cards and the
    // detail sheet always show the same name for the same assignee.
    const allMemberIds = new Set<string>();
    for (const task of tasks) {
      for (const mid of task.assignedToMemberIds ?? [])
        allMemberIds.add(String(mid));
      if (task.assignedToMemberId)
        allMemberIds.add(String(task.assignedToMemberId));
    }

    const memberProfileMap = new Map<
      string,
      { name: string; color: string | null }
    >();
    await Promise.all(
      [...allMemberIds].map(async (mid) => {
        const member = await ctx.db.get(mid as Id<'members'>);
        if (!member) return;
        let name =
          (member as { displayName?: string }).displayName?.trim() ?? '';
        if (!name) {
          const matchedId = (member as { matchedUserId?: string })
            .matchedUserId;
          if (matchedId) {
            const user = await ctx.db.get(matchedId as Id<'users'>);
            name =
              (user as { fullName?: string } | null)?.fullName?.trim() ?? '';
          }
        }
        memberProfileMap.set(mid, {
          name,
          color: (member as { color?: string }).color ?? null,
        });
      })
    );

    return tasks.map((task) => {
      const seenMids = new Set<string>();
      const assigneeMemberProfiles: {
        id: string;
        name: string;
        color: string | null;
      }[] = [];
      for (const rawMid of [
        ...(task.assignedToMemberIds?.map(String) ?? []),
        ...(task.assignedToMemberId ? [String(task.assignedToMemberId)] : []),
      ]) {
        if (seenMids.has(rawMid)) continue;
        seenMids.add(rawMid);
        const profile = memberProfileMap.get(rawMid);
        if (profile) assigneeMemberProfiles.push({ id: rawMid, ...profile });
      }

      return {
        ...task,
        communityName: task.communityId
          ? communityNameMap.get(String(task.communityId))
          : undefined,
        assigneeMemberProfiles,
      };
    });
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת כל המשימות של space (עם תאריך)
// ─────────────────────────────────────────────────────────────
export const listBySpace = query({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, { spaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
      .filter((q) =>
        q.and(
          q.neq(q.field('dueDate'), undefined),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .order('asc')
      .collect();
    const resolvedRows = await Promise.all(
      rows
        .filter((task) => isPersonalTaskForUser(task, userId))
        .map((task) => resolveCurrentEventImportantItemTask(ctx, task))
    );

    return resolvedRows.filter(
      (task): task is Doc<'tasks'> =>
        task !== null && task.dueDate !== undefined
    );
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת משימות ללא תאריך (undated tasks)
// ─────────────────────────────────────────────────────────────
export const listUndated = query({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, { spaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
      .filter((q) =>
        q.and(
          q.eq(q.field('dueDate'), undefined),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .collect();
    const resolvedRows = await Promise.all(
      rows
        .filter((task) => isPersonalTaskForUser(task, userId))
        .map((task) => resolveCurrentEventImportantItemTask(ctx, task))
    );

    return resolvedRows.filter(
      (task): task is Doc<'tasks'> =>
        task !== null && task.dueDate === undefined
    );
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת משימות קשורות ליום הולדת לפי birthdayId
// ─────────────────────────────────────────────────────────────
export const listByRelatedBirthday = query({
  args: { birthdayId: v.string() },
  handler: async (ctx, { birthdayId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query('tasks')
      .withIndex('by_related_birthday', (q) =>
        q.eq('relatedBirthdayId', birthdayId)
      )
      .filter((q) => q.eq(q.field('deletedAt'), undefined))
      .order('desc')
      .collect();
  },
});

// ─────────────────────────────────────────────────────────────
// יצירת משימה חדשה
// ─────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()), // undefined = ללא תאריך
    spaceId: v.optional(v.id('spaces')),
    assignedTo: v.optional(v.id('users')),
    assignedToMemberId: v.optional(v.id('members')),
    assignedToUserIds: v.optional(v.array(v.id('users'))),
    assignedToMemberIds: v.optional(v.array(v.id('members'))),
    category: v.optional(v.string()),
    hasTime: v.optional(v.boolean()),
    dueAt: v.optional(v.number()),
    reminderType: v.optional(taskReminderTypeValidator),
    customReminderAt: v.optional(v.number()),
    reminders: v.optional(v.array(taskReminderValidator)),
    recurrenceType: v.optional(taskRecurrenceTypeValidator),
    selectedWeekdays: v.optional(v.array(v.number())),
    subtasks: v.optional(v.array(taskSubtaskValidator)),
    allowParticipantEditing: v.optional(v.boolean()),
    attachments: v.optional(v.array(taskAttachmentArgValidator)),
    communityId: v.optional(v.id('communities')),
    relatedType: v.optional(v.literal('birthday')),
    relatedBirthdayId: v.optional(v.string()),
    relatedBirthdayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    if (args.attachments && args.attachments.length > MAX_TASK_ATTACHMENTS) {
      throw new Error(
        `לא ניתן לצרף יותר מ-${MAX_TASK_ATTACHMENTS} קבצים למשימה`
      );
    }

    const now = Date.now();
    const stampedAttachments =
      args.attachments && args.attachments.length > 0
        ? args.attachments.map((a) => ({
            ...a,
            uploadedBy: userId,
            uploadedAt: now,
          }))
        : undefined;

    const normalizedScheduleArgs = {
      ...args,
      dueAt: args.hasTime === true ? args.dueAt : undefined,
    };
    const normalizedReminders = normalizeRemindersForSchedule(
      args.reminders,
      normalizedScheduleArgs,
      now
    );
    const normalizedCustomReminderAt =
      normalizedReminders?.find((reminder) => reminder.type === 'custom')
        ?.customReminderAt ??
      (args.reminderType === 'custom'
        ? normalizeCustomReminderAtForSchedule(
            args.customReminderAt,
            normalizedScheduleArgs,
            now
          )
        : undefined);

    if (args.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        args.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) {
        throw new Error('רק חברי קהילה פעילים יכולים ליצור תזכורת');
      }
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new Error('רק בעלים או מנהלי קהילה יכולים ליצור תזכורת קהילתית');
      }
    }
    validateTaskCategory(args.category);
    validateTaskSchedule({
      ...normalizedScheduleArgs,
      customReminderAt: normalizedCustomReminderAt,
      reminders: normalizedReminders,
    });

    const {
      assignedTo: argAssignedTo,
      assignedToMemberId: argAssignedToMemberId,
      assignedToUserIds: argAssignedToUserIds,
      assignedToMemberIds: argAssignedToMemberIds,
      ...restInsertArgs
    } = args;

    const explicitAssigneeArgs = {
      assignedTo: argAssignedTo,
      assignedToMemberId: argAssignedToMemberId,
      assignedToUserIds: argAssignedToUserIds,
      assignedToMemberIds: argAssignedToMemberIds,
    };

    // Community reminders with no explicit assignee must be stored with
    // assignedTo === undefined so they match the filter in
    // listCommunityRemindersPaged / listCompletedCommunityReminders / listByCommunity.
    // Personal tasks (no communityId) keep the creator-fallback assignment.
    const normalizedAssignees =
      args.communityId !== undefined &&
      !hadExplicitAssigneeForCommunityActivity(explicitAssigneeArgs)
        ? {
            assignedTo: undefined as Id<'users'> | undefined,
            assignedToMemberId: undefined as Id<'members'> | undefined,
            assignedToUserIds: [] as Id<'users'>[],
            assignedToMemberIds: [] as Id<'members'>[],
          }
        : normalizeAssigneesForWrite(userId, explicitAssigneeArgs);

    const taskId = await ctx.db.insert('tasks', {
      ...restInsertArgs,
      dueAt: normalizedScheduleArgs.dueAt,
      spaceId: args.spaceId ?? undefined,
      assignedTo: normalizedAssignees.assignedTo,
      assignedToMemberId: normalizedAssignees.assignedToMemberId,
      assignedToUserIds:
        normalizedAssignees.assignedToUserIds.length > 0
          ? normalizedAssignees.assignedToUserIds
          : undefined,
      assignedToMemberIds:
        normalizedAssignees.assignedToMemberIds.length > 0
          ? normalizedAssignees.assignedToMemberIds
          : undefined,
      attachments: stampedAttachments,
      reminderType: normalizedReminders?.[0]?.type ?? 'none',
      customReminderAt: normalizedCustomReminderAt,
      reminders: normalizedReminders,
      subtasks: sanitizeSubtasks(args.subtasks),
      completed: false,
      isAiGenerated: false,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.communityId && !hadExplicitAssigneeForCommunityActivity(args)) {
      const communityId = args.communityId;
      await insertCommunityActivity(ctx, {
        communityId,
        actorUserId: userId,
        type: 'reminder_created',
        entityType: 'reminder',
        entityId: taskId,
        title: `נוספה תזכורת: ${args.title.trim()}`,
      });

      const community = await ctx.db.get(communityId);
      if (community) {
        const allMembers = await ctx.db
          .query('communityMembers')
          .withIndex('by_community', (q) => q.eq('communityId', communityId))
          .collect();

        const recipientUserIds = allMembers
          .filter(
            (m) =>
              isActiveCommunityMember(m) &&
              m.userId !== userId &&
              m.notificationsEnabled !== false
          )
          .map((m) => m.userId);

        if (recipientUserIds.length > 0) {
          const reminderCreatedTitle = `תזכורת חדשה ב${community.name}`;
          const reminderCreatedBody = args.title.trim();
          const reminderCreatedScreen = `/(authenticated)/community/${communityId}?tab=תזכורות`;

          await createUserNotifications(ctx, {
            recipientUserIds,
            pushType: 'community_general_reminder_created',
            title: reminderCreatedTitle,
            body: reminderCreatedBody,
            screen: reminderCreatedScreen,
          });

          await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPush, {
            recipientUserIds,
            pushType: 'community_general_reminder_created',
            title: reminderCreatedTitle,
            body: reminderCreatedBody,
            data: { screen: reminderCreatedScreen },
            channelId: 'communities',
          });
        }
      }
    }

    return taskId;
  },
});

// ─────────────────────────────────────────────────────────────
// החלפת מצב השלמה (toggle)
// ─────────────────────────────────────────────────────────────
export const toggleCompleted = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(task, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }

    const nowCompleted = !task.completed;
    await ctx.db.patch(id, {
      completed: nowCompleted,
      completedAt: nowCompleted ? Date.now() : undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת משימה בודדת לפי ID (לדף עריכה)
// ─────────────────────────────────────────────────────────────
export const getById = query({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    // TODO: לאמת שהמשתמש הנוכחי שייך ל-space של המשימה
    return await ctx.db.get(id);
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת פרטי משימה מועשרת להצגה במסך Task Details
// ─────────────────────────────────────────────────────────────
export const getTaskDetails = query({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return null;

    const task = await ctx.db.get(id);
    if (!task) return null;

    // ── Creator profile ──────────────────────────────────────────────────────
    const creator = task.createdBy ? await ctx.db.get(task.createdBy) : null;
    const creatorProfile = creator
      ? {
          id: task.createdBy as string,
          name: (creator as { fullName?: string }).fullName ?? 'משתמש',
          color: (creator as { profileColor?: string }).profileColor ?? null,
        }
      : null;

    // ── User assignees ────────────────────────────────────────────────────────
    // assignedToUserIds is the authoritative multi-assignee list.
    // Fall back to the legacy single assignedTo field only when the array is absent/empty.
    const rawUserIds: string[] =
      task.assignedToUserIds && task.assignedToUserIds.length > 0
        ? [...task.assignedToUserIds]
        : task.assignedTo
          ? [task.assignedTo]
          : [];

    const seenUsers = new Set<string>();
    const userAssigneeIds = rawUserIds.filter((uid) => {
      if (seenUsers.has(uid)) return false;
      seenUsers.add(uid);
      return true;
    });

    // ── Member assignees (family entities without an app account) ─────────────
    // assignedToMemberIds holds people who were added via family contacts but
    // have no matched userId — e.g. a manually-added member like Shalev.
    const rawMemberIds: string[] =
      task.assignedToMemberIds && task.assignedToMemberIds.length > 0
        ? [...task.assignedToMemberIds]
        : task.assignedToMemberId
          ? [task.assignedToMemberId]
          : [];

    const seenMembers = new Set<string>();
    const memberAssigneeIds = rawMemberIds.filter((mid) => {
      if (seenMembers.has(mid)) return false;
      seenMembers.add(mid);
      return true;
    });

    // ── Resolve assignee profiles ─────────────────────────────────────────────
    const assignees: {
      id: string;
      name: string;
      color: string | null;
      kind: 'user' | 'member';
    }[] = [];

    for (const uid of userAssigneeIds) {
      const user = await ctx.db.get(uid as Id<'users'>);
      if (user) {
        assignees.push({
          id: uid,
          name: (user as { fullName?: string }).fullName ?? 'משתמש',
          color: (user as { profileColor?: string }).profileColor ?? null,
          kind: 'user',
        });
      }
    }

    for (const mid of memberAssigneeIds) {
      const member = await ctx.db.get(mid as Id<'members'>);
      if (member) {
        let memberName =
          (member as { displayName?: string }).displayName?.trim() ?? '';
        if (!memberName) {
          const matchedId = (member as { matchedUserId?: string })
            .matchedUserId;
          if (matchedId) {
            const linkedUser = await ctx.db.get(matchedId as Id<'users'>);
            memberName =
              (linkedUser as { fullName?: string } | null)?.fullName?.trim() ??
              '';
          }
        }
        assignees.push({
          id: mid,
          name: memberName,
          color: (member as { color?: string }).color ?? null,
          kind: 'member',
        });
      }
    }

    const currentUserIsCreator = task.createdBy === currentUserId;

    return {
      ...task,
      creatorProfile,
      assignees,
      currentUserId,
      currentUserIsCreator,
    };
  },
});

// ─────────────────────────────────────────────────────────────
// עדכון שדות משימה קיימת
// ─────────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    assignedTo: v.optional(v.id('users')),
    assignedToMemberId: v.optional(v.id('members')),
    assignedToUserIds: v.optional(v.array(v.id('users'))),
    assignedToMemberIds: v.optional(v.array(v.id('members'))),
    category: v.optional(v.string()),
    hasTime: v.optional(v.boolean()),
    dueAt: v.optional(v.number()),
    reminderType: v.optional(taskReminderTypeValidator),
    customReminderAt: v.optional(v.number()),
    reminders: v.optional(v.array(taskReminderValidator)),
    recurrenceType: v.optional(taskRecurrenceTypeValidator),
    selectedWeekdays: v.optional(v.array(v.number())),
    subtasks: v.optional(v.array(taskSubtaskValidator)),
    allowParticipantEditing: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    attachments: v.optional(v.array(taskAttachmentArgValidator)),
    clearFields: v.optional(v.array(clearableTaskFieldValidator)),
  },
  handler: async (
    ctx,
    { id, clearFields, attachments, subtasks, ...fields }
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    const isCreator = existing.createdBy === userId;
    const isParticipant = isUserParticipantInTask(existing, userId);

    if (!isParticipant) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }

    if (!isCreator) {
      if (
        fields.title !== undefined &&
        fields.title.trim() !== existing.title
      ) {
        throw new Error('רק יוצר/ת המשימה יכול/ה לשנות את שם המשימה');
      }
      if (
        fields.category !== undefined &&
        fields.category !== existing.category
      ) {
        throw new Error('רק יוצר/ת המשימה יכול/ה לשנות את קטגוריית המשימה');
      }
      if (
        fields.recurrenceType !== undefined &&
        fields.recurrenceType !== (existing.recurrenceType ?? 'none')
      ) {
        throw new Error('רק יוצר/ת המשימה יכול/ה לשנות את הגדרת החזרה');
      }
      if (
        fields.allowParticipantEditing !== undefined &&
        fields.allowParticipantEditing !==
          (existing.allowParticipantEditing ?? false)
      ) {
        throw new Error('רק יוצר/ת המשימה יכול/ה לשנות הגדרה זו');
      }
      if (
        subtasks !== undefined &&
        !(existing.allowParticipantEditing ?? false)
      ) {
        const existingSnap = JSON.stringify(
          (existing.subtasks ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          }))
        );
        const newSnap = JSON.stringify(
          (sanitizeSubtasks(subtasks) ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          }))
        );
        if (existingSnap !== newSnap) {
          throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
        }
      }
    }

    validateTaskCategory(fields.category);
    const now = Date.now();
    const cleared = new Set(clearFields ?? []);
    const nextHasTime = cleared.has('hasTime')
      ? fields.hasTime
      : (fields.hasTime ?? existing.hasTime);
    const nextDueAt =
      nextHasTime === true && !cleared.has('dueAt')
        ? (fields.dueAt ?? existing.dueAt)
        : undefined;
    const nextDueDate = cleared.has('dueDate')
      ? undefined
      : (fields.dueDate ?? existing.dueDate);
    const nextReminders = cleared.has('reminders')
      ? undefined
      : normalizeRemindersForSchedule(
          fields.reminders ?? existing.reminders,
          {
            dueDate: nextDueDate,
            hasTime: nextHasTime,
            dueAt: nextDueAt,
          },
          now
        );
    const nextReminderType = cleared.has('reminderType')
      ? undefined
      : (fields.reminderType ?? existing.reminderType);
    const customReminderFromList = nextReminders?.find(
      (reminder) => reminder.type === 'custom'
    )?.customReminderAt;
    const nextCustomReminderAt =
      customReminderFromList ??
      (cleared.has('customReminderAt') || nextReminders !== undefined
        ? undefined
        : nextReminderType === 'custom'
          ? normalizeCustomReminderAtForSchedule(
              fields.customReminderAt ?? existing.customReminderAt,
              {
                dueDate: nextDueDate,
                hasTime: nextHasTime,
                dueAt: nextDueAt,
              },
              now
            )
          : undefined);
    validateTaskSchedule({
      dueDate: nextDueDate,
      hasTime: nextHasTime,
      dueAt: nextDueAt,
      recurrenceType: fields.recurrenceType ?? existing.recurrenceType,
      customReminderAt: nextCustomReminderAt,
      reminders: nextReminders,
    });

    if (
      attachments !== undefined &&
      attachments.length > MAX_TASK_ATTACHMENTS
    ) {
      throw new Error(
        `לא ניתן לצרף יותר מ-${MAX_TASK_ATTACHMENTS} קבצים למשימה`
      );
    }

    const clearingAttachments = clearFields?.includes('attachments') ?? false;
    const clearingSubtasks = clearFields?.includes('subtasks') ?? false;

    const nextAttachments = (() => {
      if (clearingAttachments) return undefined;
      if (attachments !== undefined) {
        if (attachments.length === 0) return undefined;
        return stampTaskAttachments(attachments, userId, existing, now);
      }
      return existing.attachments;
    })();

    const nextSubtasks = (() => {
      if (clearingSubtasks) return undefined;
      if (subtasks !== undefined) {
        return sanitizeSubtasks(subtasks);
      }
      return existing.subtasks;
    })();

    const storageBefore = new Set([
      ...storageIdsFromTaskAttachments(existing.attachments),
      ...storageIdsFromSubtaskImages(existing.subtasks),
    ]);
    const storageAfter = new Set([
      ...storageIdsFromTaskAttachments(nextAttachments),
      ...storageIdsFromSubtaskImages(nextSubtasks),
    ]);
    for (const sid of storageBefore) {
      if (!storageAfter.has(sid)) {
        await ctx.storage.delete(sid as Id<'_storage'>);
      }
    }

    const patch: Partial<Doc<'tasks'>> = Object.fromEntries(
      Object.entries({
        ...fields,
        updatedAt: now,
      }).filter(([, value]) => value !== undefined)
    ) as Partial<Doc<'tasks'>>;

    patch.reminderType = nextReminders?.[0]?.type ?? 'none';
    patch.customReminderAt = nextCustomReminderAt;
    patch.reminders = nextReminders;

    if (attachments !== undefined || clearingAttachments) {
      patch.attachments = nextAttachments;
    }
    if (subtasks !== undefined || clearingSubtasks) {
      patch.subtasks = nextSubtasks;
    }

    for (const field of clearFields ?? []) {
      (patch as Record<string, undefined>)[field] = undefined;
    }

    const nextUserIds = cleared.has('assignedToUserIds')
      ? []
      : 'assignedToUserIds' in fields
        ? (fields.assignedToUserIds ?? [])
        : (existing.assignedToUserIds ?? []);
    const nextMemberIds = cleared.has('assignedToMemberIds')
      ? []
      : 'assignedToMemberIds' in fields
        ? (fields.assignedToMemberIds ?? [])
        : (existing.assignedToMemberIds ?? []);
    const nextAssignedTo = cleared.has('assignedTo')
      ? undefined
      : 'assignedTo' in fields
        ? fields.assignedTo
        : existing.assignedTo;
    const nextAssignedToMemberId = cleared.has('assignedToMemberId')
      ? undefined
      : 'assignedToMemberId' in fields
        ? fields.assignedToMemberId
        : existing.assignedToMemberId;

    if (
      nextUserIds.length === 0 &&
      nextMemberIds.length === 0 &&
      nextAssignedTo === undefined &&
      nextAssignedToMemberId === undefined
    ) {
      const fb = existing.createdBy;
      patch.assignedTo = fb;
      patch.assignedToMemberId = undefined;
      patch.assignedToUserIds = [fb];
      patch.assignedToMemberIds = undefined;
    } else {
      patch.assignedTo = nextAssignedTo;
      patch.assignedToMemberId = nextAssignedToMemberId;
      patch.assignedToUserIds =
        nextUserIds.length > 0 ? nextUserIds : undefined;
      patch.assignedToMemberIds =
        nextMemberIds.length > 0 ? nextMemberIds : undefined;
    }

    if (!isCreator) {
      // Participants cannot modify task-level reminders — they manage their own
      // via the separate updateMyTaskReminder mutation.
      patch.reminderType = existing.reminderType ?? 'none';
      patch.customReminderAt = existing.customReminderAt;
      patch.reminders = existing.reminders;
      // Participants cannot modify assignees
      patch.assignedTo = existing.assignedTo;
      patch.assignedToMemberId = existing.assignedToMemberId;
      patch.assignedToUserIds = existing.assignedToUserIds;
      patch.assignedToMemberIds = existing.assignedToMemberIds;
    }

    await ctx.db.patch(id, patch);
  },
});

export const toggleSubtaskCompleted = mutation({
  args: { id: v.id('tasks'), subtaskId: v.string() },
  handler: async (ctx, { id, subtaskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(existing, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }
    if (
      existing.createdBy !== userId &&
      !(existing.allowParticipantEditing ?? false)
    ) {
      throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
    }

    const subtasks = existing.subtasks ?? [];
    const nextSubtasks = subtasks.map((subtask) =>
      subtask.id === subtaskId
        ? { ...subtask, completed: !subtask.completed }
        : subtask
    );

    await ctx.db.patch(id, {
      subtasks: nextSubtasks,
      updatedAt: Date.now(),
    });
  },
});

export const setSubtaskAttachment = mutation({
  args: {
    id: v.id('tasks'),
    subtaskId: v.string(),
    attachment: v.optional(
      v.object({
        id: v.string(),
        type: v.union(v.literal('image'), v.literal('file')),
        storageId: v.id('_storage'),
        mimeType: v.string(),
        sizeBytes: v.number(),
        createdAt: v.number(),
        originalName: v.optional(v.string()),
        displayName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { id, subtaskId, attachment }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(existing, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }
    if (
      existing.createdBy !== userId &&
      !(existing.allowParticipantEditing ?? false)
    ) {
      throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
    }

    const subtasks = (existing.subtasks ?? []).map((st) =>
      st.id === subtaskId ? { ...st, attachment: attachment ?? undefined } : st
    );

    await ctx.db.patch(id, { subtasks, updatedAt: Date.now() });
  },
});

export const addSubtask = mutation({
  args: { id: v.id('tasks'), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const trimmed = title.trim();
    if (!trimmed) return;

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(existing, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }
    if (
      existing.createdBy !== userId &&
      !(existing.allowParticipantEditing ?? false)
    ) {
      throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
    }

    const newSubtask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trimmed,
      completed: false,
    };

    await ctx.db.patch(id, {
      subtasks: [...(existing.subtasks ?? []), newSubtask],
      updatedAt: Date.now(),
    });
  },
});

export const removeSubtask = mutation({
  args: { id: v.id('tasks'), subtaskId: v.string() },
  handler: async (ctx, { id, subtaskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(existing, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }
    if (
      existing.createdBy !== userId &&
      !(existing.allowParticipantEditing ?? false)
    ) {
      throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
    }

    await ctx.db.patch(id, {
      subtasks: (existing.subtasks ?? []).filter((st) => st.id !== subtaskId),
      updatedAt: Date.now(),
    });
  },
});

export const reorderSubtasks = mutation({
  args: { id: v.id('tasks'), orderedIds: v.array(v.string()) },
  handler: async (ctx, { id, orderedIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(existing, userId)) {
      throw new Error('אין הרשאה לעדכן משימה זו');
    }
    if (
      existing.createdBy !== userId &&
      !(existing.allowParticipantEditing ?? false)
    ) {
      throw new Error('יוצר/ת המשימה לא אפשר/ה עריכת תתי־משימות');
    }

    const subtaskMap = new Map(
      (existing.subtasks ?? []).map((st) => [st.id, st])
    );
    const reordered = orderedIds
      .map((sid) => subtaskMap.get(sid))
      .filter((st): st is NonNullable<typeof st> => st !== undefined);

    // append any subtasks not in the provided order list (safety)
    for (const st of existing.subtasks ?? []) {
      if (!orderedIds.includes(st.id)) reordered.push(st);
    }

    await ctx.db.patch(id, {
      subtasks: reordered,
      updatedAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקת משימה
// ─────────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    // Community reminder (communityId set, no sourceType) — requires active
    // owner/admin membership, mirroring the same gate used in tasks.create.
    // softDeleteTask explicitly blocks this path for community reminders,
    // confirming that hard-delete via remove() is their intended deletion route,
    // managed at the community role level rather than individual ownership.
    if (existing.communityId !== undefined && existing.sourceType === undefined) {
      const membership = await getCommunityMembership(
        ctx,
        existing.communityId,
        userId
      );
      if (
        !isActiveCommunityMember(membership) ||
        (membership.role !== 'owner' && membership.role !== 'admin')
      ) {
        throw new Error('אין לך הרשאה למחוק משימה זו');
      }
    } else {
      // Personal task or event-linked task — participant check, consistent
      // with the same gate used by update() and toggleCompleted().
      if (!isUserParticipantInTask(existing, userId)) {
        throw new Error('אין לך הרשאה למחוק משימה זו');
      }
    }

    await ctx.db.delete(id);
  },
});

export const addEventImportantItemsToMyTasks = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('האירוע לא נמצא');

    if (event.communityId) {
      const communityId = event.communityId;
      const membership = await ctx.db
        .query('communityMembers')
        .withIndex('by_community_user', (q) =>
          q.eq('communityId', communityId).eq('userId', userId)
        )
        .unique();
      if (!isActiveCommunityMember(membership)) {
        throw new Error('אין הרשאה לצפות באירוע');
      }
    } else if (event.createdBy !== userId) {
      throw new Error('אין הרשאה לצפות באירוע');
    }

    const importantItems = event.importantItems ?? [];
    if (importantItems.length === 0) {
      return { created: 0, alreadyExisted: 0 };
    }

    // Check if an active bundle task already exists for this user + event.
    const existingBundle = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_source_event', (q) =>
        q.eq('assignedTo', userId).eq('sourceEventId', eventId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('sourceType'), 'community_event_important_items_bundle'),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .first();

    if (existingBundle) {
      return { created: 0, alreadyExisted: 1 };
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const user = membership?.spaceId ? null : await ctx.db.get(userId);
    const spaceId = membership?.spaceId ?? user?.defaultSpaceId;

    const dueDate = getImportantItemDueDate(event.startTime);

    const subtasks = importantItems.map((item) => ({
      id: item.id,
      title: item.title,
      completed: false,
    }));

    await ctx.db.insert('tasks', {
      title: `חשוב לזכור - ${event.title}`,
      completed: false,
      subtasks,
      spaceId,
      assignedTo: userId,
      communityId: event.communityId,
      dueDate,
      isAiGenerated: false,
      createdBy: userId,
      createdAt: Date.now(),
      sourceType: 'community_event_important_items_bundle',
      sourceEventId: eventId,
    });

    return { created: 1, alreadyExisted: 0 };
  },
});

export const hasUserCopiedAllImportantItemsFromEvent = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { totalItems: 0, copiedItems: 0, allCopied: false };
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      return { totalItems: 0, copiedItems: 0, allCopied: false };
    }

    if (event.communityId) {
      const communityId = event.communityId;
      const membership = await ctx.db
        .query('communityMembers')
        .withIndex('by_community_user', (q) =>
          q.eq('communityId', communityId).eq('userId', userId)
        )
        .unique();
      if (!isActiveCommunityMember(membership)) {
        return { totalItems: 0, copiedItems: 0, allCopied: false };
      }
    } else if (event.createdBy !== userId) {
      return { totalItems: 0, copiedItems: 0, allCopied: false };
    }

    const totalItems = event.importantItems?.length ?? 0;
    if (totalItems === 0) {
      return { totalItems: 0, copiedItems: 0, allCopied: false };
    }

    // Source of truth: an active bundle task exists for this user + event.
    const bundleTask = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_source_event', (q) =>
        q.eq('assignedTo', userId).eq('sourceEventId', eventId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('sourceType'), 'community_event_important_items_bundle'),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .first();

    if (bundleTask) {
      return { totalItems, copiedItems: totalItems, allCopied: true };
    }
    return { totalItems, copiedItems: 0, allCopied: false };
  },
});

// ─────────────────────────────────────────────────────────────
// Toggles a personal "חשוב לזכור" task linked to a community
// event important item. If the task doesn't exist yet, it is
// created in a completed state (first tap = done).
// Subsequent calls toggle the task's completed state.
// This enables two-way sync: the same task record drives both
// the event-detail checkbox and the "המשימות שלי" list.
// ─────────────────────────────────────────────────────────────
export const toggleImportantItemCheck = mutation({
  args: {
    eventId: v.id('events'),
    itemId: v.string(),
    itemTitle: v.string(),
  },
  handler: async (ctx, { eventId, itemId, itemTitle }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existingTask = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_source_event', (q) =>
        q.eq('assignedTo', userId).eq('sourceEventId', eventId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('sourceImportantItemId'), itemId),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .first();

    if (existingTask) {
      const nowCompleted = !existingTask.completed;
      await ctx.db.patch(existingTask._id, {
        completed: nowCompleted,
        completedAt: nowCompleted ? Date.now() : undefined,
      });
    } else {
      const event = await ctx.db.get(eventId);
      if (!event) throw new Error('האירוע לא נמצא');

      const membershipRow = await ctx.db
        .query('members')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .first();
      const user = membershipRow?.spaceId ? null : await ctx.db.get(userId);
      const spaceId = membershipRow?.spaceId ?? user?.defaultSpaceId;

      let communityName: string | undefined;
      if (event.communityId) {
        const community = await ctx.db.get(event.communityId);
        communityName = community?.name;
      }
      const descriptionParts: string[] = [];
      if (communityName) descriptionParts.push(`קהילה: ${communityName}`);
      descriptionParts.push(`אירוע: ${event.title}`);
      const description =
        descriptionParts.length > 0 ? descriptionParts.join(' · ') : undefined;

      await ctx.db.insert('tasks', {
        title: itemTitle,
        description,
        completed: true,
        completedAt: Date.now(),
        spaceId,
        assignedTo: userId,
        communityId: event.communityId,
        category: 'אירועים',
        dueDate: getImportantItemDueDate(event.startTime),
        isAiGenerated: false,
        createdBy: userId,
        createdAt: Date.now(),
        sourceType: 'community_event_important_item',
        sourceEventId: eventId,
        sourceImportantItemId: itemId,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────
// Returns a nested map: eventId → { itemId: completed }
// for all "חשוב לזכור" personal tasks the current user has.
// Used to drive personal checkboxes in event detail, home, and
// timeline — a single reactive query shared across all screens.
// ─────────────────────────────────────────────────────────────
export const getMyImportantItemChecks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {} as Record<string, Record<string, boolean>>;

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned', (q) => q.eq('assignedTo', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('sourceType'), 'community_event_important_item'),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .collect();

    const result: Record<string, Record<string, boolean>> = {};
    for (const task of tasks) {
      if (!task.sourceEventId || !task.sourceImportantItemId) continue;
      const eventKey = String(task.sourceEventId);
      if (!result[eventKey]) result[eventKey] = {};
      result[eventKey][task.sourceImportantItemId] = task.completed;
    }
    return result;
  },
});

// ─────────────────────────────────────────────────────────────
// Returns all personal "חשוב לזכור" tasks for the current user,
// enriched with event title / date and community name, so the
// Tasks screen can render them under "משימות מאירועים".
// ─────────────────────────────────────────────────────────────
export const listMyImportantItemTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned', (q) => q.eq('assignedTo', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('sourceType'), 'community_event_important_item'),
          q.eq(q.field('deletedAt'), undefined)
        )
      )
      .collect();

    const results = await Promise.all(
      tasks.map(async (task) => {
        if (!task.sourceEventId) return null;

        const event = await ctx.db.get(task.sourceEventId);
        if (!event) return null;

        // Only surface items that still exist in the event
        const currentItemIds = new Set(
          (event.importantItems ?? []).map((i) => i.id)
        );
        const stillValid =
          task.sourceImportantItemId !== undefined &&
          currentItemIds.has(task.sourceImportantItemId);
        if (!stillValid) return null;

        let communityName = '';
        if (event.communityId) {
          const community = await ctx.db.get(event.communityId);
          communityName = community?.name ?? '';
        }

        return {
          _id: task._id,
          title: task.title,
          completed: task.completed,
          eventTitle: event.title,
          eventStartTime: event.startTime,
          eventAllDay: event.allDay ?? false,
          communityName,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקה רכה (soft delete) של משימה אישית
// ─────────────────────────────────────────────────────────────
export const softDeleteTask = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');

    if (!isPersonallyDeletableTask(task, userId)) {
      throw new Error('לא ניתן למחוק משימה זו');
    }

    // Idempotent — already soft-deleted
    if (task.deletedAt !== undefined) return;

    const now = Date.now();
    await ctx.db.patch(id, {
      deletedAt: now,
      // TODO: Future cleanup cron should hard-delete expired soft-deleted tasks after deleteExpiresAt and safely clean related subtasks, shopping data, attachments, previews, and Convex Storage files.
      deleteExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      deletedBy: userId,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// שחזור משימה שנמחקה רכה
// ─────────────────────────────────────────────────────────────
export const restoreTask = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');

    if (task.deletedBy !== userId) {
      throw new Error('אין הרשאה לשחזר משימה זו');
    }

    await ctx.db.patch(id, {
      deletedAt: undefined,
      deleteExpiresAt: undefined,
      deletedBy: undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// רשימת פריטים שנמחקו לאחרונה (עבור מסך "נמחקו לאחרונה")
// מחזיר רק משימות; ניתן להרחיב בעתיד לסוגי פריטים נוספים.
// ─────────────────────────────────────────────────────────────
export const listRecentlyDeleted = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_deleted_by', (q) => q.eq('deletedBy', userId))
      .filter((q) => q.neq(q.field('deletedAt'), undefined))
      .order('desc')
      .collect();

    return tasks.map((task) => ({
      id: task._id,
      type: 'task' as const,
      title: task.title,
      deletedAt: task.deletedAt,
      deleteExpiresAt: task.deleteExpiresAt,
    }));
  },
});

// ─────────────────────────────────────────────────────────────
// תזכורת אישית של המשתתף — קריאה
// ─────────────────────────────────────────────────────────────
export const getMyTaskReminder = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query('taskParticipantSettings')
      .withIndex('by_task_user', (q) =>
        q.eq('taskId', taskId).eq('userId', userId)
      )
      .unique();
  },
});

// ─────────────────────────────────────────────────────────────
// עדכון תזכורת אישית של המשתתף בלבד
// לא משפיע על תזכורות שאר המשתתפים / היוצר
// ─────────────────────────────────────────────────────────────
export const updateMyTaskReminder = mutation({
  args: {
    taskId: v.id('tasks'),
    reminders: v.optional(v.array(taskReminderValidator)),
    reminderType: v.optional(taskReminderTypeValidator),
    customReminderAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { taskId, reminders, reminderType, customReminderAt }
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error('משימה לא נמצאה');

    if (!isUserParticipantInTask(task, userId)) {
      throw new Error('אין הרשאה לעדכן תזכורת למשימה זו');
    }

    const existing = await ctx.db
      .query('taskParticipantSettings')
      .withIndex('by_task_user', (q) =>
        q.eq('taskId', taskId).eq('userId', userId)
      )
      .unique();

    const settingsData = { reminders, reminderType, customReminderAt };

    if (existing) {
      if (existing.leftAt !== undefined) {
        throw new Error('עזבת את המשימה הזו');
      }
      await ctx.db.patch(existing._id, settingsData);
    } else {
      await ctx.db.insert('taskParticipantSettings', {
        taskId,
        userId,
        ...settingsData,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────
// עזיבת משימה משותפת (משתתף שאינו יוצר)
// המשימה נשארת אצל שאר המשתתפים והיוצר
// ─────────────────────────────────────────────────────────────
export const leaveTask = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error('משימה לא נמצאה');

    if (task.createdBy === userId) {
      throw new Error('יוצר/ת המשימה לא יכול/ה לעזוב. מחק/י את המשימה במקום.');
    }

    if (!isUserParticipantInTask(task, userId)) {
      throw new Error('אינך משתתף/ת במשימה זו');
    }

    // Remove user from assignees
    const newUserIds = (task.assignedToUserIds ?? []).filter(
      (id) => String(id) !== String(userId)
    );
    const newAssignedTo =
      task.assignedTo === userId
        ? (newUserIds[0] ?? task.createdBy)
        : task.assignedTo;

    await ctx.db.patch(taskId, {
      assignedToUserIds: newUserIds.length > 0 ? newUserIds : undefined,
      assignedTo: newAssignedTo,
      updatedAt: Date.now(),
    });

    // Record the leave in taskParticipantSettings
    const existing = await ctx.db
      .query('taskParticipantSettings')
      .withIndex('by_task_user', (q) =>
        q.eq('taskId', taskId).eq('userId', userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { leftAt: Date.now() });
    } else {
      await ctx.db.insert('taskParticipantSettings', {
        taskId,
        userId,
        leftAt: Date.now(),
      });
    }
  },
});
