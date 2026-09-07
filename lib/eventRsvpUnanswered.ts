/**
 * FIX D — shared "טרם ענו" (unanswered) calculation for Community Events
 * that require RSVP. Manager-only (event creator OR active community
 * owner/admin) coordination information — regular members must never see
 * this.
 *
 * Unanswered members = current ACTIVE community members
 *   MINUS the event creator
 *   MINUS users with an answered RSVP status (`yes` | `maybe` | `no`)
 *
 * An RSVP row with `none`, undefined, or any other non-answered value does
 * NOT count as answered — that member still shows up as unanswered.
 *
 * This intentionally does NOT read `event.participants` (manual personal
 * event invitees) — Community RSVP and Personal Event participants are
 * separate concepts and must never be mixed.
 */

const ANSWERED_RSVP_STATUSES = new Set(['yes', 'maybe', 'no']);

export type ActiveCommunityMemberLike = {
  userId: string;
  fullName: string;
};

export type EventRsvpRowLike = {
  userId: string;
  status?: string;
};

/**
 * True when the viewer may see manager-only RSVP information ("טרם ענו")
 * for a Community Event: the event's creator, or an active community
 * owner/admin (regardless of who created the event).
 */
export function canViewUnansweredRsvp(args: {
  isEventCreator: boolean;
  isActiveCommunityOwnerOrAdmin: boolean;
}): boolean {
  return args.isEventCreator || args.isActiveCommunityOwnerOrAdmin;
}

/**
 * Computes the list of active community members who have not yet submitted
 * an answered ('yes' | 'maybe' | 'no') RSVP for the event, excluding the
 * event creator (who is canonically exempt from RSVP).
 *
 * Defensively deduplicates by userId on both inputs.
 */
export function computeUnansweredCommunityMembers(args: {
  activeMembers: readonly ActiveCommunityMemberLike[];
  rsvpRows: readonly EventRsvpRowLike[];
  eventCreatedBy: string | undefined;
}): ActiveCommunityMemberLike[] {
  const { activeMembers, rsvpRows, eventCreatedBy } = args;

  const answeredUserIds = new Set<string>();
  for (const row of rsvpRows) {
    if (row.status !== undefined && ANSWERED_RSVP_STATUSES.has(row.status)) {
      answeredUserIds.add(row.userId);
    }
  }

  const seen = new Set<string>();
  const unanswered: ActiveCommunityMemberLike[] = [];
  for (const member of activeMembers) {
    if (seen.has(member.userId)) continue;
    seen.add(member.userId);
    if (eventCreatedBy !== undefined && member.userId === eventCreatedBy) {
      continue;
    }
    if (answeredUserIds.has(member.userId)) continue;
    unanswered.push(member);
  }
  return unanswered;
}

/** Trims `fullName`, falling back to "משתמש" — same fallback rule as RSVP rows. */
export function unansweredMemberDisplayName(
  member: ActiveCommunityMemberLike
): string {
  const trimmed = member.fullName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'משתמש';
}

/** Trims an RSVP row's `displayName`, falling back to "משתמש". */
export function rsvpRowDisplayName(row: { displayName?: string }): string {
  const trimmed = row.displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'משתמש';
}
