/**
 * Tests for lib/eventRsvpUnanswered.ts — FIX D "טרם ענו" (unanswered)
 * calculation for Community Events that require RSVP.
 *
 * Run with: bun test tests/convex
 */

import { describe, expect, it } from 'bun:test';

import {
  canViewUnansweredRsvp,
  computeUnansweredCommunityMembers,
  unansweredMemberDisplayName,
} from '../../lib/eventRsvpUnanswered';

describe('computeUnansweredCommunityMembers', () => {
  it('excludes the event creator, even with no RSVP row', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'creator', fullName: 'יוצר' }],
      rsvpRows: [],
      eventCreatedBy: 'creator',
    });
    expect(result).toEqual([]);
  });

  it('includes an active member with no RSVP row', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [
        { userId: 'creator', fullName: 'יוצר' },
        { userId: 'u1', fullName: 'דנה' },
      ],
      rsvpRows: [],
      eventCreatedBy: 'creator',
    });
    expect(result.map((m) => m.userId)).toEqual(['u1']);
  });

  it('includes a non-creator owner/admin member with no RSVP row', () => {
    // Caller is responsible for passing only active members; role itself
    // does not exempt anyone from RSVP other than the creator.
    const result = computeUnansweredCommunityMembers({
      activeMembers: [
        { userId: 'creator', fullName: 'יוצר' },
        { userId: 'admin1', fullName: 'מנהל' },
      ],
      rsvpRows: [],
      eventCreatedBy: 'creator',
    });
    expect(result.map((m) => m.userId)).toEqual(['admin1']);
  });

  it('excludes a member who answered "yes"', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'u1', fullName: 'דנה' }],
      rsvpRows: [{ userId: 'u1', status: 'yes' }],
      eventCreatedBy: 'creator',
    });
    expect(result).toEqual([]);
  });

  it('excludes a member who answered "maybe"', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'u1', fullName: 'דנה' }],
      rsvpRows: [{ userId: 'u1', status: 'maybe' }],
      eventCreatedBy: 'creator',
    });
    expect(result).toEqual([]);
  });

  it('excludes a member who answered "no"', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'u1', fullName: 'דנה' }],
      rsvpRows: [{ userId: 'u1', status: 'no' }],
      eventCreatedBy: 'creator',
    });
    expect(result).toEqual([]);
  });

  it('treats "none" status as NOT answered — still unanswered', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'u1', fullName: 'דנה' }],
      rsvpRows: [{ userId: 'u1', status: 'none' }],
      eventCreatedBy: 'creator',
    });
    expect(result.map((m) => m.userId)).toEqual(['u1']);
  });

  it('does not include inactive/removed/pending members (caller-filtered input)', () => {
    // activeMembers is expected to already be filtered to active members
    // only — this test documents that the helper does not need to
    // re-filter, since only active members are ever passed in.
    const result = computeUnansweredCommunityMembers({
      activeMembers: [{ userId: 'u1', fullName: 'דנה' }],
      rsvpRows: [],
      eventCreatedBy: 'creator',
    });
    expect(result.map((m) => m.userId)).toEqual(['u1']);
  });

  it('deduplicates by userId across duplicate member/RSVP rows', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [
        { userId: 'u1', fullName: 'דנה' },
        { userId: 'u1', fullName: 'דנה' },
      ],
      rsvpRows: [
        { userId: 'u2', status: 'yes' },
        { userId: 'u2', status: 'yes' },
      ],
      eventCreatedBy: 'creator',
    });
    expect(result.length).toBe(1);
    expect(result[0]?.userId).toBe('u1');
  });

  it('returns empty list when every active member answered', () => {
    const result = computeUnansweredCommunityMembers({
      activeMembers: [
        { userId: 'u1', fullName: 'דנה' },
        { userId: 'u2', fullName: 'רון' },
      ],
      rsvpRows: [
        { userId: 'u1', status: 'yes' },
        { userId: 'u2', status: 'no' },
      ],
      eventCreatedBy: 'creator',
    });
    expect(result).toEqual([]);
  });
});

describe('canViewUnansweredRsvp', () => {
  it('true for event creator', () => {
    expect(
      canViewUnansweredRsvp({
        isEventCreator: true,
        isActiveCommunityOwnerOrAdmin: false,
      })
    ).toBe(true);
  });

  it('true for active owner/admin who is not the creator', () => {
    expect(
      canViewUnansweredRsvp({
        isEventCreator: false,
        isActiveCommunityOwnerOrAdmin: true,
      })
    ).toBe(true);
  });

  it('false for a regular active member', () => {
    expect(
      canViewUnansweredRsvp({
        isEventCreator: false,
        isActiveCommunityOwnerOrAdmin: false,
      })
    ).toBe(false);
  });
});

describe('unansweredMemberDisplayName', () => {
  it('trims fullName', () => {
    expect(
      unansweredMemberDisplayName({ userId: 'u1', fullName: '  דנה  ' })
    ).toBe('דנה');
  });

  it('falls back to "משתמש" for empty/whitespace fullName', () => {
    expect(unansweredMemberDisplayName({ userId: 'u1', fullName: '   ' })).toBe(
      'משתמש'
    );
  });
});
