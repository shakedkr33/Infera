import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ── Phone normalization ───────────────────────────────────────────────────────
// FIXED: retroactive phone-based family member matching when contacts are saved
// Mirrors lib/phoneUtils.ts normalizeIsraeliPhone — duplicated here because
// Convex backend cannot import from the client lib/ folder.
function normalizeToE164(phone: string): string | null {
  const stripped = phone.replace(/[\s\-()]/g, '');
  if (stripped.startsWith('+972')) return stripped;
  if (stripped.startsWith('972')) return `+${stripped}`;
  if (stripped.startsWith('0')) return `+972${stripped.slice(1)}`;
  if (stripped.startsWith('5')) return `+972${stripped}`;
  return null;
}

type FamilyContactEntry = {
  id: string;
  selectedPhoneNumber?: string;
  matchedUserId?: string;
  [key: string]: unknown;
};

// שליפת המשתמש הנוכחי המחובר
// מחזיר null אם המשתמש לא מחובר
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// שליפת משתמש לפי מזהה (ID)
export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

// שליפת רשימת כל המשתמשים הפעילים
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();
  },
});

// יצירה או עדכון של משתמש (נקרא בדרך כלל מתהליך האימות)
export const createOrUpdateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const email = identity.email ?? '';
    const now = Date.now();

    // בדיקה אם המשתמש כבר קיים
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    const userData = {
      email,
      emailVerified: identity.emailVerified ?? false,
      fullName: identity.name || identity.nickname || 'User',
      role: 'user' as const,
      userType: 'free' as const, // ברירת מחדל - משתמש חינמי
      isActive: true,
      updatedAt: now,
    };

    // עדכון משתמש קיים
    if (existing) {
      await ctx.db.patch(existing._id, userData);
      return existing._id;
    }

    // יצירת משתמש חדש
    return await ctx.db.insert('users', {
      ...userData,
      createdAt: now,
    });
  },
});

// עדכון פרופיל המשתמש (למשל, שינוי שם)
export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, fullName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    await ctx.db.patch(userId, {
      fullName,
      updatedAt: Date.now(),
    });

    return userId;
  },
});

// עדכון סוג המשתמש (חינמי/בתשלום)
export const updateUserType = mutation({
  args: {
    userType: v.union(v.literal('free'), v.literal('paid')),
  },
  handler: async (ctx, { userType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }

    // חיפוש המשתמש לפי אימייל
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();

    if (!user) {
      throw new Error('משתמש לא נמצא');
    }

    await ctx.db.patch(user._id, {
      userType,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// מחיקת משתמש (פעולה למנהלים או למשתמש עצמו - כאן מיושם כמחיקה פיזית)
export const remove = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    await ctx.db.delete(userId);
  },
});

// שליפת ה-Space הראשי של המשתמש הנוכחי
// מחזיר Id<'spaces'> | null — null פירושו "אין מרחב פעיל"
export const getMySpace = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // 1. נסה members table — מוצא membership ומחזיר spaceId
    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (membership?.spaceId) return membership.spaceId;

    // 2. fallback: user.defaultSpaceId (נאכלס ב-onboarding)
    const user = await ctx.db.get(userId);
    if ((user as unknown as { defaultSpaceId?: string })?.defaultSpaceId) {
      return (user as unknown as { defaultSpaceId: string }).defaultSpaceId;
    }

    // 3. אין מרחב — הקליינט מציג מצב שגיאה
    return null;
  },
});

// מחיקת חשבון המשתמש הנוכחי וכל הנתונים המשויכים אליו
// ⚠️ אזהרה: פעולה זו בלתי הפיכה ותמחק את כל הנתונים לצמיתות!
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }

    // קבלת מזהה המשתמש מה-identity
    const userId = identity.subject;
    let deletedCount = 0;

    // כאן תוכל להוסיף מחיקה של טבלאות נוספות שקשורות למשתמש
    // לדוגמה:
    // const userPosts = await ctx.db
    //   .query('posts')
    //   .withIndex('by_user', (q) => q.eq('userId', userId))
    //   .collect();
    // for (const post of userPosts) {
    //   await ctx.db.delete(post._id);
    //   deletedCount += 1;
    // }

    // מחיקת המשתמש מטבלת המשתמשים
    // הערה: Convex Auth מנהל את טבלת המשתמשים, אך אנחנו יכולים למחוק את הרשומה
    const user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('_id'), userId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
      deletedCount += 1;
    }

    return {
      success: true,
      message: `נמחקו ${deletedCount} רשומות עבור משתמש ${userId}`,
      deletedCount,
    };
  },
});

export const getMyId = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

// FIXED: added getMyProfile query for authenticated rehydration
// Returns the minimal profile data needed to restore OnboardingContext after app restart.
// familyContacts (children/pets from onboarding step 4) ARE stored in Convex (familyContacts field)
// and ARE rehydrated into OnboardingContext.familyData by hydrateFromServer on app restart.
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    let spaceType: string | undefined;
    if (user.defaultSpaceId) {
      const space = await ctx.db.get(user.defaultSpaceId);
      spaceType = space?.type;
    }

    return {
      fullName: user.fullName,
      profileColor: user.profileColor,
      spaceType,
      familyContacts: user.familyContacts,
    };
  },
});

// עדכון פרופיל המשתמש הנוכחי (לשימוש חוזר לאחר אונבורדינג)
// FIXED: family profile persistence — use this instead of finishOnboarding for returning users
// FIXED: retroactive phone-based family member matching when contacts are saved
export const updateMyProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    profileColor: v.optional(v.string()),
    familyContacts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר');

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.fullName !== undefined) patch.fullName = args.fullName;
    if (args.profileColor !== undefined) patch.profileColor = args.profileColor;

    // FIXED: retroactive phone-based family member matching when contacts are saved
    // Handles the case where the invited user already had a Convex account when added.
    // Uses by_phone index — O(1) per family member, no table scan needed here.
    if (args.familyContacts !== undefined) {
      if (Array.isArray(args.familyContacts)) {
        const resolved = await Promise.all(
          (args.familyContacts as FamilyContactEntry[]).map(async (entry) => {
            if (entry.matchedUserId) return entry; // already matched — do not overwrite
            if (!entry.selectedPhoneNumber) return entry;
            const normalizedPhone = normalizeToE164(entry.selectedPhoneNumber);
            if (!normalizedPhone) return entry;
            const matchedUser = await ctx.db
              .query('users')
              .withIndex('by_phone', (q) => q.eq('phone', normalizedPhone))
              .unique();
            if (matchedUser) return { ...entry, matchedUserId: matchedUser._id };
            return entry;
          })
        );
        patch.familyContacts = resolved;
      } else {
        patch.familyContacts = args.familyContacts;
      }
    }

    await ctx.db.patch(userId, patch);
  },
});

// סטטוס המשתמש הנוכחי: האם יש פרופיל, האם האונבורדינג הושלם
// משמש לניתוב פוסט-אימות — מחזיר null כשלא מחובר (caller משתמש ב-'skip')
export const getCurrentUserStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) {
      return { hasProfile: false, onboardingComplete: false };
    }

    return {
      hasProfile: true,
      onboardingComplete: user.onboardingCompleted === true,
    };
  },
});
