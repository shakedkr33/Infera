/**
 * Tests for Stage 1C — community event scale & query bounding.
 *
 * Run with: bun test
 *
 * These exercise the pure helpers extracted for this stage:
 *   - resolveCommunityDateRange (communityCalendarState.ts) — the shared
 *     "no bound supplied → full range" default used by both
 *     events.listByCommunity and events.listByCommunityPaged.
 *   - summarizeEventTaskCounts (eventTasks.ts) — the shared per-event task
 *     counting logic used by both getTaskCountsByCommunity (legacy) and
 *     getTaskCountsForEvents (Stage 1C, focused).
 *
 * The actual bounded-index scan (`.withIndex('by_community_date', ...)
 * .gte(...).lte(...)`) and the per-event community-membership access check
 * in getTaskCountsForEvents run against ctx.db and cannot be unit-tested
 * without a Convex test harness (none exists in this repo — see
 * communityCalendarState.test.ts precedent, which also only tests pure
 * helpers). Those paths were instead verified by manual code review:
 *
 *   - listByCommunity / listByCommunityPaged: both call
 *     `.withIndex('by_community_date', (q) => q.eq('communityId', id)
 *       .gte('startTime', from).lte('startTime', to))`, which is Convex's
 *     standard inclusive range-scan primitive over an index that already
 *     existed before Stage 1C (`by_community_date` on
 *     `['communityId', 'startTime']` in schema.ts). listByCommunityPaged
 *     already used this exact pattern pre-Stage-1C; Stage 1C only adds the
 *     same pattern to listByCommunity. Events outside [from, to] are
 *     excluded by the index scan itself, not by post-filtering.
 *   - getTaskCountsForEvents: for each requested eventId, loads the event,
 *     requires event.communityId to be set, then requires
 *     isActiveCommunityMember(getCommunityMembership(ctx, communityId,
 *     userId)) — the same membership check used throughout events.ts /
 *     eventTasks.ts (e.g. listByEvent, listEventTasksForHome). An eventId
 *     for a community the caller does not belong to, or a non-existent
 *     eventId, is skipped (no entry written to `counts`), so it cannot
 *     leak counts or existence information.
 */

import { describe, expect, it } from 'bun:test';

import { resolveCommunityDateRange } from '../../convex/communityCalendarState';
import { summarizeEventTaskCounts } from '../../convex/eventTasks';

describe('resolveCommunityDateRange', () => {
  it('defaults to the full range when both bounds are omitted', () => {
    expect(resolveCommunityDateRange(undefined, undefined)).toEqual({
      from: 0,
      to: 9_999_999_999_999,
    });
  });

  it('defaults only the missing "from" bound', () => {
    expect(resolveCommunityDateRange(undefined, 1000)).toEqual({
      from: 0,
      to: 1000,
    });
  });

  it('defaults only the missing "to" bound', () => {
    expect(resolveCommunityDateRange(500, undefined)).toEqual({
      from: 500,
      to: 9_999_999_999_999,
    });
  });

  it('passes explicit bounds through unchanged', () => {
    expect(resolveCommunityDateRange(100, 200)).toEqual({
      from: 100,
      to: 200,
    });
  });
});

describe('summarizeEventTaskCounts — X/Y count semantics (unchanged from pre-Stage-1C)', () => {
  const userId = 'user_a' as never;
  const otherUserId = 'user_b' as never;

  it('an event with no tasks has zero counts', () => {
    expect(summarizeEventTaskCounts(undefined, [], userId)).toEqual({
      total: 0,
      assigned: 0,
      totalTasksCount: 0,
      assignedTasksCount: 0,
      myAssignedTasks: [],
      hasMyAssignedTasks: false,
    });
  });

  it('counts unassigned tasks in total but not in assigned', () => {
    const tasks = [
      { _id: 't1' as never, title: 'הבא עוגה' },
      { _id: 't2' as never, title: 'הבא שתייה' },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.total).toBe(2);
    expect(result.assigned).toBe(0);
    expect(result.hasMyAssignedTasks).toBe(false);
  });

  it('counts tasks assigned to another user in "assigned" but not "myAssignedTasks"', () => {
    const tasks = [
      {
        _id: 't1' as never,
        title: 'הבא עוגה',
        assignedToUserId: otherUserId,
      },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.total).toBe(1);
    expect(result.assigned).toBe(1);
    expect(result.myAssignedTasks).toEqual([]);
    expect(result.hasMyAssignedTasks).toBe(false);
  });

  it('counts a manually-assigned task (assignedToManual) as assigned', () => {
    const tasks = [
      { _id: 't1' as never, title: 'הבא עוגה', assignedToManual: 'דני' },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.assigned).toBe(1);
  });

  it('a blank assignedToManual (whitespace only) does not count as assigned', () => {
    const tasks = [
      { _id: 't1' as never, title: 'הבא עוגה', assignedToManual: '   ' },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.assigned).toBe(0);
  });

  it('populates myAssignedTasks with id+title for tasks assigned to the viewer', () => {
    const tasks = [
      { _id: 't1' as never, title: 'הבא עוגה', assignedToUserId: userId },
      { _id: 't2' as never, title: 'הבא שתייה', assignedToUserId: otherUserId },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.myAssignedTasks).toEqual([{ id: 't1', title: 'הבא עוגה' }]);
    expect(result.hasMyAssignedTasks).toBe(true);
  });

  it('excludes completed tasks from all counts', () => {
    const tasks = [
      {
        _id: 't1' as never,
        title: 'הבא עוגה',
        completed: true,
        assignedToUserId: userId,
      },
      { _id: 't2' as never, title: 'הבא שתייה', completed: false },
    ];
    const result = summarizeEventTaskCounts(undefined, tasks, userId);
    expect(result.total).toBe(1);
    expect(result.myAssignedTasks).toEqual([]);
    expect(result.hasMyAssignedTasks).toBe(false);
  });

  it('a cancelled event has zero active tasks regardless of underlying tasks', () => {
    const tasks = [
      { _id: 't1' as never, title: 'הבא עוגה', assignedToUserId: userId },
      { _id: 't2' as never, title: 'הבא שתייה' },
    ];
    const result = summarizeEventTaskCounts('cancelled', tasks, userId);
    expect(result).toEqual({
      total: 0,
      assigned: 0,
      totalTasksCount: 0,
      assignedTasksCount: 0,
      myAssignedTasks: [],
      hasMyAssignedTasks: false,
    });
  });

  it('handles multiple events independently (no cross-event leakage)', () => {
    const eventATasks = [
      { _id: 't1' as never, title: 'A-task', assignedToUserId: userId },
    ];
    const eventBTasks = [
      { _id: 't2' as never, title: 'B-task', assignedToUserId: otherUserId },
      { _id: 't3' as never, title: 'B-task-2' },
    ];
    const resultA = summarizeEventTaskCounts(undefined, eventATasks, userId);
    const resultB = summarizeEventTaskCounts(undefined, eventBTasks, userId);

    expect(resultA.total).toBe(1);
    expect(resultA.hasMyAssignedTasks).toBe(true);

    expect(resultB.total).toBe(2);
    expect(resultB.assigned).toBe(1);
    expect(resultB.hasMyAssignedTasks).toBe(false);
  });
});
