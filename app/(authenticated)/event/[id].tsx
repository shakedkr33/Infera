import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationPickerModal } from '@/components/NavigationPickerModal';
import { RsvpBlockedByTaskDialog } from '@/components/RsvpBlockedByTaskDialog';
import { UpgradeModal } from '@/components/UpgradeModal';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import type { LocalAssignee } from '@/lib/components/event/TaskAssigneeSheet';
import { TaskAssigneeSheet } from '@/lib/components/event/TaskAssigneeSheet';
import { canManageEventReminderItem } from '@/lib/eventReminderPermissions';
import { isOpenCommunityCalendarActionVisible } from '@/lib/openCommunityCalendarUi';
import { getConvexErrorCode } from '@/lib/utils/convexError';
import { parseGeoUri } from '@/lib/utils/geoUri';

const HEB_TEXT_ALIGN = 'left';
const HEB_ROW = 'row';
const HEB_FLEX_END = 'flex-start';
const HEB_WRITING_DIRECTION: undefined = undefined;

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';
const IMPORTANT_ITEMS_SECTION_TITLE = 'חשוב לזכור';
const IMPORTANT_ITEMS_COPY_DEFAULT = 'הוסף למשימות שלי';
const IMPORTANT_ITEMS_COPY_SUCCESS = 'נוסף למשימות שלך ✓';

// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'yes' | 'no' | 'maybe' | 'none';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) return '';
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)}KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatRecurrenceLabel(pattern: string | undefined): string {
  if (pattern === 'daily') return 'כל יום';
  if (pattern === 'weekly') return 'כל שבוע';
  if (pattern === 'monthly') return 'כל חודש';
  if (pattern === 'yearly') return 'כל שנה';
  if (pattern === 'custom') return 'מותאם אישית';
  return 'ללא';
}

function formatReminderLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'תזכורת: בזמן האירוע';
  if (offsetMinutes === 60) return 'תזכורת: שעה לפני האירוע';
  if (offsetMinutes === 1440) return 'תזכורת: יום לפני האירוע';
  if (offsetMinutes % 1440 === 0) {
    return `תזכורת: ${offsetMinutes / 1440} ימים לפני האירוע`;
  }
  if (offsetMinutes % 60 === 0) {
    return `תזכורת: ${offsetMinutes / 60} שעות לפני האירוע`;
  }
  return `תזכורת: ${offsetMinutes} דקות לפני האירוע`;
}

function getReminderLabels(eventLike: unknown): string[] {
  const reminders = (eventLike as { reminders?: unknown }).reminders;
  if (!Array.isArray(reminders) || reminders.length === 0) return [];
  return reminders
    .filter((r): r is number => typeof r === 'number')
    .map(formatReminderLabel);
}

function uniqueById<T>(items: readonly T[], getId: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const id = getId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
  }
  return unique;
}

// ─── RSVP Options (module-level to avoid recreating in render) ────────────────

const RSVP_OPTIONS = [
  {
    status: 'yes' as const,
    label: 'כן',
    selectedBg: '#dcfce7',
    selectedBorder: '#16a34a',
    selectedText: '#14532d',
  },
  {
    status: 'maybe' as const,
    label: 'אולי',
    selectedBg: '#fef3c7',
    selectedBorder: '#d97706',
    selectedText: '#92400e',
  },
  {
    status: 'no' as const,
    label: 'לא',
    selectedBg: '#fee2e2',
    selectedBorder: '#dc2626',
    selectedText: '#991b1b',
  },
];

// ─── Overflow Menu ────────────────────────────────────────────────────────────

interface OverflowItem {
  label: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  danger?: boolean;
}

interface OverflowMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  items: OverflowItem[];
  onClose: () => void;
}

function OverflowMenu({
  visible,
  position,
  items,
  onClose,
}: OverflowMenuProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.popoverBackdrop} onPress={onClose} />
      <View style={[styles.popover, { top: position.y, left: position.x }]}>
        {items.map((m, idx) => (
          <Pressable
            key={m.label}
            style={[
              styles.popoverItem,
              idx < items.length - 1 && styles.popoverBorder,
            ]}
            onPress={() => {
              onClose();
              m.onPress();
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={m.label}
          >
            <Text
              style={[styles.popoverLabel, m.danger && styles.popoverDanger]}
            >
              {m.label}
            </Text>
            <Ionicons
              name={m.iconName}
              size={18}
              color={m.danger ? '#ef4444' : '#374151'}
            />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

// FIXED: guard against non-Convex route params (e.g. mock item ids like "1", "2")
// Convex IDs are base62-encoded strings; a length < 8 is never a valid Id<'events'>.
function isValidConvexId(value: string | undefined): boolean {
  return typeof value === 'string' && value.length >= 8;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Guard: only cast to Id<'events'> when the param looks like a real Convex ID.
  // If the guard fails we skip all queries (pass 'skip') and show the not-found state.
  const eventId = isValidConvexId(id) ? (id as Id<'events'>) : null;

  const event = useQuery(api.events.getById, eventId ? { eventId } : 'skip');
  const rsvps = useQuery(
    api.eventRsvps.listByEvent,
    eventId ? { eventId } : 'skip'
  );
  const myAssignedEventTasksState = useQuery(
    api.eventRsvps.hasMyAssignedEventTasksForEvent,
    eventId ? { eventId } : 'skip'
  );
  const eventTasks = useQuery(
    api.eventTasks.listByEvent,
    eventId ? { eventId } : 'skip'
  );
  const eventImportantItems = useQuery(
    api.tasks.listEventImportantItems,
    eventId ? { eventId } : 'skip'
  );
  const importantItemsCopyState = useQuery(
    api.tasks.hasUserCopiedAllImportantItemsFromEvent,
    eventId ? { eventId } : 'skip'
  );
  const currentUserId = useQuery(api.users.getMyId) ?? undefined;

  const upsertRsvp = useMutation(api.eventRsvps.upsertRsvp);
  const setRsvpNoAndUnclaimMyEventTasks = useMutation(
    api.eventRsvps.setRsvpNoAndUnclaimMyEventTasks
  );
  const addCommunityEventToMyCalendar = useMutation(
    api.communityEventCalendar.addCommunityEventToMyCalendar
  );
  const cancelEventMutation = useMutation(api.events.cancelEvent);
  const removeEventTask = useMutation(api.eventTasks.remove);
  const setTaskAssignee = useMutation(api.eventTasks.setAssignee);
  const updateEventTaskVisibility = useMutation(
    api.eventTasks.updateEventTaskVisibility
  );
  const claimEventTask = useMutation(api.eventTasks.claimEventTask);
  const unclaimEventTask = useMutation(api.eventTasks.unclaimEventTask);
  const addEventImportantItemsToMyTasks = useMutation(
    api.tasks.addEventImportantItemsToMyTasks
  );
  const updateEventMutation = useMutation(api.events.update);
  // FIXED: link-based sharing for personal events (no communityId)
  const createShareLinkMutation = useMutation(api.shareLinks.createShareLink);

  const showRsvpNoBlockedDialog = useCallback(
    (count: number): void => {
      if (!eventId) return;
      setBlockedRsvpTaskCount(count);
    },
    [eventId]
  );

  const communityMembersData = useQuery(
    api.communities.getCommunityMembers,
    event?.communityId ? { communityId: event.communityId } : 'skip'
  );
  /**
   * Part D1 — computed here (rather than in the derived-state block below)
   * so `overflowItems` (a hook, evaluated before the `event === null` early
   * return) can safely reference it — reused below as the single source for
   * both `canManageCommunityEvent` and "שכפל אירוע"'s gating.
   */
  const isCommunityOwnerOrAdminEarly =
    communityMembersData?.members?.find((m) => m.userId === currentUserId)
      ?.role === 'owner' ||
    communityMembersData?.members?.find((m) => m.userId === currentUserId)
      ?.role === 'admin';

  const communityRecord = useQuery(
    api.communities.getById,
    event?.communityId ? { communityId: event.communityId } : 'skip'
  );

  const [assigneeSheetTaskId, setAssigneeSheetTaskId] = useState<string | null>(
    null
  );
  const [manualAssigneeName, setManualAssigneeName] = useState('');

  const [navPickerLocation, setNavPickerLocation] = useState<string | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 8, y: 80 });
  const menuBtnRef = useRef<View>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCopyingImportantItems, setIsCopyingImportantItems] = useState(false);
  const [blockedRsvpTaskCount, setBlockedRsvpTaskCount] = useState<
    number | null
  >(null);
  const [importantItemsCopyError, setImportantItemsCopyError] = useState<
    string | null
  >(null);
  const { isExpiredFree } = useEffectiveAccess();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  const handleMenuPress = useCallback(() => {
    if (!menuBtnRef.current) {
      setMenuPos({ x: 8, y: 80 });
      setMenuOpen(true);
      return;
    }
    menuBtnRef.current.measureInWindow((x, y, _w, h) => {
      // Popover anchored to left; ensure it doesn't overflow left edge (x >= 0)
      const popoverX = Math.max(0, x);
      setMenuPos({ x: popoverX, y: y + h + 4 });
      setMenuOpen(true);
    });
  }, []);

  const handleRsvp = useCallback(
    (status: RsvpStatus) => {
      if (!eventId) return;
      const localAssignedCount = (eventTasks ?? []).filter(
        (task) => task.assignedToUserId === currentUserId
      ).length;
      const assignedCount =
        myAssignedEventTasksState?.count ?? localAssignedCount;
      if (status === 'no' && assignedCount > 0) {
        showRsvpNoBlockedDialog(assignedCount);
        return;
      }
      upsertRsvp({ eventId, status }).catch((error) => {
        if (
          status === 'no' &&
          getConvexErrorCode(error) === 'RSVP_NO_BLOCKED_BY_ACTIVE_TASK'
        ) {
          showRsvpNoBlockedDialog(assignedCount > 0 ? assignedCount : 1);
          return;
        }
        Alert.alert('שגיאה', 'לא ניתן לשמור תגובה');
      });
    },
    [
      currentUserId,
      eventId,
      eventTasks,
      myAssignedEventTasksState,
      showRsvpNoBlockedDialog,
      upsertRsvp,
    ]
  );

  const handleAddToCalendar = useCallback(() => {
    if (!eventId || !event) return;
    if (event.isSavedToMyCalendar === true) return;
    addCommunityEventToMyCalendar({ eventId }).catch(() =>
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף ליומן. נסי שוב בעוד רגע.')
    );
  }, [event, eventId, addCommunityEventToMyCalendar]);

  const handleCopyImportantItems = useCallback(async () => {
    if (!eventId || isCopyingImportantItems) return;
    setIsCopyingImportantItems(true);
    setImportantItemsCopyError(null);
    try {
      await addEventImportantItemsToMyTasks({ eventId });
    } catch {
      setImportantItemsCopyError('לא ניתן להוסיף למשימות כרגע');
    } finally {
      setIsCopyingImportantItems(false);
    }
  }, [eventId, isCopyingImportantItems, addEventImportantItemsToMyTasks]);

  /**
   * PART B/J — Event Details is the canonical management surface for event
   * important-items: an authorized manager (creator OR active community
   * owner/admin) may remove one item at a time, for BOTH future and PAST
   * events. This DELETEs shared event content — never to be confused with
   * completing the user's own personal task copy.
   */
  const handleDeleteImportantItem = useCallback(
    async (itemId: string) => {
      if (!eventId) return;
      const currentItems = eventImportantItems ?? event?.importantItems ?? [];
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      try {
        await updateEventMutation({
          id: eventId,
          importantItems: nextItems,
        });
      } catch {
        Alert.alert('שגיאה', 'לא ניתן למחוק את הפריט כרגע');
      }
    },
    [eventId, eventImportantItems, event?.importantItems, updateEventMutation]
  );

  const handleCancelEvent = useCallback(async () => {
    if (!event || !eventId) return;
    setShowCancelDialog(false);
    try {
      await cancelEventMutation({
        eventId,
        cancelReason: cancelReason.trim() || undefined,
      });
      setCancelReason('');
      if (event.communityId) {
        router.replace({
          pathname: '/(authenticated)/community/[id]',
          params: { id: event.communityId },
        });
      } else {
        router.replace(
          '/(authenticated)/communities' as Parameters<typeof router.replace>[0]
        );
      }
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לבטל את האירוע');
    }
  }, [event, eventId, cancelEventMutation, cancelReason, router]);

  // FIXED: always embed URL inside message — never use the separate `url` field.
  // Passing `url` as a second Share.share argument causes iOS UIActivityViewController
  // to treat it as an attachment object; WhatsApp then shows only the URL card and
  // silently drops the message text. Embedding the https:// link directly inside
  // `message` is reliable on both iOS and Android: messaging apps auto-linkify it.
  const handleShare = useCallback(() => {
    if (!event) return;
    const isPersonalEvent = !event.communityId;

    const doShare = async () => {
      // Build the human-readable text block (title + date + location)
      const lines: string[] = [event.title];
      let dateLine = formatFullDate(event.startTime);
      if (!event.allDay) dateLine += ` · ${formatTime(event.startTime)}`;
      lines.push(dateLine);
      if (event.location) lines.push(`📍 ${event.location}`);
      const shareText = lines.join('\n');

      if (isPersonalEvent && eventId) {
        try {
          const { token } = await createShareLinkMutation({ eventId });

          // FIXED: clickable HTTPS share link
          const shareUrl = `https://inyomi.com/shared/${token}`;
          const finalMessage = `${shareText}\n\n${shareUrl}`;
          await Share.share({ message: finalMessage });
          return;
        } catch {
          // Fall back to text-only share if link generation fails
        }
      }

      // Community events or fallback: text-only share
      try {
        await Share.share({ message: shareText });
      } catch (e) {
        console.error('Share failed:', e);
      }
    };

    // Delay so ⋯ menu modal has fully dismissed before system Share sheet opens
    setTimeout(() => {
      doShare();
    }, 300);
  }, [event, eventId, createShareLinkMutation]);

  const handleOpenNavigationChooser = useCallback(() => {
    const location = event?.location?.trim();
    const locationUrl = (event as { locationUrl?: string } | null | undefined)
      ?.locationUrl;
    if (!location || !parseGeoUri(locationUrl)) return;
    setNavPickerLocation(location);
  }, [event]);

  const navPickerLocationUrl =
    (event as { locationUrl?: string } | null | undefined)?.locationUrl ?? null;
  const hasNavigableLocation = parseGeoUri(navPickerLocationUrl) !== null;

  const handleGatedAction = useCallback(
    (action: () => void): void => {
      if (isExpiredFree && !event?.communityId) {
        setUpgradeModalVisible(true);
        return;
      }
      action();
    },
    [isExpiredFree, event?.communityId]
  );

  const overflowItems = useMemo<OverflowItem[]>(() => {
    const items: OverflowItem[] = [
      {
        label: 'עריכת אירוע',
        iconName: 'create-outline',
        onPress: () =>
          handleGatedAction(() => {
            router.push({
              pathname: '/(authenticated)/event-edit/[id]',
              params: {
                id: eventId as string,
                ...(event?.communityId
                  ? { returnCommunityId: event.communityId as string }
                  : {}),
              },
            });
          }),
      },
      {
        label: 'שיתוף אירוע',
        iconName: 'share-outline',
        onPress: handleShare,
      },
    ];
    // Part D1/D2B — owner/admin only, same permission source as
    // canCreateCommunityContent (resolveActiveCommunityContext.ts).
    if (event?.communityId && isCommunityOwnerOrAdminEarly) {
      items.push({
        label: 'שכפל אירוע',
        iconName: 'copy-outline',
        onPress: () =>
          handleGatedAction(() => {
            router.push({
              pathname: '/(authenticated)/event/new',
              params: {
                communityId: event.communityId as string,
                duplicateFromEventId: eventId as string,
              },
            });
          }),
      });
    }
    if (event?.status !== 'cancelled') {
      items.push({
        label: 'בטל אירוע',
        iconName: 'close-circle-outline',
        danger: true,
        onPress: () => setShowCancelDialog(true),
      });
    }
    return items;
  }, [
    handleGatedAction,
    handleShare,
    event?.communityId,
    event?.status,
    eventId,
    router,
    isCommunityOwnerOrAdminEarly,
  ]);

  // ── Invalid route param (e.g. mock item ids like "1", "2")
  if (!eventId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
          <Text style={styles.notFoundText}>אירוע לא נמצא</Text>
          <TouchableOpacity
            style={styles.errorBackBtn}
            onPress={() =>
              router.replace(
                '/(authenticated)' as Parameters<typeof router.replace>[0]
              )
            }
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <Text style={styles.errorBackBtnText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading
  if (event === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Not found
  if (event === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
          <Text style={styles.notFoundText}>אירוע לא נמצא</Text>
          <TouchableOpacity
            style={styles.errorBackBtn}
            onPress={() =>
              router.replace(
                '/(authenticated)/communities' as Parameters<
                  typeof router.replace
                >[0]
              )
            }
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <Text style={styles.errorBackBtnText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived state (event is non-null from here)
  const isCreator =
    currentUserId !== undefined && event.createdBy === currentUserId;
  const myRsvp = rsvps?.find((r) => r.userId === currentUserId);
  const currentStatus: RsvpStatus = (myRsvp?.status as RsvpStatus) ?? 'none';
  const members = communityMembersData?.members ?? [];
  const myCommunityMembership = members.find((m) => m.userId === currentUserId);
  const isCommunityOwnerOrAdmin = isCommunityOwnerOrAdminEarly;
  const canManageCommunityEvent =
    Boolean(event.communityId) && (isCreator || isCommunityOwnerOrAdmin);
  // PART B/J — same authorization rule enforced server-side in
  // events.update; works identically for future AND past events (no
  // time-based gate). Reused from the community "תזכורות" tab's per-item
  // delete authorization so there is a single source of truth.
  const canManageImportantItems = canManageEventReminderItem({
    currentUserId,
    eventCreatedBy: event.createdBy ?? '',
    myRole: myCommunityMembership?.role,
  });
  /**
   * QA FIX (Issue 3) — CANONICAL CREATOR RSVP RULE: only the event's actual
   * creator is exempt from RSVP. A non-creator owner/admin must still go
   * through the normal RSVP flow — see EventDetailsBottomSheet.tsx and
   * convex/communityCalendarState.ts's computeRsvpAttentionState for the
   * matching fix.
   */
  const skipCommunityRsvpPrompt = isCreator;
  const canOpenEventOverflowMenu = event.communityId
    ? canManageCommunityEvent
    : isCreator;
  const canManageTasks = isCreator || isCommunityOwnerOrAdmin;
  const participantsCanSeeTasks = event.tasksVisibleToParticipants === true;
  const canRegularMemberSeeTasks = Boolean(
    event.communityId && myCommunityMembership && participantsCanSeeTasks
  );
  // The server already filters tasks per the visibility contract.
  // Show the section to managers always, and to members when they have visible tasks.
  const canSeeTasksSection = event.communityId
    ? canManageTasks ||
      canRegularMemberSeeTasks ||
      (eventTasks !== undefined && eventTasks.length > 0)
    : isCreator;
  const eventTasksForDisplay = uniqueById(
    eventTasks ?? [],
    (task) => task._id as string
  );

  const assignedCount = eventTasksForDisplay.filter(
    (t) => !!t.assignedToUserId || !!t.assignedToManual?.trim()
  ).length;

  const yesCount = rsvps?.filter((r) => r.status === 'yes').length ?? 0;
  const maybeCount = rsvps?.filter((r) => r.status === 'maybe').length ?? 0;
  const noCount = rsvps?.filter((r) => r.status === 'no').length ?? 0;
  const participantNames = (event.participants ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const hasParticipants = participantNames.length > 0;
  const recurrenceLabel =
    event.isRecurring === true
      ? formatRecurrenceLabel(event.recurringPattern)
      : 'ללא';
  const reminderLabels = getReminderLabels(event);
  const importantItems = eventImportantItems ?? event.importantItems ?? [];
  const hasImportantItems = importantItems.length > 0;
  const importantItemsCopyLoading = importantItemsCopyState === undefined;
  const allImportantItemsCopied =
    importantItemsCopyState?.allCopied === true && hasImportantItems;
  const importantItemsButtonDisabled =
    importantItemsCopyLoading ||
    isCopyingImportantItems ||
    allImportantItemsCopied;
  const importantItemsButtonLabel = allImportantItemsCopied
    ? IMPORTANT_ITEMS_COPY_SUCCESS
    : IMPORTANT_ITEMS_COPY_DEFAULT;
  const eventRequiresRsvp = event.requiresRsvp === true;

  const openCommunityCalendarInfoReady =
    !event.communityId ||
    (communityRecord !== undefined && communityMembersData !== undefined);

  const viewerIsActiveCommunityMemberForCalendar =
    communityMembersData !== undefined && communityMembersData !== null;

  const showOpenCommunityCalendarAction =
    openCommunityCalendarInfoReady &&
    isOpenCommunityCalendarActionVisible({
      event: {
        communityId: event.communityId ?? null,
        requiresRsvp: event.requiresRsvp,
        status: event.status,
      },
      hasValidConvexEventId: true,
      communityArchived: communityRecord?.archived === true,
      viewerIsActiveMember: viewerIsActiveCommunityMemberForCalendar,
    });

  // Local variable to satisfy TypeScript in closures (event.onlineUrl may be undefined)
  const onlineUrl = event.onlineUrl;

  // ── Assignee sheet: derive current assignee from the task being managed
  const _assigneeSheetTask = assigneeSheetTaskId
    ? (eventTasksForDisplay.find((t) => t._id === assigneeSheetTaskId) ?? null)
    : null;
  const currentAssigneeForSheet: LocalAssignee | null =
    _assigneeSheetTask?.assignedToUserId
      ? {
          type: 'user',
          userId: _assigneeSheetTask.assignedToUserId,
          display:
            (_assigneeSheetTask as { assigneeDisplay?: string })
              .assigneeDisplay ?? '',
        }
      : _assigneeSheetTask?.assignedToManual?.trim()
        ? { type: 'manual', name: _assigneeSheetTask.assignedToManual.trim() }
        : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header (RTL): right=back, center=title, left=⋯ */}
      <View style={[styles.header, styles.headerRtl]}>
        {/* First child → right in RTL: back button */}
        <TouchableOpacity
          onPress={() => {
            if (event?.communityId) {
              router.replace({
                pathname: '/(authenticated)/community/[id]',
                params: { id: event.communityId },
              });
            } else {
              router.replace(
                '/(authenticated)/communities' as Parameters<
                  typeof router.replace
                >[0]
              );
            }
          }}
          style={styles.headerIconBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חזור"
        >
          <Ionicons name="chevron-forward" size={22} color="#374151" />
        </TouchableOpacity>

        {/* Center: title */}
        <Text style={styles.headerTitle} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Last child → left in RTL: ⋯ for creator */}
        <View ref={menuBtnRef} style={styles.headerIconBtn}>
          {canOpenEventOverflowMenu && (
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.headerIconBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="אפשרויות"
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Body */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cancelled banner */}
        {event.status === 'cancelled' ? (
          <View style={styles.cancelledBanner}>
            <View style={styles.cancelledBannerRow}>
              <Ionicons name="close-circle" size={18} color="#dc2626" />
              <Text style={styles.cancelledBannerTitle}>אירוע זה בוטל</Text>
            </View>
            {event.cancelReason ? (
              <Text style={styles.cancelledBannerReason}>
                {`סיבת הביטול: ${event.cancelReason}`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Section 1: פרטי האירוע */}
        <View style={styles.card}>
          {/* Date */}
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
            <Text style={styles.detailText}>
              {formatFullDate(event.startTime)}
            </Text>
          </View>

          {/* Time */}
          {event.allDay ? (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={18} color={PRIMARY} />
              <Text style={styles.detailText}>כל היום</Text>
            </View>
          ) : (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={18} color={PRIMARY} />
              <Text style={styles.detailText}>
                {`${formatTime(event.startTime)} — ${formatTime(event.endTime)}`}
              </Text>
            </View>
          )}

          {/* Location — address text */}
          {event.location ? (
            <View style={styles.locationDetailRow}>
              <View style={styles.locationTextPressable}>
                <Ionicons name="location-outline" size={18} color={PRIMARY} />
                <Text style={styles.linkText}>{event.location}</Text>
              </View>
              {hasNavigableLocation ? (
                <TouchableOpacity
                  style={styles.navigateInlineBtn}
                  onPress={handleOpenNavigationChooser}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="נווט למיקום האירוע"
                >
                  <Ionicons name="navigate-outline" size={14} color="#8d6e63" />
                  <Text style={styles.navigateInlineBtnText}>נווט</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Online URL — meeting/video link */}
          {onlineUrl ? (
            <View style={styles.detailRow}>
              <Ionicons name="videocam-outline" size={18} color={PRIMARY} />
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(onlineUrl).catch(() => {});
                }}
                accessible
                accessibilityRole="link"
                accessibilityLabel="הצטרפות לפגישה"
              >
                <Text style={styles.linkText}>הצטרפות לפגישה</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Description as notes/details */}
          {event.description ? (
            <>
              <View style={styles.separator} />
              <Text style={styles.descriptionLabel}>הערות</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </>
          ) : null}
        </View>

        {/* ── Scheduling */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>תזמון</Text>
          <View style={styles.scheduleRow}>
            <Ionicons name="repeat-outline" size={18} color={PRIMARY} />
            <Text style={styles.scheduleText}>
              {`אירוע חוזר: ${recurrenceLabel}`}
            </Text>
          </View>
          {reminderLabels.length > 0 ? (
            <View style={styles.reminderRows}>
              {reminderLabels.map((label) => (
                <View key={label} style={styles.reminderDisplayRow}>
                  <Ionicons
                    name="notifications-outline"
                    size={16}
                    color={PRIMARY}
                  />
                  <Text style={styles.reminderDisplayText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Attachments */}
        {event.attachments && event.attachments.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>קבצים מצורפים</Text>
            <View style={styles.attachmentsList}>
              {event.attachments.map((attachment) => {
                const sizeLabel = formatFileSize(attachment.sizeBytes);
                return (
                  <View key={attachment.storageId} style={styles.attachmentRow}>
                    <Ionicons
                      name={
                        attachment.mimeType.startsWith('image/')
                          ? 'image-outline'
                          : 'document-outline'
                      }
                      size={20}
                      color={PRIMARY}
                    />
                    <View style={styles.attachmentContent}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.displayName || attachment.originalName}
                      </Text>
                      <Text style={styles.attachmentMeta} numberOfLines={1}>
                        {[attachment.mimeType, sizeLabel]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {hasImportantItems ? (
          <View style={styles.card}>
            <View style={styles.importantItemsHeaderChip}>
              <Text style={styles.importantItemsHeaderChipText}>
                {`📌 ${IMPORTANT_ITEMS_SECTION_TITLE} · ${importantItems.length}`}
              </Text>
            </View>
            <View style={styles.importantItemsList}>
              {importantItems.map((item) => (
                <View key={item.id} style={styles.importantItemRow}>
                  <Text style={styles.importantItemBullet}>•</Text>
                  <Text style={styles.importantItemText}>{item.title}</Text>
                  {canManageImportantItems ? (
                    <Pressable
                      accessibilityLabel={`מחק פריט: ${item.title}`}
                      accessibilityRole="button"
                      accessible={true}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDeleteImportantItem(item.id)}
                      style={styles.importantItemDeleteBtn}
                    >
                      <Ionicons color="#94a3b8" name="close" size={16} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Pressable
              accessibilityLabel={importantItemsButtonLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: importantItemsButtonDisabled }}
              accessible={true}
              disabled={importantItemsButtonDisabled}
              onPress={handleCopyImportantItems}
              style={({ pressed }) => [
                allImportantItemsCopied
                  ? styles.importantItemsCopiedBtn
                  : styles.importantItemsCopyBtn,
                pressed && !importantItemsButtonDisabled
                  ? styles.importantItemsCopyBtnPressed
                  : null,
                importantItemsButtonDisabled && !allImportantItemsCopied
                  ? styles.importantItemsCopyBtnDisabled
                  : null,
              ]}
            >
              <Text
                style={
                  allImportantItemsCopied
                    ? styles.importantItemsCopiedBtnText
                    : styles.importantItemsCopyBtnText
                }
              >
                {importantItemsButtonLabel}
              </Text>
            </Pressable>
            {importantItemsCopyError ? (
              <Text style={styles.importantItemsCopyError}>
                {importantItemsCopyError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Section 2: RSVP / passive state */}
        {!skipCommunityRsvpPrompt && eventRequiresRsvp ? (
          <View
            style={[
              styles.card,
              styles.rsvpCardElevated,
              event.status === 'cancelled' && styles.rsvpDisabled,
            ]}
          >
            <Text style={styles.rsvpTitle}>האם תשתתף?</Text>
            <View style={styles.rsvpRow}>
              {RSVP_OPTIONS.map((opt) => {
                const isActive = currentStatus === opt.status;
                const rsvpDisabled = event.status === 'cancelled';
                return (
                  <TouchableOpacity
                    key={opt.status}
                    activeOpacity={0.82}
                    disabled={rsvpDisabled}
                    hitSlop={{
                      top: 8,
                      bottom: 8,
                      left: 6,
                      right: 6,
                    }}
                    style={[
                      styles.rsvpBtn,
                      {
                        backgroundColor: isActive ? opt.selectedBg : '#f8fafc',
                        borderColor: isActive ? opt.selectedBorder : '#64748b',
                        opacity: rsvpDisabled ? 0.45 : 1,
                      },
                      isActive && styles.rsvpBtnSelected,
                    ]}
                    onPress={() => handleRsvp(opt.status)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    accessibilityState={{
                      selected: isActive,
                      disabled: rsvpDisabled,
                    }}
                  >
                    <Text
                      style={[
                        styles.rsvpBtnText,
                        isActive && {
                          color: opt.selectedText,
                          fontWeight: '800',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {showOpenCommunityCalendarAction ? (
          <View style={styles.card}>
            <View style={styles.passiveRow}>
              <Ionicons name="people-outline" size={18} color="#94a3b8" />
              <Text style={styles.passiveText}>פתוח לחברי הקהילה</Text>
            </View>
            <Pressable
              accessibilityHint="מוסיף או מסיר את האירוע מהיומן האישי שלך"
              accessibilityLabel={
                event.isSavedToMyCalendar === true ? 'נוסף ליומן' : 'הוסף ליומן'
              }
              accessibilityRole="button"
              accessibilityState={{
                disabled: event.isSavedToMyCalendar === true,
              }}
              accessible={true}
              disabled={event.isSavedToMyCalendar === true}
              onPress={handleAddToCalendar}
              style={({ pressed }) => [
                event.isSavedToMyCalendar === true
                  ? styles.openCalendarBtnSecondary
                  : styles.openCalendarBtn,
                pressed &&
                  event.isSavedToMyCalendar !== true &&
                  styles.openCalendarBtnPressed,
              ]}
            >
              <Text
                style={
                  event.isSavedToMyCalendar === true
                    ? styles.openCalendarBtnTextSecondary
                    : styles.openCalendarBtnText
                }
              >
                {event.isSavedToMyCalendar === true
                  ? 'נוסף ליומן'
                  : 'הוסף ליומן'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Section 3: משימות לאירוע */}
        {eventTasks !== undefined && canSeeTasksSection && (
          <View style={styles.card}>
            {/* Header: title + assignment summary */}
            <View style={styles.taskSectionHeader}>
              <Text style={styles.taskSectionTitle}>משימות לאירוע</Text>
              {eventTasksForDisplay.length > 0 ? (
                <Text
                  style={[
                    styles.taskSummary,
                    assignedCount === eventTasksForDisplay.length
                      ? styles.taskSummaryAllDone
                      : null,
                  ]}
                >
                  {`${assignedCount}/${eventTasksForDisplay.length} הוקצו`}
                </Text>
              ) : null}
            </View>

            {canManageTasks ? (
              <View style={styles.taskVisibilitySection}>
                <View style={styles.taskVisibilityTextBlock}>
                  <Text style={styles.taskVisibilityTitle}>
                    משימות גלויות למשתתפים
                  </Text>
                  <Text style={styles.taskVisibilityHelper}>
                    {participantsCanSeeTasks
                      ? 'כל חברי הקהילה יראו את המשימות וההקצאות ויוכלו להשתבץ'
                      : 'כל משתתף יראה רק משימות שהוקצו אליו. מנהלי האירוע ימשיכו לראות את כולן'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.taskVisibilityToggleTouch}
                  onPress={() =>
                    handleGatedAction(() => {
                      updateEventTaskVisibility({
                        eventId,
                        tasksVisibleToParticipants: !participantsCanSeeTasks,
                      }).catch(() =>
                        Alert.alert('שגיאה', 'לא ניתן לעדכן נראות משימות')
                      );
                    })
                  }
                  accessible
                  accessibilityRole="switch"
                  accessibilityState={{ checked: participantsCanSeeTasks }}
                  accessibilityLabel="משימות גלויות למשתתפים"
                >
                  <View
                    style={[
                      styles.taskVisibilityToggleTrack,
                      participantsCanSeeTasks &&
                        styles.taskVisibilityToggleTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.taskVisibilityToggleThumb,
                        participantsCanSeeTasks &&
                          styles.taskVisibilityToggleThumbOn,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Manager-only visibility status explanation */}
            {canManageTasks ? (
              <View style={styles.managerVisibilityRow}>
                <Ionicons
                  name={
                    participantsCanSeeTasks
                      ? 'eye-outline'
                      : 'lock-closed-outline'
                  }
                  size={15}
                  color="#6B7280"
                />
                <View style={styles.managerVisibilityTextBlock}>
                  <Text style={styles.managerVisibilityTitle}>
                    {participantsCanSeeTasks
                      ? 'גלוי למשתתפים'
                      : 'גלוי לפי הקצאה'}
                  </Text>
                  <Text style={styles.managerVisibilityDesc}>
                    {participantsCanSeeTasks
                      ? 'כל חברי הקהילה יכולים לראות את המשימות וההקצאות.'
                      : 'כל משתתף רואה רק משימות שהוקצו אליו.'}
                  </Text>
                </View>
              </View>
            ) : null}

            {eventTasksForDisplay.length === 0 ? (
              <View style={styles.emptyParticipants}>
                <Ionicons name="list-outline" size={32} color="#d1d5db" />
                <Text style={styles.emptyParticipantsText}>
                  לא נוספו משימות לאירוע הזה
                </Text>
              </View>
            ) : (
              <View style={styles.tasksList}>
                {eventTasksForDisplay.map((task) => {
                  const assigneeDisplay = (
                    task as { assigneeDisplay?: string }
                  ).assigneeDisplay?.trim();
                  const isAssigned = Boolean(
                    assigneeDisplay ||
                      task.assignedToUserId ||
                      task.assignedToManual?.trim()
                  );
                  const isAssignedToCurrentUser =
                    task.assignedToUserId === currentUserId;
                  const assignmentLabel = !isAssigned
                    ? 'אני אקח'
                    : isAssignedToCurrentUser
                      ? 'הוקצה אליי'
                      : assigneeDisplay
                        ? `הוקצה ל־${assigneeDisplay}`
                        : 'הוקצה';
                  return (
                    <View key={task._id} style={styles.taskRow}>
                      {/* Actions — left side in RTL (manager only) */}
                      {canManageTasks && (
                        <View style={styles.taskActions}>
                          <TouchableOpacity
                            onPress={() =>
                              handleGatedAction(() => {
                                setAssigneeSheetTaskId(task._id);
                                setManualAssigneeName('');
                              })
                            }
                            style={styles.taskActionBtn}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel={
                              isAssigned ? 'שנה הקצאה' : 'הקצה משימה'
                            }
                          >
                            <Ionicons
                              name={
                                isAssigned ? 'person' : 'person-add-outline'
                              }
                              size={18}
                              color={isAssigned ? PRIMARY : '#9ca3af'}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleGatedAction(() => {
                                Alert.alert(
                                  'מחק משימה',
                                  'האם למחוק את המשימה?',
                                  [
                                    { text: 'ביטול', style: 'cancel' },
                                    {
                                      text: 'מחק',
                                      style: 'destructive',
                                      onPress: () =>
                                        removeEventTask({
                                          id: task._id,
                                        }).catch(() =>
                                          Alert.alert(
                                            'שגיאה',
                                            'לא ניתן למחוק משימה'
                                          )
                                        ),
                                    },
                                  ]
                                );
                              })
                            }
                            style={styles.taskActionBtn}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel="מחק משימה"
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color="#d1d5db"
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      <View style={styles.taskContent}>
                        <Text style={styles.taskTitle} numberOfLines={2}>
                          {task.title}
                        </Text>
                        {canManageTasks ? (
                          isAssigned ? (
                            <View style={styles.taskAssignmentStatusRow}>
                              <Text
                                style={
                                  isAssignedToCurrentUser
                                    ? styles.taskAssignedLabel
                                    : styles.taskAssignedOtherLabel
                                }
                                numberOfLines={1}
                              >
                                {assignmentLabel}
                              </Text>
                              {isAssignedToCurrentUser ? (
                                <TouchableOpacity
                                  hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                  }}
                                  onPress={() =>
                                    handleGatedAction(() => {
                                      unclaimEventTask({ id: task._id }).catch(
                                        () =>
                                          Alert.alert(
                                            'שגיאה',
                                            'לא ניתן להסיר הקצאה כרגע'
                                          )
                                      );
                                    })
                                  }
                                  style={styles.taskUnassignBtn}
                                  accessible
                                  accessibilityRole="button"
                                  accessibilityLabel="בטל הקצאה"
                                >
                                  <Text style={styles.taskUnassignBtnText}>
                                    בטל הקצאה
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : (
                            <TouchableOpacity
                              hitSlop={{
                                top: 8,
                                bottom: 8,
                                left: 8,
                                right: 8,
                              }}
                              style={styles.taskClaimBtn}
                              onPress={() =>
                                handleGatedAction(() => {
                                  claimEventTask({ id: task._id }).catch(() =>
                                    Alert.alert(
                                      'שגיאה',
                                      'לא ניתן להשתבץ למשימה כרגע'
                                    )
                                  );
                                })
                              }
                              accessible
                              accessibilityRole="button"
                              accessibilityLabel="אני אקח"
                            >
                              <Text style={styles.taskClaimBtnText}>
                                אני אקח
                              </Text>
                            </TouchableOpacity>
                          )
                        ) : isAssigned ? (
                          <View style={styles.taskAssignmentStatusRow}>
                            <Text
                              style={
                                isAssignedToCurrentUser
                                  ? styles.taskAssignedLabel
                                  : styles.taskAssignedOtherLabel
                              }
                              numberOfLines={1}
                            >
                              {assignmentLabel}
                            </Text>
                            {isAssignedToCurrentUser ? (
                              <TouchableOpacity
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                                onPress={() =>
                                  unclaimEventTask({ id: task._id }).catch(() =>
                                    Alert.alert(
                                      'שגיאה',
                                      'לא ניתן להסיר הקצאה כרגע'
                                    )
                                  )
                                }
                                style={styles.taskUnassignBtn}
                                accessible
                                accessibilityRole="button"
                                accessibilityLabel="בטל הקצאה"
                              >
                                <Text style={styles.taskUnassignBtnText}>
                                  בטל הקצאה
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : (
                          <TouchableOpacity
                            hitSlop={{
                              top: 8,
                              bottom: 8,
                              left: 8,
                              right: 8,
                            }}
                            style={styles.taskClaimBtn}
                            onPress={() =>
                              claimEventTask({ id: task._id }).catch(() =>
                                Alert.alert(
                                  'שגיאה',
                                  'לא ניתן להשתבץ למשימה כרגע'
                                )
                              )
                            }
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel="אני אקח"
                          >
                            <Text style={styles.taskClaimBtnText}>אני אקח</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Section 4: משתתפים */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>משתתפים</Text>
          <View style={styles.pillsRow}>
            <View style={[styles.pill, styles.pillYes]}>
              <Text
                style={[styles.pillText, styles.pillYesText]}
              >{`מגיעים (${yesCount})`}</Text>
            </View>
            <View style={[styles.pill, styles.pillMaybe]}>
              <Text
                style={[styles.pillText, styles.pillMaybeText]}
              >{`אולי (${maybeCount})`}</Text>
            </View>
            <View style={[styles.pill, styles.pillNo]}>
              <Text
                style={[styles.pillText, styles.pillNoText]}
              >{`לא (${noCount})`}</Text>
            </View>
          </View>

          {hasParticipants ? (
            <View style={styles.participantChips}>
              {participantNames.map((name) => (
                <View key={name} style={styles.participantChip}>
                  <Text style={styles.participantChipText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Creator overflow menu */}
      <OverflowMenu
        visible={menuOpen}
        position={menuPos}
        items={overflowItems}
        onClose={() => setMenuOpen(false)}
      />

      {/* ── Assignee sheet */}
      <TaskAssigneeSheet
        visible={!!assigneeSheetTaskId}
        currentAssignee={currentAssigneeForSheet}
        members={members}
        currentUserId={currentUserId}
        isCreator={canManageTasks}
        manualName={manualAssigneeName}
        onManualNameChange={setManualAssigneeName}
        onSelectUser={(userId: Id<'users'>) => {
          if (!assigneeSheetTaskId) return;
          setTaskAssignee({
            id: assigneeSheetTaskId as Id<'eventTasks'>,
            assignee: { type: 'user', userId },
          }).catch(() => Alert.alert('שגיאה', 'לא ניתן להקצות משימה'));
          setAssigneeSheetTaskId(null);
        }}
        onSelectManual={() => {
          if (!assigneeSheetTaskId || !manualAssigneeName.trim()) return;
          setTaskAssignee({
            id: assigneeSheetTaskId as Id<'eventTasks'>,
            assignee: { type: 'manual', name: manualAssigneeName.trim() },
          }).catch(() => Alert.alert('שגיאה', 'לא ניתן להקצות משימה'));
          setAssigneeSheetTaskId(null);
          setManualAssigneeName('');
        }}
        onUnassign={() => {
          if (!assigneeSheetTaskId) return;
          setTaskAssignee({
            id: assigneeSheetTaskId as Id<'eventTasks'>,
            assignee: null,
          }).catch(() => Alert.alert('שגיאה', 'לא ניתן לבטל הקצאה'));
          setAssigneeSheetTaskId(null);
        }}
        onClose={() => {
          setAssigneeSheetTaskId(null);
          setManualAssigneeName('');
        }}
      />

      {/* ── Cancel dialog */}
      <Modal visible={showCancelDialog} transparent animationType="fade">
        <View style={styles.cancelDialogCenter}>
          <Pressable
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.4)' },
            ]}
            onPress={() => {
              setShowCancelDialog(false);
              setCancelReason('');
            }}
          />
          <View style={styles.cancelDialogCard}>
            <Text style={styles.cancelDialogTitle}>בטל אירוע</Text>
            <Text style={styles.cancelDialogBody}>
              האם אתה בטוח שברצונך לבטל את האירוע? האירוע יוסר ממסך הקהילה
              ויופיע בלשונית
              {" 'אירועים' תחת 'אירועים שבוטלו' "}
              למשך 14 ימים.
            </Text>
            <TextInput
              style={styles.cancelDialogInput}
              placeholder="סיבת ביטול (אופציונלי)"
              placeholderTextColor="#9ca3af"
              value={cancelReason}
              onChangeText={setCancelReason}
              textAlign="right"
              multiline
              numberOfLines={2}
            />
            <View style={styles.cancelDialogButtons}>
              <TouchableOpacity
                style={styles.cancelDialogBtnBack}
                onPress={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel="חזור"
              >
                <Text style={styles.cancelDialogBtnBackText}>חזור</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelDialogBtnConfirm}
                onPress={handleCancelEvent}
                accessible
                accessibilityRole="button"
                accessibilityLabel="בטל אירוע"
              >
                <Text style={styles.cancelDialogBtnConfirmText}>בטל אירוע</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <RsvpBlockedByTaskDialog
        assignedTaskCount={blockedRsvpTaskCount ?? 1}
        onClose={() => setBlockedRsvpTaskCount(null)}
        onConfirm={() => {
          if (!eventId) return;
          setBlockedRsvpTaskCount(null);
          setRsvpNoAndUnclaimMyEventTasks({ eventId }).catch(() =>
            Alert.alert('שגיאה', 'לא ניתן לעדכן אישור הגעה')
          );
        }}
        visible={blockedRsvpTaskCount !== null}
      />
      <NavigationPickerModal
        location={navPickerLocation}
        latitude={parseGeoUri(navPickerLocationUrl)?.lat}
        longitude={parseGeoUri(navPickerLocationUrl)?.lng}
        onClose={() => setNavPickerLocation(null)}
        visible={navPickerLocation !== null}
      />
      <UpgradeModal
        visible={upgradeModalVisible}
        reason="general"
        onClose={() => setUpgradeModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f8',
    ...Platform.select({
      android: { direction: 'rtl' as const },
      default: {},
    }),
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // ── Header (RTL: first=right, last=left)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // ── Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // ── Detail rows (אייקון בימין, טקסט מיושר ימינה — row-reverse עקבי באנדרואיד / iOS)
  detailRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  locationDetailRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  locationTextPressable: {
    flex: 1,
    minHeight: 44,
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
  },
  navigateInlineBtn: {
    minHeight: 34,
    minWidth: 60,
    flexDirection: HEB_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(141,110,99,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  navigateInlineBtnText: {
    color: '#8d6e63',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: HEB_WRITING_DIRECTION,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    flex: 1,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  linkText: {
    fontSize: 14,
    color: PRIMARY,
    textAlign: HEB_TEXT_ALIGN,
    flex: 1,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  separator: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    lineHeight: 22,
  },
  descriptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  scheduleRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  scheduleText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '600',
  },
  reminderRows: {
    gap: 8,
  },
  reminderDisplayRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f5fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reminderDisplayText: {
    flex: 1,
    fontSize: 14,
    color: PRIMARY,
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '600',
  },

  // ── Attachments
  attachmentsList: {
    gap: 8,
  },
  attachmentRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
  },
  attachmentContent: {
    flex: 1,
    alignItems: HEB_FLEX_END,
    gap: 2,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  attachmentMeta: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: HEB_TEXT_ALIGN,
  },

  // ── RSVP
  rsvpCardElevated: {
    zIndex: 2,
    elevation: 4,
    gap: 10,
  },
  rsvpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
    alignSelf: 'stretch',
    writingDirection: HEB_WRITING_DIRECTION,
  },
  rsvpRow: {
    flexDirection: HEB_ROW,
    gap: 6,
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
  },
  rsvpBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rsvpBtnSelected: {
    elevation: 3,
    shadowOpacity: 0.12,
  },
  rsvpBtnText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  rsvpDisabled: { opacity: 0.4 },

  // ── Cancelled banner
  cancelledBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    gap: 6,
  },
  cancelledBannerRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  cancelledBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: HEB_TEXT_ALIGN,
  },
  cancelledBannerReason: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: HEB_TEXT_ALIGN,
  },

  // ── Cancel dialog
  cancelDialogCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  cancelDialogCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
  },
  cancelDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: HEB_TEXT_ALIGN,
    color: '#111827',
  },
  cancelDialogBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: HEB_TEXT_ALIGN,
  },
  cancelDialogInput: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  cancelDialogButtons: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  cancelDialogBtnBack: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDialogBtnBackText: {
    color: '#374151',
  },
  cancelDialogBtnConfirm: {
    flex: 1,
    backgroundColor: '#ef4444',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDialogBtnConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Passive state
  passiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  passiveText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: HEB_TEXT_ALIGN,
    flex: 1,
  },
  openCalendarBtn: {
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  openCalendarBtnSecondary: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#7dd3fc',
  },
  openCalendarBtnPressed: {
    opacity: 0.9,
  },
  openCalendarBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  openCalendarBtnTextSecondary: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Important items
  importantItemsList: {
    gap: 8,
    width: '100%',
  },
  importantItemsHeaderChip: {
    alignSelf: HEB_FLEX_END,
    backgroundColor: '#E6F4FB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BAE6FD',
  },
  importantItemsHeaderChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  importantItemRow: {
    flexDirection: HEB_ROW,
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  importantItemBullet: {
    fontSize: 16,
    color: PRIMARY,
    lineHeight: 22,
  },
  importantItemText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    lineHeight: 22,
    fontWeight: '500',
    writingDirection: HEB_WRITING_DIRECTION,
  },
  importantItemDeleteBtn: {
    padding: 4,
  },
  importantItemsCopyBtn: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  importantItemsCopiedBtn: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#7dd3fc',
  },
  importantItemsCopyBtnPressed: {
    opacity: 0.9,
  },
  importantItemsCopyBtnDisabled: {
    opacity: 0.55,
  },
  importantItemsCopyBtnText: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  importantItemsCopiedBtnText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  importantItemsCopyError: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: HEB_TEXT_ALIGN,
  },

  // ── Participants
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillYes: { backgroundColor: '#dcfce7' },
  pillYesText: { color: '#16a34a' },
  pillMaybe: { backgroundColor: '#fef9c3' },
  pillMaybeText: { color: '#ca8a04' },
  pillNo: { backgroundColor: '#fee2e2' },
  pillNoText: { color: '#dc2626' },
  participantChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantChip: {
    borderRadius: 999,
    backgroundColor: '#e8f5fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  participantChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  emptyParticipants: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyParticipantsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // ── Tasks
  taskSectionHeader: {
    flexDirection: HEB_ROW,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  taskSectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  taskVisibilitySection: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  taskVisibilityTextBlock: {
    flex: 1,
    alignItems: HEB_FLEX_END,
    gap: 2,
  },
  taskVisibilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  taskVisibilityHelper: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: HEB_TEXT_ALIGN,
  },
  managerVisibilityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFB',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E9EB',
  },
  managerVisibilityTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  managerVisibilityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: HEB_TEXT_ALIGN,
  },
  managerVisibilityDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
    textAlign: HEB_TEXT_ALIGN,
  },
  taskVisibilityToggleTouch: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskVisibilityToggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#d1d5db',
    padding: 3,
    justifyContent: 'center',
  },
  taskVisibilityToggleTrackOn: {
    backgroundColor: PRIMARY,
  },
  taskVisibilityToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  taskVisibilityToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  taskSummary: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'left',
  },
  taskSummaryAllDone: {
    color: '#16a34a',
  },
  tasksList: { gap: 0 },
  taskRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    width: '100%',
  },
  taskContent: {
    flex: 1,
    alignItems: 'stretch',
    gap: 6,
    minWidth: 0,
  },
  taskTitle: {
    alignSelf: 'stretch',
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskAssignedLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskAssignedOtherLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskUnassignedLabel: {
    alignSelf: 'stretch',
    fontSize: 12,
    color: '#9ca3af',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskAssignmentAction: {
    minHeight: 32,
    justifyContent: 'center',
    alignSelf: HEB_FLEX_END,
    alignItems: HEB_FLEX_END,
  },
  taskAssignmentStatusRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    gap: 10,
  },
  taskClaimBtn: {
    minHeight: 32,
    alignSelf: HEB_FLEX_END,
    alignItems: HEB_FLEX_END,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  taskClaimBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '800',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskUnassignBtn: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  taskUnassignBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textAlign: HEB_TEXT_ALIGN,
    writingDirection: HEB_WRITING_DIRECTION,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  taskActionBtn: { padding: 4 },

  // ── Error states
  notFoundText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorBackBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  errorBackBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Overflow popover
  popoverBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popover: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 215,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  popoverBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  popoverLabel: {
    fontSize: 15,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    flex: 1,
  },
  popoverDanger: { color: '#ef4444' },
});
