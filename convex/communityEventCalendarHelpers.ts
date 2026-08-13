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

/**
 * Stage 1D: persistently removes a community event from the viewer's
 * personal calendar via a `communityEventPersonalCalendarOptOuts` row — for
 * BOTH open and RSVP-required events. An opt-out is the per-event override
 * that wins over auto-add, explicit save, creator inclusion, and RSVP
 * yes/maybe (see computeIsSavedToMyCalendar), until the user explicitly adds
 * the event back (saveCommunityEventToPersonalCalendar clears it).
 *
 * This intentionally does NOT touch RSVP status — removing an event from the
 * calendar and answering "not attending" are different actions. Callers that
 * also need to unclaim the viewer's event tasks do so themselves, separately
 * (see communityEventCalendar.ts's removeEventFromCalendarAndUnclaim).
 */
export async function removeCommunityEventFromPersonalCalendar(
  ctx: MutationCtx,
  {
    userId,
    eventId,
  }: {
    userId: Id<'users'>;
    eventId: Id<'events'>;
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
