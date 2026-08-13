import { parseGeoUri } from '@/lib/utils/geoUri';

/**
 * Canonical "does this event have a navigable location" predicate. Reused
 * by every surface that already exposes a navigation/directions action
 * (Calendar, Event Details, community Events tab, personal event card —
 * see `parseGeoUri`'s call sites) — Home's compact card below reuses this
 * SAME helper rather than a second parallel notion. An event is navigable
 * only when the viewer selected a place through the existing address
 * picker (`LocationCard`), which stamps `locationUrl` as a `geo:lat,lng`
 * URI — a plain free-text location typed by hand (no `locationUrl`) is
 * intentionally NOT navigable, preserving existing product behavior
 * exactly (see the "NAVIGATION PRODUCT RULE" — this does not broaden it).
 */
export function hasNavigableEventLocation(
  location: string,
  locationUrl: string | undefined
): boolean {
  return location.trim().length > 0 && parseGeoUri(locationUrl) !== null;
}

export type HomeCompactNavItemType = 'event' | 'task';
export type HomeCompactNavTemporalState =
  | 'active'
  | 'upcoming'
  | 'ended'
  | 'overdue'
  | 'completed';

/**
 * BUG FIX (manual QA) — Home's compact event card previously only showed
 * its "ניווט" quick-action pill when `temporalState === 'upcoming'`.
 * All-day events are classified `'active'` for their ENTIRE local calendar
 * day (their `startAt`/`endAt` span local midnight → 23:59:59.999, see
 * event/new.tsx's all-day save convention) — and, unlike timed events
 * (which get promoted out of the compact list into a separate "featured"
 * card the moment they become active — see
 * HomeDailyCommandCenter.activeItems/remainingItems), all-day items are
 * ALWAYS rendered through this same compact card, never promoted. The
 * result was that a TODAY all-day event with a perfectly valid selected
 * address never showed its navigation action for its entire day, even
 * though `hasNavigableEventLocation` was already true for it.
 *
 * Fix: the compact nav pill is available whenever the item is an event
 * that has not ended (`'active'` OR `'upcoming'`) with a navigable
 * location — `allDay` itself has NO effect on this decision, matching the
 * product rule. Timed events are unaffected: a compact-rendered TIMED
 * event is never `'active'` in practice (Home's featured section already
 * absorbs those), so widening this to also allow `'active'` only changes
 * behavior for all-day items.
 */
export function isHomeCompactNavButtonVisible(args: {
  itemType: HomeCompactNavItemType;
  temporalState: HomeCompactNavTemporalState;
  location: string;
  locationUrl: string | undefined;
}): boolean {
  if (args.itemType !== 'event') return false;
  if (args.temporalState !== 'upcoming' && args.temporalState !== 'active') {
    return false;
  }
  return hasNavigableEventLocation(args.location, args.locationUrl);
}
