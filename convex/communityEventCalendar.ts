import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { mutation } from './_generated/server';
import {
  removeCommunityEventFromPersonalCalendar,
  saveCommunityEventToPersonalCalendar,
} from './communityEventCalendarHelpers';
import { isActiveCommunityMember } from './communityMemberUtils';

async function getCommunityMembership(
  ctx: MutationCtx,
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

async function getMyActiveAssignedEventTasks(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  userId: Id<'users'>
) {
  const tasks = await ctx.db
    .query('eventTasks')
    .withIndex('by_event', (q) => q.eq('eventId', eventId))
    .collect();
  return tasks.filter(
    (task) => task.assignedToUserId === userId && task.completed !== true
  );
}

export const addCommunityEventToMyCalendar = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event?.communityId) throw new Error('אירוע לא נמצא');
    if (event.requiresRsvp === true) {
      throw new Error('אירוע זה דורש אישור הגעה');
    }
    if (event.status === 'cancelled')
      throw new Error('לא ניתן להוסיף אירוע שבוטל');

    const membership = await getCommunityMembership(
      ctx,
      event.communityId,
      userId
    );
    if (!isActiveCommunityMember(membership)) {
      throw new Error('אין הרשאה');
    }

    const rsvpRow = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_user', (q) =>
        q.eq('eventId', eventId).eq('userId', userId)
      )
      .unique();
    if (rsvpRow?.status === 'yes') {
      return { success: true as const };
    }

    await saveCommunityEventToPersonalCalendar(ctx, {
      userId,
      eventId,
      communityId: event.communityId,
    });
    return { success: true as const };
  },
});

export const removeCommunityEventFromMyCalendar = mutation({
  args: {
    eventId: v.id('events'),
    confirmRemoveWithActiveTask: v.optional(v.boolean()),
  },
  handler: async (ctx, { eventId, confirmRemoveWithActiveTask }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event?.communityId) throw new Error('אירוע לא נמצא');

    const membership = await getCommunityMembership(
      ctx,
      event.communityId,
      userId
    );
    if (!isActiveCommunityMember(membership)) {
      throw new Error('אין הרשאה');
    }

    const assignedTasks =
      event.status === 'cancelled'
        ? []
        : await getMyActiveAssignedEventTasks(ctx, eventId, userId);
    if (assignedTasks.length > 0 && confirmRemoveWithActiveTask !== true) {
      throw new ConvexError({
        code: 'CALENDAR_REMOVE_REQUIRES_ACTIVE_TASK_CONFIRMATION',
        message: 'נדרש אישור להסרת אירוע עם משימה פעילה',
      });
    }

    await removeCommunityEventFromPersonalCalendar(ctx, {
      userId,
      eventId,
      requiresRsvp: event.requiresRsvp,
    });
    return { success: true as const };
  },
});

export const removeEventFromCalendarAndUnclaim = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event?.communityId) throw new Error('אירוע לא נמצא');

    const membership = await getCommunityMembership(
      ctx,
      event.communityId,
      userId
    );
    if (!isActiveCommunityMember(membership)) {
      throw new Error('אין הרשאה');
    }

    const assignedTasks = await getMyActiveAssignedEventTasks(
      ctx,
      eventId,
      userId
    );
    for (const task of assignedTasks) {
      await ctx.db.patch(task._id, {
        assignedToUserId: undefined,
        assignedToManual: undefined,
      });
    }

    await removeCommunityEventFromPersonalCalendar(ctx, {
      userId,
      eventId,
      requiresRsvp: event.requiresRsvp,
    });

    return { success: true as const, unclaimedCount: assignedTasks.length };
  },
});
