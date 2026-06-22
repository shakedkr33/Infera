/**
 * Holiday overlay mapper — Phase 2B Step 5.
 *
 * Pure mapping service: no React, no AsyncStorage, no fetch, no state, no UI.
 *
 * Accepts HebcalProviderRecord[] (which may span multiple Gregorian years),
 * the InYomi product categories to include, and an inclusive local date range.
 * Returns HolidayOverlayItem[] that intersect the requested range.
 *
 * Multi-year grouping contract:
 *   All grouping is performed before range filtering so that a holiday family
 *   spanning a Gregorian-year boundary (e.g. Chanukah starting in late December
 *   and ending in early January) is never split or duplicated.
 *
 * Dual-category items:
 *   Tish'a B'Av belongs to both jewish_holidays and fast_days.
 *   It is built exactly once as a canonical item with
 *   productCategories: ['fast_days', 'jewish_holidays'] (alphabetical order).
 *   It is included whenever any of its product categories is enabled.
 *   Its ID is stable and identical regardless of which categories the caller enables.
 *
 * Verified against live Hebcal API responses for 2026 and 2027 (Israel mode, i=on).
 *
 * VERIFIED API FIELD CONSTANTS (used for predicate matching):
 *   category : 'holiday' | 'roshchodesh'
 *   subcat   : 'major' | 'minor' | 'fast' | 'modern'  (holiday only)
 *   titleOrig: English name; stable across years for known families
 *
 * VERIFIED GROUPABLE FAMILIES (2026/2027 live data):
 *   Chanukah    – 8 candle records (title_orig "Chanukah: N Candle(s)") + closing
 *                 day ("Chanukah: 8th Day"); all subcat=major
 *   Pesach      – 7 records "Pesach I" … "Pesach VII"; all subcat=major
 *                 (Pesach Sheni is subcat=minor → excluded automatically)
 *   Sukkot      – 7 records "Sukkot I" … "Sukkot VII (Hoshana Raba)"; subcat=major
 *                 Shmini Atzeret follows immediately but is a distinct holiday →
 *                 kept as a separate single item, not merged into the Sukkot range
 *   Rosh Hashana– 2 records "Rosh Hashana YYYY" + "Rosh Hashana II"; subcat=major
 *                 ("Rosh Hashana LaBehemot" is subcat=minor → excluded)
 *
 * TISH'A B'AV:
 *   titleOrig: "Tish'a B'Av"  (U+0027 straight apostrophe, verified)
 *   category:  holiday
 *   subcat:    major  (Hebcal does NOT classify it as subcat=fast)
 *   productCategories: ['fast_days', 'jewish_holidays']
 *   Excluded from the ordinary single-day jewish_holidays fallback path.
 *   Excluded from the subcat=fast path (it does not have subcat=fast).
 *   Built once by buildTishaBavGroups().
 *
 * VERIFIED CURATED EREV ITEMS (Phase 2B Step 5):
 *   All Erev records verified from live Hebcal API responses for 2026 and 2027.
 *   Only the five items in APPROVED_EREV_TITLES are included as standalone
 *   single-day jewish_holidays items. All other Erev records remain excluded.
 *
 *   Included — exact titleOrig → exact hebrew (verified):
 *     'Erev Pesach'       → 'ערב פסח'         (2026-04-01, 2027-04-21)
 *     'Erev Sukkot'       → 'ערב סוכות'        (2026-09-25, 2027-10-15)
 *     'Erev Rosh Hashana' → 'ערב ראש השנה'     (2026-09-11, 2027-10-01)
 *     'Erev Yom Kippur'   → 'ערב יום כיפור'    (2026-09-20, 2027-10-10)
 *     'Erev Shavuot'      → 'ערב שבועות'        (2026-05-21, 2027-06-10)
 *
 *   Excluded Erev records and reasons:
 *     'Erev Purim'          – Not in primary-required or recommended list; excluded per allowlist policy.
 *     "Erev Tish'a B'Av"   – Not in recommended list; Tish'a B'Av has special dual-category handling.
 *     'Erev Shmini Atzeret' – No such item exists in Hebcal Israel mode (verified for 2026 and 2027).
 *                             In Israel, Shmini Atzeret and Simchat Torah share the same day; Hebcal
 *                             emits no separate Erev record. DO NOT construct this label manually.
 *     'Erev final Pesach'   – No distinct "final-Pesach-day eve" record exists in Hebcal (verified).
 *                             Hebcal emits no additional Erev item after 'Erev Pesach'.
 *
 *   Erev items are always separate single-day items. They are never merged into
 *   the adjacent grouped holiday range. Date proximity is intentional:
 *     Erev Pesach       falls the day before Pesach I starts.
 *     Erev Sukkot       falls the day before Sukkot I starts.
 *     Erev Rosh Hashana falls the day before Rosh Hashana I starts.
 *   This means no overlap in dates between an Erev item and the grouped range
 *   that immediately follows it.
 *
 * EXPLICIT EXCLUSIONS:
 *   - Erev items NOT in APPROVED_EREV_TITLES (titleOrig starts with "Erev ")
 *   - minor observances   (subcat=minor)
 *   - unapproved modern   (subcat=modern not in APPROVED_NATIONAL_DAYS allowlist)
 *   - Rosh Chodesh Tishri (not emitted by Hebcal; Rosh Hashana replaces it)
 *   - candle-lighting     (suppressed at request level: c=off)
 *   - daily Hebrew-date   (suppressed at request level: d=off)
 *   - location-specific   (suppressed at request level: geo=none)
 */

import type {
  HebcalProviderRecord,
  HolidayCategoryId,
  HolidayOverlayItem,
} from '../types/holidayOverlay';

// ── Public input contract ───────────────────────────────────────────────────

export interface MapHolidayOverlayArgs {
  /**
   * Combined raw provider records; may include records from multiple years.
   * Duplicates (same id) are silently dropped.
   */
  records: HebcalProviderRecord[];
  /**
   * Only items whose productCategories intersects this set are returned.
   * Empty array → returns [] immediately without processing any records.
   */
  enabledCategories: HolidayCategoryId[];
  /** Start of the visible date range, YYYY-MM-DD, inclusive. */
  startDate: string;
  /** End of the visible date range, YYYY-MM-DD, inclusive. */
  endDate: string;
}

// ── National days strict allowlist ─────────────────────────────────────────
//
// Exactly four title_orig values are approved. This set is the sole gate
// for israeli_national_days; no fuzzy matching or Hebrew text comparison.
//
// title_orig values verified from live 2026 Hebcal API response:
//   "Yom HaShoah"       → יום הזיכרון לשואה ולגבורה    (subcat=modern)
//   "Yom HaZikaron"     → יום הזכרון (abbreviated)      (subcat=modern)
//   "Yom HaAtzma'ut"   → יום העצמאות                   (subcat=modern)
//   "Yom Yerushalayim"  → יום ירושלים                   (subcat=modern)

const APPROVED_NATIONAL_DAYS = new Set<string>([
  'Yom HaShoah',
  'Yom HaZikaron',
  "Yom HaAtzma'ut",
  'Yom Yerushalayim',
]);

// ── Curated Erev allowlist ─────────────────────────────────────────────────
//
// Exact titleOrig values verified from live Hebcal API (Israel mode) for 2026 and 2027.
// Only these five records are emitted as standalone single-day jewish_holidays items.
// No other Erev records are included regardless of subcat.
//
// titleOrig               → hebrew (display title, exact provider value)
// 'Erev Pesach'           → 'ערב פסח'
// 'Erev Sukkot'           → 'ערב סוכות'
// 'Erev Rosh Hashana'     → 'ערב ראש השנה'
// 'Erev Yom Kippur'       → 'ערב יום כיפור'
// 'Erev Shavuot'          → 'ערב שבועות'
//
// Excluded: 'Erev Purim', "Erev Tish'a B'Av", 'Erev Shmini Atzeret' (does not
// exist in Hebcal Israel mode), and any future unknown Erev items.

const APPROVED_EREV_TITLES = new Set<string>([
  'Erev Pesach',
  'Erev Sukkot',
  'Erev Rosh Hashana',
  'Erev Yom Kippur',
  'Erev Shavuot',
]);

// ── Provider constant ──────────────────────────────────────────────────────

const PROVIDER = 'hebcal';

// ── Date utilities ─────────────────────────────────────────────────────────

/**
 * YYYY-MM-DD string comparison is lexicographically equivalent to
 * chronological order for ISO date strings. Used for all date comparisons
 * to avoid timezone conversion.
 */
function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Returns true when dateB falls exactly one calendar day after dateA.
 * Date objects are used solely for the arithmetic; no timezone-sensitive
 * operations (toISOString, etc.) are performed on the result.
 */
function isNextCalendarDay(dateA: string, dateB: string): boolean {
  const [ya, ma, da] = dateA.split('-').map(Number) as [number, number, number];
  const [yb, mb, db] = dateB.split('-').map(Number) as [number, number, number];
  const msA = new Date(ya, ma - 1, da).getTime();
  const msB = new Date(yb, mb - 1, db).getTime();
  return msB - msA === 86_400_000;
}

/**
 * True when [itemStart, itemEnd] (inclusive) overlaps [rangeStart, rangeEnd].
 * Safe for YYYY-MM-DD string comparison.
 */
function intersectsRange(
  itemStart: string,
  itemEnd: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return itemStart <= rangeEnd && itemEnd >= rangeStart;
}

// ── Record deduplication ───────────────────────────────────────────────────

function deduplicateRecords(records: HebcalProviderRecord[]): HebcalProviderRecord[] {
  const seen = new Set<string>();
  const result: HebcalProviderRecord[] = [];
  for (const r of records) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      result.push(r);
    }
  }
  return result;
}

// ── ID generation ──────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Deterministic overlay item ID.
 *
 * Format: {provider}:{categorySlug}:{familySlug}:{startDate}:{endDate}
 *
 * For single-category items: categorySlug = the category name.
 * For multi-category items:  categorySlug = sorted categories joined with '+'.
 *
 * Examples:
 *   hebcal:jewish_holidays:purim:2026-03-03:2026-03-03
 *   hebcal:fast_days+jewish_holidays:tish-a-b-av:2026-07-23:2026-07-23
 *
 * The sorted join ensures the ID is identical regardless of which subset of
 * an item's categories happens to be enabled by the caller.
 */
function makeId(
  provider: string,
  productCategories: HolidayCategoryId[],
  familySlug: string,
  startDate: string,
  endDate: string,
): string {
  const catSlug = [...productCategories].sort().join('+');
  return `${provider}:${catSlug}:${familySlug}:${startDate}:${endDate}`;
}

// ── Internal group shape ───────────────────────────────────────────────────

/**
 * Intermediate representation before converting to HolidayOverlayItem.
 * Avoids constructing partial items and allows deduplication before range filtering.
 *
 * productCategories is a non-empty array in deterministic (alphabetical) order.
 * Most groups have exactly one category. Tish'a B'Av has two:
 * ['fast_days', 'jewish_holidays'].
 */
interface OverlayGroup {
  provider: string;
  productCategories: HolidayCategoryId[];
  /** Stable ASCII slug used as part of the deterministic ID. */
  familySlug: string;
  /** Plain Hebrew display title — provider's `hebrew` field, or a fixed canonical string. */
  hebrewTitle: string;
  startDate: string;
  endDate: string;
  providerCategory: string;
  holidaySubtype?: string;
}

function groupToItem(group: OverlayGroup): HolidayOverlayItem {
  const isMultiDay = group.startDate !== group.endDate;
  const item: HolidayOverlayItem = {
    id: makeId(group.provider, group.productCategories, group.familySlug, group.startDate, group.endDate),
    title: group.hebrewTitle,
    startDate: group.startDate,
    calendarItemType: 'holiday',
    calendarSource: 'system',
    provider: group.provider,
    productCategories: [...group.productCategories],
    providerCategory: group.providerCategory,
    isMultiDay,
  };
  if (isMultiDay) {
    item.endDateInclusive = group.endDate;
  }
  if (group.holidaySubtype !== undefined) {
    item.holidaySubtype = group.holidaySubtype;
  }
  return item;
}

// ── Family membership predicates ───────────────────────────────────────────
//
// All predicates use only verified stable provider fields (category, subcat, titleOrig).
// Matching is done against the English titleOrig, which is stable and does not
// vary with locale or year number embedded in the Hebrew title.

function isMajorHoliday(r: HebcalProviderRecord): boolean {
  return r.category === 'holiday' && r.subcat === 'major';
}

/** Erev items have subcat=major but must be excluded from jewish_holidays output. */
function isErev(r: HebcalProviderRecord): boolean {
  return r.titleOrig.startsWith('Erev ');
}

/**
 * Tish'a B'Av dual-category predicate.
 *
 * Verified from live 2026 Hebcal API:
 *   title_orig: "Tish'a B'Av"  (exactly 11 chars, both apostrophes U+0027)
 *   category:   "holiday"
 *   subcat:     "major"  (NOT "fast" — Hebcal does not use subcat=fast here)
 *
 * Exact string match against titleOrig prevents false positives on
 * "Erev Tish'a B'Av" (which starts with "Erev " and is excluded upstream).
 */
function isTishaBav(r: HebcalProviderRecord): boolean {
  return (
    r.category === 'holiday' &&
    r.subcat === 'major' &&
    r.titleOrig === "Tish'a B'Av"
  );
}

/**
 * Chanukah family: title_orig starts with "Chanukah:" (colon is present on all
 * candle records and the closing "8th Day" record).
 * Verified title_orig values: "Chanukah: N Candle(s)", "Chanukah: 8th Day".
 */
function isChanukahFamily(r: HebcalProviderRecord): boolean {
  return r.category === 'holiday' && r.subcat === 'major' && r.titleOrig.startsWith('Chanukah:');
}

/**
 * Pesach family: title_orig starts with "Pesach " (space after).
 * "Pesach I"–"Pesach VII" all start with "Pesach " and have subcat=major.
 * "Pesach Sheni" has subcat=minor → excluded by the subcat guard.
 * "Erev Pesach" starts with "Erev " → excluded by the Erev predicate.
 */
function isPesachFamily(r: HebcalProviderRecord): boolean {
  return (
    r.category === 'holiday' &&
    r.subcat === 'major' &&
    r.titleOrig.startsWith('Pesach ')
  );
}

/**
 * Sukkot family: title_orig starts with "Sukkot " (space after).
 * "Sukkot I"–"Sukkot VII (Hoshana Raba)" all start with "Sukkot " and have subcat=major.
 * Shmini Atzeret (title_orig "Shmini Atzeret") is a distinct holiday that does not
 * match this predicate; it remains a standalone item.
 * "Erev Sukkot" starts with "Erev " → excluded by the Erev predicate.
 */
function isSukkotFamily(r: HebcalProviderRecord): boolean {
  return (
    r.category === 'holiday' &&
    r.subcat === 'major' &&
    r.titleOrig.startsWith('Sukkot ')
  );
}

/**
 * Rosh Hashana family: title_orig starts with "Rosh Hashana" (no trailing space,
 * because the year number follows directly, e.g. "Rosh Hashana 5787").
 * "Rosh Hashana II" also starts with "Rosh Hashana".
 * "Rosh Hashana LaBehemot" has subcat=minor → excluded by the subcat guard.
 * "Erev Rosh Hashana" starts with "Erev " → excluded by the Erev predicate.
 */
function isRoshHashanaFamily(r: HebcalProviderRecord): boolean {
  return (
    r.category === 'holiday' &&
    r.subcat === 'major' &&
    r.titleOrig.startsWith('Rosh Hashana')
  );
}

/** True when a major record belongs to any of the four grouped families. */
function isKnownGroupedFamily(r: HebcalProviderRecord): boolean {
  return (
    isChanukahFamily(r) ||
    isPesachFamily(r) ||
    isSukkotFamily(r) ||
    isRoshHashanaFamily(r)
  );
}

// ── Group builders ─────────────────────────────────────────────────────────

/**
 * Groups all records matching `predicate` into one or more contiguous runs.
 *
 * Records are sorted by date first. Consecutive records (adjacent calendar
 * days) are merged into a single range group. A gap between any two matching
 * records ends the current run and starts a new one.
 *
 * Why runs instead of a single min/max span:
 *   When records from multiple Gregorian years are passed together (e.g.
 *   years 2025 and 2026), the same holiday family has two separate annual
 *   occurrences. A simple first-to-last span would incorrectly merge them
 *   into one item spanning ~12 months. Run-based grouping correctly produces
 *   two distinct items for Chanukah 2025 and Chanukah 2026, while still
 *   producing ONE item for a Chanukah that genuinely starts in late December
 *   of year N and ends in early January of year N+1 (consecutive days).
 *
 * Returns [] when no records match (family not present in the supplied years).
 */
function buildFamilyRuns(
  records: HebcalProviderRecord[],
  predicate: (r: HebcalProviderRecord) => boolean,
  familySlug: string,
  hebrewTitle: string,
  productCategories: HolidayCategoryId[],
  providerCategory: string,
  holidaySubtype?: string,
): OverlayGroup[] {
  const matching = records
    .filter(predicate)
    .sort((a, b) => compareDates(a.date, b.date));

  if (matching.length === 0) return [];

  const runs: OverlayGroup[] = [];
  let runStart = matching[0].date;
  let runEnd = matching[0].date;

  for (let i = 1; i < matching.length; i += 1) {
    if (isNextCalendarDay(matching[i - 1].date, matching[i].date)) {
      runEnd = matching[i].date;
    } else {
      // Gap: close the current run and start a fresh one.
      runs.push({
        provider: PROVIDER,
        productCategories,
        familySlug,
        hebrewTitle,
        startDate: runStart,
        endDate: runEnd,
        providerCategory,
        holidaySubtype,
      });
      runStart = matching[i].date;
      runEnd = matching[i].date;
    }
  }

  // Push the final (or only) run.
  runs.push({
    provider: PROVIDER,
    productCategories,
    familySlug,
    hebrewTitle,
    startDate: runStart,
    endDate: runEnd,
    providerCategory,
    holidaySubtype,
  });

  return runs;
}

/**
 * Builds the canonical dual-category item for Tish'a B'Av.
 *
 * Tish'a B'Av is a major Jewish observance (subcat=major in Hebcal) AND a fast
 * day. It belongs to both product categories: ['fast_days', 'jewish_holidays'].
 * This function produces a single canonical group per occurrence. The item is
 * shown whenever either category is enabled, and appears at most once per
 * occurrence thanks to ID-based deduplication in mapHolidayOverlayItems().
 *
 * Detection uses an exact match on titleOrig ("Tish'a B'Av", U+0027 apostrophe,
 * verified from live API) to prevent false positives on "Erev Tish'a B'Av".
 */
function buildTishaBavGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const groups: OverlayGroup[] = [];
  for (const r of records) {
    if (isTishaBav(r)) {
      groups.push({
        provider: PROVIDER,
        // Alphabetical order is the canonical deterministic order.
        productCategories: ['fast_days', 'jewish_holidays'],
        familySlug: toSlug(r.titleOrig), // "tish-a-b-av"
        hebrewTitle: r.hebrew,           // "תשעה באב"
        startDate: r.date,
        endDate: r.date,
        providerCategory: 'holiday',
        holidaySubtype: 'major',
      });
    }
  }
  return groups;
}

/**
 * Builds standalone single-day overlay groups for curated Erev items.
 *
 * Only records whose titleOrig is in APPROVED_EREV_TITLES are included.
 * Every approved Erev record becomes exactly one standalone single-day item
 * with productCategories: ['jewish_holidays'].
 *
 * These items are intentionally separate from their adjacent grouped holiday
 * ranges. For example, Erev Pesach always falls the day before Pesach I, so
 * there is no date overlap between the Erev item and the Pesach range.
 *
 * The single-day fallback loop in buildJewishHolidayGroups() already guards
 * with !isErev(r), so approved Erev records appear exactly once — here —
 * and never as part of the ordinary single-day path.
 *
 * Hebrew display title is taken directly from the provider's `hebrew` field.
 * No Hebrew labels are constructed manually.
 */
function buildErevGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const groups: OverlayGroup[] = [];
  for (const r of records) {
    if (
      r.category === 'holiday' &&
      r.subcat === 'major' &&
      isErev(r) &&
      APPROVED_EREV_TITLES.has(r.titleOrig)
    ) {
      groups.push({
        provider: PROVIDER,
        productCategories: ['jewish_holidays'],
        familySlug: toSlug(r.titleOrig), // e.g. 'erev-pesach', 'erev-sukkot'
        hebrewTitle: r.hebrew,           // exact provider Hebrew, e.g. 'ערב פסח'
        startDate: r.date,
        endDate: r.date,
        providerCategory: 'holiday',
        holidaySubtype: 'major',
      });
    }
  }
  return groups;
}

/**
 * Builds overlay groups for the jewish_holidays product category.
 *
 * Processing order:
 *   1. Four grouped families (Chanukah, Pesach, Sukkot, Rosh Hashana).
 *      Each family uses run-based grouping so that multiple annual occurrences
 *      in the input (e.g. Chanukah 2025 + Chanukah 2026) are two distinct items,
 *      while a single occurrence that crosses a Gregorian year boundary becomes
 *      one item.
 *   2. Single-day major holidays that do not belong to any known family,
 *      excluding all Erev items and excluding Tish'a B'Av (which is built
 *      separately by buildTishaBavGroups() as a dual-category item).
 *
 * Shmini Atzeret is intentionally kept as a standalone item because its
 * title_orig ("Shmini Atzeret") does not match the Sukkot family predicate,
 * and it is a halakhically distinct holiday even though it falls on the day
 * immediately following Sukkot VII.
 */
function buildJewishHolidayGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const groups: OverlayGroup[] = [];

  groups.push(...buildFamilyRuns(
    records, isChanukahFamily, 'chanukah', 'חנוכה',
    ['jewish_holidays'], 'holiday', 'major',
  ));

  groups.push(...buildFamilyRuns(
    records, isPesachFamily, 'pesach', 'פסח',
    ['jewish_holidays'], 'holiday', 'major',
  ));

  groups.push(...buildFamilyRuns(
    records, isSukkotFamily, 'sukkot', 'סוכות',
    ['jewish_holidays'], 'holiday', 'major',
  ));

  groups.push(...buildFamilyRuns(
    records, isRoshHashanaFamily, 'rosh-hashana', 'ראש השנה',
    ['jewish_holidays'], 'holiday', 'major',
  ));

  // Single-day major holidays not belonging to any grouped family.
  // Erev items are explicitly excluded even though they have subcat=major.
  // Tish'a B'Av is explicitly excluded here; it is built by buildTishaBavGroups()
  // as a dual-category item and must not appear twice.
  for (const r of records) {
    if (isMajorHoliday(r) && !isErev(r) && !isKnownGroupedFamily(r) && !isTishaBav(r)) {
      groups.push({
        provider: PROVIDER,
        productCategories: ['jewish_holidays'],
        familySlug: toSlug(r.titleOrig),
        hebrewTitle: r.hebrew,
        startDate: r.date,
        endDate: r.date,
        providerCategory: 'holiday',
        holidaySubtype: 'major',
      });
    }
  }

  return groups;
}

/**
 * Builds overlay groups for the israeli_national_days product category.
 *
 * Only the four title_orig values in APPROVED_NATIONAL_DAYS are included.
 * All other subcat=modern records are excluded.
 */
function buildNationalDayGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const groups: OverlayGroup[] = [];
  for (const r of records) {
    if (
      r.category === 'holiday' &&
      r.subcat === 'modern' &&
      APPROVED_NATIONAL_DAYS.has(r.titleOrig)
    ) {
      groups.push({
        provider: PROVIDER,
        productCategories: ['israeli_national_days'],
        familySlug: toSlug(r.titleOrig),
        hebrewTitle: r.hebrew,
        startDate: r.date,
        endDate: r.date,
        providerCategory: 'holiday',
        holidaySubtype: 'modern',
      });
    }
  }
  return groups;
}

/**
 * Builds overlay groups for the fast_days product category.
 *
 * Includes category=holiday, subcat=fast records only.
 *
 * Tish'a B'Av (subcat=major in Hebcal) is NOT matched here. It is built
 * separately by buildTishaBavGroups() as a dual-category item with
 * productCategories: ['fast_days', 'jewish_holidays'], which causes it to
 * appear when fast_days is enabled without duplicating it.
 */
function buildFastDayGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const groups: OverlayGroup[] = [];
  for (const r of records) {
    if (r.category === 'holiday' && r.subcat === 'fast') {
      groups.push({
        provider: PROVIDER,
        productCategories: ['fast_days'],
        familySlug: toSlug(r.titleOrig),
        hebrewTitle: r.hebrew,
        startDate: r.date,
        endDate: r.date,
        providerCategory: 'holiday',
        holidaySubtype: 'fast',
      });
    }
  }
  return groups;
}

/**
 * Builds overlay groups for the rosh_chodesh product category.
 *
 * Multi-day Rosh Chodesh months (2 consecutive records with the same hebrew
 * value) are merged into a single range item. Single-day months become
 * single-day items. Records are sorted by date before grouping.
 */
function buildRoshChodeshGroups(records: HebcalProviderRecord[]): OverlayGroup[] {
  const sorted = records
    .filter(r => r.category === 'roshchodesh')
    .sort((a, b) => compareDates(a.date, b.date));

  const groups: OverlayGroup[] = [];
  let i = 0;

  while (i < sorted.length) {
    const current = sorted[i];
    let endDate = current.date;

    // Merge consecutive records with the same Hebrew name into one range.
    // Rosh Chodesh months with two days always have identical hebrew values.
    while (
      i + 1 < sorted.length &&
      sorted[i + 1].hebrew === current.hebrew &&
      isNextCalendarDay(sorted[i].date, sorted[i + 1].date)
    ) {
      i += 1;
      endDate = sorted[i].date;
    }

    // Use titleOrig for the slug (English, ASCII-safe). e.g. "rosh-chodesh-adar"
    groups.push({
      provider: PROVIDER,
      productCategories: ['rosh_chodesh'],
      familySlug: toSlug(current.titleOrig),
      hebrewTitle: current.hebrew,
      startDate: current.date,
      endDate,
      providerCategory: 'roshchodesh',
    });

    i += 1;
  }

  return groups;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Maps raw HebcalProviderRecord[] to HolidayOverlayItem[] for the given
 * enabled InYomi product categories and visible date range.
 *
 * Key properties:
 * - Returns [] immediately when `enabledCategories` is empty.
 * - Builds ALL canonical groups before applying any category filter, so that
 *   dual-category items (e.g. Tish'a B'Av) are constructed once with a stable
 *   ID regardless of which subset of their categories the caller has enabled.
 * - An item is included when any element of its productCategories is enabled.
 * - Groups all holiday families across the full record set before filtering
 *   to the requested range, preventing cross-Gregorian-year splits.
 * - Deduplicates input records by provider id before processing.
 * - Deduplicates output items by overlay id before returning.
 * - Output is sorted ascending by startDate.
 * - Never throws.
 */
export function mapHolidayOverlayItems(args: MapHolidayOverlayArgs): HolidayOverlayItem[] {
  const { records, enabledCategories, startDate, endDate } = args;

  if (enabledCategories.length === 0) return [];

  const deduped = deduplicateRecords(records);
  const enabledSet = new Set<HolidayCategoryId>(enabledCategories);

  // Build ALL canonical groups first — category filtering happens below.
  // This guarantees that dual-category items have the same stable ID
  // regardless of which categories the caller has enabled.
  // buildErevGroups() is listed last among jewish_holidays builders to keep
  // it distinct from the grouped ranges; ID-based deduplication below
  // prevents any theoretical overlap.
  const allGroups: OverlayGroup[] = [
    ...buildJewishHolidayGroups(deduped),
    ...buildErevGroups(deduped),
    ...buildTishaBavGroups(deduped),
    ...buildNationalDayGroups(deduped),
    ...buildFastDayGroups(deduped),
    ...buildRoshChodeshGroups(deduped),
  ];

  // Include an item when:
  //   (a) at least one of its productCategories is enabled, AND
  //   (b) its date range intersects the requested visible range.
  // Deduplicate by ID (guards against any future builder overlap).
  const seenIds = new Set<string>();
  const result: HolidayOverlayItem[] = [];

  for (const group of allGroups) {
    const isEnabled = group.productCategories.some(cat => enabledSet.has(cat));
    if (!isEnabled) continue;

    if (!intersectsRange(group.startDate, group.endDate, startDate, endDate)) continue;

    const item = groupToItem(group);
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      result.push(item);
    }
  }

  return result.sort((a, b) => compareDates(a.startDate, b.startDate));
}
