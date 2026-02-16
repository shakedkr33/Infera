import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  // ═══════════════════════════════════════════════════════
  // טבלת משתמשים
  // ═══════════════════════════════════════════════════════
  users: defineTable({
    email: v.string(),
    emailVerified: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    profileColor: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('user')),
    userType: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    tokenIdentifier: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  // ═══════════════════════════════════════════════════════
  // טבלת משפחות/יומנים (Spaces = Families/Calendars)
  // ═══════════════════════════════════════════════════════
  spaces: defineTable({
    name: v.string(),
    type: v.union(
      v.literal('personal'),
      v.literal('couple'),
      v.literal('family'),
      v.literal('business')
    ),
    ownerId: v.id('users'),
    onboardingChallenges: v.optional(v.array(v.string())),
    primarySources: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index('by_owner', ['ownerId']),

  // ═══════════════════════════════════════════════════════
  // טבלת חברי משפחה (Members = Family Members)
  // ═══════════════════════════════════════════════════════
  members: defineTable({
    userId: v.id('users'),
    spaceId: v.id('spaces'),
    role: v.union(v.literal('admin'), v.literal('member')),
    displayName: v.optional(v.string()), // שם תצוגה (אופציונלי)
    color: v.optional(v.string()), // צבע אישי (#FF5733)
    joinedAt: v.number(), // תאריך הצטרפות
  })
    .index('by_space', ['spaceId'])
    .index('by_user', ['userId']),

  // ═══════════════════════════════════════════════════════
  // טבלת אירועים
  // ═══════════════════════════════════════════════════════
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(), // Unix timestamp
    endTime: v.number(), // Unix timestamp
    spaceId: v.id('spaces'),
    category: v.optional(v.string()),
    location: v.optional(v.string()), // מיקום האירוע
    participants: v.optional(v.array(v.string())), // רשימת משתתפים
    isRecurring: v.optional(v.boolean()), // האם אירוע חוזר
    recurringPattern: v.optional(v.string()), // "daily", "weekly", "monthly", "yearly"
    isAiGenerated: v.boolean(), // האם נוצר על ידי AI
    captureId: v.optional(v.id('captures')), // קישור ל-capture שיצר אותו
    createdBy: v.id('users'), // מי יצר את האירוע
    createdAt: v.number(),
  })
    .index('by_space_and_time', ['spaceId', 'startTime'])
    .index('by_creator', ['createdBy'])
    .index('by_space', ['spaceId']),

  // ═══════════════════════════════════════════════════════
  // טבלת משימות
  // ═══════════════════════════════════════════════════════
  tasks: defineTable({
    title: v.string(), // כותרת המשימה
    description: v.optional(v.string()), // תיאור מפורט
    dueDate: v.optional(v.number()), // תאריך יעד (Unix timestamp)
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done')
    ),
    spaceId: v.id('spaces'),
    assignedTo: v.optional(v.id('users')), // למי מוקצה
    category: v.optional(v.string()),
    isAiGenerated: v.boolean(), // האם נוצר על ידי AI
    createdBy: v.id('users'), // מי יצר את המשימה
    createdAt: v.number(),
  })
    .index('by_space_status', ['spaceId', 'status'])
    .index('by_assigned', ['assignedTo'])
    .index('by_space', ['spaceId']),

  // ═══════════════════════════════════════════════════════
  // טבלת ימי הולדת
  // ═══════════════════════════════════════════════════════
  birthdays: defineTable({
    name: v.string(), // שם של בן משפחה
    date: v.string(), // תאריך לידה בפורמט "YYYY-MM-DD"
    spaceId: v.id('spaces'), // לאיזו משפחה שייך
    userId: v.optional(v.id('users')), // אם זה user רשום - קישור אליו
    imageUrl: v.optional(v.string()), // תמונה אופציונלית
    notes: v.optional(v.string()), // הערות (למשל: "אוהב שוקולד")
    createdBy: v.id('users'), // מי הוסיף את יום הההולדת
    createdAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_date', ['date'])
    .index('by_user', ['userId']),

  // ═══════════════════════════════════════════════════════
  // טבלת לכידות AI (Captures)
  // תמונות, טקסט, קול שהמשתמש שלח לעיבוד AI
  // ═══════════════════════════════════════════════════════
  captures: defineTable({
    userId: v.id('users'),
    spaceId: v.id('spaces'),
    type: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('voice'),
      v.literal('screenshot')
    ),
    rawContent: v.string(), // התוכן המקורי (URL או טקסט)
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    processedData: v.optional(v.any()), // התוצאה מה-AI (JSON)
    errorMessage: v.optional(v.string()), // הודעת שגיאה אם נכשל
    createdAt: v.number(),
  })
    .index('by_space_pending', ['spaceId', 'status'])
    .index('by_user', ['userId'])
    .index('by_space', ['spaceId']),
});
