/**
 * Tests for lib/eventsTabDateHelpers.ts — the community "אירועים" tab's
 * month/year navigator + past/current/future classification (Stage 3
 * correction: replaces the old forward-only 12-month tab strip).
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';

import {
  formatEventsTabMonthYearLabel,
  getCurrentEventsTabMonth,
  getEventsTabMonthRange,
  getEventsTabMonthTemporalKind,
  getLocalDayStart,
  getNextEventsTabMonth,
  getPreviousEventsTabMonth,
  hasEventEndedByNow,
  isCurrentEventsTabMonth,
} from '../../lib/eventsTabDateHelpers';

describe('getEventsTabMonthRange', () => {
  it('resolves the correct [start, nextMonthStart) boundaries for a 31-day month', () => {
    // August 2026 -> 1st 00:00:00.000 through (exclusive) Sep 1 00:00:00.000
    const { monthStart, nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const start = new Date(monthStart);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    const nextStart = new Date(nextMonthStart);
    expect(nextStart.getFullYear()).toBe(2026);
    expect(nextStart.getMonth()).toBe(8);
    expect(nextStart.getDate()).toBe(1);
    expect(nextStart.getHours()).toBe(0);
    expect(nextMonthStart).toBeGreaterThan(monthStart);
  });

  it('monthEnd is exactly nextMonthStart - 1ms (the last instant of the month)', () => {
    const { monthEnd, nextMonthStart } = getEventsTabMonthRange(2026, 7);
    expect(monthEnd).toBe(nextMonthStart - 1);
    expect(new Date(monthEnd).getDate()).toBe(31);
    expect(new Date(monthEnd).getHours()).toBe(23);
    expect(new Date(monthEnd).getMinutes()).toBe(59);
    expect(new Date(monthEnd).getMilliseconds()).toBe(999);
  });

  it('this equivalence holds across every month of several years, including DST transitions', () => {
    for (let year = 2024; year <= 2028; year++) {
      for (let monthIndex0 = 0; monthIndex0 < 12; monthIndex0++) {
        const { monthEnd, nextMonthStart } = getEventsTabMonthRange(
          year,
          monthIndex0
        );
        expect(monthEnd).toBe(nextMonthStart - 1);
      }
    }
  });

  it('resolves February in a leap year to 29 days', () => {
    const { monthStart, nextMonthStart } = getEventsTabMonthRange(2028, 1);
    expect(new Date(monthStart).getMonth()).toBe(1);
    expect(new Date(nextMonthStart).getMonth()).toBe(2);
    expect(new Date(nextMonthStart).getDate()).toBe(1);
  });

  it('resolves February in a non-leap year to 28 days', () => {
    const { nextMonthStart } = getEventsTabMonthRange(2026, 1);
    expect(new Date(nextMonthStart).getMonth()).toBe(2);
    expect(new Date(nextMonthStart).getDate()).toBe(1);
  });

  it('rolls over correctly across a year boundary (December)', () => {
    const { monthStart, nextMonthStart } = getEventsTabMonthRange(2026, 11);
    expect(new Date(monthStart).getFullYear()).toBe(2026);
    expect(new Date(monthStart).getMonth()).toBe(11);
    expect(new Date(nextMonthStart).getFullYear()).toBe(2027);
    expect(new Date(nextMonthStart).getMonth()).toBe(0);
    expect(new Date(nextMonthStart).getDate()).toBe(1);
  });

  it('an all-day event stored at local midnight of a day in the month falls within [monthStart, nextMonthStart)', () => {
    const { monthStart, nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const allDayEventStart = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    expect(allDayEventStart).toBeGreaterThanOrEqual(monthStart);
    expect(allDayEventStart).toBeLessThan(nextMonthStart);
  });

  it('an all-day event on the LAST day of the month still falls within range (boundary: last instant)', () => {
    const { monthStart, nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const lastDayEventStart = new Date(2026, 7, 31, 0, 0, 0, 0).getTime();
    expect(lastDayEventStart).toBeGreaterThanOrEqual(monthStart);
    expect(lastDayEventStart).toBeLessThan(nextMonthStart);
  });

  it('boundary: an event starting at exactly the first instant of the NEXT month is NOT < nextMonthStart', () => {
    const { nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const nextMonthEventStart = new Date(2026, 8, 1, 0, 0, 0, 0).getTime();
    expect(nextMonthEventStart).toBe(nextMonthStart);
    // The Convex query uses `.lt('startTime', nextMonthStart)`, so this
    // event — starting at exactly nextMonthStart — must be excluded from
    // August's page (it belongs to September instead).
    expect(nextMonthEventStart < nextMonthStart).toBe(false);
  });

  it('boundary: an all-day event on the first day of the NEXT month falls outside range', () => {
    const { nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const nextMonthAllDayStart = new Date(2026, 8, 1, 0, 0, 0, 0).getTime();
    expect(nextMonthAllDayStart).toBeGreaterThanOrEqual(nextMonthStart);
  });

  it('boundary: an event 1ms before nextMonthStart is the last instant still inside the month', () => {
    const { nextMonthStart } = getEventsTabMonthRange(2026, 7);
    const lastInstantOfMonth = nextMonthStart - 1;
    expect(lastInstantOfMonth < nextMonthStart).toBe(true);
  });
});

describe('getCurrentEventsTabMonth', () => {
  it('resolves the calendar month containing the given timestamp', () => {
    const now = new Date(2026, 7, 11).getTime(); // Aug 11, 2026
    expect(getCurrentEventsTabMonth(now)).toEqual({
      year: 2026,
      monthIndex0: 7,
    });
  });
});

describe('getPreviousEventsTabMonth / getNextEventsTabMonth', () => {
  it('previous month from January enters December of the previous year', () => {
    expect(getPreviousEventsTabMonth(2027, 0)).toEqual({
      year: 2026,
      monthIndex0: 11,
    });
  });

  it('next month from December enters January of the next year', () => {
    expect(getNextEventsTabMonth(2026, 11)).toEqual({
      year: 2027,
      monthIndex0: 0,
    });
  });

  it('ordinary mid-year previous/next steps do not change the year', () => {
    expect(getPreviousEventsTabMonth(2026, 7)).toEqual({
      year: 2026,
      monthIndex0: 6,
    });
    expect(getNextEventsTabMonth(2026, 7)).toEqual({
      year: 2026,
      monthIndex0: 8,
    });
  });

  it('has no fixed navigation limit — can be applied repeatedly, unboundedly, in either direction', () => {
    let cursor = { year: 2026, monthIndex0: 7 };
    for (let i = 0; i < 36; i++) {
      cursor = getNextEventsTabMonth(cursor.year, cursor.monthIndex0);
    }
    expect(cursor).toEqual({ year: 2029, monthIndex0: 7 });

    cursor = { year: 2026, monthIndex0: 7 };
    for (let i = 0; i < 36; i++) {
      cursor = getPreviousEventsTabMonth(cursor.year, cursor.monthIndex0);
    }
    expect(cursor).toEqual({ year: 2023, monthIndex0: 7 });
  });
});

describe('isCurrentEventsTabMonth', () => {
  it('is true for the month containing `now`', () => {
    const now = new Date(2026, 7, 11).getTime();
    expect(isCurrentEventsTabMonth(now, 2026, 7)).toBe(true);
  });

  it('is false for any other month', () => {
    const now = new Date(2026, 7, 11).getTime();
    expect(isCurrentEventsTabMonth(now, 2026, 8)).toBe(false);
    expect(isCurrentEventsTabMonth(now, 2025, 7)).toBe(false);
  });
});

describe('getEventsTabMonthTemporalKind', () => {
  const now = new Date(2026, 7, 11).getTime(); // Aug 11, 2026

  it('classifies the month containing `now` as current', () => {
    expect(getEventsTabMonthTemporalKind(now, 2026, 7)).toBe('current');
  });

  it('classifies an earlier month in the same year as past', () => {
    expect(getEventsTabMonthTemporalKind(now, 2026, 6)).toBe('past');
  });

  it('classifies an earlier year as past regardless of month', () => {
    expect(getEventsTabMonthTemporalKind(now, 2025, 11)).toBe('past');
  });

  it('classifies a later month in the same year as future', () => {
    expect(getEventsTabMonthTemporalKind(now, 2026, 8)).toBe('future');
  });

  it('classifies a later year as future regardless of month', () => {
    expect(getEventsTabMonthTemporalKind(now, 2027, 0)).toBe('future');
  });

  it('has no 12-month or year-count limit — arbitrarily distant months resolve correctly', () => {
    expect(getEventsTabMonthTemporalKind(now, 2010, 0)).toBe('past');
    expect(getEventsTabMonthTemporalKind(now, 2099, 0)).toBe('future');
  });
});

describe('formatEventsTabMonthYearLabel', () => {
  it('formats a month/year as "<Hebrew month> <year>"', () => {
    expect(formatEventsTabMonthYearLabel(2026, 7)).toBe('אוגוסט 2026');
  });

  it('formats January correctly across a year rollover', () => {
    expect(formatEventsTabMonthYearLabel(2027, 0)).toBe('ינואר 2027');
  });
});

describe('hasEventEndedByNow', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0, 0).getTime(); // Aug 15, 2026 12:00

  it('a timed event with endTime in the past has ended', () => {
    const endTime = new Date(2026, 7, 15, 10, 0, 0, 0).getTime(); // 10:00 same day
    expect(
      hasEventEndedByNow({ startTime: endTime - 3_600_000, endTime }, now)
    ).toBe(true);
  });

  it('a timed event with endTime in the future has not ended', () => {
    const endTime = new Date(2026, 7, 15, 18, 0, 0, 0).getTime(); // 18:00 same day
    expect(
      hasEventEndedByNow({ startTime: endTime - 3_600_000, endTime }, now)
    ).toBe(false);
  });

  it('an all-day event earlier today has NOT ended (ends at 23:59:59.999 local)', () => {
    const startTime = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    expect(
      hasEventEndedByNow({ startTime, endTime: startTime, allDay: true }, now)
    ).toBe(false);
  });

  it('an all-day event from a previous day has ended', () => {
    const startTime = new Date(2026, 7, 14, 0, 0, 0, 0).getTime();
    expect(
      hasEventEndedByNow({ startTime, endTime: startTime, allDay: true }, now)
    ).toBe(true);
  });
});

// FOLLOW-UP FIX — getLocalDayStart is the client-computed `localDayStart`
// arg replacing the previous flat `now - 48h` server-side lookback in
// events.listCommunityMainOverview / listCommunityAdditionalEventsPaged.
describe('getLocalDayStart', () => {
  it('resolves to 00:00:00.000 of the local day containing nowMs', () => {
    const now = new Date(2026, 7, 15, 14, 32, 10, 500).getTime();
    const dayStart = getLocalDayStart(now);
    const d = new Date(dayStart);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('is idempotent when nowMs is already local midnight', () => {
    const midnight = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    expect(getLocalDayStart(midnight)).toBe(midnight);
  });

  it('is stable across every instant within the same local day', () => {
    const dayStart = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    const noon = new Date(2026, 7, 15, 12, 0, 0, 0).getTime();
    const justBeforeMidnight = new Date(2026, 7, 15, 23, 59, 59, 999).getTime();
    expect(getLocalDayStart(dayStart)).toBe(dayStart);
    expect(getLocalDayStart(noon)).toBe(dayStart);
    expect(getLocalDayStart(justBeforeMidnight)).toBe(dayStart);
  });

  it("rolls forward to tomorrow's midnight once the local day changes", () => {
    const today = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    const tomorrow = new Date(2026, 7, 16, 0, 0, 0, 0).getTime();
    const justAfterMidnight = new Date(2026, 7, 16, 0, 0, 0, 1).getTime();
    expect(getLocalDayStart(today)).not.toBe(tomorrow);
    expect(getLocalDayStart(justAfterMidnight)).toBe(tomorrow);
  });
});
