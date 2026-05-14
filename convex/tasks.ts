import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { insertCommunityActivity } from './communityActivities';
import { isActiveCommunityMember } from './communityMemberUtils';

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
      .filter((q) => q.neq(q.field('dueDate'), undefined))
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
      .filter((q) => q.eq(q.field('dueDate'), undefined))
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

    const normalizedAssignees = normalizeAssigneesForWrite(userId, {
      assignedTo: argAssignedTo,
      assignedToMemberId: argAssignedToMemberId,
      assignedToUserIds: argAssignedToUserIds,
      assignedToMemberIds: argAssignedToMemberIds,
    });

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
      await insertCommunityActivity(ctx, {
        communityId: args.communityId,
        actorUserId: userId,
        type: 'reminder_created',
        entityType: 'reminder',
        entityId: taskId,
        title: `נוספה תזכורת: ${args.title.trim()}`,
      });
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

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const user = membership?.spaceId ? null : await ctx.db.get(userId);
    const spaceId = membership?.spaceId ?? user?.defaultSpaceId;

    const dueDate = getImportantItemDueDate(event.startTime);

    const existingTasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_source_event', (q) =>
        q.eq('assignedTo', userId).eq('sourceEventId', eventId)
      )
      .collect();
    const existingItemIds = new Set(
      existingTasks
        .map((task) => task.sourceImportantItemId)
        .filter((id): id is string => typeof id === 'string')
    );

    let created = 0;
    let alreadyExisted = 0;

    for (const item of importantItems) {
      if (existingItemIds.has(item.id)) {
        alreadyExisted++;
        continue;
      }

      await ctx.db.insert('tasks', {
        title: item.title,
        completed: false,
        spaceId,
        assignedTo: userId,
        communityId: event.communityId,
        dueDate,
        isAiGenerated: false,
        createdBy: userId,
        createdAt: Date.now(),
        sourceType: 'community_event_important_item',
        sourceEventId: eventId,
        sourceImportantItemId: item.id,
      });
      created++;
      existingItemIds.add(item.id);
    }

    return { created, alreadyExisted };
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

    const existingTasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_source_event', (q) =>
        q.eq('assignedTo', userId).eq('sourceEventId', eventId)
      )
      .collect();
    const existingItemIds = new Set(
      existingTasks
        .map((task) => task.sourceImportantItemId)
        .filter((id): id is string => typeof id === 'string')
    );

    const copiedItems = (event.importantItems ?? []).filter((item) =>
      existingItemIds.has(item.id)
    ).length;
    return {
      totalItems,
      copiedItems,
      allCopied: totalItems > 0 && copiedItems === totalItems,
    };
  },
});
