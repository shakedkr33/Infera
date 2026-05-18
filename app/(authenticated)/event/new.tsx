import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import EventScreen from '@/lib/components/event/EventScreen';
import type { EventAttachmentDraft, EventData } from '@/lib/types/event';

// ─── Community Event Form ─────────────────────────────────────────────────────

function CommunityEventForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [rsvpRequired, setRsvpRequired] = useState(false);

  const createEvent = useMutation(api.events.create);
  const createEventTasks = useMutation(api.eventTasks.createBatch);
  const setTaskAssignee = useMutation(api.eventTasks.setAssignee);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);
  const spaceId = useQuery(api.users.getMySpace);
  const communityMembersData = useQuery(api.communities.getCommunityMembers, {
    communityId: communityId as Id<'communities'>,
  });
  const communityMembers = communityMembersData?.members ?? [];

  const communityTaskParticipants = useMemo(
    () =>
      communityMembers.map((member) => ({
        id: member.userId,
        name: member.fullName,
        email: member.email,
        color: '#36a9e2',
      })),
    [communityMembers]
  );

  const handleUnifiedCommunitySave = useCallback(
    async (data: EventData): Promise<string> => {
      if (!spaceId && !communityId) {
        Alert.alert('שגיאה', 'לא נמצא מרחב פעיל. נסה להתנתק ולהתחבר מחדש.');
        throw new Error('לא נמצא מרחב פעיל');
      }

      const baseDate = new Date(data.date);
      const startTs =
        data.isAllDay || !data.startTime
          ? new Date(data.date).setHours(0, 0, 0, 0)
          : (() => {
              const [hStr, mStr] = data.startTime.split(':');
              const d = new Date(baseDate);
              d.setHours(Number(hStr ?? '9'), Number(mStr ?? '0'), 0, 0);
              return d.getTime();
            })();
      const endTs =
        data.isAllDay || !data.endTime
          ? new Date(data.date).setHours(23, 59, 59, 999)
          : (() => {
              const [hStr, mStr] = data.endTime.split(':');
              const endBase =
                data.endDate != null ? new Date(data.endDate) : baseDate;
              const d = new Date(
                endBase.getFullYear(),
                endBase.getMonth(),
                endBase.getDate()
              );
              d.setHours(Number(hStr ?? '10'), Number(mStr ?? '0'), 0, 0);
              return d.getTime();
            })();
      const resolvedAttachments = await uploadDraftAttachments(
        data.attachments ?? [],
        generateUploadUrl
      );

      const eventId = await createEvent({
        // FIXED: community creation now uses the shared base EventScreen form
        title: data.title.trim(),
        description: data.notes?.trim() || undefined,
        startTime: startTs,
        endTime: endTs,
        allDay: data.isAllDay || undefined,
        location: data.location?.trim() || undefined,
        onlineUrl: data.onlineUrl?.trim() || undefined,
        locationUrl: data.locationUrl || undefined,
        spaceId: (spaceId as Id<'spaces'> | null) ?? undefined,
        communityId: communityId as Id<'communities'>,
        tasksVisibleToParticipants: data.tasksVisibleToParticipants,
        requiresRsvp: rsvpRequired,
        attachments:
          resolvedAttachments.length > 0 ? resolvedAttachments : undefined,
        reminders: data.remindersEnabled
          ? data.reminders.map((r) => r.offsetMinutes)
          : [],
        importantItems:
          data.importantItems && data.importantItems.length > 0
            ? data.importantItems
            : undefined,
      });

      const tasksToCreate = data.tasks.filter(
        (task) => task.title.trim().length > 0
      );
      if (tasksToCreate.length > 0) {
        const taskIds = await createEventTasks({
          eventId,
          tasks: tasksToCreate.map((task) => ({ title: task.title.trim() })),
        });

        for (let i = 0; i < tasksToCreate.length; i++) {
          const task = tasksToCreate[i];
          const taskId = taskIds[i];
          const assigneeUserId =
            task.assignedParticipantIds?.[0] ?? task.assigneeId;
          if (taskId && assigneeUserId) {
            await setTaskAssignee({
              id: taskId as Id<'eventTasks'>,
              assignee: {
                type: 'user',
                userId: assigneeUserId as Id<'users'>,
              },
            }).catch(() => {});
          }
        }
      }

      router.replace(
        `/(authenticated)/community/${communityId}` as Parameters<
          typeof router.replace
        >[0]
      );
      return eventId;
    },
    [
      communityId,
      createEvent,
      createEventTasks,
      generateUploadUrl,
      router,
      rsvpRequired,
      setTaskAssignee,
      spaceId,
    ]
  );

  return (
    <EventScreen
      mode="create"
      context="community"
      onSave={handleUnifiedCommunitySave}
      showParticipants={false}
      taskParticipants={communityTaskParticipants}
      showRsvpSection={true}
      rsvpRequired={rsvpRequired}
      onRsvpRequiredChange={setRsvpRequired}
      showSuccessSheet={false}
    />
  );
}

// ─── Upload helper ────────────────────────────────────────────────────────────
// FIXED: uploads draft attachments (localUri) to Convex Storage before saving.
// Returns the final list with storageId set and localUri stripped.
// uploadedBy is stamped by the backend mutation; we pass a placeholder here
// and let the mutation fill it using getAuthUserId(ctx).

// Shape accepted by the create/update mutation args (uploadedBy/uploadedAt stamped by backend)
type ConvexAttachment = {
  storageId: Id<'_storage'>;
  originalName: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
};

async function uploadDraftAttachments(
  drafts: EventAttachmentDraft[],
  generateUrl: () => Promise<string>
): Promise<ConvexAttachment[]> {
  const results: ConvexAttachment[] = [];

  for (const draft of drafts) {
    if (draft.storageId && !draft.localUri) {
      // Already saved — pass through (storageId already typed as Id<'_storage'>)
      results.push({
        storageId: draft.storageId,
        originalName: draft.originalName,
        displayName: draft.displayName,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
      });
      continue;
    }

    if (!draft.localUri) continue; // skip anything with neither

    const uploadUrl = await generateUrl();
    const response = await fetch(draft.localUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': draft.mimeType },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`העלאת הקובץ נכשלה: ${draft.originalName}`);
    }

    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };

    results.push({
      storageId: storageId as Id<'_storage'>,
      originalName: draft.originalName,
      displayName: draft.displayName,
      mimeType: draft.mimeType,
      sizeBytes: draft.sizeBytes,
    });
  }

  return results;
}

// ─── Route Entry ──────────────────────────────────────────────────────────────

export default function NewEventScreen(): React.JSX.Element {
  const {
    communityId,
    selectedDate: selectedDateParam,
    date: dateParam,
  } = useLocalSearchParams<{
    communityId?: string;
    selectedDate?: string;
    date?: string;
  }>();
  // FIXED: added generateUploadUrl + upload loop before createEvent for file attachments
  const createEvent = useMutation(api.events.create);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);
  // FIXED: persist personal event checklist tasks created in EventScreen
  const createEventTasks = useMutation(api.eventTasks.createBatch);
  const setTaskAssignee = useMutation(api.eventTasks.setAssignee);
  const toggleEventTaskCompleted = useMutation(api.eventTasks.toggleCompleted);
  const spaceId = useQuery(api.users.getMySpace);

  // Resolve initial date: prefer legacy numeric selectedDate, then YYYY-MM-DD date param.
  // Build local midnight timestamp to avoid UTC-offset day shift.
  const selectedDate = useMemo((): number | undefined => {
    if (selectedDateParam) return Number(selectedDateParam);
    if (dateParam) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]) - 1;
        const d = Number(match[3]);
        const dt = new Date(y, m, d);
        if (!Number.isNaN(dt.getTime())) return dt.getTime();
      }
    }
    return undefined;
  }, [selectedDateParam, dateParam]);

  const handlePersonalSave = useCallback(
    async (data: EventData): Promise<string> => {
      // Block save if spaceId hasn't resolved — an event without spaceId
      // is invisible to listByDateRange and will never appear in the calendar.
      if (spaceId === undefined) {
        throw new Error('טוען נתונים, נסה שוב.');
      }
      if (spaceId === null) {
        throw new Error('לא נמצא מרחב אישי. נסה לצאת ולהיכנס מחדש.');
      }
      const resolvedSpaceId = spaceId as Id<'spaces'>;

      const baseDate = new Date(data.date);

      let startMs: number;
      if (data.startTime) {
        const [hStr, mStr] = data.startTime.split(':');
        const d = new Date(baseDate);
        d.setHours(Number(hStr ?? '9'), Number(mStr ?? '0'), 0, 0);
        startMs = d.getTime();
      } else {
        startMs = data.date;
      }

      let endMs: number;
      if (data.endTime) {
        const [hStr, mStr] = data.endTime.split(':');
        // Use endDate if provided (handles cross-midnight correctly),
        // fall back to startDate for events that finish on the same day.
        const endBase =
          data.endDate != null ? new Date(data.endDate) : baseDate;
        const d = new Date(
          endBase.getFullYear(),
          endBase.getMonth(),
          endBase.getDate()
        );
        d.setHours(Number(hStr ?? '10'), Number(mStr ?? '0'), 0, 0);
        endMs = d.getTime();
      } else {
        endMs = startMs + 60 * 60 * 1000; // default +1 hour
      }

      // Upload any new draft attachments (localUri set, storageId not yet set)
      const resolvedAttachments = await uploadDraftAttachments(
        data.attachments ?? [],
        generateUploadUrl
      );

      // FIXED: family sharing saved to event on creation
      // Let any Convex errors propagate — EventScreen.handleSave catches them
      // FIXED: return eventId so EventScreen can show the post-save success/share sheet
      const newEventId = await createEvent({
        title: data.title,
        description: data.notes?.trim() || undefined,
        startTime: startMs,
        endTime: endMs,
        allDay: data.isAllDay || undefined,
        isRecurring: data.recurrence !== 'none' || undefined,
        recurringPattern:
          data.recurrence !== 'none' ? data.recurrence : undefined,
        spaceId: resolvedSpaceId,
        location: data.location?.trim() || undefined,
        onlineUrl: data.onlineUrl?.trim() || undefined,
        locationUrl: data.locationUrl || undefined,
        tasksVisibleToParticipants: data.tasksVisibleToParticipants,
        participants:
          data.participants.length > 0
            ? data.participants
                .map((participant) => participant.name.trim())
                .filter((name) => name.length > 0)
            : undefined,
        allFamily: data.allFamily || undefined,
        sharedWithFamilyMemberIds:
          data.sharedWithFamilyMemberIds &&
          data.sharedWithFamilyMemberIds.length > 0
            ? data.sharedWithFamilyMemberIds
            : undefined,
        attachments:
          resolvedAttachments.length > 0 ? resolvedAttachments : undefined,
        reminders: data.remindersEnabled
          ? data.reminders.map((r) => r.offsetMinutes)
          : [],
      });

      const tasksToCreate = data.tasks.filter(
        (task) => task.title.trim().length > 0
      );
      if (tasksToCreate.length > 0) {
        const taskIds = await createEventTasks({
          eventId: newEventId as Id<'events'>,
          tasks: tasksToCreate.map((task) => ({ title: task.title.trim() })),
        });

        for (let i = 0; i < tasksToCreate.length; i++) {
          const task = tasksToCreate[i];
          const taskId = taskIds[i];
          if (!taskId) continue;

          const assignedParticipantId =
            task.assignedParticipantIds?.[0] ?? task.assigneeId;
          const assignedParticipant = assignedParticipantId
            ? data.participants.find((p) => p.id === assignedParticipantId)
            : undefined;
          const assignedName =
            assignedParticipant?.name.trim() || task.assignee?.name.trim();

          if (assignedName) {
            await setTaskAssignee({
              id: taskId as Id<'eventTasks'>,
              assignee: { type: 'manual', name: assignedName },
            }).catch(() => {});
          }

          if (task.completed) {
            await toggleEventTaskCompleted({
              id: taskId as Id<'eventTasks'>,
            }).catch(() => {});
          }
        }
      }
      return newEventId;
    },
    [
      createEvent,
      createEventTasks,
      generateUploadUrl,
      setTaskAssignee,
      spaceId,
      toggleEventTaskCompleted,
    ]
  );

  if (communityId) {
    return <CommunityEventForm communityId={communityId} />;
  }

  return (
    <EventScreen
      key={selectedDate != null ? String(selectedDate) : 'default'}
      mode="create"
      onSave={handlePersonalSave}
      selectedDate={selectedDate}
    />
  );
}
