import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { isActiveCommunityMember } from './communityMemberUtils';

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
  if (task.assignedTo === userId) {
    return true;
  }

  return (
    task.assignedTo === undefined &&
    task.createdBy === userId &&
    task.communityId === undefined &&
    task.sourceType === undefined
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
    category: v.optional(v.string()),
    communityId: v.optional(v.id('communities')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    return await ctx.db.insert('tasks', {
      ...args,
      spaceId: args.spaceId ?? undefined,
      completed: false,
      isAiGenerated: false,
      createdBy: userId,
      createdAt: Date.now(),
    });
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
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('משימה לא נמצאה');

    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, patch);
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
