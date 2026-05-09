import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

export async function saveCommunityEventToPersonalCalendar(
  ctx: MutationCtx,
  {
    userId,
    eventId,
    communityId,
  }: {
    userId: Id<'users'>;
    eventId: Id<'events'>;
    communityId: Id<'communities'>;
  }
): Promise<{ wasAddedToCalendar: boolean }> {
  const optOut = await ctx.db
    .query('communityEventPersonalCalendarOptOuts')
    .withIndex('by_user_event', (q) =>
      q.eq('userId', userId).eq('eventId', eventId)
    )
    .unique();
  if (optOut) {
    await ctx.db.delete(optOut._id);
  }

  const existing = await ctx.db
    .query('savedCommunityEvents')
    .withIndex('by_user_event', (q) =>
      q.eq('userId', userId).eq('eventId', eventId)
    )
    .unique();

  if (existing) {
    if (existing.removedAt !== undefined) {
      await ctx.db.patch(existing._id, { removedAt: undefined });
      return { wasAddedToCalendar: true };
    }
    return { wasAddedToCalendar: false };
  }

  await ctx.db.insert('savedCommunityEvents', {
    userId,
    eventId,
    communityId,
    createdAt: Date.now(),
  });
  return { wasAddedToCalendar: true };
}

export async function removeCommunityEventFromPersonalCalendar(
  ctx: MutationCtx,
  {
    userId,
    eventId,
    requiresRsvp,
  }: {
    userId: Id<'users'>;
    eventId: Id<'events'>;
    requiresRsvp: boolean | undefined;
  }
): Promise<void> {
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

  if (requiresRsvp === false) {
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
}
