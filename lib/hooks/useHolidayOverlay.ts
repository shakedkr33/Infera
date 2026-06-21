/**
 * useHolidayOverlay — Phase 2B Step 2B.
 *
 * UI-agnostic hook that fetches Hebcal records for the Gregorian years
 * intersecting the requested date range, maps them to HolidayOverlayItem[],
 * and returns the result with loading and data-availability signals.
 *
 * Contract:
 * - If enabledCategories is empty: no fetch occurs, items=[], isLoading=false.
 * - The requested date range determines which Gregorian years are fetched.
 *   A range spanning December–January triggers fetches for both years so that
 *   a holiday family crossing the year boundary is correctly grouped.
 * - Records from all fetched years are combined and passed to the mapper in
 *   one call. Grouping precedes range filtering, so no family is split.
 * - Stale async results for a superseded range are silently discarded via a
 *   per-effect `cancelled` flag. When the range or categories change a new
 *   async run starts; if the old run settles after the new one has started its
 *   result is discarded and never applied.
 * - Cache behaviour is fully delegated to getHebcalRecordsForYear().
 * - Does not persist anything; does not alter holiday preference storage.
 * - Does not perform any network work at module load time.
 * - Never throws — errors from the provider are handled gracefully.
 *
 * Dependencies:
 *   startDate, endDate  → change triggers a new fetch-and-map cycle.
 *   enabledCategories   → tracked via a stable sorted-join string (categoriesKey)
 *                         to avoid spurious re-runs from reference-unstable arrays.
 */

import { useEffect, useState } from 'react';
import { getHebcalRecordsForYear } from '../services/hebcalHolidayProvider';
import { mapHolidayOverlayItems } from '../services/holidayOverlayMapper';
import type { HolidayCategoryId, HolidayOverlayItem } from '../types/holidayOverlay';

// ── Public types ────────────────────────────────────────────────────────────

export type UseHolidayOverlayArgs = {
  /** Start of the visible date range, YYYY-MM-DD, inclusive. */
  startDate: string;
  /** End of the visible date range, YYYY-MM-DD, inclusive. */
  endDate: string;
  /** InYomi product categories to include in the result. */
  enabledCategories: HolidayCategoryId[];
};

export type UseHolidayOverlayResult = {
  /** Mapped overlay items that intersect the requested range. */
  items: HolidayOverlayItem[];
  /**
   * True while the async fetch-and-map cycle for the current range is in flight.
   * False when no fetch is needed (empty categories) or when the result is ready.
   */
  isLoading: boolean;
  /**
   * True when at least one year's provider records were successfully loaded
   * (from cache or network). False when all fetches returned empty results,
   * which indicates an offline state with no cached data.
   */
  hasUsableData: boolean;
};

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns HolidayOverlayItem[] for the given date range and category set.
 *
 * The `enabledCategories` prop does not need to be referentially stable;
 * the hook computes a sorted-join string internally and only re-fetches when
 * the category content actually changes.
 */
export function useHolidayOverlay({
  startDate,
  endDate,
  enabledCategories,
}: UseHolidayOverlayArgs): UseHolidayOverlayResult {
  const [items, setItems] = useState<HolidayOverlayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsableData, setHasUsableData] = useState(false);

  // Stable string proxy for the categories array.
  // Sorting ensures that ['a','b'] and ['b','a'] produce the same key.
  // Category IDs never contain commas, so the join separator is safe.
  const categoriesKey = [...enabledCategories].sort().join(',');

  useEffect(() => {
    // Reconstruct the category array from the stable key so that this effect
    // only depends on primitive values (strings), avoiding infinite re-runs
    // from callers that pass a new array reference on every render.
    const cats =
      categoriesKey.length > 0
        ? (categoriesKey.split(',') as HolidayCategoryId[])
        : [];

    if (cats.length === 0) {
      setItems([]);
      setIsLoading(false);
      setHasUsableData(false);
      return;
    }

    // `cancelled` is flipped to true in the cleanup function so that if this
    // effect fires again before the async work finishes, the stale result is
    // discarded and never applied to state.
    let cancelled = false;

    setIsLoading(true);

    // Determine all Gregorian years that intersect the requested range.
    const startYear = Number.parseInt(startDate.substring(0, 4), 10);
    const endYear = Number.parseInt(endDate.substring(0, 4), 10);
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y += 1) {
      years.push(y);
    }

    const run = async (): Promise<void> => {
      try {
        // Fetch each year in parallel; getHebcalRecordsForYear never throws.
        const yearResults = await Promise.all(
          years.map(y => getHebcalRecordsForYear(y)),
        );

        if (cancelled) return;

        const allRecords = yearResults.flat();
        const usable = allRecords.length > 0;

        const mapped = mapHolidayOverlayItems({
          records: allRecords,
          enabledCategories: cats,
          startDate,
          endDate,
        });

        setItems(mapped);
        setHasUsableData(usable);
      } catch {
        // Should not occur (provider does not throw), but guard for safety.
        if (cancelled) return;
        setItems([]);
        setHasUsableData(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, categoriesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, isLoading, hasUsableData };
}
