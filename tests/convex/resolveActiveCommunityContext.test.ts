/**
 * QA FIX (Issue 1) — tests for the pure decision helper behind the global
 * "+" button's community context. See lib/resolveActiveCommunityContext.ts
 * for the full rationale: this rule must be driven by focus/route state
 * (via useFocusEffect at the call site), not stale mounted-component state,
 * so the community actions disappear immediately once the viewer navigates
 * to any non-inner-community screen (Home, Calendar, Tasks, Communities
 * list, etc).
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';

import { resolveActiveCommunityContext } from '../../lib/resolveActiveCommunityContext';

describe('resolveActiveCommunityContext — Issue 1 (global "+" context leak)', () => {
  it('returns null while community data is still loading (undefined)', () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: undefined,
      })
    ).toBeNull();
  });

  it('returns null when the community was not found (null)', () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: null,
      })
    ).toBeNull();
  });

  it("returns null while the viewer's membership is still pending — no community creation options for a non-member yet", () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: {
          name: 'קהילת הרצים',
          myRole: 'member',
          myMembershipStatus: 'pending',
        },
      })
    ).toBeNull();
  });

  it('owner, active membership -> full context with canCreateCommunityContent = true', () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: {
          name: 'קהילת הרצים',
          myRole: 'owner',
          myMembershipStatus: 'active',
        },
      })
    ).toEqual({
      communityId: 'community_1',
      communityName: 'קהילת הרצים',
      canCreateCommunityContent: true,
    });
  });

  it('admin, active membership -> canCreateCommunityContent = true', () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: {
          name: 'קהילת הרצים',
          myRole: 'admin',
          myMembershipStatus: 'active',
        },
      })
    ).toEqual({
      communityId: 'community_1',
      communityName: 'קהילת הרצים',
      canCreateCommunityContent: true,
    });
  });

  it('regular member, active membership -> context exists but canCreateCommunityContent = false', () => {
    expect(
      resolveActiveCommunityContext({
        communityId: 'community_1',
        community: {
          name: 'קהילת הרצים',
          myRole: 'member',
          myMembershipStatus: 'active',
        },
      })
    ).toEqual({
      communityId: 'community_1',
      communityName: 'קהילת הרצים',
      canCreateCommunityContent: false,
    });
  });

  it('carries through the correct communityId + name when switching between two different communities', () => {
    const first = resolveActiveCommunityContext({
      communityId: 'community_1',
      community: {
        name: 'קהילת הרצים',
        myRole: 'owner',
        myMembershipStatus: 'active',
      },
    });
    const second = resolveActiveCommunityContext({
      communityId: 'community_2',
      community: {
        name: 'קהילת השחייה',
        myRole: 'admin',
        myMembershipStatus: 'active',
      },
    });
    expect(first?.communityId).toBe('community_1');
    expect(first?.communityName).toBe('קהילת הרצים');
    expect(second?.communityId).toBe('community_2');
    expect(second?.communityName).toBe('קהילת השחייה');
  });

  it("PLUS CONTEXT rule: navigating away is represented by the caller simply not calling this resolver at all (useFocusEffect cleanup sets context to null directly) — this helper's null-safety only covers the loading/pending edge cases, not the focus lifecycle itself", () => {
    // Documents the division of responsibility asserted in the Issue 1 fix:
    // resolveActiveCommunityContext decides WHAT the context should be
    // while this screen is focused and its data is ready; useFocusEffect's
    // cleanup (in community/[id].tsx) is solely responsible for clearing it
    // to null the instant focus is lost, even though the screen may remain
    // mounted under Tabs.Screen. Nothing to assert on the pure function
    // here beyond it being deterministic for the same inputs.
    const a = resolveActiveCommunityContext({
      communityId: 'community_1',
      community: {
        name: 'קהילת הרצים',
        myRole: 'owner',
        myMembershipStatus: 'active',
      },
    });
    const b = resolveActiveCommunityContext({
      communityId: 'community_1',
      community: {
        name: 'קהילת הרצים',
        myRole: 'owner',
        myMembershipStatus: 'active',
      },
    });
    expect(a).toEqual(b);
  });
});
