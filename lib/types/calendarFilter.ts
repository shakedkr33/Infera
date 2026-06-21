/**
 * Calendar filter types and helpers — Phase 1 foundation.
 *
 * IMPORTANT ARCHITECTURE RULE:
 * - Item type (holiday, event, …) and source (community, google, …) are
 *   separate concerns. Do NOT combine them into one enum.
 *
 * This file is types + helpers only. No visible filter UI is built here.
 * Filter UI will be added in a later phase once holidays, Shabbat times,
 * and Google/Apple-imported items exist.
 */

// ── Item type ─────────────────────────────────────────────────────────────────

/** What kind of calendar item this is. */
export type CalendarItemType =
  | 'event'
  | 'task'
  | 'reminder'
  | 'holiday'
  | 'shabbatTime';

// ── Source ────────────────────────────────────────────────────────────────────

/** Where this calendar item originated from. */
export type CalendarSource =
  | 'personal'
  | 'family'
  | 'community'
  | 'system'
  | 'google'
  | 'apple';

// ── Filter preset ─────────────────────────────────────────────────────────────

/**
 * Named preset for common filter states.
 *
 * - all:           show everything allowed by the per-toggle preferences
 * - communityOnly: show only items whose calendarSource === "community"
 * - noHolidays:    hide items where calendarItemType === "holiday" | "shabbatTime"
 */
export type CalendarFilterPreset = 'all' | 'communityOnly' | 'noHolidays';

// ── Per-toggle preferences ─────────────────────────────────────────────────────

export type CalendarFilterPreferences = {
  // Item-type toggles
  showEvents: boolean;
  showTasks: boolean;
  showReminders: boolean;
  showHolidays: boolean;
  showShabbatTimes: boolean;

  // Source toggles
  showPersonal: boolean;
  showFamily: boolean;
  showCommunity: boolean;
  showSystem: boolean;
  showGoogle: boolean;
  showApple: boolean;

  // Active preset
  activePreset: CalendarFilterPreset;
};

// ── Defaults ───────────────────────────────────────────────────────────────────

export const defaultCalendarFilterPreferences: CalendarFilterPreferences = {
  showEvents: true,
  showTasks: true,
  showReminders: true,
  showHolidays: false,
  showShabbatTimes: false,

  showPersonal: true,
  showFamily: true,
  showCommunity: true,
  showSystem: true,
  showGoogle: true,
  showApple: true,

  activePreset: 'all',
};

// ── Typed calendar item (minimal shape required for filtering) ─────────────────

/**
 * Minimum shape a calendar item must conform to in order to be passed to
 * `filterCalendarItems`. Screens can extend this with their own extra fields.
 */
export interface FilterableCalendarItem {
  calendarItemType: CalendarItemType;
  calendarSource: CalendarSource;
}

// ── Adapter helpers ────────────────────────────────────────────────────────────

/**
 * Map a raw community event/task to its CalendarSource.
 * Used in local adapter/selector layer — does NOT mutate the DB record.
 */
export function resolveCalendarSource(item: {
  communityId?: string | null;
}): CalendarSource {
  return item.communityId ? 'community' : 'personal';
}

// ── Filter function ────────────────────────────────────────────────────────────

/**
 * Filter an array of calendar items according to the given preferences.
 *
 * This is purely visual / display filtering.
 * It does NOT delete, mutate, or hide data permanently.
 *
 * @param items       - Array of items with at least `calendarItemType` and
 *                      `calendarSource`.
 * @param preferences - The active filter preferences.
 */
export function filterCalendarItems<T extends FilterableCalendarItem>(
  items: T[],
  preferences: CalendarFilterPreferences
): T[] {
  return items.filter((item) => {
    const { calendarItemType, calendarSource } = item;
    const { activePreset } = preferences;

    // ── Preset overrides ────────────────────────────────────────────────────

    if (activePreset === 'communityOnly') {
      return calendarSource === 'community';
    }

    if (activePreset === 'noHolidays') {
      if (
        calendarItemType === 'holiday' ||
        calendarItemType === 'shabbatTime'
      ) {
        return false;
      }
    }

    // ── Per-type toggles ────────────────────────────────────────────────────

    if (calendarItemType === 'event' && !preferences.showEvents) return false;
    if (calendarItemType === 'task' && !preferences.showTasks) return false;
    if (calendarItemType === 'reminder' && !preferences.showReminders)
      return false;
    if (calendarItemType === 'holiday' && !preferences.showHolidays)
      return false;
    if (calendarItemType === 'shabbatTime' && !preferences.showShabbatTimes)
      return false;

    // ── Per-source toggles ───────────────────────────────────────────────────

    if (calendarSource === 'personal' && !preferences.showPersonal)
      return false;
    if (calendarSource === 'family' && !preferences.showFamily) return false;
    if (calendarSource === 'community' && !preferences.showCommunity)
      return false;
    if (calendarSource === 'system' && !preferences.showSystem) return false;
    if (calendarSource === 'google' && !preferences.showGoogle) return false;
    if (calendarSource === 'apple' && !preferences.showApple) return false;

    return true;
  });
}
