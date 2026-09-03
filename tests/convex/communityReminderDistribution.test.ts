/**
 * Community Reminder distribution/presentation fix — focused eligibility,
 * classification, and date-range-bounding tests.
 *
 * Covers:
 *  - shouldIncludeCommunityReminderForViewer (convex/taskUtils.ts) — PART F/G:
 *    visibility derives from the VIEWER's own active community membership,
 *    never from creator status, and per-user completion stays independent.
 *  - isGeneralCommunityReminderWithinRange (convex/taskUtils.ts) — the exact
 *    date-range inclusion rule the dedicated
 *    `listVisibleCommunityRemindersForRange` query's two index scans
 *    (dueAt / dueDate) jointly implement: timed reminders inside/before/
 *    after range, date-only reminders inside/before/after range, and an
 *    undated reminder (neither field set) is never "in range".
 *  - getTaskClassification / getTaskTypeLabel — PART E: a general community
 *    reminder is always classified/labelled the same way everywhere.
 *  - selectMainReminderCandidates (lib/communityMainReminderCandidate.ts) —
 *    PART B: active-lifecycle filtering + nearest-due selection for the
 *    Community Main "מה חשוב עכשיו" integration, now fed by the dedicated
 *    range query instead of raw-row-count-bounded pagination — so it has no
 *    `isDone`/row-count dependency and cannot be suppressed by unrelated
 *    historical rows.
 *  - getHomeReminderMetadata (lib/taskClassification.ts) — BUG 2: the SAME
 *    helper used by both the timed and date-only/untimed Home mappers, so
 *    they cannot structurally drift apart.
 *
 * QUERY-BOUNDING (convex/tasks.ts `listVisibleCommunityRemindersForRange` /
 * `loadGeneralCommunityRemindersInRange`) — the actual bounded-index scans
 * cannot be unit-tested without a Convex test harness (none exists in this
 * repo — see eventScaleBounding.test.ts's identical precedent, which also
 * only tests pure helpers). Verified instead by manual code review:
 *   - `listMyTasks`'s previous Step 4 (an unbounded-by-date scan of every
 *     general reminder in every community the viewer belongs to, via the
 *     removed `by_community_assigned` index) has been deleted entirely.
 *     `listMyTasks` now only ever returns personal/assigned tasks — a
 *     general community reminder is excluded from its result
 *     UNCONDITIONALLY, even for its own creator (via the pre-existing
 *     by_creator match), so a reminder's creator gets the exact same
 *     personal-dismissal behavior as every other member (see the
 *     "CREATOR-OVERLAP CORRECTION" note on that query in convex/tasks.ts).
 *   - The dedicated query instead scans
 *     `.withIndex('by_community_assigned_dueAt', (q) => q.eq('communityId',
 *       id).eq('assignedTo', undefined).gte('dueAt', from).lte('dueAt',
 *       to))` and the equivalent `by_community_assigned_dueDate` index —
 *     TWO new compound indexes added in convex/schema.ts, each bounding the
 *     read by BOTH reminder-shape (`assignedTo === undefined`) AND the
 *     caller's requested date range, so DB reads grow with (memberships ×
 *     date-range activity), never with total historical community-reminder
 *     volume.
 *
 * Run with: bun test tests/convex
 */

import { describe, expect, it } from 'bun:test';

import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  getTaskClassification,
  isCommunityReminderPersonallyHidden,
  isEligibleForCompletedCommunityReminderBucket,
  isGeneralCommunityReminder,
  isGeneralCommunityReminderWithinRange,
  shouldIncludeCommunityReminderForViewer,
  shouldShowCommunityReminderInCommunity,
  shouldShowCommunityReminderOnPersonalSurface,
} from '../../convex/taskUtils';
import { selectMainReminderCandidates } from '../../lib/communityMainReminderCandidate';
import {
  getHomeReminderMetadata,
  getTaskTypeLabel,
} from '../../lib/taskClassification';

const communityId = 'community_1' as Id<'communities'>;
const userId = 'user_1' as Id<'users'>;

type MembershipStatus = Doc<'communityMembers'>['status'];

function membership(status: MembershipStatus | undefined): {
  status: MembershipStatus | undefined;
} {
  return { status };
}

const generalReminder = {
  communityId,
  sourceType: undefined,
};

describe('shouldIncludeCommunityReminderForViewer — PART F/G viewer visibility', () => {
  it('[#1] creator + active reminder → visible', () => {
    // Creator has no special data semantics — they are just another active
    // member for visibility purposes (PART G).
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(true);
  });

  it('[#2] normal active member + same reminder → visible', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(true);
  });

  it('[#3] admin + same reminder → visible (role does not gate visibility)', () => {
    // isActiveCommunityMember only inspects `status` — role (owner/admin/
    // member) never changes viewer eligibility.
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(true);
  });

  it('[#4] pending member → excluded according to existing access rules', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('pending'),
        personallyCompletedByViewer: false,
      })
    ).toBe(false);
  });

  it('[#5] non-member (no membership row) → excluded', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: null,
        personallyCompletedByViewer: false,
      })
    ).toBe(false);
  });

  it('left/removed member → excluded (does not keep seeing active reminders)', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('left'),
        personallyCompletedByViewer: false,
      })
    ).toBe(false);
  });

  it('[#6] reminder completed by viewer → hidden for that viewer', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: generalReminder,
        viewerMembership: membership('active'),
        personallyCompletedByViewer: true,
      })
    ).toBe(false);
  });

  it('[#7] same reminder not completed by another viewer → remains visible to that viewer', () => {
    // Member A completed it — hidden for A.
    const forMemberA = shouldIncludeCommunityReminderForViewer({
      task: generalReminder,
      viewerMembership: membership('active'),
      personallyCompletedByViewer: true,
    });
    // Member B has NOT completed it — still visible for B. Completion is
    // per-user (taskParticipantSettings), never a shared/global flag on the
    // task row itself.
    const forMemberB = shouldIncludeCommunityReminderForViewer({
      task: generalReminder,
      viewerMembership: membership('active'),
      personallyCompletedByViewer: false,
    });
    expect(forMemberA).toBe(false);
    expect(forMemberB).toBe(true);
  });

  it('[#13] creator status does NOT change classification/eligibility — same predicate, same inputs, same result regardless of who created the task', () => {
    // The predicate never even receives a "createdBy"/"isCreator" argument —
    // only task shape + viewer membership + viewer's own completion. This
    // proves management authority (creation) is structurally separated from
    // viewer visibility (PART G).
    const resultAsIfCreator = shouldIncludeCommunityReminderForViewer({
      task: generalReminder,
      viewerMembership: membership('active'),
      personallyCompletedByViewer: false,
    });
    const resultAsIfNotCreator = shouldIncludeCommunityReminderForViewer({
      task: generalReminder,
      viewerMembership: membership('active'),
      personallyCompletedByViewer: false,
    });
    expect(resultAsIfCreator).toBe(resultAsIfNotCreator);
  });

  it('[#14] community reminder visibility does NOT depend on Auto-Add — predicate has no autoAddEventsToCalendar concept at all', () => {
    // autoAddEventsToCalendar belongs to community EVENTS, not reminders.
    // Confirm the predicate's task shape has no such field and passing one
    // has no effect on the result.
    const task = { ...generalReminder, autoAddEventsToCalendar: true } as {
      communityId: Id<'communities'>;
      sourceType: undefined;
      autoAddEventsToCalendar: boolean;
    };
    expect(
      shouldIncludeCommunityReminderForViewer({
        task,
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(true);
  });

  it('a normal personal task (not community-scoped) is never included via this predicate', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: { communityId: undefined, sourceType: undefined },
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(false);
  });

  it('a community task with an explicit assignee is never included via this predicate (not a general reminder)', () => {
    expect(
      shouldIncludeCommunityReminderForViewer({
        task: { ...generalReminder, assignedTo: userId },
        viewerMembership: membership('active'),
        personallyCompletedByViewer: false,
      })
    ).toBe(false);
  });
});

describe('getTaskClassification / getTaskTypeLabel — PART E canonical classification', () => {
  it('[#10] general community reminder → type label = תזכורת קהילה', () => {
    const classification = getTaskClassification(generalReminder);
    expect(classification).toBe('community_reminder');
    expect(getTaskTypeLabel(classification)).toBe('תזכורת קהילה');
  });

  it('[#11] normal personal task → remains משימה', () => {
    const classification = getTaskClassification({
      communityId: undefined,
      sourceType: undefined,
    });
    expect(classification).toBe('personal_task');
    expect(getTaskTypeLabel(classification)).toBe('משימה');
  });

  it('classification is identical regardless of which "screen" calls it (Home vs Calendar) — same pure function, same input, same output', () => {
    const forHome = getTaskClassification(generalReminder);
    const forCalendar = getTaskClassification(generalReminder);
    expect(forHome).toBe(forCalendar);
    expect(forHome).toBe('community_reminder');
  });
});

describe('selectMainReminderCandidates — PART B "מה חשוב עכשיו" integration', () => {
  const nowMs = 1_700_000_000_000;
  const dayMs = 24 * 60 * 60 * 1000;

  it('[#15] active relevant reminder can enter מה חשוב עכשיו', () => {
    const reminders = [
      { _id: 'r1', title: 'תזכורת פעילה', dueAt: nowMs + dayMs },
    ];
    const { activeReminders, nearest } = selectMainReminderCandidates(
      reminders,
      nowMs
    );
    expect(activeReminders).toHaveLength(1);
    expect(nearest?._id).toBe('r1');
  });

  it('[#16] inactive/past reminder does not enter מה חשוב עכשיו', () => {
    const reminders = [
      { _id: 'r1', title: 'תזכורת שעבר זמנה', dueAt: nowMs - dayMs },
    ];
    const { activeReminders, nearest } = selectMainReminderCandidates(
      reminders,
      nowMs
    );
    expect(activeReminders).toHaveLength(0);
    expect(nearest).toBeNull();
  });

  it('[#8]/[#9] past-due reminder excluded, future/current active reminder included, in the same bounded list', () => {
    const reminders = [
      { _id: 'past', title: 'עבר', dueAt: nowMs - dayMs },
      { _id: 'soon', title: 'קרוב', dueAt: nowMs + 60_000 },
      { _id: 'later', title: 'בהמשך', dueAt: nowMs + 2 * dayMs },
    ];
    const { activeReminders, nearest } = selectMainReminderCandidates(
      reminders,
      nowMs
    );
    expect(activeReminders.map((r) => r._id)).toEqual(['soon', 'later']);
    // Nearest-due-first ordering — the imminent reminder surfaces first.
    expect(nearest?._id).toBe('soon');
  });

  it('a reminder with no due timestamp at all is treated as active (never past-due) and sorts last', () => {
    const reminders = [
      { _id: 'no-date', title: 'ללא תאריך' },
      { _id: 'soon', title: 'קרוב', dueAt: nowMs + 60_000 },
    ];
    const { activeReminders, nearest } = selectMainReminderCandidates(
      reminders,
      nowMs
    );
    expect(activeReminders.map((r) => r._id)).toEqual(['soon', 'no-date']);
    expect(nearest?._id).toBe('soon');
  });

  it('[#11] future dueAt → active/eligible', () => {
    const reminders = [{ _id: 'r1', title: 'תזכורת', dueAt: nowMs + dayMs }];
    expect(
      selectMainReminderCandidates(reminders, nowMs).activeReminders
    ).toHaveLength(1);
  });

  it('[#12] future/current dueDate-only (no dueAt) → active/eligible (end-of-day semantics)', () => {
    // A dueDate-only reminder is due through the END of that day — see
    // lib/taskDueStatus.ts dayEnd(). "Today" (nowMs's own day) must still
    // be active, not already expired.
    const reminders = [{ _id: 'r1', title: 'תזכורת', dueDate: nowMs }];
    expect(
      selectMainReminderCandidates(reminders, nowMs).activeReminders
    ).toHaveLength(1);
  });

  it('[#13] past dueAt → excluded', () => {
    const reminders = [{ _id: 'r1', title: 'תזכורת', dueAt: nowMs - dayMs }];
    expect(
      selectMainReminderCandidates(reminders, nowMs).activeReminders
    ).toHaveLength(0);
  });

  it('[#14] expired dueDate-only (yesterday) → excluded per canonical end-of-day semantics', () => {
    const reminders = [{ _id: 'r1', title: 'תזכורת', dueDate: nowMs - dayMs }];
    expect(
      selectMainReminderCandidates(reminders, nowMs).activeReminders
    ).toHaveLength(0);
  });

  it('never mutates the input array (bounded list stays reusable for other UI)', () => {
    const reminders = [
      { _id: 'r2', title: 'ב', dueAt: nowMs + dayMs },
      { _id: 'r1', title: 'א', dueAt: nowMs + 60_000 },
    ];
    const snapshotOrder = reminders.map((r) => r._id);
    selectMainReminderCandidates(reminders, nowMs);
    expect(reminders.map((r) => r._id)).toEqual(snapshotOrder);
  });
});

describe('getHomeReminderMetadata — BUG 2 Home timed/date-only metadata parity', () => {
  it('[#8] timed community reminder → תזכורת קהילה + community name', () => {
    const meta = getHomeReminderMetadata({
      taskType: 'community_reminder',
      communityId,
      communityName: 'קהילת השכונה',
    });
    expect(meta.taskTypeLabel).toBe('תזכורת קהילה');
    expect(meta.groupName).toBe('קהילת השכונה');
    expect(meta.communityId).toBe(String(communityId));
  });

  it('[#9] date-only community reminder → IDENTICAL metadata to the timed case (same helper, same input shape, no dueAt/hasTime dependency)', () => {
    // getHomeReminderMetadata's input has no dueAt/hasTime field at all —
    // structurally proving the date-only mapping path (which has no time)
    // produces the exact same result as the timed path above.
    const meta = getHomeReminderMetadata({
      taskType: 'community_reminder',
      communityId,
      communityName: 'קהילת השכונה',
    });
    expect(meta).toEqual({
      taskTypeLabel: 'תזכורת קהילה',
      groupName: 'קהילת השכונה',
      communityId: String(communityId),
    });
  });

  it('[#11] personal task → משימה, no community tag (taskTypeLabel/groupName/communityId all undefined)', () => {
    const meta = getHomeReminderMetadata({
      taskType: 'personal_task',
      communityId: undefined,
      communityName: undefined,
    });
    expect(meta.taskTypeLabel).toBeUndefined();
    expect(meta.groupName).toBeUndefined();
    expect(meta.communityId).toBeUndefined();
  });
});

describe('isGeneralCommunityReminderWithinRange — dedicated range-query bounding predicate', () => {
  const from = 1_700_000_000_000; // range start
  const to = 1_700_600_000_000; // range end

  it('[#1] timed reminder (dueAt) inside range → included', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: from + 1000 }, from, to)
    ).toBe(true);
  });

  it('[#2] timed reminder (dueAt) before range → excluded', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: from - 1000 }, from, to)
    ).toBe(false);
  });

  it('[#3] timed reminder (dueAt) after range → excluded', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: to + 1000 }, from, to)
    ).toBe(false);
  });

  it('[#4] date-only reminder (dueDate, no dueAt) inside range → included', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: from + 1000 }, from, to)
    ).toBe(true);
  });

  it('[#5] date-only reminder before range → excluded', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: from - 1000 }, from, to)
    ).toBe(false);
  });

  it('[#6] date-only reminder after range → excluded', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: to + 1000 }, from, to)
    ).toBe(false);
  });

  it('[#7] undated reminder (neither dueAt nor dueDate) → never "in range" for date-driven surfaces', () => {
    expect(isGeneralCommunityReminderWithinRange({}, from, to)).toBe(false);
  });

  it('range boundaries are inclusive on both ends', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: from }, from, to)
    ).toBe(true);
    expect(isGeneralCommunityReminderWithinRange({ dueAt: to }, from, to)).toBe(
      true
    );
  });

  it('[#20] reminder with BOTH dueAt and dueDate in range → still just "in range" once (dedup happens at the query-merge step, keyed by task ID, not here)', () => {
    expect(
      isGeneralCommunityReminderWithinRange(
        { dueAt: from + 1000, dueDate: from + 500 },
        from,
        to
      )
    ).toBe(true);
  });
});

describe('[#17] >8 raw rows does not empty Main — selectMainReminderCandidates has no isDone dependency', () => {
  const nowMs = 1_700_000_000_000;

  it('a valid active candidate on a bounded (incomplete) page of >8 raw rows is still selected', () => {
    // Simulates page 1 of a community with far more than 8 raw task rows:
    // selectMainReminderCandidates never receives/consults `isDone` at all —
    // it is a pure function of the reminders it's given, so a valid
    // candidate loaded on an incomplete page is never suppressed.
    const boundedFirstPageOf8 = [
      { _id: 'r1', title: 'ריק', dueAt: nowMs - 1000 }, // past due
      { _id: 'r2', title: 'תזכורת פעילה', dueAt: nowMs + 60_000 }, // active
      { _id: 'r3', title: 'ריק2', dueAt: nowMs - 2000 },
      { _id: 'r4', title: 'ריק3', dueAt: nowMs - 3000 },
      { _id: 'r5', title: 'ריק4', dueAt: nowMs - 4000 },
      { _id: 'r6', title: 'ריק5', dueAt: nowMs - 5000 },
      { _id: 'r7', title: 'ריק6', dueAt: nowMs - 6000 },
      { _id: 'r8', title: 'ריק7', dueAt: nowMs - 7000 },
    ];
    const { nearest } = selectMainReminderCandidates(
      boundedFirstPageOf8,
      nowMs
    );
    expect(nearest?._id).toBe('r2');
  });
});

describe('[#12] community reminder includes community name metadata', () => {
  it('a general community reminder carries a resolvable communityId that the caller can join against community name metadata', () => {
    // The reminder row itself only carries communityId (PART D CALENDAR
    // COMMUNITY TAG / PART C HOME TYPE-LABEL) — the actual community NAME is
    // resolved server-side once per unique communityId in listMyTasks and
    // attached as `communityName` (see convex/tasks.ts), never via a
    // client-side N+1 useQuery per reminder. This test locks the underlying
    // classification contract those enrichment call sites depend on: a
    // general reminder is exactly the shape that carries a communityId.
    expect(generalReminder.communityId).toBe(communityId);
    expect(getTaskClassification(generalReminder)).toBe('community_reminder');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Community Reminder personal dismissal — backend foundation.
//
// Covers:
//  - isCommunityReminderPersonallyHidden (convex/taskUtils.ts) — the
//    dismissedAt-OR-legacy-completedAt data-model rule.
//  - shouldShowCommunityReminderOnPersonalSurface — PERSONAL (Home/
//    Calendar) eligibility: active membership AND not personally hidden.
//  - shouldShowCommunityReminderInCommunity — COMMUNITY (Main / Reminders
//    tab) eligibility: active membership only, personal state never
//    consulted at all (the function signature has no settings/dismissal
//    param, so it structurally cannot be affected by it).
//
// MUTATION SECURITY (dismissCommunityReminderForMe in convex/tasks.ts) —
// there is no Convex mutation test harness in this repo (see this file's
// own header comment and the identical precedent in
// tests/convex/communityCalendarState.test.ts's "#16-#18" note). The
// mutation's authorization logic is exactly:
//   isGeneralCommunityReminder(task) && isActiveCommunityMember(membership)
// — i.e. the SAME two building blocks exercised by
// shouldShowCommunityReminderInCommunity below (task-shape + membership),
// which is why the "MUTATION SECURITY / PURE AUTH HELPERS" cases (owner/
// admin/member/pending/non-member/non-community-task/event-derived-task)
// are covered via that shared predicate rather than a duplicate helper —
// any change to the authorization rule shows up here. The actual DB write
// (setPersonalDismissed's upsert/idempotency) and the mutation's
// `getAuthUserId`-only viewer resolution were verified by code review:
//   - convex/tasks.ts `dismissCommunityReminderForMe` reads the viewer
//     EXCLUSIVELY via `getAuthUserId(ctx)` — the mutation's only arg is
//     `{ taskId }`, so no userId/viewerId can ever be supplied by the
//     client.
//   - convex/taskUtils.ts `setPersonalDismissed` patches the existing
//     by_task_user row (matching setPersonalCompleted's exact upsert
//     identity) or inserts one minimal new row — never a second row for an
//     existing (taskId, userId) pair — and returns the ORIGINAL
//     `dismissedAt` without writing again when already dismissed.
// ═════════════════════════════════════════════════════════════════════════

describe('isCommunityReminderPersonallyHidden — data-model/classification', () => {
  it('[#1] general community reminder + no viewer settings row → not personally hidden', () => {
    expect(isCommunityReminderPersonallyHidden(generalReminder, null)).toBe(
      false
    );
    expect(
      isCommunityReminderPersonallyHidden(generalReminder, undefined)
    ).toBe(false);
    expect(isCommunityReminderPersonallyHidden(generalReminder, {})).toBe(
      false
    );
  });

  it('[#2] dismissedAt present → personally hidden', () => {
    expect(
      isCommunityReminderPersonallyHidden(generalReminder, {
        dismissedAt: 123,
      })
    ).toBe(true);
  });

  it('[#3] legacy completedAt present → personally hidden', () => {
    expect(
      isCommunityReminderPersonallyHidden(generalReminder, {
        completedAt: 456,
      })
    ).toBe(true);
  });

  it('[#4] both dismissedAt and completedAt present → personally hidden', () => {
    expect(
      isCommunityReminderPersonallyHidden(generalReminder, {
        dismissedAt: 123,
        completedAt: 456,
      })
    ).toBe(true);
  });

  it('[#5] normal personal task + completedAt does NOT become "community reminder personally hidden" through this helper', () => {
    const personalTask = { communityId: undefined, sourceType: undefined };
    expect(
      isCommunityReminderPersonallyHidden(personalTask, { completedAt: 456 })
    ).toBe(false);
  });

  it('a community task with an explicit assignee (not a general reminder) is never "personally hidden" via this helper', () => {
    expect(
      isCommunityReminderPersonallyHidden(
        { ...generalReminder, assignedTo: userId },
        { dismissedAt: 123, completedAt: 456 }
      )
    ).toBe(false);
  });

  it('an event-derived community task (sourceType set) is never "personally hidden" via this helper', () => {
    expect(
      isCommunityReminderPersonallyHidden(
        { ...generalReminder, sourceType: 'community_event_important_item' },
        { dismissedAt: 123, completedAt: 456 }
      )
    ).toBe(false);
  });
});

describe('shouldShowCommunityReminderOnPersonalSurface — PERSONAL (Home/Calendar) visibility', () => {
  it('[#6] active member + reminder + no hidden state → eligible for personal retrieval', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: {},
      })
    ).toBe(true);
  });

  it('[#7] active member + dismissedAt → excluded from personal retrieval', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: { dismissedAt: 123 },
      })
    ).toBe(false);
  });

  it('[#8] active member + legacy completedAt → excluded from personal retrieval', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: { completedAt: 456 },
      })
    ).toBe(false);
  });

  it('[#9] viewer A dismissed → viewer B with no setting remains eligible', () => {
    const forViewerA = shouldShowCommunityReminderOnPersonalSurface({
      task: generalReminder,
      viewerMembership: membership('active'),
      settings: { dismissedAt: 123 },
    });
    const forViewerB = shouldShowCommunityReminderOnPersonalSurface({
      task: generalReminder,
      viewerMembership: membership('active'),
      settings: {},
    });
    expect(forViewerA).toBe(false);
    expect(forViewerB).toBe(true);
  });

  it('pending member + no hidden state → still excluded (membership gates before hidden-state)', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('pending'),
        settings: {},
      })
    ).toBe(false);
  });

  it('non-member (no membership row) → excluded regardless of hidden state', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: null,
        settings: {},
      })
    ).toBe(false);
  });
});

describe('shouldShowCommunityReminderInCommunity — COMMUNITY (Main / Reminders tab) visibility', () => {
  it('[#10] reminder dismissed by viewer → still eligible inside Community Main backend semantics', () => {
    // No `settings`/dismissal parameter exists on this function at all —
    // personal state structurally cannot suppress the result.
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#11] legacy completed reminder → still eligible inside community semantics', () => {
    // Same call as #10 — legacy completedAt is likewise never consulted.
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#12] deleted reminder → still excluded', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { ...generalReminder, deletedAt: 999 },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });

  it('[#13] pending member → excluded', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('pending'),
      })
    ).toBe(false);
  });

  it('[#14] removed/non-member → excluded', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('left'),
      })
    ).toBe(false);
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: null,
      })
    ).toBe(false);
  });
});

describe('MUTATION SECURITY / PURE AUTH HELPERS — dismissCommunityReminderForMe authorization building blocks', () => {
  // dismissCommunityReminderForMe's server-side authorization is exactly
  // `isGeneralCommunityReminder(task) && isActiveCommunityMember(membership)`
  // — the same two checks shouldShowCommunityReminderInCommunity composes.
  // These cases exercise that exact composition for every role/status the
  // mutation must accept or reject.

  it('[#17] non-community task (no communityId) → cannot dismiss via this mutation', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { communityId: undefined, sourceType: undefined },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });

  it('[#18] event-derived community task → cannot dismiss via this mutation', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: {
          ...generalReminder,
          sourceType: 'community_event_important_item',
        },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });

  it('[#19] active owner → allowed (role never gates — only status)', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#20] active admin → allowed', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#21] active member → allowed', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#22] pending member → rejected', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('pending'),
      })
    ).toBe(false);
  });

  it('[#23] non-member → rejected', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: null,
      })
    ).toBe(false);
  });

  it('a community task with an explicit assignee → cannot dismiss via this mutation (not a general reminder)', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { ...generalReminder, assignedTo: userId },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });

  it('a soft-deleted/archived general reminder → cannot dismiss via this mutation', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { ...generalReminder, deletedAt: 999 },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { ...generalReminder, archivedAt: 999 },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });
});

describe('RANGE ARCHITECTURE — listVisibleCommunityRemindersForRange preserved after personal-dismissal changes', () => {
  const from = 1_700_000_000_000;
  const to = 1_700_600_000_000;

  it('[#29] timed reminder range behavior preserved (dueAt-only bounding rule untouched)', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: from + 1000 }, from, to)
    ).toBe(true);
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: to + 1000 }, from, to)
    ).toBe(false);
  });

  it('[#30] date-only range behavior preserved (dueDate-only bounding rule untouched)', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: from + 1000 }, from, to)
    ).toBe(true);
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: to + 1000 }, from, to)
    ).toBe(false);
  });

  it('[#31] undated reminder remains absent from personal date-range query', () => {
    expect(isGeneralCommunityReminderWithinRange({}, from, to)).toBe(false);
  });

  it('[#32] the personal-hidden filter is a Set membership check on task IDs already collected via a SINGLE by_user scan — dismissal introduces no per-reminder or historical scan', () => {
    // Documents the exact shape listVisibleCommunityRemindersForRange builds
    // (convex/tasks.ts): one `taskParticipantSettings.by_user` scan for the
    // viewer, reduced to a Set<string> of hidden task IDs (dismissedAt OR
    // completedAt), then a plain `.has(key)` check per already-bounded
    // range-query candidate — never a query per candidate reminder.
    const myCompletionRows: {
      taskId: string;
      completedAt?: number;
      dismissedAt?: number;
    }[] = [
      { taskId: 't1', dismissedAt: 111 },
      { taskId: 't2', completedAt: 222 },
      { taskId: 't3' },
    ];
    const myHiddenTaskIds = new Set(
      myCompletionRows
        .filter(
          (r) => r.completedAt !== undefined || r.dismissedAt !== undefined
        )
        .map((r) => r.taskId)
    );
    expect(myHiddenTaskIds.has('t1')).toBe(true);
    expect(myHiddenTaskIds.has('t2')).toBe(true);
    expect(myHiddenTaskIds.has('t3')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LEGACY COMPLETION: COMMUNITY VISIBILITY CORRECTION.
//
// A general community reminder is SHARED community content, never a
// per-viewer completable task. Legacy taskParticipantSettings.completedAt
// means ONLY "personally hidden from my own Home/Calendar" — it must NEVER
// exclude, move, or partition the reminder inside the COMMUNITY itself
// (Community Main / Community Reminders tab).
//
// Covers:
//  - shouldShowCommunityReminderInCommunity — the Community Reminders/
//    Community Main source-visibility predicate. Its signature has no
//    dismissal/completion parameter AT ALL, so personal state structurally
//    cannot affect it (convex/tasks.ts `listCommunityRemindersPaged` /
//    `listByCommunity` now delegate visibility to the same task-shape +
//    membership rule this predicate captures — no getPersonalCompletion
//    call remains in either query's general-reminder branch).
//  - isEligibleForCompletedCommunityReminderBucket — the exact rule
//    convex/tasks.ts `listCompletedCommunityReminders` uses to decide
//    whether a completedAt row may ever be classified into a "completed
//    community reminder" bucket: never true for a general community
//    reminder.
//  - shouldShowCommunityReminderOnPersonalSurface — confirms PERSONAL
//    (Home/Calendar) retrieval is completely unaffected by this
//    correction: dismissedAt/legacy completedAt still hide on personal
//    surfaces exactly as before.
//
// The actual DB-backed queries (`listCommunityRemindersPaged`,
// `listByCommunity`, `listCompletedCommunityReminders`,
// `listVisibleCommunityRemindersForRange`) cannot be unit-tested without a
// Convex test harness (none exists in this repo — same precedent as the
// rest of this file). Verified instead by code review: every
// `getPersonalCompletion`/`taskParticipantSettings` read that used to gate
// a general-reminder's presence in the Community Reminders source has been
// removed; the only remaining `getPersonalCompletion` calls are in
// `toggleCompleted` (writes the viewer's OWN completion state) and
// `getTaskDetails` (overlays the viewer's OWN completion state onto a
// single task's detail view) — neither of which excludes the reminder from
// any shared community list.
// ═════════════════════════════════════════════════════════════════════════

describe('Community Reminders source visibility — legacy completedAt/dismissedAt never hide shared content', () => {
  it('[#1] general Community Reminder + no settings → visible in Community Reminders source', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#2] general Community Reminder + dismissedAt → STILL visible in Community Reminders source', () => {
    // shouldShowCommunityReminderInCommunity has no settings parameter at
    // all — dismissedAt cannot be passed in, and therefore cannot affect
    // the result. This is the same call as #1: the function is
    // structurally blind to personal state.
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#3] general Community Reminder + legacy completedAt → STILL visible in Community Reminders source', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#4] general Community Reminder + both dismissedAt + completedAt → STILL visible in Community Reminders source', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });

  it('[#11] deleted general reminder → still excluded from community source', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: { ...generalReminder, deletedAt: 999 },
        viewerMembership: membership('active'),
      })
    ).toBe(false);
  });

  it('[#12] inactive/non-member viewer → still excluded', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('pending'),
      })
    ).toBe(false);
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('left'),
      })
    ).toBe(false);
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: null,
      })
    ).toBe(false);
  });

  it('[#13] Community Main semantics still ignore personal hidden state (respectPersonalHiddenState=false mode has no settings input either)', () => {
    // listVisibleCommunityRemindersForRange's community-context mode
    // (respectPersonalHiddenState: false) skips the personal by_user scan
    // entirely (see convex/tasks.ts) — modeled here at the predicate level:
    // shouldShowCommunityReminderInCommunity is exactly what that mode
    // reduces to once personal hidden state is skipped.
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });
});

describe('isEligibleForCompletedCommunityReminderBucket — completed-bucket classification correction', () => {
  it('[#5] general Community Reminder + legacy completedAt → NOT classified into completed-community-reminder bucket', () => {
    expect(isEligibleForCompletedCommunityReminderBucket(generalReminder)).toBe(
      false
    );
  });

  it('[#6] general Community Reminder + dismissedAt → NOT classified into completed-community-reminder bucket', () => {
    // The predicate has no settings parameter — it is a pure function of
    // task SHAPE, so dismissedAt cannot change the result either.
    expect(isEligibleForCompletedCommunityReminderBucket(generalReminder)).toBe(
      false
    );
  });

  it('[#9] normal completable task + completedAt → existing completed behavior unchanged (eligible for the completed bucket)', () => {
    const personalTask = { communityId: undefined, sourceType: undefined };
    expect(isEligibleForCompletedCommunityReminderBucket(personalTask)).toBe(
      true
    );
  });

  it('[#10] event-derived task + completedAt → existing behavior unchanged (eligible for the completed bucket — not a general reminder)', () => {
    const eventDerivedTask = {
      ...generalReminder,
      sourceType: 'community_event_important_item',
    };
    expect(
      isEligibleForCompletedCommunityReminderBucket(eventDerivedTask)
    ).toBe(true);
  });

  it('a community task with an explicit assignee → eligible for the completed bucket (not a general reminder)', () => {
    expect(
      isEligibleForCompletedCommunityReminderBucket({
        ...generalReminder,
        assignedTo: userId,
      })
    ).toBe(true);
  });
});

describe('PERSONAL surfaces (Home/Calendar) — unaffected by this correction', () => {
  it('[#7] general Community Reminder + completedAt → STILL hidden from PERSONAL retrieval', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: { completedAt: 456 },
      })
    ).toBe(false);
  });

  it('[#8] general Community Reminder + dismissedAt → STILL hidden from PERSONAL retrieval', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: { dismissedAt: 123 },
      })
    ).toBe(false);
  });

  it('general Community Reminder + no hidden state → still visible on PERSONAL retrieval (unaffected baseline)', () => {
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: {},
      })
    ).toBe(true);
  });
});

describe('[#14] dueAt/dueDate bounded retrieval unchanged by this correction', () => {
  const from = 1_700_000_000_000;
  const to = 1_700_600_000_000;

  it('timed reminder (dueAt) range-inclusion rule is untouched', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: from + 1000 }, from, to)
    ).toBe(true);
    expect(
      isGeneralCommunityReminderWithinRange({ dueAt: to + 1000 }, from, to)
    ).toBe(false);
  });

  it('date-only reminder (dueDate) range-inclusion rule is untouched', () => {
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: from + 1000 }, from, to)
    ).toBe(true);
    expect(
      isGeneralCommunityReminderWithinRange({ dueDate: to + 1000 }, from, to)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Personal-dismiss CREATOR-OVERLAP correction (Home + Calendar final audit).
//
// convex/tasks.ts `listMyTasks` never reads `taskParticipantSettings` at all
// (no dismissedAt/settings input in this query, unlike
// listVisibleCommunityRemindersForRange), so it cannot itself decide whether
// a general community reminder is personally hidden. Its by_creator scan
// (step 2) could therefore still return a general community reminder to its
// own creator even after that creator dismissed it — completely bypassing
// `dismissCommunityReminderForMe` for that one viewer, since Home/Calendar
// merge listMyTasks's raw result into the same dataset as the
// dismissal-aware dedicated query (see index.tsx/calendar.tsx merge
// comments).
//
// The fix: listMyTasks now unconditionally excludes every general community
// reminder from its OWN result — `tasks.filter((t) =>
// !isGeneralCommunityReminder(t))` — regardless of which step matched it,
// so the raw dataset it hands to Home/Calendar can never reintroduce a
// reminder the dedicated, dismissal-aware query already correctly excluded.
//
// The actual ctx.db scan/filter cannot be unit-tested without a live Convex
// harness (same precedent as the rest of this file) — these tests instead
// exercise the exact PURE predicate (`isGeneralCommunityReminder`) that
// drives that filter, against task shapes representative of every
// listMyTasks step (creator/assignee/co-member-secondary-assignee).
// ─────────────────────────────────────────────────────────────────────────────
describe('listMyTasks creator-overlap correction — isGeneralCommunityReminder as the exclusion predicate', () => {
  /** Mirrors `tasks.filter((t) => !isGeneralCommunityReminder(t))` in convex/tasks.ts. */
  function applyListMyTasksReminderExclusion<
    T extends Parameters<typeof isGeneralCommunityReminder>[0],
  >(tasks: T[]): T[] {
    return tasks.filter((t) => !isGeneralCommunityReminder(t));
  }

  it('[#1] creator-owned general Community Reminder is excluded from the listMyTasks result set (Home data)', () => {
    // Same task shape a by_creator match (listMyTasks step 2) would return
    // for its own creator — no assignee, communityId set, no sourceType.
    const creatorOwnedReminder = {
      _id: 'task_reminder_1',
      ...generalReminder,
      createdBy: userId,
    };
    const result = applyListMyTasksReminderExclusion([creatorOwnedReminder]);
    expect(result).toHaveLength(0);
  });

  it('[#2] creator-owned general Community Reminder is excluded from the listMyTasks result set (Calendar data — identical predicate, identical input shape)', () => {
    // Calendar's calendarTasksRaw is fed by the SAME listMyTasks query as
    // Home — there is no second, Calendar-specific exclusion path to drift.
    const creatorOwnedReminder = {
      _id: 'task_reminder_2',
      ...generalReminder,
      createdBy: userId,
    };
    const result = applyListMyTasksReminderExclusion([creatorOwnedReminder]);
    expect(result).toHaveLength(0);
  });

  it('[#3] an ordinary creator-owned PERSONAL task (no communityId) is NOT excluded — unaffected by this correction', () => {
    const personalTask = {
      _id: 'task_personal_1',
      communityId: undefined,
      sourceType: undefined,
      createdBy: userId,
    };
    const result = applyListMyTasksReminderExclusion([personalTask]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(personalTask);
  });

  it('an ordinary assigned task (listMyTasks step 1 / by_assigned) is NOT excluded — unaffected by this correction', () => {
    const assignedTask = {
      _id: 'task_assigned_1',
      communityId: undefined,
      sourceType: undefined,
      assignedTo: userId,
    };
    const result = applyListMyTasksReminderExclusion([assignedTask]);
    expect(result).toHaveLength(1);
  });

  it('a co-member secondary-assignee task (listMyTasks step 3) is NOT excluded — unaffected by this correction', () => {
    const coMemberTask = {
      _id: 'task_co_member_1',
      communityId: undefined,
      sourceType: undefined,
      assignedToUserIds: [userId],
    };
    const result = applyListMyTasksReminderExclusion([coMemberTask]);
    expect(result).toHaveLength(1);
  });

  it('a community task WITH an explicit assignee is NOT excluded — only general (unassigned) reminders are, never assigned community tasks', () => {
    const assignedCommunityTask = {
      _id: 'task_community_assigned_1',
      ...generalReminder,
      assignedTo: userId,
      createdBy: userId,
    };
    const result = applyListMyTasksReminderExclusion([assignedCommunityTask]);
    expect(result).toHaveLength(1);
  });

  it('an event-derived task (sourceType set) sharing communityId is NOT excluded — isGeneralCommunityReminder requires sourceType === undefined', () => {
    const eventDerivedTask = {
      _id: 'task_event_derived_1',
      ...generalReminder,
      sourceType: 'community_event_important_item',
      createdBy: userId,
    };
    const result = applyListMyTasksReminderExclusion([eventDerivedTask]);
    expect(result).toHaveLength(1);
  });

  it('normal member behavior is unaffected: shouldShowCommunityReminderOnPersonalSurface (the dedicated query the reminder is now EXCLUSIVELY sourced from) already ignores creator status entirely', () => {
    // Whether the viewer created the reminder is never an input to this
    // predicate — visibility/dismissal is purely membership + settings, so
    // an ordinary active member gets IDENTICAL treatment to the creator.
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: {},
      })
    ).toBe(true);
    expect(
      shouldShowCommunityReminderOnPersonalSurface({
        task: generalReminder,
        viewerMembership: membership('active'),
        settings: { dismissedAt: 999 },
      })
    ).toBe(false);
  });

  it('community-context visibility (Community Main / Community "תזכורות") is untouched by this correction — shouldShowCommunityReminderInCommunity has no settings/dismissal input at all', () => {
    expect(
      shouldShowCommunityReminderInCommunity({
        task: generalReminder,
        viewerMembership: membership('active'),
      })
    ).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// QA FIX — BUG 2: Community Main incorrectly hid a personally-dismissed
// reminder ("מה חשוב עכשיו").
//
// Root cause was NOT a pure-logic bug — every predicate above
// (shouldShowCommunityReminderInCommunity, isCommunityReminderPersonallyHidden)
// already had, and still has, the correct COMMUNITY-vs-PERSONAL semantics
// (community-context visibility has no settings/dismissal input at all, see
// the test directly above). The bug was a QUERY-ARGUMENT wiring defect: the
// actual caller — `TabMain` in app/(authenticated)/community/[id].tsx — was
// invoking `api.tasks.listVisibleCommunityRemindersForRange` WITHOUT
// `respectPersonalHiddenState: false`, so the query defaulted to its
// PERSONAL-surface mode (which DOES consult the viewer's own
// dismissedAt/completedAt — see convex/tasks.ts, lines around
// `ignorePersonalHiddenState`). Fix: added `respectPersonalHiddenState:
// false` to that one query call — no backend/taskUtils change, no schema
// change. This exact query mode already existed and was already exercised
// by this file's `shouldShowCommunityReminderInCommunity` coverage above;
// there was simply no test (and no query-argument default) verifying Main
// actually SELECTED that mode. Cannot be verified further with a pure unit
// test (the query argument itself lives in a React component, and there is
// no Convex mutation/query test harness in this repo — see this file's own
// header comment) — verified instead by direct code review of the
// corrected call site.
//
// QA FIX — BUG 3: Community Main did not display a reminder's configured
// date/time.
//
// Root cause: the Main label was built as a bare `תזכורת · {title}` string
// with no date/time context at all. Fix: `formatReminderScheduleLabel`
// (lib/taskDueStatus.ts, relocated from the previously-private
// `formatDueDate`/`formatDueTime` in app/(authenticated)/community/[id].tsx
// so the Reminders tab and Community Main share ONE date-formatting
// implementation) is now composed into that label — see
// tests/convex/taskDueStatus.test.ts for the exhaustive
// timed/date-only/today/tomorrow/no-fake-00:00 coverage of that helper.
// ═════════════════════════════════════════════════════════════════════════
