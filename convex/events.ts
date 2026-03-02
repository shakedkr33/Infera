import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─────────────────────────────────────────────────────────────
// שליפת אירועים לפי טווח תאריכים
// ─────────────────────────────────────────────────────────────
export const listByDateRange = query({
  args: {
    spaceId: v.id('spaces'),
    from: v.number(), // Unix timestamp (ms) – תחילת טווח
    to: v.number(),   // Unix timestamp (ms) – סוף טווח
  },
  handler: async (ctx, { spaceId, from, to }) => {
    // TODO: לחבר לאימות – לוודא שהמשתמש הנוכחי שייך ל-spaceId
    return await ctx.db
      .query('events')
      .withIndex('by_space_and_time', (q) =>
        q.eq('spaceId', spaceId).gte('startTime', from).lte('startTime', to)
      )
      .order('asc')
      .collect();
  },
});

// ─────────────────────────────────────────────────────────────
// יצירת אירוע חדש
// ─────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    allDay: v.optional(v.boolean()),
    spaceId: v.id('spaces'),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    locationUrl: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    groupId: v.optional(v.id('spaces')),
    sharedWithUserIds: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    // TODO: לאמת שהמשתמש הנוכחי שייך ל-spaceId לפני יצירה
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();
    if (!user) throw new Error('משתמש לא נמצא');

    return await ctx.db.insert('events', {
      ...args,
      isAiGenerated: false,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────
// עדכון אירוע קיים
// ─────────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id: v.id('events'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    locationUrl: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    groupId: v.optional(v.id('spaces')),
    sharedWithUserIds: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, { id, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    // TODO: לוודא שהמשתמש הנוכחי הוא יוצר האירוע או בעל הרשאות עריכה
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('אירוע לא נמצא');

    await ctx.db.patch(id, fields);
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקת אירוע
// ─────────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id('events') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    // TODO: לוודא שהמשתמש הנוכחי הוא יוצר האירוע
    // TODO: למחוק גם eventRsvps קשורים לפני מחיקת האירוע
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('אירוע לא נמצא');

    await ctx.db.delete(id);
  },
});
