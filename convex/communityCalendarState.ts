import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

type RsvpStatus = 'yes' | 'no' | 'maybe' | 'none' | undefined;

/**
 * Personal "saved to my calendar" flag for community events.
 * Open events: saved row, RSVP yes, or opt-out semantics unchanged.
 * RSVP-required: only explicit savedCommunityEvents row (e.g. creator auto-save), no RSVP implied.
 */
export function computeIsSavedToMyCalendar(args: {
  requiresRsvp: boolean | undefined;
  rsvpStatus: RsvpStatus;
  hasActiveSave: boolean;
  hasOptOut: boolean;
}): boolean {
  if (args.requiresRsvp === false) {
    if (args.hasOptOut) return false;
    if (args.hasActiveSave) return true;
    return args.rsvpStatus === 'yes';
  }
  if (args.hasOptOut) return false;
  return args.hasActiveSave;
}

/** Inclusion in home / listCommunityEventsForDate aggregates (non-community list). */
export function shouldIncludeInPersonalHomeCalendar(args: {
  privileged: boolean;
  requiresRsvp: boolean | undefined;
  rsvpStatus: RsvpStatus;
  hasActiveSave: boolean;
  hasOptOut: boolean;
}): boolean {
  // Explicit opt-out always wins — even for creators / owners / admins.
  // This is set by removeCommunityEventFromMyCalendar for open events.
  if (args.hasOptOut) return false;
  // Privileged users (creator / owner / admin) are included by default
  // unless they explicitly opted out above.
  if (args.privileged) return true;
  if (args.requiresRsvp === false) {
    if (args.hasActiveSave) return true;
    if (args.rsvpStatus === 'yes') return true;
    return false;
  }
  return args.rsvpStatus === 'yes';
}

export async function loadActiveSavedEventIds(
  ctx: QueryCtx,
  userId: Id<'users'>
): Promise<Set<string>> {
  const rows = await ctx.db
    .query('savedCommunityEvents')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  const set = new Set<string>();
  for (const r of rows) {
    if (r.removedAt === undefined) {
      set.add(r.eventId as string);
    }
  }
  return set;
}

export async function loadOptOutEventIds(
  ctx: QueryCtx,
  userId: Id<'users'>
): Promise<Set<string>> {
  const rows = await ctx.db
    .query('communityEventPersonalCalendarOptOuts')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  return new Set(rows.map((r) => r.eventId as string));
}

export async function enrichEventsWithCalendarFlags<T extends Doc<'events'>>(
  ctx: QueryCtx,
  userId: Id<'users'>,
  events: T[],
  rsvpByEventId: Map<string, 'yes' | 'no' | 'maybe' | 'none'>
): Promise<Array<T & { isSavedToMyCalendar: boolean }>> {
  const savedIds = await loadActiveSavedEventIds(ctx, userId);
  const optOutIds = await loadOptOutEventIds(ctx, userId);
  return events.map((ev) => {
    const id = ev._id as string;
    const rsvpStatus = rsvpByEventId.get(id);
    return {
      ...ev,
      isSavedToMyCalendar: computeIsSavedToMyCalendar({
        requiresRsvp: ev.requiresRsvp,
        rsvpStatus,
        hasActiveSave: savedIds.has(id),
        hasOptOut: optOutIds.has(id),
      }),
    };
  });
}
