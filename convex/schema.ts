import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  // ═══════════════════════════════════════════════════════
  // טבלת משתמשים
  // ═══════════════════════════════════════════════════════
  users: defineTable({
    // Phone auth — primary identifier
    phone: v.optional(v.string()), // E.164 format, e.g. +972501234567
    // Email retained as optional for backwards-compatibility and future use
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    profileColor: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('user')),
    userType: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    tokenIdentifier: v.optional(v.string()),
    // MVP additions
    onboardingCompleted: v.optional(v.boolean()),
    defaultSpaceId: v.optional(v.id('spaces')),
    // FIXED: family profile persistence — stores onboarding family contacts as JSON blob
    familyContacts: v.optional(v.any()),
    /** Optional post-auth profile setup was completed */
    profileSetupCompletedAt: v.optional(v.number()),
    /** Post-auth optional family setup was skipped; prevents nag on every launch */
    familySetupSkippedAt: v.optional(v.number()),
  })
    .index('by_email', ['email'])
    .index('by_phone', ['phone'])
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
    userId: v.optional(v.id('users')), // optional: pending invited contacts have no userId yet
    spaceId: v.id('spaces'),
    role: v.union(v.literal('admin'), v.literal('member')),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
    joinedAt: v.number(),
    // ── Row-type discriminator ────────────────────────────────────────────────
    // 'access' — authenticated user who owns or was granted access to the space
    // 'entity' — visible family entity (contact placeholder, child, pet)
    // Rows without this field: infer via resolveKind() in convex/members.ts
    // FIXED: kind discriminator added to separate access rows from entity rows
    kind: v.optional(v.union(v.literal('access'), v.literal('entity'))),
    // ── Family invite tracking (additive, all optional) ──────────────────────
    selectedPhoneNumber: v.optional(v.string()),
    matchedUserId: v.optional(v.id('users')),
    inviteStatus: v.optional(
      v.union(v.literal('none'), v.literal('invited'), v.literal('joined'))
    ),
  })
    .index('by_space', ['spaceId'])
    .index('by_user', ['userId'])
    .index('by_kind', ['spaceId', 'kind'])
    .index('by_phone', ['selectedPhoneNumber']),

  // ═══════════════════════════════════════════════════════
  // טבלת אירועים
  // ═══════════════════════════════════════════════════════
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(), // Unix timestamp (ms)
    endTime: v.number(), // Unix timestamp (ms)
    spaceId: v.optional(v.id('spaces')),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    participants: v.optional(v.array(v.string())),
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
    isAiGenerated: v.boolean(),
    captureId: v.optional(v.id('captures')),
    createdBy: v.id('users'),
    createdAt: v.number(),
    // MVP additions
    allDay: v.optional(v.boolean()),
    locationUrl: v.optional(v.string()), // Google Maps / Waze link
    onlineUrl: v.optional(v.string()), // Zoom / Meet link
    // TODO: migrate groupId → communityId (groupId was v.optional(v.id('spaces')))
    sharedWithUserIds: v.optional(v.array(v.id('users'))), // משתמשים מוזמנים
    // FIXED: added allFamily and sharedWithFamilyMemberIds to events schema
    allFamily: v.optional(v.boolean()), // true → shared with all family members
    sharedWithFamilyMemberIds: v.optional(v.array(v.string())), // entity row IDs of selected family members
    communityId: v.optional(v.id('communities')),
    tasksVisibleToParticipants: v.optional(v.boolean()),
    requiresRsvp: v.optional(v.boolean()), // האם האירוע דורש אישור השתתפות
    status: v.optional(v.union(v.literal('active'), v.literal('cancelled'))),
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.id('users')),
    cancelReason: v.optional(v.string()),
    // Persisted reminder offsets in minutes before event start (e.g. 0, 60, 1440)
    reminders: v.optional(v.array(v.number())),
    // FIXED: file attachments for personal events (hard cap of 2 enforced in mutations)
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id('_storage'),
          originalName: v.string(),
          displayName: v.string(),
          mimeType: v.string(),
          sizeBytes: v.number(),
          uploadedAt: v.number(),
          uploadedBy: v.id('users'),
        })
      )
    ),
    importantItems: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
        })
      )
    ),
  })
    .index('by_space_and_time', ['spaceId', 'startTime'])
    .index('by_creator', ['createdBy'])
    .index('by_space', ['spaceId'])
    .index('by_community_date', ['communityId', 'startTime']),

  // ═══════════════════════════════════════════════════════
  // טבלת משימות
  // ═══════════════════════════════════════════════════════
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()), // null = ללא תאריך (undated task)
    completed: v.boolean(), // החליף את status
    spaceId: v.optional(v.id('spaces')),
    assignedTo: v.optional(v.id('users')),
    category: v.optional(v.string()),
    isAiGenerated: v.boolean(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    communityId: v.optional(v.id('communities')), // קהילה שאליה שייכת המשימה
    completedAt: v.optional(v.number()), // חותמת זמן השלמה (לצורך היסטוריה)
    sourceType: v.optional(v.literal('community_event_important_item')),
    sourceEventId: v.optional(v.id('events')),
    sourceImportantItemId: v.optional(v.string()),
    // Legacy / extended fields present in existing documents
    allowParticipantEditing: v.optional(v.boolean()),
    assignedToMemberId: v.optional(v.id('members')),
    assignedToUserIds: v.optional(v.array(v.id('users'))),
    assignedToMemberIds: v.optional(v.array(v.id('members'))),
    hasTime: v.optional(v.boolean()),
    dueAt: v.optional(v.number()),
    recurrenceType: v.optional(v.string()),
    reminderType: v.optional(v.string()),
    reminders: v.optional(v.array(v.any())),
    selectedWeekdays: v.optional(v.array(v.float64())),
    subtasks: v.optional(v.array(v.any())),
    attachments: v.optional(v.array(v.any())),
    updatedAt: v.optional(v.float64()),
  })
    .index('by_space_completed', ['spaceId', 'completed'])
    .index('by_assigned', ['assignedTo'])
    .index('by_space', ['spaceId'])
    .index('by_community', ['communityId'])
    .index('by_assigned_source_event', ['assignedTo', 'sourceEventId']),

  // ═══════════════════════════════════════════════════════
  // טבלת ימי הולדת
  // ═══════════════════════════════════════════════════════
  birthdays: defineTable({
    name: v.string(),
    date: v.string(), // YYYY-MM-DD
    spaceId: v.id('spaces'),
    userId: v.optional(v.id('users')),
    imageUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_date', ['date'])
    .index('by_user', ['userId']),

  // ═══════════════════════════════════════════════════════
  // טבלת לכידות AI (Captures)
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
    rawContent: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    processedData: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_space_pending', ['spaceId', 'status'])
    .index('by_user', ['userId'])
    .index('by_space', ['spaceId']),

  // ═══════════════════════════════════════════════════════
  // משימות אירוע (checklist קולבורטיבי באירוע)
  // ═══════════════════════════════════════════════════════
  eventTasks: defineTable({
    eventId: v.id('events'),
    title: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    order: v.optional(v.number()),
    assignedToUserId: v.optional(v.id('users')),
    assignedToManual: v.optional(v.string()),
  })
    .index('by_event', ['eventId'])
    .index('by_event_order', ['eventId', 'order']),

  // ═══════════════════════════════════════════════════════
  // טבלת RSVP לאירועים
  // ═══════════════════════════════════════════════════════
  eventRsvps: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    status: v.union(
      v.literal('yes'),
      v.literal('no'),
      v.literal('maybe'),
      v.literal('none')
    ),
    updatedAt: v.number(),
  })
    .index('by_event_user', ['eventId', 'userId'])
    .index('by_user', ['userId']),

  // ═══════════════════════════════════════════════════════
  // אירועי קהילה פתוחים — שמירה אישית ליומן / בית (למשתמש בלבד)
  // ═══════════════════════════════════════════════════════
  savedCommunityEvents: defineTable({
    userId: v.id('users'),
    eventId: v.id('events'),
    communityId: v.id('communities'),
    createdAt: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_event', ['userId', 'eventId']),

  /** הסרה ידנית מיומן אישי כשעדיין קיים RSVP yes (אירוע עבר ממצב RSVP לפתוח) */
  communityEventPersonalCalendarOptOuts: defineTable({
    userId: v.id('users'),
    eventId: v.id('events'),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_event', ['userId', 'eventId']),

  // ═══════════════════════════════════════════════════════
  // טבלת מצב רוח יומי
  // ═══════════════════════════════════════════════════════
  dailyMoods: defineTable({
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD
    moodValue: v.number(), // 0–4
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_user_date', ['userId', 'date']),

  // ═══════════════════════════════════════════════════════
  // טבלת מנויים
  // ═══════════════════════════════════════════════════════
  subscriptions: defineTable({
    userId: v.id('users'),
    plan: v.union(v.literal('free'), v.literal('plus'), v.literal('family')),
    status: v.union(
      v.literal('active'),
      v.literal('trial'),
      v.literal('expired'),
      v.literal('cancelled')
    ),
    source: v.union(
      v.literal('apple'),
      v.literal('google'),
      v.literal('stripe'),
      v.literal('demo')
    ),
    productId: v.optional(v.string()), // מזהה מוצר ב-RevenueCat
    expiresAt: v.optional(v.number()), // null = חינמי / ללא תפוגה
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // ═══════════════════════════════════════════════════════
  // קהילות (גן, בית-ספר, חוג, משפחה, עבודה, אישי, אחר)
  // ═══════════════════════════════════════════════════════
  communities: defineTable({
    name: v.string(),
    description: v.optional(v.string()), // תיאור קצר (חדש)
    ownerId: v.id('users'),
    spaceId: v.optional(v.id('spaces')), // optional – לא תמיד משויך ל-space
    category: v.optional(
      v.union(
        v.literal('school'),
        v.literal('kindergarten'),
        v.literal('club'),
        v.literal('family'),
        v.literal('work'),
        v.literal('personal'),
        v.literal('other')
      )
    ),
    tags: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    inviteCode: v.string(),
    createdAt: v.number(),
    archived: v.optional(v.boolean()),
    pinnedByUserIds: v.optional(v.array(v.id('users'))), // deprecated – use communityMembers.pinned
    /** Join via invite link: manual = admin approval required; automatic = immediate (default if unset). */
    joinApprovalMode: v.optional(
      v.union(v.literal('manual'), v.literal('automatic'))
    ),
  })
    .index('by_owner', ['ownerId'])
    .index('by_space', ['spaceId'])
    .index('by_invite_code', ['inviteCode']),

  // ═══════════════════════════════════════════════════════
  // חברות של משתמשים בקהילות
  // ═══════════════════════════════════════════════════════
  communityMembers: defineTable({
    communityId: v.id('communities'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    pinned: v.boolean(),
    notificationsEnabled: v.boolean(),
    joinedAt: v.number(),
    status: v.optional(
      v.union(v.literal('active'), v.literal('left'), v.literal('pending'))
    ),
    /** Last time the user opened this community detail (for "new events" hints on the list). */
    lastViewedAt: v.optional(v.number()),
  })
    .index('by_community', ['communityId'])
    .index('by_user', ['userId'])
    .index('by_community_user', ['communityId', 'userId']),

  // ═══════════════════════════════════════════════════════
  // פעילות אוטומטית בקהילה
  // ═══════════════════════════════════════════════════════
  communityActivities: defineTable({
    communityId: v.id('communities'),
    actorUserId: v.optional(v.id('users')),
    type: v.union(
      v.literal('event_created'),
      v.literal('event_updated'),
      v.literal('event_cancelled'),
      v.literal('reminder_created'),
      v.literal('task_assigned'),
      v.literal('task_completed'),
      v.literal('member_joined'),
      v.literal('community_updated')
    ),
    entityType: v.optional(
      v.union(
        v.literal('event'),
        v.literal('reminder'),
        v.literal('task'),
        v.literal('community'),
        v.literal('member')
      )
    ),
    entityId: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_community_createdAt', ['communityId', 'createdAt'])
    .index('by_entity', ['entityType', 'entityId']),

  // ═══════════════════════════════════════════════════════
  // שיתוף אירועים אישיים — קישורי שיתוף
  // FIXED: one active link per event (enforced in createShareLink mutation)
  // ═══════════════════════════════════════════════════════
  shareLinks: defineTable({
    eventId: v.id('events'),
    token: v.string(), // random 24-char alphanumeric — same pattern as communities.inviteCode
    createdBy: v.id('users'), // event owner
    revoked: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_event', ['eventId'])
    .index('by_creator', ['createdBy']),

  // ═══════════════════════════════════════════════════════
  // שיתוף אירועים אישיים — אירועים מקושרים (ביומן הנמען)
  // FIXED: snapshot used only for sourceStatus='deleted'; live data read from source otherwise
  // ═══════════════════════════════════════════════════════
  linkedEvents: defineTable({
    sourceEventId: v.id('events'),
    shareToken: v.string(),
    savedByUserId: v.id('users'), // recipient — internal only, never exposed to owner
    ownerUserId: v.id('users'), // event owner — stamped at save time
    spaceId: v.id('spaces'), // recipient's own space

    // patched by deleteEvent / cancelEvent mutations
    sourceStatus: v.union(
      v.literal('active'),
      v.literal('deleted'),
      v.literal('cancelled')
    ),

    // snapshot — populated at save time
    // used ONLY when sourceStatus = 'deleted' (tombstone fallback)
    // when active or cancelled, display data is read live from the source event
    snapshotTitle: v.string(),
    snapshotStartTime: v.number(),
    snapshotEndTime: v.number(),
    snapshotLocation: v.optional(v.string()),

    savedAt: v.number(),
  })
    .index('by_recipient', ['savedByUserId'])
    .index('by_recipient_and_source', ['savedByUserId', 'sourceEventId'])
    .index('by_source', ['sourceEventId'])
    .index('by_space', ['spaceId']),
});
