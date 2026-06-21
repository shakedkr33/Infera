/**
 * Holiday overlay cache — Phase 2B Step 2A.
 *
 * Stores normalized Hebcal provider records in AsyncStorage, keyed by
 * provider name and Gregorian year. Each year is cached independently
 * so a stale year can be refreshed without touching adjacent years.
 *
 * Safety contract:
 * - load never throws; malformed or missing cache returns null.
 * - save never throws; write failures are silently ignored.
 * - A valid stale cache is always preferred over an empty result.
 * - No network requests occur in this module.
 * - No cache writes occur at module-load time.
 *
 * Freshness window: 30 days.
 * Rationale: Hebcal holiday data for a given year is fixed at the start of
 * that year. Changes are rare (Israeli national day date adjustments for
 * Shabbat proximity). 30 days balances offline reliability with accuracy.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HebcalProviderRecord } from '../types/holidayOverlay';

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_SCHEMA_VERSION = 1 as const;
const FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * AsyncStorage key pattern: @inyomi/holiday-overlay-cache:hebcal:v1:{year}
 *
 * - Provider name ('hebcal') is embedded so future providers use distinct keys.
 * - Schema version ('v1') allows a clean-slate migration if the schema changes.
 * - Year is the Gregorian year as a 4-digit number.
 */
function cacheKey(year: number): string {
  return `@inyomi/holiday-overlay-cache:hebcal:v1:${year}`;
}

// ── Cache entry shape ─────────────────────────────────────────────────────────

export interface HebcalCacheEntry {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  provider: 'hebcal';
  year: number;
  fetchedAt: number;              // Date.now() timestamp — used only for freshness
  records: HebcalProviderRecord[];
}

// ── Validation ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidRecord(r: unknown): r is HebcalProviderRecord {
  if (typeof r !== 'object' || r === null) return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.id === 'string' && rec.id.length > 0 &&
    typeof rec.date === 'string' && DATE_RE.test(rec.date) &&
    typeof rec.hebrew === 'string' && rec.hebrew.length > 0 &&
    typeof rec.titleOrig === 'string' && rec.titleOrig.length > 0 &&
    typeof rec.category === 'string' && rec.category.length > 0
  );
}

function parseEntry(raw: unknown): HebcalCacheEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (
    obj.schemaVersion !== CACHE_SCHEMA_VERSION ||
    obj.provider !== 'hebcal' ||
    typeof obj.year !== 'number' ||
    typeof obj.fetchedAt !== 'number' ||
    !Array.isArray(obj.records)
  ) {
    return null;
  }

  const records = (obj.records as unknown[]).filter(isValidRecord);

  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    provider: 'hebcal',
    year: obj.year,
    fetchedAt: obj.fetchedAt,
    records,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the cached Hebcal data for a given year.
 * Returns null when the cache is absent or structurally invalid.
 * A returned entry may be stale — check with isCacheStale().
 */
export async function loadHebcalCache(year: number): Promise<HebcalCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(year));
    if (raw === null) return null;
    return parseEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Persist Hebcal records for a given year.
 * Sets fetchedAt to Date.now() at write time.
 * Never throws — write failures are silently ignored.
 */
export async function saveHebcalCache(
  year: number,
  records: HebcalProviderRecord[]
): Promise<void> {
  const entry: HebcalCacheEntry = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    provider: 'hebcal',
    year,
    fetchedAt: Date.now(),
    records,
  };
  try {
    await AsyncStorage.setItem(cacheKey(year), JSON.stringify(entry));
  } catch {
    // Cache write failure must never crash the app.
  }
}

/**
 * Returns true when the cache entry is older than the freshness window.
 * A stale entry is still usable — the service falls back to it on refresh failure.
 */
export function isCacheStale(entry: HebcalCacheEntry): boolean {
  return Date.now() - entry.fetchedAt > FRESHNESS_MS;
}
