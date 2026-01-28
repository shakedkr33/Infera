import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

// הגדרת מערכת האימות (Authentication)
// קובץ זה מגדיר את ספקי ההזדהות והלוגיקה של יצירת משתמשים
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password], // שימוש בסיסמה (אימייל וסיסמה) כספק הזדהות
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // משך זמן ה-Session (30 ימים)
  },
  callbacks: {
    // פונקציה שנקראת בעת יצירה או עדכון של משתמש
    async createOrUpdateUser(ctx, args) {
      const now = Date.now();

      // אם המשתמש כבר קיים (למשל, התחברות נוספת), נעדכן את הפרטים שלו
      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, {
          email: args.profile.email,
          emailVerified: args.profile.emailVerified ?? false,
          fullName: args.profile.name || 'User',
          updatedAt: now,
        });
        return args.existingUserId;
      }

      // יצירת משתמש חדש עם כל השדות הנדרשים לפי ה-Schema
      return await ctx.db.insert('users', {
        email: args.profile.email ?? '',
        emailVerified: args.profile.emailVerified ?? false,
        fullName: args.profile.name || 'User',
        role: 'user', // תפקיד ברירת מחדל
        isActive: true, // משתמש פעיל כברירת מחדל
        createdAt: now,
        updatedAt: now,
      });
    },
  },
});
