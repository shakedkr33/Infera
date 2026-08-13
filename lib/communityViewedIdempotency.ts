/**
 * communityViewedIdempotency
 *
 * Optimization Sprint Fix #1 — server-side safety net for
 * `convex/communities.ts`'s `markCommunityViewed` mutation.
 *
 * The client (`app/(authenticated)/community/[id].tsx`) is responsible for
 * only calling this mutation ONCE per genuine screen focus/visit (see the
 * focus-based visit guard there). This helper is a DEFENSIVE second layer,
 * not a substitute for that client lifecycle fix: even if some future
 * regression on the client causes rapid/duplicate calls (or the mutation is
 * ever called directly), the server must not thrash `communityMembers`
 * writes — every write invalidates `getCommunity` for this viewer, which
 * (before Fix #1) was exactly what turned a single reactive re-render into
 * an unbounded write loop.
 *
 * Extracted as a tiny pure function (no `ctx`/`Date.now()`) so the timing
 * predicate can be unit tested without spinning up Convex.
 */

/** Default idempotency window: skip re-marking "viewed" within this many ms
 * of the previous mark for the same membership. */
export const MARK_COMMUNITY_VIEWED_MIN_INTERVAL_MS = 5_000;

/**
 * True when a fresh `lastViewedAt` write should be SKIPPED because the
 * previous mark is still "fresh" (within `thresholdMs`).
 *
 * - No previous `lastViewedAt` at all → never skip (first-ever visit must
 *   write).
 * - `now - lastViewedAt` is negative (clock skew / a bad future timestamp
 *   somehow stored) → treated the same as "too recent" and skipped, so a
 *   corrupt/future value can never be used to justify a fresh write loop.
 * - Exactly at the threshold or later → do not skip (write allowed).
 */
export function shouldSkipMarkCommunityViewed(
  lastViewedAt: number | undefined,
  now: number,
  thresholdMs: number = MARK_COMMUNITY_VIEWED_MIN_INTERVAL_MS
): boolean {
  if (lastViewedAt === undefined) return false;
  return now - lastViewedAt < thresholdMs;
}
