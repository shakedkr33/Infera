import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─────────────────────────────────────────────────────────────
// יצירה/עדכון RSVP לאירוע (upsert)
// ─────────────────────────────────────────────────────────────
export const upsertRsvp = mutation({
  args: {
    eventId: v.id('events'),
    status: v.union(
      v.literal('yes'),
      v.literal('no'),
      v.literal('maybe'),
      v.literal('none')
    ),
  },
  handler: async (ctx, { eventId, status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();
    if (!user) throw new Error('משתמש לא נמצא');

    // TODO: לוודא שהאירוע קיים ושהמשתמש הוזמן אליו
    const existing = await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_user', (q) =>
        q.eq('eventId', eventId).eq('userId', user._id)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { status, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('eventRsvps', {
        eventId,
        userId: user._id,
        status,
        updatedAt: Date.now(),
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת RSVP של משתמש ספציפי לאירוע
// ─────────────────────────────────────────────────────────────
export const getRsvpForUser = query({
  args: {
    eventId: v.id('events'),
    userId: v.id('users'),
  },
  handler: async (ctx, { eventId, userId }) => {
    // TODO: לחבר לאימות – לוודא שהמשתמש הנוכחי מורשה לראות RSVP זה
    return await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_user', (q) =>
        q.eq('eventId', eventId).eq('userId', userId)
      )
      .unique();
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת כל ה-RSVPs לאירוע (לבעל האירוע)
// ─────────────────────────────────────────────────────────────
export const listByEvent = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    // TODO: לוודא שהמשתמש הנוכחי הוא יוצר האירוע
    return await ctx.db
      .query('eventRsvps')
      .withIndex('by_event_user', (q) => q.eq('eventId', eventId))
      .collect();
  },
});
