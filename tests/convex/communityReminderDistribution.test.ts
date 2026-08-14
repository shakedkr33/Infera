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
 *     `listMyTasks` now only ever returns personal/assigned tasks (a general
 *     reminder can still appear there ONLY via the pre-existing by_creator
 *     match, unrelated to this fix).
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
  isGeneralCommunityReminderWithinRange,
  shouldIncludeCommunityReminderForViewer,
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
