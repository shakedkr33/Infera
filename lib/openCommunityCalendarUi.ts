/**
 * Shared rules and copy for "open community event" personal calendar actions
 * (add/remove from my calendar). UI only — server enforces permissions.
 */

export type OpenCommunityCalendarEventLike = {
  communityId?: string | null;
  requiresRsvp?: boolean;
  status?: 'active' | 'cancelled';
};

export type CommunityMembershipLike = {
  status?: 'active' | 'left' | 'pending';
} | null;

/** True if the viewer is an active (non-pending, non-left) community member. */
export function viewerIsActiveCommunityMember(
  membership: CommunityMembershipLike
): boolean {
  if (!membership) {
    return false;
  }
  if (membership.status === 'left' || membership.status === 'pending') {
    return false;
  }
  return true;
}

/**
 * When `event` is loaded from `api.events.getById` for a community event, the
 * backend already requires an active membership. Callers may pass
 * `viewerIsActiveMember: true` in that case, or compute from membership row.
 */
export function isOpenCommunityCalendarActionVisible(args: {
  event: OpenCommunityCalendarEventLike;
  hasValidConvexEventId: boolean;
  communityArchived?: boolean;
  viewerIsActiveMember: boolean;
}): boolean {
  const {
    event,
    hasValidConvexEventId,
    communityArchived,
    viewerIsActiveMember,
  } = args;
  if (!hasValidConvexEventId) {
    return false;
  }
  if (!event.communityId) {
    return false;
  }
  if (event.requiresRsvp !== false) {
    return false;
  }
  if (event.status === 'cancelled') {
    return false;
  }
  if (communityArchived === true) {
    return false;
  }
  if (!viewerIsActiveMember) {
    return false;
  }
  return true;
}

export function getOpenCommunityCalendarActionLabel(
  isSavedToMyCalendar: boolean
): 'להוסיף ליומן' | 'להסיר מהיומן' {
  return isSavedToMyCalendar ? 'להסיר מהיומן' : 'להוסיף ליומן';
}

/** Informational label "פתוח לחברי הקהילה" — not tied to RSVP UI or roles. */
export function isOpenCommunityInformationalLabelVisible(args: {
  event: OpenCommunityCalendarEventLike;
  communityArchived?: boolean;
  viewerIsActiveMember: boolean;
}): boolean {
  const { event, communityArchived, viewerIsActiveMember } = args;
  if (!event.communityId) {
    return false;
  }
  if (event.requiresRsvp !== false) {
    return false;
  }
  if (event.status === 'cancelled') {
    return false;
  }
  if (communityArchived === true) {
    return false;
  }
  if (!viewerIsActiveMember) {
    return false;
  }
  return true;
}
