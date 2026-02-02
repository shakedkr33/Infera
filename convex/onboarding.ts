import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * פונקציה זו נקראת בסוף תהליך האונבורדינג.
 * היא מעדכנת את פרטי המשתמש ויוצרת עבורו את ה-Space (מרחב העבודה) הראשון.
 */
export const finishOnboarding = mutation({
  // הגדרת הנתונים שאנחנו מצפים לקבל מהמסכים שעיצבת
  args: {
    fullName: v.string(), // מגיע ממסך הפרופיל
    profileColor: v.string(), // מגיע ממסך הפרופיל
    spaceType: v.string(), // מגיע משלב 1 (מי מנהל את הלו"ז?)
    challenges: v.array(v.string()), // מגיע משלב 2 (האתגר היומי)
    sources: v.array(v.string()), // מגיע משלב 3 (מקורות מידע)
    childCount: v.optional(v.number()), // מגיע ממסך הילדים (אם רלוונטי)
  },
  handler: async (ctx, args) => {
    // 1. בדיקה שהמשתמש מחובר (ביצע Login עם גוגל/אפל)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('חייבים להיות מחוברים כדי לסיים את האונבורדינג');
    }

    // 2. מציאת המשתמש בבסיס הנתונים ועדכון הפרטים שלו
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .unique();

    if (!user) throw new Error('משתמש לא נמצא');

    await ctx.db.patch(user._id, {
      fullName: args.fullName,
      profileColor: args.profileColor,
      isActive: true,
      updatedAt: Date.now(),
    });

    // 3. יצירת המרחב (Space) הראשון שלו - ה"בית" של הנתונים שלו
    const spaceId = await ctx.db.insert('spaces', {
      name: args.spaceType === 'family' ? 'הבית שלנו' : 'המרחב שלי',
      type: args.spaceType as any,
      ownerId: user._id,
      onboardingChallenges: args.challenges,
      primarySources: args.sources,
    });

    // 4. הוספת המשתמש כ"מנהל" (Admin) בתוך המרחב החדש
    await ctx.db.insert('members', {
      userId: user._id,
      spaceId: spaceId,
      role: 'admin',
    });

    return { spaceId };
  },
});