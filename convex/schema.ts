import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// הגדרת הסכמה (Schema) של מסד הנתונים
// קובץ זה מגדיר את מבנה הטבלאות והקשרים ב-Database
export default defineSchema({
  // יבוא טבלאות ברירת מחדל של ספריית האימות (users, sessions, etc.)
  ...authTables,

  // טבלת משתמשים מורחבת
  // מכילה מידע נוסף על המשתמשים מעבר לבסיס של ספריית האימות
  users: defineTable({
    email: v.string(), // כתובת אימייל
    emailVerified: v.optional(v.boolean()), // האם האימייל אומת
    fullName: v.optional(v.string()), // שם מלא
    role: v.union(v.literal('admin'), v.literal('user')), // תפקיד המשתמש (מנהל או משתמש רגיל)
    userType: v.optional(v.union(v.literal('free'), v.literal('paid'))), // סוג משתמש (חינמי או בתשלום) - אופציונלי לתאימות לאחור
    isActive: v.boolean(), // האם המשתמש פעיל
    createdAt: v.number(), // זמן יצירה (Timestamp)
    updatedAt: v.number(), // זמן עדכון אחרון (Timestamp)
  })
    .index('by_email', ['email']) // אינדקס לחיפוש מהיר לפי אימייל
    .index('by_role', ['role']) // אינדקס לסינון מהיר לפי תפקיד
    .index('by_userType', ['userType']), // אינדקס לסינון מהיר לפי סוג משתמש
});
