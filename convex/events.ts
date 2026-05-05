// FIXED: added generateUploadUrl, getAttachmentUrl, and attachment support to create + update
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import {
  computeIsSavedToMyCalendar,
  enrichEventsWithCalendarFlags,
  loadActiveSavedEventIds,
  loadOptOutEventIds,
  shouldIncludeInPersonalHomeCalendar,
} from './communityCalendarState';
import { isActiveCommunityMember } from './communityMemberUtils';

// ─── Attachment arg validator ──────────────────────────────────────────────────
// uploadedBy and uploadedAt are NOT accepted from the client — the handler
// stamps them using the authenticated userId and server time.
const attachmentObject = v.object({
  storageId: v.id('_storage'),
  originalName: v.string(),
  displayName: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
});

async function getCommunityMembership(
  ctx: MutationCtx | QueryCtx,
  communityId: Id<'communities'>,
  userId: Id<'users'>
) {
  return await ctx.db
    .query('communityMembers')
    .withIndex('by_community_user', (q) =>
      q.eq('communityId', communityId).eq('userId', userId)
    )
    .unique();
}

/** Creator, community owner, or admin always see community events on home/calendar aggregates. */
function isCommunityEventPrivilegedForCalendar(
  eventCreatedBy: Id<'users'>,
  viewerUserId: Id<'users'>,
  membershipRole: 'owner' | 'admin' | 'member'
): boolean {
  if (eventCreatedBy === viewerUserId) return true;
  if (membershipRole === 'owner' || membershipRole === 'admin') return true;
  return false;
}

/**
 * Community list (per community) for RSVP-gated events: same as home "yes" rule.
 * Open events are shown to all members separately in listByCommunity.
 */
function shouldIncludeCommunityEventForPersonalAggregates(args: {
  eventCreatedBy: Id<'users'>;
  viewerUserId: Id<'users'>;
  membershipRole: 'owner' | 'admin' | 'member';
  rsvpStatus: 'yes' | 'no' | 'maybe' | 'none' | undefined;
}): boolean {
  const { eventCreatedBy, viewerUserId, membershipRole, rsvpStatus } = args;
  if (
    isCommunityEventPrivilegedForCalendar(
      eventCreatedBy,
      viewerUserId,
      membershipRole
    )
  ) {
    return true;
  }
  return rsvpStatus === 'yes';
}

// ─────────────────────────────────────────────────────────────
// יצירת URL להעלאת קובץ ל-Convex Storage
// ─────────────────────────────────────────────────────────────
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');
    return await ctx.storage.generateUploadUrl();
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת URL לצפייה בקובץ מ-Convex Storage
// ─────────────────────────────────────────────────────────────
export const getAttachmentUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת אירוע יחיד לפי מזהה
// ─────────────────────────────────────────────────────────────
export const getById = query({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(eventId);
    if (!event) return null;

    if (event.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) return null;

      const rsvpRow = await ctx.db
        .query('eventRsvps')
        .withIndex('by_event_user', (q) =>
          q.eq('eventId', eventId).eq('userId', userId)
        )
        .unique();
      const saveRow = await ctx.db
        .query('savedCommunityEvents')
        .withIndex('by_user_event', (q) =>
          q.eq('userId', userId).eq('eventId', eventId)
        )
        .unique();
      const optOutRow = await ctx.db
        .query('communityEventPersonalCalendarOptOuts')
        .withIndex('by_user_event', (q) =>
          q.eq('userId', userId).eq('eventId', eventId)
        )
        .unique();
      const hasActiveSave = saveRow !== null && saveRow.removedAt === undefined;
      const hasOptOut = optOutRow !== null;
      const rsvpStatus = rsvpRow?.status;

      return {
        ...event,
        isSavedToMyCalendar: computeIsSavedToMyCalendar({
          requiresRsvp: event.requiresRsvp,
          rsvpStatus,
          hasActiveSave,
          hasOptOut,
        }),
      };
    }

    if (event.createdBy !== userId) return null;
    return { ...event, isSavedToMyCalendar: false };
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת אירועי קהילה עם cursor pagination (לביצועים)
// ─────────────────────────────────────────────────────────────
export const listByCommunityPaged = query({
  args: {
    communityId: v.id('communities'),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
    fromTime: v.optional(v.number()),
    toTime: v.optional(v.number()),
  },
  handler: async (ctx, { communityId, cursor, numItems, fromTime, toTime }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    const membership = await getCommunityMembership(ctx, communityId, userId);
    if (!isActiveCommunityMember(membership)) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    const from = fromTime ?? 0;
    const to = toTime ?? 9_999_999_999_999; // far future
    const pageResult = await ctx.db
      .query('events')
      .withIndex('by_community_date', (q) =>
        q
          .eq('communityId', communityId)
          .gte('startTime', from)
          .lte('startTime', to)
      )
      .paginate({ cursor, numItems: numItems ?? 20 });

    const userRsvps = await ctx.db
      .query('eventRsvps')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const rsvpByEventId = new Map(
      userRsvps.map((r) => [r.eventId as string, r.status])
    );

    const enrichedPage = await enrichEventsWithCalendarFlags(
      ctx,
      userId,
      pageResult.page,
      rsvpByEventId
    );

    return {
      ...pageResult,
      page: enrichedPage,
    };
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת כל אירועי קהילה לפי communityId
// ─────────────────────────────────────────────────────────────
export const listByCommunity = query({
  args: { communityId: v.id('communities') },
  handler: async (ctx, { communityId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await getCommunityMembership(ctx, communityId, userId);
    if (!isActiveCommunityMember(membership)) return [];

    const userRsvps = await ctx.db
      .query('eventRsvps')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const rsvpByEventId = new Map(
      userRsvps.map((r) => [r.eventId as string, r.status])
    );

    const events = await ctx.db
      .query('events')
      .withIndex('by_community_date', (q) => q.eq('communityId', communityId))
      .filter((q) => q.neq(q.field('status'), 'cancelled'))
      .order('asc')
      .collect();

    const filtered = events.filter((ev) => {
      /** Open to all members — everyone in the community sees it (calendar filtered by community). */
      if (ev.requiresRsvp === false) {
        return true;
      }
      return shouldIncludeCommunityEventForPersonalAggregates({
        eventCreatedBy: ev.createdBy,
        viewerUserId: userId,
        membershipRole: membership.role,
        rsvpStatus: rsvpByEventId.get(ev._id),
      });
    });

    return enrichEventsWithCalendarFlags(ctx, userId, filtered, rsvpByEventId);
  },
});

// ─────────────────────────────────────────────────────────────
// שליפת אירועים לפי טווח תאריכים
// ─────────────────────────────────────────────────────────────
export const listByDateRange = query({
  args: {
    spaceId: v.id('spaces'),
    from: v.number(), // Unix timestamp (ms) – תחילת טווח
    to: v.number(), // Unix timestamp (ms) – סוף טווח
  },
  handler: async (ctx, { spaceId, from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    // TODO: לחבר לאימות – לוודא שהמשתמש הנוכחי שייך ל-spaceId
    const rows = await ctx.db
      .query('events')
      .withIndex('by_space_and_time', (q) =>
        q.eq('spaceId', spaceId).gte('startTime', from).lte('startTime', to)
      )
      .filter((q) => q.neq(q.field('status'), 'cancelled'))
      .order('asc')
      .collect();

    if (rows.length === 0) {
      return [];
    }

    const userRsvps = await ctx.db
      .query('eventRsvps')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const rsvpByEventId = new Map(
      userRsvps.map((r) => [r.eventId as string, r.status])
    );
    const savedIds = await loadActiveSavedEventIds(ctx, userId);
    const optOutIds = await loadOptOutEventIds(ctx, userId);

    const communityIdSet = new Set<string>();
    for (const e of rows) {
      if (e.communityId) {
        communityIdSet.add(e.communityId as string);
      }
    }
    const communityNameById = new Map<string, string>();
    for (const cidStr of communityIdSet) {
      const c = await ctx.db.get(cidStr as Id<'communities'>);
      if (c) {
        communityNameById.set(cidStr, c.name);
      }
    }

    const result: Array<
      (typeof rows)[0] & { communityName?: string; isSavedToMyCalendar: boolean }
    > = [];
    for (const ev of rows) {
      const idStr = ev._id as string;
      const rsvpStatus = rsvpByEventId.get(idStr);
      let communityName: string | undefined;
      let isSavedToMyCalendar = false;

      if (ev.communityId) {
        communityName = communityNameById.get(ev.communityId as string);
        isSavedToMyCalendar = computeIsSavedToMyCalendar({
          requiresRsvp: ev.requiresRsvp,
          rsvpStatus,
          hasActiveSave: savedIds.has(idStr),
          hasOptOut: optOutIds.has(idStr),
        });
        // Community events that appear via the space index (have spaceId set)
        // must still respect personal-calendar saved state — only include if
        // actively saved. This mirrors listCommunityEventsForDate filtering.
        if (!isSavedToMyCalendar) continue;
      }

      result.push({ ...ev, communityName, isSavedToMyCalendar });
    }
    return result;
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
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
    spaceId: v.optional(v.id('spaces')),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    locationUrl: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    groupId: v.optional(v.id('spaces')),
    // FIXED: persist personal event participants collected in EventScreen
    participants: v.optional(v.array(v.string())),
    sharedWithUserIds: v.optional(v.array(v.id('users'))),
    communityId: v.optional(v.id('communities')),
    tasksVisibleToParticipants: v.optional(v.boolean()),
    requiresRsvp: v.optional(v.boolean()),
    // FIXED: added family sharing fields to create mutation
    allFamily: v.optional(v.boolean()),
    sharedWithFamilyMemberIds: v.optional(v.array(v.string())),
    // FIXED: file attachments (max 2 enforced here)
    attachments: v.optional(v.array(attachmentObject)),
    // Reminder offsets in minutes before event start
    reminders: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    if (args.communityId) {
      const community = await ctx.db.get(args.communityId);
      if (!community || community.archived) {
        throw new Error('קהילה לא נמצאה');
      }
      const membership = await getCommunityMembership(
        ctx,
        args.communityId,
        userId
      );
      const isOwnerByCommunityRecord = community.ownerId === userId;
      const isOwnerOrAdminMembership =
        membership &&
        isActiveCommunityMember(membership) &&
        (membership.role === 'owner' || membership.role === 'admin');
      const canCreateCommunityEvent =
        isOwnerByCommunityRecord || Boolean(isOwnerOrAdminMembership);
      if (!canCreateCommunityEvent) {
        throw new Error('רק בעלים או מנהלי קהילה יכולים ליצור אירוע קהילתי');
      }
    }

    if (args.attachments && args.attachments.length > 2) {
      throw new Error('לא ניתן לצרף יותר מ-2 קבצים לאירוע');
    }

    const now = Date.now();
    // Stamp uploadedBy and uploadedAt server-side — not trusted from client
    const stamped = args.attachments?.map((a) => ({
      ...a,
      uploadedBy: userId,
      uploadedAt: now,
    }));

    const eventId = await ctx.db.insert('events', {
      ...args,
      attachments: stamped,
      tasksVisibleToParticipants: args.tasksVisibleToParticipants ?? false,
      isAiGenerated: false,
      createdBy: userId,
      createdAt: now,
    });

    if (args.communityId) {
      const existingSave = await ctx.db
        .query('savedCommunityEvents')
        .withIndex('by_user_event', (q) =>
          q.eq('userId', userId).eq('eventId', eventId)
        )
        .unique();
      if (existingSave) {
        if (existingSave.removedAt !== undefined) {
          await ctx.db.patch(existingSave._id, { removedAt: undefined });
        }
      } else {
        await ctx.db.insert('savedCommunityEvents', {
          userId,
          eventId,
          communityId: args.communityId,
          createdAt: now,
        });
      }
    }

    return eventId;
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
    isRecurring: v.optional(v.boolean()),
    recurringPattern: v.optional(v.string()),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    locationUrl: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    groupId: v.optional(v.id('spaces')),
    // FIXED: allow edit flows to preserve/update existing event sharing fields
    participants: v.optional(v.array(v.string())),
    sharedWithUserIds: v.optional(v.array(v.id('users'))),
    allFamily: v.optional(v.boolean()),
    sharedWithFamilyMemberIds: v.optional(v.array(v.string())),
    tasksVisibleToParticipants: v.optional(v.boolean()),
    requiresRsvp: v.optional(v.boolean()),
    // FIXED: file attachments (max 2; backend diffs and deletes removed files from storage)
    attachments: v.optional(v.array(attachmentObject)),
    // Reminder offsets in minutes before event start
    reminders: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { id, attachments, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר למערכת');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('אירוע לא נמצא');
    if (existing.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        existing.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) {
        throw new Error('אין הרשאה לערוך את האירוע');
      }
      const isCreator = existing.createdBy === userId;
      const isOwnerOrAdmin =
        membership.role === 'owner' || membership.role === 'admin';
      if (!isCreator && !isOwnerOrAdmin) {
        throw new Error('אין הרשאה לערוך את האירוע');
      }
    } else if (existing.createdBy !== userId) {
      throw new Error('אין הרשאה לערוך את האירוע');
    }

    let stampedAttachments: typeof existing.attachments | undefined;
    if (attachments !== undefined) {
      if (attachments.length > 2) {
        throw new Error('לא ניתן לצרף יותר מ-2 קבצים לאירוע');
      }

      // Delete from storage any file present in the old list but absent from the new list
      const newIds = new Set(attachments.map((a) => a.storageId));
      for (const old of existing.attachments ?? []) {
        if (!newIds.has(old.storageId)) {
          await ctx.storage.delete(old.storageId);
        }
      }

      const now = Date.now();
      // Build a lookup of existing metadata so we can preserve uploadedBy/uploadedAt
      const existingByStorageId = new Map(
        (existing.attachments ?? []).map((a) => [a.storageId, a])
      );

      stampedAttachments = attachments.map((a) => {
        const prev = existingByStorageId.get(a.storageId);
        return {
          ...a,
          uploadedBy: prev?.uploadedBy ?? userId,
          uploadedAt: prev?.uploadedAt ?? now,
        };
      });
    }

    await ctx.db.patch(id, {
      ...fields,
      ...(stampedAttachments !== undefined
        ? { attachments: stampedAttachments }
        : {}),
    });
  },
});

// ─────────────────────────────────────────────────────────────
// ביטול אירוע (מאומת — רק יוצר האירוע, לא מוחק)
// FIXED: also patches all linkedEvents sourceStatus → 'cancelled'
// ─────────────────────────────────────────────────────────────
export const cancelEvent = mutation({
  args: {
    eventId: v.id('events'),
    cancelReason: v.optional(v.string()),
    cancelledBy: v.optional(v.id('users')),
  },
  handler: async (ctx, { eventId, cancelReason, cancelledBy }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר');
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('אירוע לא נמצא');
    if (event.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) {
        throw new Error('אין הרשאה');
      }
      const isCreator = event.createdBy === userId;
      const isOwnerOrAdmin =
        membership.role === 'owner' || membership.role === 'admin';
      if (!isCreator && !isOwnerOrAdmin) throw new Error('אין הרשאה');
    } else if (event.createdBy !== userId) {
      throw new Error('אין הרשאה');
    }

    await ctx.db.patch(eventId, {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelledBy: cancelledBy ?? userId,
      cancelReason,
    });

    // Propagate cancellation to all linked events saved by recipients
    const linked = await ctx.db
      .query('linkedEvents')
      .withIndex('by_source', (q) => q.eq('sourceEventId', eventId))
      .collect();
    for (const row of linked) {
      if (row.sourceStatus !== 'cancelled') {
        await ctx.db.patch(row._id, { sourceStatus: 'cancelled' });
      }
    }

    // TODO push notification:
    // notify all participants that the event was cancelled
    // include event.title and cancelReason if provided
  },
});

// ─────────────────────────────────────────────────────────────
// מחיקת אירועים שבוטלו לאחר 14 ימים
// ─────────────────────────────────────────────────────────────
export const deleteCancelledEventsPastGracePeriod = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query('events')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'cancelled'),
          q.lt(q.field('cancelledAt'), cutoff)
        )
      )
      .collect();
    for (const ev of old) {
      await ctx.db.delete(ev._id);
    }
    return { deleted: old.length };
  },
});
// TODO cleanup job: call deleteCancelledEventsPastGracePeriod on a schedule.
// Do NOT call this mutation from the UI in this step.

// ─────────────────────────────────────────────────────────────
// מחיקת אירוע (מאומת — רק יוצר האירוע)
// FIXED: patches all linkedEvents sourceStatus → 'deleted' before deleting
//        so recipients see a tombstone with last-known snapshot data
// ─────────────────────────────────────────────────────────────
export const deleteEvent = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('לא מחובר');
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('אירוע לא נמצא');
    if (event.communityId) {
      const membership = await getCommunityMembership(
        ctx,
        event.communityId,
        userId
      );
      if (!isActiveCommunityMember(membership)) {
        throw new Error('אין הרשאה');
      }
      const isCreator = event.createdBy === userId;
      const isOwnerOrAdmin =
        membership.role === 'owner' || membership.role === 'admin';
      if (!isCreator && !isOwnerOrAdmin) throw new Error('אין הרשאה');
    } else if (event.createdBy !== userId) {
      throw new Error('אין הרשאה');
    }

    // Patch linked events before deleting — recipients will fall back to snapshot
    const linked = await ctx.db
      .query('linkedEvents')
      .withIndex('by_source', (q) => q.eq('sourceEventId', eventId))
      .collect();
    for (const row of linked) {
      await ctx.db.patch(row._id, { sourceStatus: 'deleted' });
    }

    await ctx.db.delete(eventId);
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

// ─────────────────────────────────────────────────────────────
// אירועי קהילות עבור תאריך נבחר — לדף הבית
// מחזיר את כל האירועים בקהילות של המשתמש הנוכחי בטווח הזמן
// ─────────────────────────────────────────────────────────────
export const listCommunityEventsForDate = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query('communityMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const activeMembers = memberships.filter((m) => isActiveCommunityMember(m));

    const userRsvps = await ctx.db
      .query('eventRsvps')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const rsvpByEventId = new Map(
      userRsvps.map((r) => [r.eventId as string, r.status])
    );

    const savedIds = await loadActiveSavedEventIds(ctx, userId);
    const optOutIds = await loadOptOutEventIds(ctx, userId);

    const results = await Promise.all(
      activeMembers.map(async ({ communityId, role }) => {
        const community = await ctx.db.get(communityId);
        if (!community || community.archived) return [];

        const events = await ctx.db
          .query('events')
          .withIndex('by_community_date', (q) =>
            q
              .eq('communityId', communityId)
              .gte('startTime', from)
              .lte('startTime', to)
          )
          .collect();

        return events
          .filter((ev) => ev.status !== 'cancelled')
          .filter((ev) => {
            const privileged = isCommunityEventPrivilegedForCalendar(
              ev.createdBy,
              userId,
              role
            );
            const idStr = ev._id as string;
            return shouldIncludeInPersonalHomeCalendar({
              privileged,
              requiresRsvp: ev.requiresRsvp,
              rsvpStatus: rsvpByEventId.get(ev._id),
              hasActiveSave: savedIds.has(idStr),
              hasOptOut: optOutIds.has(idStr),
            });
          })
          .map((ev) => ({
            _id: ev._id,
            title: ev.title,
            startTime: ev.startTime,
            endTime: ev.endTime,
            allDay: ev.allDay ?? false,
            communityId,
            communityName: community.name,
            location: ev.location,
            isSavedToMyCalendar: computeIsSavedToMyCalendar({
              requiresRsvp: ev.requiresRsvp,
              rsvpStatus: rsvpByEventId.get(ev._id),
              hasActiveSave: savedIds.has(ev._id as string),
              hasOptOut: optOutIds.has(ev._id as string),
            }),
          }));
      })
    );

    return results.flat();
  },
});
