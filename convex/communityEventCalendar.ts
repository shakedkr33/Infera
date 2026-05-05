import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { mutation } from './_generated/server';
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

export const addCommunityEventToMyCalendar = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const event = await ctx.db.get(eventId);
    if (!event?.communityId) throw new Error('אירוע לא נמצא');
    if (event.requiresRsvp !== false) {
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

    const optOut = await ctx.db
      .query('communityEventPersonalCalendarOptOuts')
      .withIndex('by_user_event', (q) =>
        q.eq('userId', userId).eq('eventId', eventId)
      )
      .unique();
    if (optOut) await ctx.db.delete(optOut._id);

    const rsvpRow = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_user', (q) =>
        q.eq('eventId', eventId).eq('userId', userId)
      )
      .unique();
    if (rsvpRow?.status === 'yes') {
      return { success: true as const };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('savedCommunityEvents')
      .withIndex('by_user_event', (q) =>
        q.eq('userId', userId).eq('eventId', eventId)
      )
      .unique();

    if (existing) {
      if (existing.removedAt !== undefined) {
        await ctx.db.patch(existing._id, { removedAt: undefined });
      }
      return { success: true as const };
    }

    await ctx.db.insert('savedCommunityEvents', {
      userId,
      eventId,
      communityId: event.communityId,
      createdAt: now,
    });
    return { success: true as const };
  },
});

export const removeCommunityEventFromMyCalendar = mutation({
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

    const saveRow = await ctx.db
      .query('savedCommunityEvents')
      .withIndex('by_user_event', (q) =>
        q.eq('userId', userId).eq('eventId', eventId)
      )
      .unique();
    const activeSave = saveRow && saveRow.removedAt === undefined;
    if (activeSave) {
      await ctx.db.patch(saveRow._id, { removedAt: Date.now() });
    }

    if (event.requiresRsvp === false) {
      // Always create an opt-out for open events so that privileged users
      // (event creators, community owners / admins) are also excluded from
      // personal home/calendar aggregates after explicit removal.
      // addCommunityEventToMyCalendar deletes the opt-out on re-add.
      const existingOpt = await ctx.db
        .query('communityEventPersonalCalendarOptOuts')
        .withIndex('by_user_event', (q) =>
          q.eq('userId', userId).eq('eventId', eventId)
        )
        .unique();
      if (!existingOpt) {
        await ctx.db.insert('communityEventPersonalCalendarOptOuts', {
          userId,
          eventId,
          createdAt: Date.now(),
        });
      }
    }

    return { success: true as const };
  },
});
