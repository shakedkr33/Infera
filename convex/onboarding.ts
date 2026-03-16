import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation } from './_generated/server';

/**
 * פונקציה זו נקראת בסוף תהליך האונבורדינג.
 * היא מעדכנת את פרטי המשתמש ויוצרת עבורו את ה-Space (מרחב העבודה) הראשון.
 */
export const finishOnboarding = mutation({
  args: {
    fullName: v.string(),
    profileColor: v.string(),
    spaceType: v.string(),
    challenges: v.array(v.string()),
    sources: v.array(v.string()),
    childCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. בדיקה שהמשתמש מחובר
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('חייבים להיות מחוברים כדי לסיים את האונבורדינג');
    }

    // 2. מציאת המשתמש בבסיס הנתונים
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('משתמש לא נמצא');

    // 3. עדכון פרטי המשתמש
    await ctx.db.patch(userId, {
      fullName: args.fullName,
      profileColor: args.profileColor,
      isActive: true,
      updatedAt: Date.now(),
    });

    // 4. יצירת המרחב (Space) הראשון
    const spaceId = await ctx.db.insert('spaces', {
      name: args.spaceType === 'family' ? 'הבית שלנו' : 'המרחב שלי',
      type: args.spaceType as 'personal' | 'couple' | 'family' | 'business',
      ownerId: userId,
      onboardingChallenges: args.challenges,
      primarySources: args.sources,
      createdAt: Date.now(),
    });

    // 5. הוספת המשתמש כ-Admin במרחב החדש
    await ctx.db.insert('members', {
      userId,
      spaceId,
      role: 'admin',
      joinedAt: Date.now(),
    });

    // 6. סימון האונבורדינג כהושלם ושמירת ה-Space הראשי
    await ctx.db.patch(userId, {
      onboardingCompleted: true,
      defaultSpaceId: spaceId,
      updatedAt: Date.now(),
    });

    return { spaceId };
  },
});
