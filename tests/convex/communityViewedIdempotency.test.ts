/**
 * communityViewedIdempotency — server-side safety net for
 * `markCommunityViewed` (Optimization Sprint Fix #1).
 *
 * Covers the timing predicate that decides whether a fresh
 * `lastViewedAt` write should be skipped because the previous mark for the
 * same membership is still "fresh" — the last line of defense against the
 * confirmed markCommunityViewed <-> getCommunity write/invalidation loop.
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';
import {
  MARK_COMMUNITY_VIEWED_MIN_INTERVAL_MS,
  shouldSkipMarkCommunityViewed,
} from '../../lib/communityViewedIdempotency';

describe('shouldSkipMarkCommunityViewed — Optimization Sprint Fix #1', () => {
  it('no previous lastViewedAt -> should write (never skip a first-ever visit)', () => {
    expect(shouldSkipMarkCommunityViewed(undefined, 1_000_000)).toBe(false);
  });

  it('lastViewedAt 1,000ms ago -> should skip', () => {
    const now = 1_000_000;
    expect(shouldSkipMarkCommunityViewed(now - 1_000, now)).toBe(true);
  });

  it('lastViewedAt 4,999ms ago -> should skip (just under the threshold)', () => {
    const now = 1_000_000;
    expect(shouldSkipMarkCommunityViewed(now - 4_999, now)).toBe(true);
  });

  it('lastViewedAt exactly 5,000ms ago -> should write (threshold boundary is inclusive of writing)', () => {
    const now = 1_000_000;
    expect(
      shouldSkipMarkCommunityViewed(
        now - MARK_COMMUNITY_VIEWED_MIN_INTERVAL_MS,
        now
      )
    ).toBe(false);
  });

  it('lastViewedAt 5,001ms+ ago -> should write', () => {
    const now = 1_000_000;
    expect(shouldSkipMarkCommunityViewed(now - 5_001, now)).toBe(false);
  });

  it('future/invalid lastViewedAt (clock skew) -> should skip, never a write loop', () => {
    const now = 1_000_000;
    // lastViewedAt an hour in the future relative to `now`.
    expect(shouldSkipMarkCommunityViewed(now + 3_600_000, now)).toBe(true);
  });

  it('respects a custom thresholdMs override', () => {
    const now = 1_000_000;
    expect(shouldSkipMarkCommunityViewed(now - 4_000, now, 5_000)).toBe(true);
    expect(shouldSkipMarkCommunityViewed(now - 6_000, now, 5_000)).toBe(
      false
    );
  });
});
