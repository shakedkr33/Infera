/**
 * canManageEventReminderItem
 *
 * Pure authorization check for the per-item delete control on the community
 * "תזכורות" tab's event-based "חשוב לזכור" group card. Mirrors the EXACT
 * same rule Convex's `events.update` enforces server-side — the event
 * creator, OR an active community owner/admin — never every owner/admin
 * unconditionally, and never inferred from anything else.
 *
 * This is a client-side UI gate only (show/hide the delete control); the
 * mutation call itself is still authorized server-side regardless of what
 * this function returns.
 */
export interface CanManageEventReminderItemArgs {
  currentUserId?: string;
  eventCreatedBy: string;
  myRole?: 'owner' | 'admin' | 'member';
}

export function canManageEventReminderItem({
  currentUserId,
  eventCreatedBy,
  myRole,
}: CanManageEventReminderItemArgs): boolean {
  if (currentUserId === undefined) return false;
  return (
    eventCreatedBy === currentUserId || myRole === 'owner' || myRole === 'admin'
  );
}
