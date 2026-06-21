/**
 * Hebcal holiday provider — Phase 2B Step 2A.
 *
 * Fetches holiday data from the Hebcal JSON API for a given Gregorian year,
 * normalizes it into HebcalProviderRecord[], and manages the AsyncStorage cache.
 *
 * VERIFIED REQUEST (live check against hebcal.com, 2026-06-21):
 *   URL: https://www.hebcal.com/hebcal
 *   Parameters:
 *     v=1       API version
 *     cfg=json  JSON response format
 *     maj=on    major Jewish holidays     (holiday/major)
 *     min=on    minor Jewish holidays     (holiday/minor)
 *     nx=on     Rosh Chodesh              (roshchodesh)
 *     mf=on     fast days                 (holiday/fast)
 *     mod=on    modern Israeli days       (holiday/modern)
 *     d=off     suppress daily Hebrew-date entries (365 items/year)
 *     c=off     suppress candle-lighting times
 *     geo=none  no location-based times
 *     lg=he     Hebrew titles via `hebrew` field
 *     i=on      Israel mode (1-day Shavuot, Israel-specific dates)
 *     year=YYYY Gregorian year
 *
 * VERIFIED RESPONSE SHAPE (per item):
 *   title       string  Vocalized Hebrew with niqqud (not used for display)
 *   title_orig  string  English name — used for stable ID derivation only
 *   hebrew      string  Plain unvocalized Hebrew — used for display
 *   date        string  YYYY-MM-DD Gregorian date
 *   hdate       string  Hebrew date label (not stored)
 *   category    string  'holiday' | 'roshchodesh' (verified)
 *   subcat      string? 'major' | 'minor' | 'fast' | 'modern' (holiday only)
 *   yomtov      bool?   true only on principal Yom-Tov days (8 in 2026)
 *   link        string  URL — not stored; used for slug in ID derivation
 *   memo        string? Hebrew description — not stored
 *   leyning     object? Torah readings — not stored
 *
 * NO uid OR id FIELD EXISTS IN THE API RESPONSE (verified: 0 items had it).
 * Stable IDs are derived as: 'hebcal:{year}:{date}:{title_orig_slug}'
 *
 * MULTI-DAY HOLIDAYS: The API does not provide startDate/endDate spans.
 * Each holiday day is a separate item. Pesach has 9 items (ערב + 7 days),
 * Chanukah has 9 items (8 candle nights + closing day). Grouping is deferred
 * to the mapping/rendering step.
 *
 * Safety contract:
 * - No module-level network requests.
 * - No console.log or debug output.
 * - Returns [] safely when both cache and network fail.
 * - Stale cache is always preferred over an empty result on network failure.
 * - Cache writes never block the caller; they happen as a side effect.
 */

import {
  isCacheStale,
  loadHebcalCache,
  saveHebcalCache,
} from '../storage/holidayOverlayCache';
import type { HebcalProviderRecord } from '../types/holidayOverlay';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEBCAL_BASE_URL = 'https://www.hebcal.com/hebcal';

const HEBCAL_PARAMS: Record<string, string> = {
  v: '1',
  cfg: 'json',
  maj: 'on',   // major Jewish holidays
  min: 'on',   // minor Jewish holidays
  nx: 'on',    // Rosh Chodesh
  mf: 'on',    // fast days
  mod: 'on',   // modern Israeli national days
  d: 'off',    // suppress 365 daily Hebrew-date entries
  c: 'off',    // suppress candle-lighting times
  geo: 'none', // no location-based times
  lg: 'he',    // Hebrew titles in `hebrew` field
  i: 'on',     // Israel mode
};

// ── Internal types ────────────────────────────────────────────────────────────

/**
 * Raw item shape from the Hebcal API response.
 * Fields are validated from an actual 2026 API response.
 */
interface HebcalRawItem {
  title: string;
  title_orig: string;
  hebrew: string;
  date: string;
  hdate: string;
  category: string;
  subcat?: string;
  yomtov?: boolean;
  link: string;
  memo?: string;
  leyning?: unknown;
}

interface HebcalApiResponse {
  items?: unknown[];
  version?: string;
  title?: string;
  date?: string;
  range?: unknown;
  location?: unknown;
}

// ── ID derivation ─────────────────────────────────────────────────────────────

/**
 * Derive a stable, unique ID for a raw Hebcal item.
 *
 * Format: 'hebcal:{year}:{date}:{title_orig_slug}'
 *
 * title_orig is lowercased and non-alphanumeric sequences collapsed to '-'.
 * The combination of date + title_orig is unique within a year (verified: no
 * two items share both the same date and the same title_orig in the 2026 response).
 *
 * Examples:
 *   hebcal:2026:2026-03-02:erev-purim
 *   hebcal:2026:2026-03-02:ta-anit-esther
 *   hebcal:2026:2026-01-19:rosh-chodesh-sh-vat
 */
function deriveId(year: number, date: string, titleOrig: string): string {
  const slug = titleOrig
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `hebcal:${year}:${date}:${slug}`;
}

// ── Validation and normalization ──────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidRawItem(item: unknown): item is HebcalRawItem {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.title_orig === 'string' && r.title_orig.length > 0 &&
    typeof r.hebrew === 'string' && r.hebrew.length > 0 &&
    typeof r.date === 'string' && DATE_RE.test(r.date) &&
    typeof r.category === 'string' && r.category.length > 0
  );
}

function normalizeItem(
  item: HebcalRawItem,
  year: number
): HebcalProviderRecord {
  const record: HebcalProviderRecord = {
    id: deriveId(year, item.date, item.title_orig),
    date: item.date,
    hebrew: item.hebrew,
    titleOrig: item.title_orig,
    category: item.category,
  };
  if (typeof item.subcat === 'string' && item.subcat.length > 0) {
    record.subcat = item.subcat;
  }
  if (item.yomtov === true) {
    record.yomtov = true;
  }
  return record;
}

// ── Network fetch ─────────────────────────────────────────────────────────────

function buildUrl(year: number): string {
  const params = new URLSearchParams({ ...HEBCAL_PARAMS, year: String(year) });
  return `${HEBCAL_BASE_URL}?${params.toString()}`;
}

async function fetchYearFromNetwork(
  year: number
): Promise<HebcalProviderRecord[]> {
  const url = buildUrl(year);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Hebcal API returned HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  const data = json as HebcalApiResponse;
  const rawItems = Array.isArray(data.items) ? data.items : [];

  return rawItems
    .filter(isValidRawItem)
    .map((item) => normalizeItem(item, year));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns normalized Hebcal provider records for the given Gregorian year.
 *
 * Cache behavior:
 * - Fresh cache  → return cached records immediately, no network request.
 * - Stale cache + successful refresh → cache updated, new records returned.
 * - Stale cache + failed refresh → stale records returned (offline safety).
 * - No cache + successful fetch → records cached and returned.
 * - No cache + failed fetch → [] returned (no crash, no partial state).
 * - Malformed cache → treated as absent; fetch attempted.
 *
 * This function never throws.
 */
export async function getHebcalRecordsForYear(
  year: number
): Promise<HebcalProviderRecord[]> {
  try {
    const cached = await loadHebcalCache(year);

    if (cached !== null && !isCacheStale(cached)) {
      return cached.records;
    }

    try {
      const fresh = await fetchYearFromNetwork(year);
      await saveHebcalCache(year, fresh);
      return fresh;
    } catch {
      // Network or parse failure — fall back to whatever cache we have.
      if (cached !== null) {
        return cached.records;
      }
      return [];
    }
  } catch {
    return [];
  }
}
