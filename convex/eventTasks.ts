import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { saveCommunityEventToPersonalCalendar } from './communityEventCalendarHelpers';
import { isActiveCommunityMember } from './communityMemberUtils';

// ─────────────────────────────────────────────────────────────
// סיכום משימות לפי קהילה (לתצוגת כרטיסי אירועים — ללא N+1)
// ─────────────────────────────────────────────────────────────
export const getTaskCountsByCommunity = query({
  args: { communityId: v.id('communities') },
  handler: async (ctx, { communityId }) => {
    const events = await ctx.db
      .query('events')
      .withIndex('by_community_date', (q) => q.eq('communityId', communityId))
      .collect();

    const counts: Record<string, { total: number; assigned: number }> = {};

    await Promise.all(
      events.map(async (ev) => {
        const tasks = await ctx.db
          .query('eventTasks')
          .withIndex('by_event', (q) => q.eq('eventId', ev._id))
          .collect();
        counts[ev._id] = {
          total: tasks.length,
          assigned: tasks.filter(
            (t) => t.assignedToUserId || t.assignedToManual?.trim()
          ).length,
        };
      })
    );

    return counts;
  },
});

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

// ─────────────────────────────────────────────────────────────
// שליפת משימות אירוע (כולל assignee display)
// ─────────────────────────────────────────────────────────────
export const listByEvent = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(eventId);
    if (!event) return [];

    if (event.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) return [];

      const canManageTasks =
        event.createdBy === userId ||
        membership.role === 'owner' ||
        membership.role === 'admin';

      if (!canManageTasks && event.tasksVisibleToParticipants !== true)
        return [];
    } else if (event.createdBy !== userId) {
      return [];
    }

    const tasks = await ctx.db
      .query('eventTasks')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();

    const enriched = await Promise.all(
      tasks.map(async (t) => {
        let assigneeDisplay: string | undefined;
        if (t.assignedToUserId) {
          const user = await ctx.db.get(t.assignedToUserId);
          assigneeDisplay =
            (user as { fullName?: string } | null)?.fullName ?? undefined;
        } else if (t.assignedToManual?.trim()) {
          assigneeDisplay = t.assignedToManual.trim();
        }
        return { ...t, assigneeDisplay };
      })
    );

    return enriched.sort((a, b) => {
      const oa = a.order ?? 0;
      const ob = b.order ?? 0;
      if (oa !== ob) return oa - ob;
      return a._creationTime - b._creationTime;
    });
  },
});

// ─────────────────────────────────────────────────────────────
// יצירת משימת אירוע
// ─────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    eventId: v.id('events'),
    title: v.string(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { eventId, title, order }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('אירוע לא נמצא');
    if (event.createdBy !== userId) throw new Error('אין הרשאה להוסיף משימות');

    return await ctx.db.insert('eventTasks', {
      eventId,
      title: title.trim(),
      completed: false,
      order: order ?? 0,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// יצירת משימות במקבץ (לאחר יצירת אירוע)
// ─────────────────────────────────────────────────────────────
export const createBatch = mutation({
  args: {
    eventId: v.id('events'),
    tasks: v.array(v.object({ title: v.string() })),
  },
  handler: async (ctx, { eventId, tasks }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('אירוע לא נמצא');
    if (event.createdBy !== userId) throw new Error('אין הרשאה להוסיף משימות');

    const ids: string[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.title?.trim()) continue;
      const id = await ctx.db.insert('eventTasks', {
        eventId,
        title: t.title.trim(),
        completed: false,
        order: i,
      });
      ids.push(id);
    }
    return ids;
  },
});

// ─────────────────────────────────────────────────────────────
// עדכון כותרת משימה
// ─────────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id('eventTasks'),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');

    const event = await ctx.db.get(task.eventId);
    if (!event || event.createdBy !== userId)
      throw new Error('אין הרשאה לערוך משימות');

    await ctx.db.patch(id, { title: title.trim() });
  },
});

// ─────────────────────────────────────────────────────────────
// החלפת מצב השלמה (חבר קהילה בלבד)
// ─────────────────────────────────────────────────────────────
export const toggleCompleted = mutation({
  args: { id: v.id('eventTasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');
    const event = await ctx.db.get(task.eventId);
    if (!event) throw new Error('אירוע לא נמצא');

    if (event.communityId) {
      const communityId = event.communityId;
      if (!communityId) throw new Error('אירוע זה אינו שייך לקהילה');
      const member = await ctx.db
        .query('communityMembers')
        .withIndex('by_community_user', (q) =>
          q.eq('communityId', communityId).eq('userId', userId)
        )
        .unique();
      if (!member) throw new Error('רק חברי הקהילה יכולים לעדכן משימות');
    }

    const nowCompleted = !task.completed;
    await ctx.db.patch(id, {
      completed: nowCompleted,
      completedAt: nowCompleted ? Date.now() : undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// הקצאת משימה או ביטול הקצאה
// assignee: { type: 'user', userId } | { type: 'manual', name } | null
// ─────────────────────────────────────────────────────────────
export const setAssignee = mutation({
  args: {
    id: v.id('eventTasks'),
    assignee: v.union(
      v.object({ type: v.literal('user'), userId: v.id('users') }),
      v.object({ type: v.literal('manual'), name: v.string() }),
      v.null()
    ),
  },
  handler: async (ctx, { id, assignee }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');
    const event = await ctx.db.get(task.eventId);
    if (!event) throw new Error('אירוע לא נמצא');

    const hasUserId = !!task.assignedToUserId;
    const hasManual = !!task.assignedToManual?.trim();
    const isAssigned = hasUserId || hasManual;
    let canManageAssignments = event.createdBy === userId;
    const isAssignedUser = task.assignedToUserId === userId;

    if (event.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) {
        throw new Error('רק חברי קהילה פעילים יכולים להקצות משימות');
      }
      canManageAssignments =
        canManageAssignments ||
        membership.role === 'owner' ||
        membership.role === 'admin';
    }

    if (assignee === null) {
      if (!canManageAssignments && !isAssignedUser)
        throw new Error('רק הממונה או יוצר האירוע יכולים לבטל הקצאה');
      if (hasManual && !canManageAssignments)
        throw new Error('רק יוצר האירוע יכול לשנות הקצאה ידנית');
      await ctx.db.patch(id, {
        assignedToUserId: undefined,
        assignedToManual: undefined,
      });
      return;
    }

    if (assignee.type === 'manual') {
      if (!canManageAssignments)
        throw new Error('רק מנהלי האירוע יכולים להקצות שם ידני');
      await ctx.db.patch(id, {
        assignedToUserId: undefined,
        assignedToManual: assignee.name.trim() || undefined,
      });
      return;
    }

    if (assignee.type === 'user') {
      if (!canManageAssignments && isAssigned)
        throw new Error('רק יוצר האירוע או הממונה הנוכחי יכולים לשנות הקצאה');
      if (!canManageAssignments && !isAssigned && assignee.userId !== userId)
        throw new Error('משימה לא מוקצית – ניתן להקצות רק את עצמך');
      await ctx.db.patch(id, {
        assignedToUserId: assignee.userId,
        assignedToManual: undefined,
      });
    }
  },
});

export const updateEventTaskVisibility = mutation({
  args: {
    eventId: v.id('events'),
    tasksVisibleToParticipants: v.boolean(),
  },
  handler: async (ctx, { eventId, tasksVisibleToParticipants }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('אירוע לא נמצא');

    if (!event.communityId) {
      if (event.createdBy !== userId)
        throw new Error('אין הרשאה לעדכן נראות משימות');
    } else {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      const canManage =
        event.createdBy === userId ||
        membership?.role === 'owner' ||
        membership?.role === 'admin';
      if (!isActiveCommunityMember(membership) || !canManage) {
        throw new Error('אין הרשאה לעדכן נראות משימות');
      }
    }

    await ctx.db.patch(eventId, { tasksVisibleToParticipants });
  },
});

export const claimEventTask = mutation({
  args: { id: v.id('eventTasks') },
  returns: v.object({
    taskId: v.id('eventTasks'),
    wasAddedToCalendar: v.boolean(),
    rsvpChanged: v.union(
      v.literal('set_to_yes'),
      v.literal('unchanged'),
      v.literal('not_applicable')
    ),
  }),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');
    const event = await ctx.db.get(task.eventId);
    if (!event || !event.communityId)
      throw new Error('פעולה זו זמינה רק באירוע קהילתי');
    if (event.startTime <= Date.now()) {
      throw new ConvexError({
        code: 'EVENT_IS_PAST',
        message: 'לא ניתן להשתבץ למשימה באירוע שעבר',
      });
    }

    const membership = await getCommunityMembership(
      ctx,
      event.communityId,
      userId
    );
    if (!isActiveCommunityMember(membership)) {
      throw new Error('רק חברי קהילה פעילים יכולים להשתבץ למשימה');
    }

    const canManage =
      event.createdBy === userId ||
      membership.role === 'owner' ||
      membership.role === 'admin';

    if (!canManage && event.tasksVisibleToParticipants !== true) {
      throw new Error('המשימות אינן גלויות למשתתפים');
    }

    const isAssigned =
      !!task.assignedToUserId || !!task.assignedToManual?.trim();
    if (isAssigned) throw new Error('המשימה כבר הוקצתה');

    await ctx.db.patch(id, {
      assignedToUserId: userId,
      assignedToManual: undefined,
    });

    const { wasAddedToCalendar } =
      await saveCommunityEventToPersonalCalendar(ctx, {
        userId,
        eventId: event._id,
        communityId: event.communityId,
      });

    let rsvpChanged: 'set_to_yes' | 'unchanged' | 'not_applicable' =
      'not_applicable';
    if (event.requiresRsvp === true) {
      const existingRsvp = await ctx.db
        .query('eventRsvps')
        .withIndex('by_event_user', (q) =>
          q.eq('eventId', event._id).eq('userId', userId)
        )
        .unique();
      if (existingRsvp?.status === 'yes') {
        rsvpChanged = 'unchanged';
      } else if (existingRsvp) {
        await ctx.db.patch(existingRsvp._id, {
          status: 'yes',
          updatedAt: Date.now(),
        });
        rsvpChanged = 'set_to_yes';
      } else {
        await ctx.db.insert('eventRsvps', {
          eventId: event._id,
          userId,
          status: 'yes',
          updatedAt: Date.now(),
        });
        rsvpChanged = 'set_to_yes';
      }
    }

    return { taskId: id, wasAddedToCalendar, rsvpChanged };
  },
});

export const unclaimEventTask = mutation({
  args: { id: v.id('eventTasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');
    const event = await ctx.db.get(task.eventId);
    if (!event || !event.communityId)
      throw new Error('פעולה זו זמינה רק באירוע קהילתי');

    const membership = await getCommunityMembership(
      ctx,
      event.communityId,
      userId
    );
    if (!isActiveCommunityMember(membership)) {
      throw new Error('רק חברי קהילה פעילים יכולים להסיר הקצאה');
    }

    const canManage =
      event.createdBy === userId ||
      membership.role === 'owner' ||
      membership.role === 'admin';

    if (!canManage && event.tasksVisibleToParticipants !== true) {
      throw new Error('המשימות אינן גלויות למשתתפים');
    }

    if (!task.assignedToUserId) throw new Error('המשימה אינה מוקצית למשתמש');
    if (!canManage && task.assignedToUserId !== userId) {
      throw new Error('ניתן להסיר רק הקצאה של עצמך');
    }

    await ctx.db.patch(id, {
      assignedToUserId: undefined,
      assignedToManual: undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────
// משימות מוקצות למשתמש הנוכחי בקהילות — לדף הבית
// ─────────────────────────────────────────────────────────────
export const listMyAssignedEventTasksForDate = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query('communityMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const activeMembers = memberships.filter((m) => isActiveCommunityMember(m));

    const results = await Promise.all(
      activeMembers.map(async ({ communityId }) => {
        const community = await ctx.db.get(communityId);
        if (!community || community.archived) return [];

        const events = await ctx.db
          .query('events')
          .withIndex('by_community_date', (q) =>
            q
              .eq('communityId', communityId)
              .gte('startTime', from)
              .lte('startTime', to)
          )
          .collect();

        const activeEvents = events.filter((ev) => ev.status !== 'cancelled');

        const taskRows = await Promise.all(
          activeEvents.map(async (ev) => {
            const tasks = await ctx.db
              .query('eventTasks')
              .withIndex('by_event', (q) => q.eq('eventId', ev._id))
              .collect();

            return tasks
              .filter((t) => t.assignedToUserId === userId)
              .map((t) => ({
                _id: t._id,
                title: t.title,
                completed: t.completed ?? false,
                eventId: ev._id,
                eventTitle: ev.title,
                eventStartTime: ev.startTime,
                eventAllDay: ev.allDay ?? false,
                communityId,
                communityName: community.name,
              }));
          })
        );

        return taskRows.flat();
      })
    );

    return results.flat();
  },
});

export const listMyAssignedEventTasks = query({
  args: { from: v.number(), to: v.number() },
  returns: v.array(
    v.object({
      _id: v.id('eventTasks'),
      title: v.string(),
      completed: v.boolean(),
      eventId: v.id('events'),
      eventTitle: v.string(),
      eventStartTime: v.number(),
      eventEndTime: v.number(),
      eventAllDay: v.boolean(),
      communityId: v.id('communities'),
      communityName: v.string(),
    })
  ),
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query('communityMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const activeMembers = memberships.filter((m) => isActiveCommunityMember(m));

    const results = await Promise.all(
      activeMembers.map(async ({ communityId }) => {
        const community = await ctx.db.get(communityId);
        if (!community || community.archived) return [];

        const events = await ctx.db
          .query('events')
          .withIndex('by_community_date', (q) =>
            q
              .eq('communityId', communityId)
              .gte('startTime', from)
              .lte('startTime', to)
          )
          .collect();

        const activeEvents = events.filter((ev) => ev.status !== 'cancelled');

        const taskRows = await Promise.all(
          activeEvents.map(async (ev) => {
            const tasks = await ctx.db
              .query('eventTasks')
              .withIndex('by_event', (q) => q.eq('eventId', ev._id))
              .collect();

            return tasks
              .filter((t) => t.assignedToUserId === userId)
              .map((t) => ({
                _id: t._id,
                title: t.title,
                completed: t.completed ?? false,
                eventId: ev._id,
                eventTitle: ev.title,
                eventStartTime: ev.startTime,
                eventEndTime: ev.endTime,
                eventAllDay: ev.allDay ?? false,
                communityId,
                communityName: community.name,
              }));
          })
        );

        return taskRows.flat();
      })
    );

    return results
      .flat()
      .sort((a, b) => a.eventStartTime - b.eventStartTime);
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקת משימה
// ─────────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id('eventTasks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const task = await ctx.db.get(id);
    if (!task) throw new Error('משימה לא נמצאה');

    const event = await ctx.db.get(task.eventId);
    if (!event || event.createdBy !== userId)
      throw new Error('אין הרשאה למחוק משימות');

    await ctx.db.delete(id);
  },
});
