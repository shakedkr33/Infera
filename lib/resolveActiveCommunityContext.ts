import type { ActiveCommunityContext } from '@/contexts/ActionSheetContext';

/**
 * QA FIX (Issue 1) — pure decision helper for what the global "+" sheet's
 * active community context should be, extracted out of
 * app/(authenticated)/community/[id].tsx's `useFocusEffect` so the rule
 * ("community actions are only ever exposed while THIS screen is the
 * focused route, for a fully-loaded, non-pending membership") can be unit
 * tested without mounting React Navigation / Convex.
 *
 * Returns `null` when the community data isn't ready yet (still loading,
 * not found, or the viewer's membership is still pending) — the caller
 * must treat `null` the same as "no context", clearing the sheet's
 * community section.
 */
export function resolveActiveCommunityContext(args: {
  communityId: string;
  community:
    | {
        name: string;
        myRole: 'owner' | 'admin' | 'member' | null;
        myMembershipStatus: 'active' | 'pending' | 'left' | null;
      }
    | null
    | undefined;
}): ActiveCommunityContext | null {
  const { communityId, community } = args;
  if (community === undefined || community === null) return null;
  if (community.myMembershipStatus === 'pending') return null;

  return {
    communityId,
    communityName: community.name,
    canCreateCommunityContent:
      community.myRole === 'owner' || community.myRole === 'admin',
  };
}
