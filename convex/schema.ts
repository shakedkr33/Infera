import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  users: defineTable({
    email: v.string(),
    emailVerified: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    profileColor: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('user')),
    userType: v.optional(v.string()), // הוספנו את זה כדי לתקן את השגיאה האדומה!
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    tokenIdentifier: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_role', ['role']),

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
  }),

  members: defineTable({
    userId: v.id('users'),
    spaceId: v.id('spaces'),
    role: v.union(v.literal('admin'), v.literal('member')),
  })
    .index('by_space', ['spaceId'])
    .index('by_user', ['userId']),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    spaceId: v.id('spaces'),
    category: v.optional(v.string()),
    isAiGenerated: v.boolean(),
    captureId: v.optional(v.id('captures')),
  }).index('by_space_and_time', ['spaceId', 'startTime']),

  tasks: defineTable({
    text: v.string(),
    dueDate: v.optional(v.number()),
    status: v.union(v.literal('todo'), v.literal('done')),
    spaceId: v.id('spaces'),
    assignedTo: v.optional(v.id('users')),
    category: v.optional(v.string()),
    isAiGenerated: v.boolean(),
  }).index('by_space_status', ['spaceId', 'status']),

  captures: defineTable({
    userId: v.id('users'),
    spaceId: v.id('spaces'),
    type: v.union(
      v.literal('text'),
      v.literal('image'),
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
  }).index('by_space_pending', ['spaceId', 'status']),
});