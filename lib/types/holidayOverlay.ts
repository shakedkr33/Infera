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

// ── Provider record ───────────────────────────────────────────────────────────

/**
 * A single normalized record from the Hebcal holiday provider.
 *
 * This is the shape stored in the local AsyncStorage cache.
 * Fields are derived from verified Hebcal API response fields only.
 *
 * Verified API fields used:
 *   date      → YYYY-MM-DD local date string (never a timestamp)
 *   hebrew    → plain unvocalized Hebrew title (preferred over `title` which has niqqud)
 *   title_orig → English name; used only for stable ID derivation
 *   category  → 'holiday' | 'roshchodesh' (verified values)
 *   subcat    → 'major' | 'minor' | 'fast' | 'modern'; absent on roshchodesh items
 *   yomtov    → true on 8 major Yom-Tov days; absent (not false) on all others
 *
 * `id` is a stable derived identifier: 'hebcal:{year}:{date}:{title_orig_slug}'
 * No uid or id field exists in the Hebcal API response.
 */
export interface HebcalProviderRecord {
  id: string;
  date: string;       // YYYY-MM-DD, local date only
  hebrew: string;     // plain unvocalized Hebrew title
  titleOrig: string;  // English name — for ID derivation and traceability
  category: string;   // verified: 'holiday' | 'roshchodesh'
  subcat?: string;    // verified: 'major' | 'minor' | 'fast' | 'modern'
  yomtov?: boolean;   // true on principal Yom-Tov days only
}

// ── Overlay item ───────────────────────────────────────────────────────────────

/**
 * A single holiday overlay item.
 *
 * - `startDate` / `endDateInclusive` are local date-only strings (YYYY-MM-DD).
 * - `calendarItemType` and `calendarSource` satisfy FilterableCalendarItem
 *   from lib/types/calendarFilter.ts.
 * - `provider` is a free-form string so future providers can be added without
 *   a type change (e.g. 'hebcal', 'custom', 'gov_il').
 * - `productCategories` lists every InYomi product category this item belongs to.
 *   Must be non-empty. Kept in deterministic (alphabetical) order.
 *   Most items have exactly one category; Tish'a B'Av has two
 *   (['fast_days', 'jewish_holidays']) because it is both a major Jewish
 *   observance and a fast day. Consumers must not assume a single-element array.
 *   Set at the mapping layer; never derived from raw provider fields.
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
  productCategories: HolidayCategoryId[];
  providerCategory?: string;
  holidaySubtype?: string;
  isMultiDay?: boolean;
}
