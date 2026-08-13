/**
 * Manual QA follow-up — PART A: "מהקהילה" must contain ONLY true standalone
 * general community reminders, never event important-items, tasks created
 * from important items, or event tasks.
 *
 * Covers the pure predicate `isGeneralCommunityReminder` (convex/taskUtils.ts)
 * that convex/tasks.ts's `listCommunityRemindersPaged` now uses as an
 * inclusion gate (previously it only used this predicate to decide the
 * completion-filter branch, and fell through to including ANY other
 * unassigned community task — including event-derived rows — which was the
 * root cause of the duplicate "חשוב לזכור" leak into "מהקהילה". See the
 * fix in convex/tasks.ts).
 *
 * Run with: bun test
 */

import { describe, expect, it } from 'bun:test';

import type { Id } from '../../convex/_generated/dataModel';
import { isGeneralCommunityReminder } from '../../convex/taskUtils';

const communityId = 'community_1' as Id<'communities'>;
const eventId = 'event_1' as Id<'events'>;
const userId = 'user_1' as Id<'users'>;

describe('isGeneralCommunityReminder — "מהקהילה" classification', () => {
  it('[#1] true standalone community reminder → general reminder (appears in "מהקהילה")', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: undefined,
      })
    ).toBe(true);
  });

  it('[#2] event important-item sync row (sourceType = community_event_important_item) → NOT a general reminder', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: 'community_event_important_item',
      })
    ).toBe(false);
  });

  it('[#3] event-derived personal bundle task (sourceType = community_event_important_items_bundle) → NOT a general reminder', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: 'community_event_important_items_bundle',
        assignedTo: userId,
      })
    ).toBe(false);
  });

  it('[#4] a task with an explicit participant assignment → NOT a general reminder, even with no sourceType', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: undefined,
        assignedToUserIds: [userId],
      })
    ).toBe(false);
  });

  it('a non-community task is never a general community reminder', () => {
    expect(
      isGeneralCommunityReminder({
        communityId: undefined,
        sourceType: undefined,
      })
    ).toBe(false);
  });

  it('a deleted general reminder is excluded (soft-delete semantics preserved)', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: undefined,
        deletedAt: Date.now(),
      })
    ).toBe(false);
  });

  it('still classifies canonical event important-item rows tied to a specific event as non-general, regardless of eventId', () => {
    expect(
      isGeneralCommunityReminder({
        communityId,
        sourceType: 'community_event_important_item',
      })
    ).toBe(false);
    // sourceEventId itself isn't part of the predicate's signature — the
    // sourceType discriminator alone is authoritative, matching taskUtils.ts.
    void eventId;
  });
});
