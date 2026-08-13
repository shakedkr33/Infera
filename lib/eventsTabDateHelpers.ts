/**
 * Pure date helpers for the community "אירועים" tab's month navigator
 * (Stage 3 + Stage 3 correction). Extracted out of
 * app/(authenticated)/community/[id].tsx so the month range/navigation/
 * temporal-kind logic can be unit tested without mounting the screen or a
 * Convex query — same precedent as lib/resolveActiveCommunityContext.ts.
 *
 * STAGE 3 CORRECTION: the original forward-only 12-month tab strip
 * (`getEventsTabMonthOptions` / `eventsTabMonthOptionsSpanMultipleYears` /
 * `formatEventsTabMonthLabel`) has been REMOVED and replaced with simple
 * prev/next month/year arrow navigation that has no product-imposed past or
 * future limit — see getPreviousEventsTabMonth / getNextEventsTabMonth.
 */

export type EventsTabMonth = { year: number; monthIndex0: number };

/**
 * `monthStart` (inclusive) / `nextMonthStart` (EXCLUSIVE) / `monthEnd`
 * (inclusive, `nextMonthStart - 1`ms, kept only for callers that still want
 * the last-instant-of-month value).
 *
 * STAGE 3 CORRECTNESS PASS: the Events tab's server query
 * (`listCommunityEventsTabPaged`) now bounds its indexed scan with
 * `.lt('startTime', nextMonthStart)` instead of `.lte('startTime', monthEnd)`.
 * Both are mathematically equivalent (`monthEnd === nextMonthStart - 1`,
 * verified for every month across DST transitions in
 * eventsTabDateHelpers.test.ts), but an explicit exclusive upper bound is
 * the clearer, less fragile-looking contract the query should rely on —
 * it can never be off-by-one even if this helper's internals change later.
 */
export function getEventsTabMonthRange(
  year: number,
  monthIndex0: number
): { monthStart: number; monthEnd: number; nextMonthStart: number } {
  const monthStart = new Date(year, monthIndex0, 1, 0, 0, 0, 0).getTime();
  const nextMonthStart = new Date(
    year,
    monthIndex0 + 1,
    1,
    0,
    0,
    0,
    0
  ).getTime();
  const monthEnd = nextMonthStart - 1;
  return { monthStart, monthEnd, nextMonthStart };
}

/** The calendar month containing `nowMs` — the Events tab's default selection. */
export function getCurrentEventsTabMonth(nowMs: number): EventsTabMonth {
  const d = new Date(nowMs);
  return { year: d.getFullYear(), monthIndex0: d.getMonth() };
}

/**
 * 00:00:00.000 of the LOCAL (device-timezone) calendar day containing
 * `nowMs` — the canonical `localDayStart` the client passes to
 * `events.listCommunityMainOverview` / `events.listCommunityAdditionalEventsPaged`
 * as their indexed scan's lower bound, replacing a previous flat 48h
 * server-side lookback. Computed on the client (never in the Convex
 * handler, which would use the SERVER's timezone) so an all-day event
 * whose `startTime` is stamped at today's local midnight is reached by
 * the scan for the entirety of today, while yesterday's all-day events
 * (which already ended) never enter the scan at all.
 */
export function getLocalDayStart(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * One calendar month back. December → January automatically rolls the year
 * back by one (JS `Date` normalizes monthIndex0 === -1 into December of the
 * previous year) — no manual year-boundary branching needed. No lower
 * product limit: this can be called an unbounded number of times.
 */
export function getPreviousEventsTabMonth(
  year: number,
  monthIndex0: number
): EventsTabMonth {
  const d = new Date(year, monthIndex0 - 1, 1);
  return { year: d.getFullYear(), monthIndex0: d.getMonth() };
}

/**
 * One calendar month forward. January → December automatically rolls the
 * year forward by one. No upper product limit: this can be called an
 * unbounded number of times.
 */
export function getNextEventsTabMonth(
  year: number,
  monthIndex0: number
): EventsTabMonth {
  const d = new Date(year, monthIndex0 + 1, 1);
  return { year: d.getFullYear(), monthIndex0: d.getMonth() };
}

/** True when (year, monthIndex0) is the calendar month containing `nowMs`. */
export function isCurrentEventsTabMonth(
  nowMs: number,
  year: number,
  monthIndex0: number
): boolean {
  const current = getCurrentEventsTabMonth(nowMs);
  return current.year === year && current.monthIndex0 === monthIndex0;
}

/** Hebrew month/year label for the navigator title, e.g. "אוגוסט 2026". */
export function formatEventsTabMonthYearLabel(
  year: number,
  monthIndex0: number
): string {
  const d = new Date(year, monthIndex0, 1);
  const monthName = d.toLocaleDateString('he-IL', { month: 'long' });
  return `${monthName} ${year}`;
}

export type EventsTabMonthTemporalKind = 'past' | 'current' | 'future';

/**
 * Whether the selected month lies entirely before, contains, or lies
 * entirely after the calendar month containing `nowMs`. Drives Part B's
 * section rules:
 *   - 'past'    → ONLY a historical "אירועים שהתקיימו" list, no
 *                 action-oriented sections.
 *   - 'current' → normal three-section semantics for events that have not
 *                 yet ended, PLUS a historical list for ones that have.
 *   - 'future'  → normal three-section semantics only.
 */
export function getEventsTabMonthTemporalKind(
  nowMs: number,
  year: number,
  monthIndex0: number
): EventsTabMonthTemporalKind {
  const current = getCurrentEventsTabMonth(nowMs);
  if (current.year === year && current.monthIndex0 === monthIndex0) {
    return 'current';
  }
  if (
    year < current.year ||
    (year === current.year && monthIndex0 < current.monthIndex0)
  ) {
    return 'past';
  }
  return 'future';
}

/**
 * Pure, testable "has this event already ended?" check — the CURRENT
 * month's dividing line between the normal three sections and "אירועים
 * שהתקיימו" (Part B2). All-day events are treated as ending at the end of
 * their local calendar day (23:59:59.999), matching `events.ts`'s own
 * all-day `endTime` convention (see event/new.tsx's community/personal save
 * handlers, which stamp all-day endTime at 23:59:59.999) — this helper does
 * not depend on that convention holding, it recomputes independently from
 * `startTime` so it stays correct even for older data.
 */
export function hasEventEndedByNow(
  event: { startTime: number; endTime: number; allDay?: boolean },
  nowMs: number
): boolean {
  if (event.allDay) {
    const d = new Date(event.startTime);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < nowMs;
  }
  return event.endTime < nowMs;
}
