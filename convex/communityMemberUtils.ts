import type { Doc } from './_generated/dataModel';

/** Resolved membership row status; missing/legacy rows count as active. */
export function effectiveMemberStatus(
  status: Doc<'communityMembers'>['status']
): 'active' | 'left' | 'pending' {
  if (status === 'left') return 'left';
  if (status === 'pending') return 'pending';
  return 'active';
}

/** User may access community content (events, tasks, etc.). */
export function isActiveCommunityMember(
  membership: Doc<'communityMembers'> | null
): membership is Doc<'communityMembers'> {
  if (!membership) return false;
  return effectiveMemberStatus(membership.status) === 'active';
}
