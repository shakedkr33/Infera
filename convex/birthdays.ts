import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─────────────────────────────────────────────────────────────
// שליפת ימי הולדת קרובים (בתוך X ימים מהיום)
// ─────────────────────────────────────────────────────────────
export const listUpcoming = query({
  args: {
    spaceId: v.id('spaces'),
    daysAhead: v.number(), // למשל: 30 = חודש קדימה
  },
  handler: async (ctx, { spaceId, daysAhead }) => {
    // TODO: לחבר לאימות – לוודא שהמשתמש שייך ל-spaceId
    const all = await ctx.db
      .query('birthdays')
      .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
      .collect();

    // TODO: לממש חישוב "ימי הולדת קרובים" שמתחשב גם בשנה הבאה
    // (למשל: יום הולדת ב-03-01 נחשב "קרוב" גם ב-דצמבר)
    const today = new Date();
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const cutoff = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const cutoffMMDD = `${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    return all.filter((b) => {
      const mmdd = b.date.slice(5); // "YYYY-MM-DD" → "MM-DD"
      if (cutoffMMDD >= todayMMDD) {
        return mmdd >= todayMMDD && mmdd <= cutoffMMDD;
      }
      // חוצה שנה (דצמבר → ינואר)
      return mmdd >= todayMMDD || mmdd <= cutoffMMDD;
    });
  },
});

// ─────────────────────────────────────────────────────────────
// הוספת יום הולדת חדש
// ─────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    name: v.string(),
    date: v.string(), // YYYY-MM-DD
    spaceId: v.id('spaces'),
    userId: v.optional(v.id('users')),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
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

    return await ctx.db.insert('birthdays', {
      ...args,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקת יום הולדת
// ─────────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id('birthdays') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    // TODO: לוודא שהמשתמש הנוכחי הוא יוצר הרשומה
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('יום הולדת לא נמצא');

    await ctx.db.delete(id);
  },
});
