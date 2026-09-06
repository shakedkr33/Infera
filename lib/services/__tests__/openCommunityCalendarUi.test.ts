/**
 * FIX A — Community Event calendar add/remove parity in full-screen Event
 * Details (app/(authenticated)/event/[id].tsx).
 *
 * This file did not previously have a dedicated test even though it is the
 * shared visibility/copy helper module already used by
 * components/EventDetailsBottomSheet.tsx. FIX A wires
 * app/(authenticated)/event/[id].tsx to import and reuse
 * `isRsvpCalendarActionVisible` (previously imported only by the Bottom
 * Sheet) alongside the pre-existing `isOpenCommunityCalendarActionVisible`,
 * so both surfaces now depend on identical visibility rules for personal-
 * calendar inclusion. These are pure functions, so they are unit-testable
 * without any component-rendering harness (none exists in this repo — see
 * lib/services/__tests__/communityReminderPersonalDismissUi.test.ts for the
 * same precedent).
 *
 * Explicitly verified here per the FIX A spec:
 *   - RSVP-required events use `isRsvpCalendarActionVisible`
 *     (requiresRsvp === true), open/no-RSVP events use
 *     `isOpenCommunityCalendarActionVisible` (requiresRsvp !== true) — the
 *     two are mutually exclusive for any given event, so a Community Event
 *     never shows both calendar cards at once and never shows the calendar
 *     action for a personal (non-community) event.
 *   - Both helpers hide the action for cancelled events, archived
 *     communities, and non-active (pending/left) membership.
 *   - Both helpers require a valid Convex event id.
 *   - Label helpers derive purely from the boolean isSavedToMyCalendar flag
 *     (the same `event.isSavedToMyCalendar` field returned by
 *     `api.events.getById` that both UIs already treat as the single source
 *     of truth — no local saved-state boolean is introduced anywhere).
 *
 * NOT unit-testable without a component-rendering harness (none exists in
 * this repo) — verified instead by structural code review:
 *   - app/(authenticated)/event/[id].tsx now calls
 *     `handleCalendarToggle`, which picks
 *     `api.communityEventCalendar.addCommunityEventToMyCalendar` or
 *     `removeCommunityEventFromMyCalendar` based on
 *     `event.isSavedToMyCalendar` — the exact same mutation-selection
 *     pattern as `EventDetailsBottomSheet.tsx`'s `handleOpenCalendarToggle`.
 *   - The active-assigned-task removal confirmation
 *     (`AppConfirmationDialog`, shown via `calendarRemoveConfirmEventId`)
 *     uses the same literal server error code
 *     ('CALENDAR_REMOVE_REQUIRES_ACTIVE_TASK_CONFIRMATION', defined in
 *     convex/communityEventCalendar.ts) and the same
 *     `confirmRemoveWithActiveTask: true` follow-up call as the Bottom
 *     Sheet — no new error code or confirmation rule was invented.
 *   - RSVP yes/maybe/no buttons and `handleRsvp` in
 *     app/(authenticated)/event/[id].tsx were not modified by FIX A; the new
 *     RSVP-required calendar card is rendered as an independent sibling
 *     card, never nested inside or gating the RSVP card.
 *
 * Run with: bun test lib/services/__tests__
 */

import { describe, expect, it } from 'bun:test';
import {
  getOpenCommunityCalendarActionLabel,
  getRsvpCalendarActionLabel,
  isOpenCommunityCalendarActionVisible,
  isOpenCommunityInformationalLabelVisible,
  isRsvpCalendarActionVisible,
  viewerIsActiveCommunityMember,
} from '@/lib/openCommunityCalendarUi';

const baseArgs = {
  hasValidConvexEventId: true,
  communityArchived: false,
  viewerIsActiveMember: true,
};

describe('isOpenCommunityCalendarActionVisible (open / no-RSVP events)', () => {
  it('is visible for an active, non-cancelled, non-archived open community event', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
      })
    ).toBe(true);
  });

  it('is hidden when the event requires RSVP', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden for a personal (non-community) event', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        event: { communityId: null, requiresRsvp: false, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when the event is cancelled', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        event: {
          communityId: 'c1',
          requiresRsvp: false,
          status: 'cancelled',
        },
      })
    ).toBe(false);
  });

  it('is hidden when the community is archived', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        communityArchived: true,
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when the viewer is not an active member', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        viewerIsActiveMember: false,
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when there is no valid Convex event id', () => {
    expect(
      isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        hasValidConvexEventId: false,
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
      })
    ).toBe(false);
  });
});

describe('isRsvpCalendarActionVisible (RSVP-required events — Stage 2B / FIX A)', () => {
  it('is visible for an active, non-cancelled, non-archived RSVP-required community event', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
      })
    ).toBe(true);
  });

  it('is hidden when the event does not require RSVP (mutually exclusive with the open-event action)', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden for a personal (non-community) event even if requiresRsvp is true', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        event: { communityId: null, requiresRsvp: true, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when the event is cancelled', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        event: { communityId: 'c1', requiresRsvp: true, status: 'cancelled' },
      })
    ).toBe(false);
  });

  it('is hidden when the community is archived', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        communityArchived: true,
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when the viewer is not an active member', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        viewerIsActiveMember: false,
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
      })
    ).toBe(false);
  });

  it('is hidden when there is no valid Convex event id', () => {
    expect(
      isRsvpCalendarActionVisible({
        ...baseArgs,
        hasValidConvexEventId: false,
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
      })
    ).toBe(false);
  });

  it('is mutually exclusive with isOpenCommunityCalendarActionVisible for the same event', () => {
    const activeEvent = {
      communityId: 'c1',
      status: 'active' as const,
    };
    for (const requiresRsvp of [true, false]) {
      const openVisible = isOpenCommunityCalendarActionVisible({
        ...baseArgs,
        event: { ...activeEvent, requiresRsvp },
      });
      const rsvpVisible = isRsvpCalendarActionVisible({
        ...baseArgs,
        event: { ...activeEvent, requiresRsvp },
      });
      expect(openVisible && rsvpVisible).toBe(false);
      expect(openVisible || rsvpVisible).toBe(true);
    }
  });
});

describe('calendar action labels derive purely from isSavedToMyCalendar', () => {
  it('getOpenCommunityCalendarActionLabel toggles add/remove copy', () => {
    expect(getOpenCommunityCalendarActionLabel(false)).toBe('הוסף ליומן');
    expect(getOpenCommunityCalendarActionLabel(true)).toBe('להסיר מהיומן');
  });

  it('getRsvpCalendarActionLabel toggles add/remove copy independently of RSVP status', () => {
    expect(getRsvpCalendarActionLabel(false)).toBe('הוסף ליומן');
    expect(getRsvpCalendarActionLabel(true)).toBe('הסר מהיומן');
  });
});

describe('isOpenCommunityInformationalLabelVisible / viewerIsActiveCommunityMember (unchanged by FIX A, sanity-checked for regressions)', () => {
  it('informational label follows the same open-event gating as the calendar action', () => {
    expect(
      isOpenCommunityInformationalLabelVisible({
        event: { communityId: 'c1', requiresRsvp: false, status: 'active' },
        communityArchived: false,
        viewerIsActiveMember: true,
      })
    ).toBe(true);
    expect(
      isOpenCommunityInformationalLabelVisible({
        event: { communityId: 'c1', requiresRsvp: true, status: 'active' },
        communityArchived: false,
        viewerIsActiveMember: true,
      })
    ).toBe(false);
  });

  it('viewerIsActiveCommunityMember rejects pending/left/null membership', () => {
    expect(viewerIsActiveCommunityMember(null)).toBe(false);
    expect(viewerIsActiveCommunityMember({ status: 'pending' })).toBe(false);
    expect(viewerIsActiveCommunityMember({ status: 'left' })).toBe(false);
    expect(viewerIsActiveCommunityMember({ status: 'active' })).toBe(true);
  });
});
