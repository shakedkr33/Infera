/**
 * Tests for convex/eventTasks.ts — assertCommunityTaskAssigneeAllowed
 * (FIX B follow-up: Community task assignment integrity).
 *
 * Community Event tasks must be account-backed: assignment is restricted
 * to ACTIVE members of the SAME community. Personal Events must keep
 * manual/free-text assignment working exactly as before. Clearing an
 * assignment (assignee === null) — including a legacy manual one — must
 * never be blocked, so existing legacy Community manual assignments stay
 * removable without being silently mutated elsewhere.
 *
 * This validates only the pure decision logic (no ctx/db), matching the
 * existing pattern used for summarizeEventTaskCounts in this same file —
 * no Convex test harness is introduced.
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import type { Id } from '../../convex/_generated/dataModel';
import { assertCommunityTaskAssigneeAllowed } from '../../convex/eventTasks';

const communityId = 'community_1' as Id<'communities'>;
const userId = 'user_1' as Id<'users'>;

describe('assertCommunityTaskAssigneeAllowed — Community Events', () => {
  it('[TEST 1] rejects manual assignee for a Community Event', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed(
        { communityId },
        { type: 'manual', name: 'דני' },
        false
      )
    ).toThrow('באירוע קהילה ניתן להקצות משימה רק לחברי הקהילה');
  });

  it('[TEST 2] rejects a user assignee who is not an active community member', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed(
        { communityId },
        { type: 'user', userId },
        false
      )
    ).toThrow('ניתן להקצות משימה רק לחברי קהילה פעילים');
  });

  it('[TEST 3] allows a user assignee who IS an active community member', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed(
        { communityId },
        { type: 'user', userId },
        true
      )
    ).not.toThrow();
  });

  it('[TEST 4] allows clearing (assignee === null), including a legacy manual assignment', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed({ communityId }, null, false)
    ).not.toThrow();
  });
});

describe('assertCommunityTaskAssigneeAllowed — Personal Events', () => {
  it('[TEST 5] allows manual assignee for a Personal Event (no communityId)', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed(
        {},
        { type: 'manual', name: 'דני' },
        false
      )
    ).not.toThrow();
  });

  it('[TEST 6] allows a user assignee for a Personal Event regardless of membership flag', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed({}, { type: 'user', userId }, false)
    ).not.toThrow();
  });

  it('[TEST 7] allows clearing for a Personal Event', () => {
    expect(() =>
      assertCommunityTaskAssigneeAllowed({}, null, false)
    ).not.toThrow();
  });
});
