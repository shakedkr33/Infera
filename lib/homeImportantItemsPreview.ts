import { hasEventEndedByNow } from '@/lib/eventsTabDateHelpers';

/**
 * getHomeImportantItemsPreview
 *
 * Pure helper deciding what the Home event card's compact "📌 חשוב לזכור"
 * preview shows: up to two item titles, plus a "ועוד N" remainder count
 * when there are more. Deliberately does NOT decide whether the event
 * itself should appear on Home — that remains governed entirely by the
 * existing personal-calendar/date eligibility rules; this helper only
 * shapes the preview for an already-eligible card that has items.
 */
export interface HomeImportantItemsPreviewInput {
  id: string;
  title: string;
}

export interface HomeImportantItemsPreviewResult<
  T extends HomeImportantItemsPreviewInput,
> {
  preview: T[];
  remainingCount: number;
}

const MAX_HOME_IMPORTANT_ITEMS_PREVIEW = 2;

export function getHomeImportantItemsPreview<
  T extends HomeImportantItemsPreviewInput,
>(items: T[]): HomeImportantItemsPreviewResult<T> {
  const preview = items.slice(0, MAX_HOME_IMPORTANT_ITEMS_PREVIEW);
  return {
    preview,
    remainingCount: Math.max(0, items.length - preview.length),
  };
}

/**
 * STAGE 4 ALIGNMENT PART F/G/I — "חשוב לזכור" is event CONTENT, but the
 * Home preview + group-level "הוסף למשימות שלי" action are an ACTIVE
 * mental-load surface, not a history screen. Once the source event has
 * ended (or was all-day and its day is over), the preview/action must stop
 * appearing on Home — WITHOUT removing the event card itself (that remains
 * governed entirely by Home's own existing personal-calendar date logic)
 * and WITHOUT touching the event's `importantItems` data (still fully
 * visible in historical Event Details) or any personal task already
 * created from them.
 *
 * Reuses the exact same canonical event-end rule already used to drop
 * ended events from the community "תזכורות" → "מאירועים" grouped cards
 * (`hasEventEndedByNow`) — never a second, conflicting definition of
 * "event ended".
 */
export function isEventEligibleForHomeImportantItemsPreview(
  event: { startTime: number; endTime: number; allDay?: boolean },
  nowMs: number
): boolean {
  return !hasEventEndedByNow(event, nowMs);
}
