/**
 * Holiday overlay types — Phase 2B foundation.
 *
 * ARCHITECTURE RULES:
 * - Holiday items are display-only. They are never stored as Convex events
 *   and are never editable, deletable, or RSVP-able.
 * - Categories defined here are InYomi product categories.
 *   Provider-to-category mapping lives in the data-service layer (future step).
 * - Date fields are local date-only strings (YYYY-MM-DD).
 *   Never use Date objects or timestamps in persisted holiday data.
 */

// ── Product categories ─────────────────────────────────────────────────────────

/**
 * InYomi product-level holiday category identifiers.
 *
 * These are stable IDs used for user preferences and rendering decisions.
 * Provider-specific raw category names are mapped to these at the service layer.
 */
export type HolidayCategoryId =
  | 'jewish_holidays'
  | 'israeli_national_days'
  | 'fast_days'
  | 'rosh_chodesh';

// ── Overlay item ───────────────────────────────────────────────────────────────

/**
 * A single holiday overlay item.
 *
 * - `startDate` / `endDateInclusive` are local date-only strings (YYYY-MM-DD).
 * - `calendarItemType` and `calendarSource` satisfy FilterableCalendarItem
 *   from lib/types/calendarFilter.ts.
 * - `provider` is a free-form string so future providers can be added without
 *   a type change (e.g. 'hebcal', 'custom', 'gov_il').
 * - `providerCategory` carries the raw provider category name for traceability.
 * - `holidaySubtype` carries any provider subcategory (e.g. 'major', 'fast').
 * - `isMultiDay` is true when startDate !== endDateInclusive.
 */
export interface HolidayOverlayItem {
  id: string;
  title: string;
  startDate: string;           // YYYY-MM-DD, local date only
  endDateInclusive?: string;   // YYYY-MM-DD, local date only; absent = single day
  calendarItemType: 'holiday';
  calendarSource: 'system';
  provider: string;
  providerCategory?: string;
  holidaySubtype?: string;
  isMultiDay?: boolean;
}
