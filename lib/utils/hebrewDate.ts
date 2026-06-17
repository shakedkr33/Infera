/**
 * Hebrew date utility — fully self-contained, zero external imports.
 *
 * Root cause of the previous crash:
 *   @hebcal/core (and its dependency @hebcal/hdate) are ESM-only packages
 *   ("type": "module", no "main" CJS field). Metro bundler / Hermes in
 *   React Native cannot load them and crashes with a C++ exception at startup.
 *
 * Solution:
 *   The algorithm is extracted verbatim from @hebcal/hdate's MIT-licensed
 *   source (dist/esm/hdateBase.js, greg.js, gematriya.js) and inlined here
 *   as plain TypeScript. No runtime dependency on @hebcal/core or any other
 *   package.
 *
 * Safety contract:
 *   Every exported function is wrapped in try/catch.
 *   Invalid or missing dates always return empty strings, never throw.
 */

// ── Gregorian → R.D. (Rata Die fixed-day count) ───────────────────────────────

function isGregLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 400 === 0 || year % 100 !== 0);
}

/** Convert proleptic Gregorian date to R.D. day number (Jan 1, 1 CE = 1). */
function gregorianToRD(year: number, month: number, day: number): number {
  const py = year - 1;
  return (
    365 * py +
    Math.floor(py / 4) -
    Math.floor(py / 100) +
    Math.floor(py / 400) +
    Math.floor((367 * month - 362) / 12) +
    (month <= 2 ? 0 : isGregLeapYear(year) ? -1 : -2) +
    day
  );
}

// ── Hebrew calendar constants ─────────────────────────────────────────────────

const HEBREW_EPOCH = -1373428; // R.D. of 1 Tishrei, year 1 (from @hebcal/hdate)
const AVG_HEBYEAR = 365.24682220597794;

// ── Hebrew calendar helpers ───────────────────────────────────────────────────

function isHebrewLeapYear(year: number): boolean {
  return (1 + year * 7) % 19 < 7;
}

function hebrewMonthsInYear(year: number): number {
  return isHebrewLeapYear(year) ? 13 : 12;
}

/** Elapsed days from Hebrew epoch to start of Hebrew year (the molad calculation). */
function elapsedDays(year: number): number {
  const prevYear = year - 1;
  const mElapsed =
    235 * Math.floor(prevYear / 19) +
    12 * (prevYear % 19) +
    Math.floor(((prevYear % 19) * 7 + 1) / 19);
  const pElapsed = 204 + 793 * (mElapsed % 1080);
  const hElapsed =
    5 +
    12 * mElapsed +
    793 * Math.floor(mElapsed / 1080) +
    Math.floor(pElapsed / 1080);
  const parts = (pElapsed % 1080) + 1080 * (hElapsed % 24);
  const day = 1 + 29 * mElapsed + Math.floor(hElapsed / 24);
  let altDay = day;
  if (
    parts >= 19440 ||
    (day % 7 === 2 && parts >= 9924 && !isHebrewLeapYear(year)) ||
    (day % 7 === 1 && parts >= 16789 && isHebrewLeapYear(prevYear))
  ) {
    altDay++;
  }
  if (altDay % 7 === 0 || altDay % 7 === 3 || altDay % 7 === 5) {
    return altDay + 1;
  }
  return altDay;
}

function daysInHebrewYear(year: number): number {
  return elapsedDays(year + 1) - elapsedDays(year);
}

function longCheshvan(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 5;
}

function shortKislev(year: number): boolean {
  return daysInHebrewYear(year) % 10 === 3;
}

// Month indices (match @hebcal/hdate)
const NISAN = 1;
const TISHREI = 7;
const CHESHVAN = 8;
const _KISLEV = 9;
const ADAR_I = 12;

// Static day counts indexed by month. 0 = computed dynamically.
const STATIC_DAYS = [0, 30, 29, 30, 29, 30, 29, 30, 0, 0, 29, 30, 0, 29];

function daysInHebrewMonth(month: number, year: number): number {
  const d = STATIC_DAYS[month];
  if (d !== 0) return d;
  if (month === ADAR_I) return isHebrewLeapYear(year) ? 30 : 29;
  if (month === CHESHVAN) return longCheshvan(year) ? 30 : 29;
  return shortKislev(year) ? 29 : 30; // KISLEV
}

function hebrew2rd(year: number, month: number, day: number): number {
  let tempabs = day;
  if (month < TISHREI) {
    const endMonth = hebrewMonthsInYear(year);
    for (let m = TISHREI; m <= endMonth; m++) {
      tempabs += daysInHebrewMonth(m, year);
    }
    for (let m = NISAN; m < month; m++) {
      tempabs += daysInHebrewMonth(m, year);
    }
  } else {
    for (let m = TISHREI; m < month; m++) {
      tempabs += daysInHebrewMonth(m, year);
    }
  }
  return HEBREW_EPOCH + elapsedDays(year) + tempabs - 1;
}

function rd2hebrew(rd: number): { year: number; month: number; day: number } {
  const rdInt = Math.trunc(rd);
  let year = Math.floor((rdInt - HEBREW_EPOCH) / AVG_HEBYEAR);
  while (HEBREW_EPOCH + elapsedDays(year + 1) <= rdInt) year++;
  while (HEBREW_EPOCH + elapsedDays(year) > rdInt) year--;
  let month = rdInt < hebrew2rd(year, NISAN, 1) ? TISHREI : NISAN;
  while (rdInt > hebrew2rd(year, month, daysInHebrewMonth(month, year))) {
    month++;
  }
  const day = 1 + rdInt - hebrew2rd(year, month, 1);
  return { year, month, day };
}

// ── Gematriya ─────────────────────────────────────────────────────────────────

const GERESH = '׳';
const GERSHAYIM = '״';
const NUM2HEB: Record<number, string> = {
  1: 'א',
  2: 'ב',
  3: 'ג',
  4: 'ד',
  5: 'ה',
  6: 'ו',
  7: 'ז',
  8: 'ח',
  9: 'ט',
  10: 'י',
  20: 'כ',
  30: 'ל',
  40: 'מ',
  50: 'נ',
  60: 'ס',
  70: 'ע',
  80: 'פ',
  90: 'צ',
  100: 'ק',
  200: 'ר',
  300: 'ש',
  400: 'ת',
};

function num2digits(num: number): number[] {
  const digits: number[] = [];
  while (num > 0) {
    if (num === 15 || num === 16) {
      digits.push(9, num - 9);
      break;
    }
    let incr = 100;
    let i: number;
    for (i = 400; i > num; i -= incr) {
      if (i === incr) incr = incr / 10;
    }
    digits.push(i);
    num -= i;
  }
  return digits;
}

function gematriya(num: number): string {
  const n = Math.trunc(num);
  if (!n || n < 0) throw new RangeError(`invalid number: ${num}`);
  let str = '';
  const thousands = Math.floor(n / 1000);
  if (thousands > 0 && thousands !== 5) {
    for (const d of num2digits(thousands)) str += NUM2HEB[d];
    str += GERESH;
  }
  const digits = num2digits(n % 1000);
  if (digits.length === 1) return str + NUM2HEB[digits[0]] + GERESH;
  for (let i = 0; i < digits.length; i++) {
    if (i + 1 === digits.length) str += GERSHAYIM;
    str += NUM2HEB[digits[i]];
  }
  return str;
}

// ── Hebrew month names in Hebrew ──────────────────────────────────────────────

const HEBREW_MONTH_NAMES: Record<number, string> = {
  1: 'ניסן',
  2: 'אייר',
  3: 'סיוון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
  7: 'תשרי',
  8: 'חשוון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר', // Adar in a regular year, Adar I in a leap year
  13: 'אדר ב׳',
};

function getMonthName(month: number, year: number): string {
  if (month === ADAR_I && isHebrewLeapYear(year)) return 'אדר א׳';
  return HEBREW_MONTH_NAMES[month] ?? `חודש ${month}`;
}

// ── Local midnight normalisation ──────────────────────────────────────────────

/**
 * Normalise any date input to a local-midnight Date so that timezone offsets
 * cannot shift the Hebrew date by one day on Israeli devices (UTC+2/UTC+3).
 */
function toLocalMidnight(input: Date | string | number): Date {
  const d =
    typeof input === 'string' || typeof input === 'number'
      ? new Date(input)
      : input;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface HebrewDateInfo {
  hebrewDay: string;
  hebrewMonth: string;
  hebrewYear: string;
  /** e.g. 'י״א בתמוז תשפ״ו' */
  fullHebrewDate: string;
}

const EMPTY_INFO: HebrewDateInfo = {
  hebrewDay: '',
  hebrewMonth: '',
  hebrewYear: '',
  fullHebrewDate: '',
};

/**
 * Return Hebrew date components for a Gregorian date.
 * Always returns a valid object — never throws.
 */
export function getHebrewDateInfo(
  date?: Date | string | number
): HebrewDateInfo {
  if (date == null) return EMPTY_INFO;
  try {
    const local = toLocalMidnight(date);
    if (Number.isNaN(local.getTime())) return EMPTY_INFO;
    const rd = gregorianToRD(
      local.getFullYear(),
      local.getMonth() + 1,
      local.getDate()
    );
    const hd = rd2hebrew(rd);
    const hebrewDay = gematriya(hd.day);
    const hebrewMonth = getMonthName(hd.month, hd.year);
    const hebrewYear = gematriya(hd.year);
    const fullHebrewDate = `${hebrewDay} ב${hebrewMonth} ${hebrewYear}`;
    return { hebrewDay, hebrewMonth, hebrewYear, fullHebrewDate };
  } catch {
    return EMPTY_INFO;
  }
}

/**
 * Return a Hebrew month-range label for a Gregorian month.
 * Examples:
 *   June 2026       → 'סיוון – תמוז תשפ״ו'
 *   September 2025  → 'אלול תשפ״ה – תשרי תשפ״ו'
 * Always returns a string — never throws.
 */
export function getHebrewMonthRangeForGregorianMonth(
  year?: number,
  month?: number
): string {
  if (year == null || month == null) return '';
  try {
    const rdFirst = gregorianToRD(year, month + 1, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const rdLast = gregorianToRD(year, month + 1, lastDay);

    const hFirst = rd2hebrew(rdFirst);
    const hLast = rd2hebrew(rdLast);

    const firstMonthName = getMonthName(hFirst.month, hFirst.year);
    const firstYearGem = gematriya(hFirst.year);
    const lastMonthName = getMonthName(hLast.month, hLast.year);
    const lastYearGem = gematriya(hLast.year);

    if (firstMonthName === lastMonthName && firstYearGem === lastYearGem) {
      return `${firstMonthName} ${firstYearGem}`;
    }
    if (firstYearGem === lastYearGem) {
      return `${firstMonthName} – ${lastMonthName} ${firstYearGem}`;
    }
    return `${firstMonthName} ${firstYearGem} – ${lastMonthName} ${lastYearGem}`;
  } catch {
    return '';
  }
}
