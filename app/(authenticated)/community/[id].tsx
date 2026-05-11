import { Ionicons } from '@expo/vector-icons';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  type GestureResponderEvent,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppConfirmationDialog } from '@/components/AppConfirmationDialog';
import { EventDetailsBottomSheet } from '@/components/EventDetailsBottomSheet';
import {
  type JoinApprovalMode,
  JoinApprovalSettingsModal,
} from '@/components/JoinApprovalSettingsModal';
import { RsvpBlockedByTaskDialog } from '@/components/RsvpBlockedByTaskDialog';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  getOpenCommunityCalendarActionLabel,
  isOpenCommunityCalendarActionVisible,
} from '@/lib/openCommunityCalendarUi';
import { getConvexErrorCode } from '@/lib/utils/convexError';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';
const NOW_PLUS_60_DAYS = () => Date.now() + 60 * 24 * 60 * 60 * 1000;
const CALENDAR_REMOVE_CONFIRM_TITLE = 'להסיר מהיומן?';
const CALENDAR_REMOVE_CONFIRM_MESSAGE =
  'שימי לב, הוקצו לך משימות באירוע הזה. האירוע יוסר מהיומן שלך, אבל המשימות עדיין יופיעו במסך המשימות.';
const CALENDAR_REMOVE_CONFIRMATION_CODE =
  'CALENDAR_REMOVE_REQUIRES_ACTIVE_TASK_CONFIRMATION';

const TABS = ['הכל', 'אירועים', 'תזכורות', 'פעילות'] as const;
type Tab = (typeof TABS)[number];

const EVENT_COLORS = [
  '#36a9e2',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#f43f5e',
  '#6366f1',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'yes' | 'no' | 'maybe' | 'none';
type TaskSummary = {
  total: number;
  assigned: number;
  totalTasksCount: number;
  assignedTasksCount: number;
  myAssignedTasks: Array<{ id: Id<'eventTasks'>; title: string }>;
  hasMyAssignedTasks: boolean;
};

interface EventDoc {
  _id: Id<'events'>;
  title: string;
  category?: string;
  startTime: number;
  endTime: number;
  allDay?: boolean;
  location?: string;
  description?: string;
  communityId?: Id<'communities'>;
  requiresRsvp?: boolean;
  tasksVisibleToParticipants?: boolean;
  createdBy?: Id<'users'>;
  status?: 'active' | 'cancelled';
  cancelledAt?: number;
  cancelReason?: string;
  /** Open community events: personal calendar / "הסר מהיומן" (from Convex) */
  isSavedToMyCalendar?: boolean;
  importantItems?: Array<{ id: string; title: string }>;
}

interface TaskDoc {
  _id: Id<'tasks'>;
  title: string;
  dueDate?: number;
  completed: boolean;
  completedAt?: number;
}

type CommunityActivityType =
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'reminder_created'
  | 'task_assigned'
  | 'task_completed'
  | 'member_joined'
  | 'community_updated';

type CommunityActivityEntityType =
  | 'event'
  | 'reminder'
  | 'task'
  | 'community'
  | 'member';

interface CommunityActivityItem {
  id: Id<'communityActivities'>;
  type: CommunityActivityType;
  title: string;
  description?: string;
  actorDisplayName?: string;
  createdAt: number;
  entityType?: CommunityActivityEntityType;
  entityId?: string;
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type ActivityDateGroup = 'היום' | 'אתמול' | 'השבוע' | 'מוקדם יותר';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEventColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

function isEventPast(event: EventDoc): boolean {
  const now = Date.now();
  if (event.allDay) {
    const d = new Date(event.startTime);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < now;
  }
  return event.endTime < now;
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

function formatEventDate(ts: number, allDay?: boolean): string {
  const d = new Date(ts);
  if (allDay) {
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFlyerDate(ts: number): string {
  return new Date(ts).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatFlyerTime(event: EventDoc): string {
  if (event.allDay) return 'כל היום';
  return `${new Date(event.startTime).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  })} — ${new Date(event.endTime).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatDueDate(ts: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  return new Date(ts).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
}

function getActivityIcon(type: CommunityActivityType): IoniconName {
  const icons: Record<CommunityActivityType, IoniconName> = {
    event_created: 'calendar-outline',
    event_updated: 'create-outline',
    event_cancelled: 'close-circle-outline',
    reminder_created: 'notifications-outline',
    task_assigned: 'person-add-outline',
    task_completed: 'checkmark-circle-outline',
    member_joined: 'people-outline',
    community_updated: 'information-circle-outline',
  };
  return icons[type];
}

function formatRelativeActivityTime(createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) return 'עכשיו';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דק׳`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return 'לפני שעה';
  if (diffHours < 24) return `לפני ${diffHours} שעות`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activityDate = new Date(createdAt);
  activityDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - activityDate.getTime()) / 86_400_000
  );
  if (diffDays === 1) return 'אתמול';

  return new Date(createdAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
}

function getActivityDateGroup(createdAt: number): ActivityDateGroup {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activityDate = new Date(createdAt);
  activityDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - activityDate.getTime()) / 86_400_000
  );
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return 'השבוע';
  return 'מוקדם יותר';
}

function groupActivitiesByDate(
  activities: CommunityActivityItem[]
): Array<{ title: ActivityDateGroup; items: CommunityActivityItem[] }> {
  const groups: ActivityDateGroup[] = ['היום', 'אתמול', 'השבוע', 'מוקדם יותר'];
  return groups
    .map((title) => ({
      title,
      items: activities.filter(
        (activity) => getActivityDateGroup(activity.createdAt) === title
      ),
    }))
    .filter((group) => group.items.length > 0);
}

interface TaskSummaryLineProps {
  taskSummary: TaskSummary;
  copy: 'full' | 'compact';
  style: StyleProp<TextStyle>;
  doneStyle?: StyleProp<TextStyle>;
}

function TaskSummaryLine({
  taskSummary,
  copy,
  style,
  doneStyle,
}: TaskSummaryLineProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const assignedTasksCount =
    taskSummary.assignedTasksCount ?? taskSummary.assigned;
  const totalTasksCount = taskSummary.totalTasksCount ?? taskSummary.total;
  const myTaskTitles = taskSummary.myAssignedTasks
    .map((task) => task.title.trim())
    .filter((title) => title.length > 0);
  const hasMyAssignedTasks =
    taskSummary.hasMyAssignedTasks && myTaskTitles.length > 0;
  const baseText =
    copy === 'full'
      ? `${assignedTasksCount}/${totalTasksCount} משימות הוקצו`
      : `${assignedTasksCount}/${totalTasksCount} הוקצו`;

  const handleTaskLinePress = useCallback(
    (event: GestureResponderEvent): void => {
      event.stopPropagation();
      setTooltipVisible((visible) => !visible);
    },
    []
  );

  const handleTooltipPress = useCallback(
    (event: GestureResponderEvent): void => {
      event.stopPropagation();
    },
    []
  );

  const lineText = (
    <Text
      numberOfLines={1}
      style={[style, assignedTasksCount === totalTasksCount ? doneStyle : null]}
    >
      {baseText}
      {hasMyAssignedTasks ? ' · ' : ''}
      {hasMyAssignedTasks ? (
        <Text style={styles.myTasksIndicator}>גם לך</Text>
      ) : null}
    </Text>
  );

  return (
    <>
      {hasMyAssignedTasks ? (
        <Pressable
          accessibilityHint="פותח את המשימות שלך באירוע"
          accessibilityLabel="גם לך יש משימות באירוע"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          onPress={handleTaskLinePress}
          style={styles.taskSummaryPressable}
        >
          {lineText}
        </Pressable>
      ) : (
        lineText
      )}
      <Modal
        animationType="fade"
        onRequestClose={() => setTooltipVisible(false)}
        transparent
        visible={tooltipVisible}
      >
        <Pressable
          onPress={() => setTooltipVisible(false)}
          style={styles.myTasksTooltipBackdrop}
        >
          <Pressable
            accessible={true}
            accessibilityLabel="המשימות שלך"
            onPress={handleTooltipPress}
            style={styles.myTasksTooltip}
          >
            {myTaskTitles.length === 1 ? (
              <Text numberOfLines={3} style={styles.myTasksTooltipText}>
                {`המשימה שלך: ${myTaskTitles[0]}`}
              </Text>
            ) : (
              <>
                <Text style={styles.myTasksTooltipTitle}>המשימות שלך:</Text>
                {myTaskTitles.map((title, index) => (
                  <Text
                    key={`${title}-${index}`}
                    numberOfLines={2}
                    style={styles.myTasksTooltipText}
                  >
                    {`• ${title}`}
                  </Text>
                ))}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── RSVP Bottom Sheet ────────────────────────────────────────────────────────

interface RsvpSheetProps {
  eventId: Id<'events'> | null;
  currentStatus: RsvpStatus;
  onSelect: (status: RsvpStatus) => void;
  onClose: () => void;
}

const RSVP_OPTIONS: {
  status: RsvpStatus;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}[] = [
  { status: 'yes', label: 'כן', icon: 'checkmark-circle', color: '#22c55e' },
  { status: 'maybe', label: 'אולי', icon: 'help-circle', color: '#eab308' },
  { status: 'no', label: 'לא', icon: 'close-circle', color: '#ef4444' },
];

function RsvpBottomSheet({
  eventId,
  currentStatus,
  onSelect,
  onClose,
}: RsvpSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (eventId) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [eventId, slideAnim]);

  if (!eventId) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>האם תשתתף?</Text>
        {RSVP_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.status}
            style={[
              styles.sheetOption,
              currentStatus === opt.status && styles.sheetOptionActive,
            ]}
            onPress={() => {
              onSelect(opt.status);
              onClose();
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Ionicons
              name={opt.icon}
              size={22}
              color={currentStatus === opt.status ? opt.color : '#9ca3af'}
            />
            <Text
              style={[
                styles.sheetOptionText,
                currentStatus === opt.status && {
                  color: opt.color,
                  fontWeight: '700',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

// ─── Action Sheet (+ button) ──────────────────────────────────────────────────

// ─── Add Popover Menu ─────────────────────────────────────────────────────────

interface AddPopoverMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  communityId: string;
  canCreateCommunityEvent: boolean;
  onClose: () => void;
}

function AddPopoverMenu({
  visible,
  position,
  communityId,
  canCreateCommunityEvent,
  onClose,
}: AddPopoverMenuProps) {
  const router = useRouter();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.popoverBackdrop} onPress={onClose} />
      <View style={[styles.popover, { top: position.y, left: position.x }]}>
        {canCreateCommunityEvent ? (
          <Pressable
            style={[styles.popoverItem, styles.popoverBorder]}
            onPress={() => {
              onClose();
              router.push(
                `/(authenticated)/event/new?communityId=${communityId}` as Parameters<
                  typeof router.push
                >[0]
              );
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="אירוע חדש"
          >
            <Text style={styles.popoverLabel}>אירוע חדש</Text>
            <Ionicons name="calendar-outline" size={18} color="#374151" />
          </Pressable>
        ) : null}
        <Pressable
          style={
            canCreateCommunityEvent
              ? styles.popoverItem
              : [styles.popoverItem, styles.popoverSingleItem]
          }
          onPress={() => {
            onClose();
            router.push(
              `/(authenticated)/community-reminder/new?communityId=${communityId}` as Parameters<
                typeof router.push
              >[0]
            );
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="תזכורת חדשה"
        >
          <Text style={styles.popoverLabel}>תזכורת חדשה</Text>
          <Ionicons name="checkmark-circle-outline" size={18} color="#374151" />
        </Pressable>
      </View>
    </Modal>
  );
}

type FlyerVariant = {
  bg: string;
  border: string;
  pillBg: string;
  pillText: string;
  divider: string;
  meta: string;
  buttonBg: string;
  buttonText: string;
};

const FLYER_VARIANTS: FlyerVariant[] = [
  {
    bg: '#f8f2ec',
    border: '#eadfce',
    pillBg: '#efe3d5',
    pillText: '#7a5c3f',
    divider: '#9a8268',
    meta: '#7c6b5a',
    buttonBg: '#e9ddd0',
    buttonText: '#5f4a35',
  },
  {
    bg: '#f6eef2',
    border: '#ead7e1',
    pillBg: '#eedde7',
    pillText: '#7a4b63',
    divider: '#9a6f84',
    meta: '#7a5d6d',
    buttonBg: '#eadbe4',
    buttonText: '#5f3f52',
  },
  {
    bg: '#eff4f6',
    border: '#dbe6eb',
    pillBg: '#dde9ee',
    pillText: '#4a6878',
    divider: '#6a8593',
    meta: '#5e7480',
    buttonBg: '#dce8ee',
    buttonText: '#32505d',
  },
  {
    bg: '#f5f3ef',
    border: '#e8e3db',
    pillBg: '#ebe6dd',
    pillText: '#6d6558',
    divider: '#8a8276',
    meta: '#6f695f',
    buttonBg: '#e8e3db',
    buttonText: '#554f45',
  },
];

interface CommunityEventFlyerCardProps {
  event: EventDoc;
  rsvpStatus: RsvpStatus;
  taskSummary?: TaskSummary;
  cardWidth: number;
  onOpenDetails: (eventId: Id<'events'>) => void;
  onRsvpSelect: (eventId: Id<'events'>, status: RsvpStatus) => Promise<void>;
  /** Owner/admin/creator: always "לפרטים", no inline RSVP */
  flyerDetailsOnly?: boolean;
  /** When false for participants, hide X/Y task counts (tasks not visible to them). */
  showTaskMetrics?: boolean;
  isSavedToMyCalendar?: boolean;
  onCalendarToggle?: (eventId: Id<'events'>) => void | Promise<void>;
  /** false for pending / non-active members (no personal calendar for community events) */
  viewerIsActiveCommunityMember?: boolean;
  communityArchived?: boolean;
}

function CommunityEventFlyerCard({
  event,
  rsvpStatus,
  taskSummary,
  cardWidth,
  onOpenDetails,
  onRsvpSelect,
  flyerDetailsOnly = false,
  isSavedToMyCalendar = false,
  onCalendarToggle,
  viewerIsActiveCommunityMember = true,
  communityArchived = false,
}: CommunityEventFlyerCardProps) {
  const [showInlineChoices, setShowInlineChoices] = useState(false);
  const variant =
    FLYER_VARIANTS[Math.abs(event._id.length) % FLYER_VARIANTS.length];
  const isOpenCommunityEvent = event.requiresRsvp === false;
  /** Invitee has not chosen yet — CTA ממתין לאישור opens inline choices */
  const showInviteePendingCta =
    !flyerDetailsOnly && !isOpenCommunityEvent && rsvpStatus === 'none';
  /** Invitee chose yes/maybe/no — can change inline without locking after yes */
  const showMemberChangeRsvpCta =
    !flyerDetailsOnly && !isOpenCommunityEvent && rsvpStatus !== 'none';
  const showInlineRsvpRow =
    showInlineChoices && (showInviteePendingCta || showMemberChangeRsvpCta);
  const rawCategory = event.category?.trim();
  const showCategoryPill = Boolean(rawCategory && rawCategory.length > 0);
  const dateLabel = formatFlyerDate(event.startTime);
  const timeLabel = formatFlyerTime(event);
  const locationLabel = event.location?.trim() || 'מיקום יתעדכן בהמשך';
  const importantItemsCount = event.importantItems?.length ?? 0;
  const showImportantItemsChip = importantItemsCount > 0;
  const rsvpMeta = isOpenCommunityEvent
    ? 'פתוח לחברי הקהילה'
    : rsvpStatus === 'yes'
      ? 'אישרת הגעה'
      : rsvpStatus === 'no'
        ? 'סימנת לא'
        : rsvpStatus === 'maybe'
          ? 'סימנת אולי'
          : 'נדרש אישור הגעה';
  const taskTotal = taskSummary?.totalTasksCount ?? taskSummary?.total ?? 0;
  const taskCopy = cardWidth < 176 ? 'compact' : 'full';
  useEffect(() => {
    if (rsvpStatus !== 'none') setShowInlineChoices(false);
  }, [rsvpStatus]);

  const isCancelledEvent = event.status === 'cancelled';
  const openCalendarActionLabel =
    getOpenCommunityCalendarActionLabel(isSavedToMyCalendar);
  const showOpenCalendarCta =
    onCalendarToggle !== undefined &&
    isOpenCommunityCalendarActionVisible({
      event: {
        communityId: event.communityId ?? null,
        requiresRsvp: event.requiresRsvp,
        status: event.status,
      },
      hasValidConvexEventId: true,
      communityArchived,
      viewerIsActiveMember: viewerIsActiveCommunityMember,
    });

  return (
    <View
      style={[
        styles.flyerCard,
        {
          width: cardWidth,
          backgroundColor: variant.bg,
          borderColor: variant.border,
        },
        isCancelledEvent ? { opacity: 0.68 } : null,
      ]}
    >
      <Pressable
        style={styles.flyerCardBody}
        onPress={() => onOpenDetails(event._id)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`פרטי אירוע ${event.title}`}
      >
        {showCategoryPill ? (
          <View style={[styles.flyerPill, { backgroundColor: variant.pillBg }]}>
            <Text
              style={[styles.flyerPillText, { color: variant.pillText }]}
              numberOfLines={1}
            >
              {rawCategory}
            </Text>
          </View>
        ) : null}
        <Text style={styles.flyerTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.flyerImportantItemsSlot}>
          {showImportantItemsChip ? (
            <View style={styles.flyerImportantItemsChip}>
              <Text style={styles.flyerImportantItemsChipText}>
                {`📌 חשוב לזכור · ${importantItemsCount}`}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.flyerDividerRow}>
          <View
            style={[
              styles.flyerDividerLine,
              { backgroundColor: variant.divider },
            ]}
          />
          <Text
            style={[styles.flyerDividerDiamond, { color: variant.divider }]}
          >
            ✦
          </Text>
          <View
            style={[
              styles.flyerDividerLine,
              { backgroundColor: variant.divider },
            ]}
          />
        </View>
        <Text style={styles.flyerDate}>{dateLabel}</Text>
        <Text style={styles.flyerTime}>{timeLabel}</Text>
        <Text style={styles.flyerLocation} numberOfLines={1}>
          {locationLabel}
        </Text>
        <Text
          style={[
            styles.flyerMeta,
            !isOpenCommunityEvent &&
              rsvpStatus === 'maybe' &&
              styles.flyerMetaEmphasis,
            { color: variant.meta },
          ]}
          numberOfLines={1}
        >
          {rsvpMeta}
        </Text>
        {taskSummary && taskTotal > 0 ? (
          <TaskSummaryLine
            copy={taskCopy}
            doneStyle={styles.flyerMetaDone}
            style={[
              styles.flyerMeta,
              styles.flyerMetaLast,
              { color: variant.meta },
            ]}
            taskSummary={taskSummary}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={[
              styles.flyerMeta,
              styles.flyerMetaLast,
              { color: variant.meta },
            ]}
          >
            ללא משימות פעילות
          </Text>
        )}
      </Pressable>

      <View style={styles.flyerCtaWrap}>
        {showInlineRsvpRow ? (
          <View style={styles.flyerInlineRsvpRow}>
            {(
              [
                { status: 'yes', label: 'כן' },
                { status: 'maybe', label: 'אולי' },
                { status: 'no', label: 'לא' },
              ] as { status: RsvpStatus; label: string }[]
            ).map((opt) => (
              <TouchableOpacity
                key={`${event._id}-${opt.status}`}
                style={styles.flyerInlineRsvpBtn}
                onPress={() => {
                  onRsvpSelect(event._id, opt.status).finally(() => {
                    setShowInlineChoices(false);
                  });
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <Text style={styles.flyerInlineRsvpText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : showOpenCalendarCta ? (
          <TouchableOpacity
            style={[styles.flyerCtaBtn, { backgroundColor: variant.buttonBg }]}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onCalendarToggle(event._id);
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={openCalendarActionLabel}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.flyerCtaText, { color: variant.buttonText }]}>
              {openCalendarActionLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.flyerCtaBtn, { backgroundColor: variant.buttonBg }]}
            onPress={() => {
              if (flyerDetailsOnly) {
                onOpenDetails(event._id);
                return;
              }
              if (showInviteePendingCta || showMemberChangeRsvpCta) {
                setShowInlineChoices(true);
                return;
              }
              onOpenDetails(event._id);
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              flyerDetailsOnly
                ? 'לפרטים'
                : showInviteePendingCta
                  ? 'ממתין לאישור'
                  : showMemberChangeRsvpCta
                    ? rsvpStatus === 'yes'
                      ? 'שינוי אישור'
                      : 'שינוי תגובה'
                    : 'לפרטים'
            }
          >
            <Text style={[styles.flyerCtaText, { color: variant.buttonText }]}>
              {flyerDetailsOnly
                ? 'לפרטים'
                : showInviteePendingCta
                  ? 'ממתין לאישור'
                  : showMemberChangeRsvpCta
                    ? rsvpStatus === 'yes'
                      ? 'שינוי אישור'
                      : 'שינוי תגובה'
                    : 'לפרטים'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── EventRow (events tab list view) ─────────────────────────────────────────

interface EventRowProps {
  event: EventDoc;
  rsvpStatus: RsvpStatus;
  onRsvpPress: (eventId: Id<'events'>) => void;
  onOpenDetails: (eventId: Id<'events'>) => void;
  isCancelled?: boolean;
  cancelReason?: string;
  taskSummary?: TaskSummary;
}

function EventRow({
  event,
  rsvpStatus,
  onRsvpPress,
  onOpenDetails,
  isCancelled,
  cancelReason,
  taskSummary,
}: EventRowProps) {
  const past = isEventPast(event);

  let badgeLabel = '';
  let badgeColor = '#eab308';
  if (isCancelled) {
    badgeLabel = 'בוטל';
    badgeColor = '#fee2e2';
  } else if (rsvpStatus === 'yes') {
    badgeLabel = 'כן';
    badgeColor = '#22c55e';
  } else if (rsvpStatus === 'maybe') {
    badgeLabel = 'אולי';
    badgeColor = '#eab308';
  } else if (rsvpStatus === 'no') {
    badgeLabel = 'לא';
    badgeColor = '#ef4444';
  }

  const isOpenCommunityEvent = event.requiresRsvp === false;
  const showRsvpBadge =
    !isOpenCommunityEvent &&
    !isCancelled &&
    !past &&
    (event.requiresRsvp !== false || rsvpStatus !== 'none');
  const showCancelledBadge = isCancelled;

  return (
    <Pressable
      style={[
        styles.eventRow,
        past && { opacity: 0.45 },
        isCancelled && { opacity: 0.5 },
      ]}
      onPress={() => onOpenDetails(event._id)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <View style={styles.eventRowLeft}>
        <Text style={styles.eventRowDate}>
          {new Date(event.startTime).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        <View
          style={[
            styles.eventDot,
            { backgroundColor: getEventColor(event._id) },
          ]}
        />
      </View>
      <View style={styles.eventRowContent}>
        <View style={styles.eventRowTop}>
          {past && !isCancelled && (
            <View
              style={[
                styles.eventBadge,
                { backgroundColor: '#94a3b8', marginLeft: 0, marginRight: 6 },
              ]}
            >
              <Text style={styles.eventBadgeText}>עבר</Text>
            </View>
          )}
          <Text
            style={[
              styles.eventRowTitle,
              past && !isCancelled && { color: '#9ca3af' },
            ]}
            numberOfLines={2}
          >
            {event.title}
          </Text>
        </View>
        {cancelReason ? (
          <Text style={styles.eventRowCancelReason} numberOfLines={1}>
            {cancelReason}
          </Text>
        ) : null}
        {event.location ? (
          <Text
            style={[
              styles.eventRowLocation,
              past && !isCancelled && { color: '#c4c9d4' },
            ]}
            numberOfLines={1}
          >
            📍 {event.location}
          </Text>
        ) : null}
        {showCancelledBadge ? (
          <View style={styles.eventRowCancelledBadge}>
            <Text style={styles.eventRowCancelledBadgeText}>{badgeLabel}</Text>
          </View>
        ) : showRsvpBadge ? (
          <TouchableOpacity
            style={[styles.rsvpStatusBadge, { backgroundColor: badgeColor }]}
            onPress={() => onRsvpPress(event._id)}
          >
            <Text style={styles.rsvpStatusText}>
              {badgeLabel !== '' ? `${badgeLabel} ▾` : 'ממתין לאישור ▾'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {taskSummary &&
        (taskSummary.totalTasksCount ?? taskSummary.total) > 0 ? (
          <TaskSummaryLine
            copy="compact"
            doneStyle={styles.eventRowTaskSummaryDone}
            style={styles.eventRowTaskSummary}
            taskSummary={taskSummary}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskDoc;
  onToggle: (id: Id<'tasks'>) => void;
}

function TaskRow({ task, onToggle }: TaskRowProps) {
  return (
    <Pressable
      style={styles.taskRow}
      onPress={() => onToggle(task._id)}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={task.title}
      accessibilityState={{ checked: task.completed }}
    >
      <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
        {task.completed && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text
        style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
        numberOfLines={2}
      >
        {task.title}
      </Text>
      {task.dueDate !== undefined ? (
        <Text style={styles.taskDue}>{formatDueDate(task.dueDate)}</Text>
      ) : null}
    </Pressable>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            accessible
            accessibilityRole="button"
          >
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.sectionRight}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Overflow Menu ────────────────────────────────────────────────────────────

interface OverflowItem {
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
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

// ─── Search Modal ─────────────────────────────────────────────────────────────

interface SearchModalProps {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

function SearchModal({ visible, value, onChange, onClose }: SearchModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.searchBackdrop} onPress={onClose} />
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={value}
          onChangeText={onChange}
          placeholder="חיפוש אירוע..."
          placeholderTextColor="#9ca3af"
          textAlign="right"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={onClose}
          accessibilityLabel="חיפוש אירוע"
        />
        <Ionicons name="search" size={20} color="#9ca3af" />
      </View>
    </Modal>
  );
}

// ─── ReminderRowAll (כדאי לזכור section in הכל tab) ──────────────────────────

interface ReminderRowAllProps {
  task: TaskDoc;
  onToggle: (id: Id<'tasks'>) => void;
  onHide?: (id: string) => void;
}

function ReminderRowAll({ task, onToggle, onHide }: ReminderRowAllProps) {
  return (
    <Pressable
      style={styles.reminderRow}
      onPress={() => onToggle(task._id)}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={task.title}
      accessibilityState={{ checked: task.completed }}
    >
      {/* Checkbox — square, right side (first element in RTL row) */}
      <View
        style={[
          styles.reminderCheckbox,
          task.completed && styles.reminderCheckboxDone,
        ]}
      >
        {task.completed && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>

      {/* Title */}
      <Text
        style={[
          styles.reminderTitle,
          task.completed && styles.reminderTitleDone,
        ]}
        numberOfLines={2}
      >
        {task.title}
      </Text>

      {/* Left side: X button (when completed + onHide provided), completedAt date, or dueDate */}
      {task.completed && onHide ? (
        <TouchableOpacity
          onPress={() => onHide(task._id)}
          style={styles.reminderHideBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="הסתר"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color="#9ca3af" />
        </TouchableOpacity>
      ) : task.completed && task.completedAt !== undefined ? (
        <Text style={styles.reminderDue}>
          {`טופל ב-${new Date(task.completedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`}
        </Text>
      ) : task.dueDate !== undefined ? (
        <Text style={styles.reminderDue}>{formatDueDate(task.dueDate)}</Text>
      ) : null}
    </Pressable>
  );
}

interface ActivityRowProps {
  activity: CommunityActivityItem;
  onOpenEventDetails: (eventId: Id<'events'>) => void;
}

function ActivityRow({ activity, onOpenEventDetails }: ActivityRowProps) {
  const canOpenEvent =
    activity.entityType === 'event' && activity.entityId !== undefined;

  const handlePress = useCallback((): void => {
    if (!canOpenEvent || !activity.entityId) return;
    onOpenEventDetails(activity.entityId as Id<'events'>);
  }, [activity.entityId, canOpenEvent, onOpenEventDetails]);

  return (
    <Pressable
      onPress={canOpenEvent ? handlePress : undefined}
      style={({ pressed }) => [
        styles.activityRow,
        canOpenEvent && pressed ? styles.activityRowPressed : null,
      ]}
      accessible
      accessibilityRole={canOpenEvent ? 'button' : 'text'}
      accessibilityLabel={activity.title}
      accessibilityHint={canOpenEvent ? 'פותח את פרטי האירוע' : undefined}
    >
      <View style={styles.activityIconWrap}>
        <Ionicons
          name={getActivityIcon(activity.type)}
          size={18}
          color={PRIMARY}
        />
      </View>
      <View style={styles.activityTextBlock}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.title}
        </Text>
        {activity.description ? (
          <Text style={styles.activityDescription} numberOfLines={2}>
            {activity.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.activityTime}>
        {formatRelativeActivityTime(activity.createdAt)}
      </Text>
    </Pressable>
  );
}

interface ActivityListProps {
  activities: CommunityActivityItem[];
  grouped?: boolean;
  onOpenEventDetails: (eventId: Id<'events'>) => void;
}

function ActivityList({
  activities,
  grouped = false,
  onOpenEventDetails,
}: ActivityListProps) {
  if (!grouped) {
    return (
      <View style={styles.activityCard}>
        {activities.map((activity, index) => (
          <View key={activity.id}>
            <ActivityRow
              activity={activity}
              onOpenEventDetails={onOpenEventDetails}
            />
            {index < activities.length - 1 ? (
              <View style={styles.activityDivider} />
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.activityTimeline}>
      {groupActivitiesByDate(activities).map((group) => (
        <View key={group.title} style={styles.activityGroup}>
          <Text style={styles.activityGroupTitle}>{group.title}</Text>
          <View style={styles.activityCard}>
            {group.items.map((activity, index) => (
              <View key={activity.id}>
                <ActivityRow
                  activity={activity}
                  onOpenEventDetails={onOpenEventDetails}
                />
                {index < group.items.length - 1 ? (
                  <View style={styles.activityDivider} />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: הכל ────────────────────────────────────────────────────────────────

interface TabAllProps {
  communityId: Id<'communities'>;
  rsvpMap: Record<string, RsvpStatus>;
  onToggleTask: (id: Id<'tasks'>) => void;
  onSeeMoreEvents: () => void;
  onSeeMoreReminders: () => void;
  onOpenEventDetails: (eventId: Id<'events'>) => void;
  // Persisted state lifted to parent so it survives tab switches
  hiddenReminderIds: Set<string>;
  setHiddenReminderIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  localCompletedIds: Set<string>;
  setLocalCompletedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  localTaskCache: Map<string, TaskDoc>;
  setLocalTaskCache: React.Dispatch<React.SetStateAction<Map<string, TaskDoc>>>;
  isRemindersOpen: boolean;
  setIsRemindersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUserId?: Id<'users'>;
  taskCountsMap: Record<string, TaskSummary>;
  onInlineRsvp: (eventId: Id<'events'>, status: RsvpStatus) => Promise<void>;
  communityMyRole?: 'owner' | 'admin' | 'member';
}

function TabAll({
  communityId,
  rsvpMap,
  onToggleTask,
  onOpenEventDetails,
  hiddenReminderIds,
  setHiddenReminderIds,
  localCompletedIds,
  setLocalCompletedIds,
  localTaskCache,
  setLocalTaskCache,
  isRemindersOpen,
  setIsRemindersOpen,
  currentUserId,
  taskCountsMap,
  onInlineRsvp,
  communityMyRole,
}: TabAllProps) {
  const { width: screenWidth } = useWindowDimensions();
  const flyerColumns = screenWidth < 360 ? 1 : 2;
  const horizontalPadding = 32; // TabAll horizontal margins
  const gridGap = 12;
  const availableWidth = screenWidth - horizontalPadding;
  const flyerCardWidth =
    flyerColumns === 1 ? availableWidth : (availableWidth - gridGap) / 2;
  // Stable timestamps — computed once on mount, never change
  const windowStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const windowEnd = useMemo(() => NOW_PLUS_60_DAYS(), []);

  // Memoized query args — prevents Convex from seeing new object references each render
  const eventsArgs = useMemo(
    () => ({
      communityId,
      cursor: null as null,
      numItems: 8,
      fromTime: windowStart,
      toTime: windowEnd,
    }),
    [communityId, windowStart, windowEnd]
  );
  const remindersArgs = useMemo(
    () => ({ communityId, cursor: null as null, numItems: 8 }),
    [communityId]
  );
  const activityPreviewArgs = useMemo(
    () => ({ communityId, limit: 3 }),
    [communityId]
  );

  const eventsPage = useQuery(api.events.listByCommunityPaged, eventsArgs);
  const remindersPage = useQuery(
    api.tasks.listCommunityRemindersPaged,
    remindersArgs
  );
  const activityPreview = useQuery(
    api.communityActivities.listCommunityActivities,
    activityPreviewArgs
  ) as CommunityActivityItem[] | undefined;

  const events = (eventsPage?.page ?? []) as EventDoc[];
  const reminders = (remindersPage?.page ?? []) as TaskDoc[];

  const isLoadingEvents = eventsPage === undefined;
  const isLoadingReminders = remindersPage === undefined;
  const isLoadingActivityPreview = activityPreview === undefined;

  // hiddenReminderIds, localCompletedIds, localTaskCache come from parent props
  // so they survive tab switches

  // Pending move state: items in the 600ms visual transition (open → completed)
  const [pendingMoveIds, setPendingMoveIds] = useState<Set<string>>(new Set());
  const [pendingSnapshots, setPendingSnapshots] = useState<
    Map<string, TaskDoc>
  >(new Map());

  const activeEvents = events.filter((ev) => ev.status !== 'cancelled');

  const addCommunityEventToMyCalendar = useMutation(
    api.communityEventCalendar.addCommunityEventToMyCalendar
  );
  const removeCommunityEventFromMyCalendar = useMutation(
    api.communityEventCalendar.removeCommunityEventFromMyCalendar
  );
  const [
    calendarRemoveConfirmationEventId,
    setCalendarRemoveConfirmationEventId,
  ] = useState<Id<'events'> | null>(null);

  const showCalendarRemoveConfirmation = useCallback(
    (eventId: Id<'events'>): void => {
      setCalendarRemoveConfirmationEventId(eventId);
    },
    []
  );

  const handleConfirmCalendarRemoval = useCallback((): void => {
    if (!calendarRemoveConfirmationEventId) return;
    const eventId = calendarRemoveConfirmationEventId;
    setCalendarRemoveConfirmationEventId(null);
    removeCommunityEventFromMyCalendar({
      eventId,
      confirmRemoveWithActiveTask: true,
    }).catch(() => Alert.alert('שגיאה', 'לא ניתן לעדכן את היומן'));
  }, [calendarRemoveConfirmationEventId, removeCommunityEventFromMyCalendar]);

  const handleCancelCalendarRemoval = useCallback(
    (): void => setCalendarRemoveConfirmationEventId(null),
    []
  );

  const handleCalendarToggle = useCallback(
    async (eventId: Id<'events'>) => {
      const ev = activeEvents.find((e) => e._id === eventId);
      const saved = ev?.isSavedToMyCalendar === true;
      const hasMyAssignedTasks =
        taskCountsMap[eventId]?.hasMyAssignedTasks === true &&
        taskCountsMap[eventId]?.myAssignedTasks.length > 0;

      if (saved && hasMyAssignedTasks) {
        showCalendarRemoveConfirmation(eventId);
        return;
      }

      try {
        if (saved) {
          await removeCommunityEventFromMyCalendar({ eventId });
          return;
        }
        await addCommunityEventToMyCalendar({ eventId });
      } catch (error) {
        const errorCode = getConvexErrorCode(error);
        if (
          saved &&
          (errorCode === CALENDAR_REMOVE_CONFIRMATION_CODE ||
            errorCode === 'CALENDAR_REMOVE_BLOCKED_BY_ACTIVE_TASK')
        ) {
          showCalendarRemoveConfirmation(eventId);
          return;
        }
        Alert.alert('שגיאה', 'לא ניתן לעדכן את היומן');
      }
    },
    [
      activeEvents,
      addCommunityEventToMyCalendar,
      removeCommunityEventFromMyCalendar,
      showCalendarRemoveConfirmation,
      taskCountsMap,
    ]
  );

  const recentlyCancelledEvents = events.filter(
    (ev) =>
      ev.status === 'cancelled' &&
      ev.cancelledAt !== undefined &&
      Date.now() - ev.cancelledAt < 24 * 60 * 60 * 1000
  );

  // Section 1: events the user created, or RSVPed "yes", or open events in personal calendar
  const myEvents = activeEvents.filter((ev) => {
    if (currentUserId !== undefined && ev.createdBy === currentUserId)
      return true;
    if (ev.requiresRsvp === false) {
      return ev.isSavedToMyCalendar === true;
    }
    return (rsvpMap[ev._id] ?? 'none') === 'yes';
  });

  // Section 3: other members' events not in the user's personal calendar
  const pendingEvents = activeEvents.filter((ev) => {
    if (currentUserId !== undefined && ev.createdBy === currentUserId)
      return false;
    if (ev.requiresRsvp === false) {
      return !ev.isSavedToMyCalendar;
    }
    return (rsvpMap[ev._id] ?? 'none') !== 'yes';
  });

  // Section 2: merge query results with locally-completed tasks + pending-transition tasks
  const allRemindersForSection = useMemo(() => {
    const queryIds = new Set(reminders.map((t) => t._id as string));
    // Mark locally-completed items still in the query
    const fromQuery = reminders.map((t) =>
      localCompletedIds.has(t._id as string) ? { ...t, completed: true } : t
    );
    // Items that disappeared from the query (backend updated) but are cached locally
    const fromLocalCache = [...localCompletedIds]
      .filter((id) => !queryIds.has(id))
      .flatMap((id) => {
        const cached = localTaskCache.get(id);
        return cached ? [{ ...cached, completed: true }] : [];
      });
    // Items in pending transition that disappeared from query before 600ms elapsed
    const fromPendingCache = [...pendingMoveIds]
      .filter((id) => !queryIds.has(id) && !localCompletedIds.has(id))
      .flatMap((id) => {
        const snap = pendingSnapshots.get(id);
        return snap ? [{ ...snap, completed: false }] : [];
      });
    return uniqueById(
      [...fromQuery, ...fromLocalCache, ...fromPendingCache],
      (task) => task._id as string
    );
  }, [
    reminders,
    localCompletedIds,
    localTaskCache,
    pendingMoveIds,
    pendingSnapshots,
  ]);

  const visibleForSection = allRemindersForSection.filter(
    (t) => !hiddenReminderIds.has(t._id as string)
  );
  const openReminderItems = visibleForSection.filter(
    (t) => !t.completed && !pendingMoveIds.has(t._id as string)
  );
  const pendingMoveItems = visibleForSection.filter((t) =>
    pendingMoveIds.has(t._id as string)
  );
  const completedReminderItems = visibleForSection.filter(
    (t) => t.completed && !pendingMoveIds.has(t._id as string)
  );
  const openCount = openReminderItems.length + pendingMoveItems.length;
  const completedCount = completedReminderItems.length;
  const remindersSummaryText =
    completedCount > 0
      ? `${openCount} פתוחות · ${completedCount} הושלמו`
      : `${openCount} פתוחות`;

  const handleToggleInSection = useCallback(
    (id: Id<'tasks'>) => {
      const task = allRemindersForSection.find((t) => t._id === id);
      const isEffectivelyCompleted = task?.completed ?? false;
      const isPending = pendingMoveIds.has(id as string);

      if (!isEffectivelyCompleted && !isPending) {
        // Open → completing: 600ms visual delay before moving to completed group
        const taskSnapshot = task;
        if (taskSnapshot) {
          setPendingSnapshots((prev) =>
            new Map(prev).set(id as string, taskSnapshot)
          );
        }
        setPendingMoveIds((prev) => new Set([...prev, id as string]));
        setTimeout(() => {
          setPendingMoveIds((prev) => {
            const s = new Set(prev);
            s.delete(id as string);
            return s;
          });
          setPendingSnapshots((prev) => {
            const m = new Map(prev);
            m.delete(id as string);
            return m;
          });
          if (taskSnapshot) {
            setLocalCompletedIds((prev) => new Set([...prev, id as string]));
            setLocalTaskCache((prev) =>
              new Map(prev).set(id as string, taskSnapshot)
            );
          }
        }, 600);
      } else if (isEffectivelyCompleted || isPending) {
        // Completed/pending → open
        if (isPending) {
          setPendingMoveIds((prev) => {
            const s = new Set(prev);
            s.delete(id as string);
            return s;
          });
          setPendingSnapshots((prev) => {
            const m = new Map(prev);
            m.delete(id as string);
            return m;
          });
        }
        setLocalCompletedIds((prev) => {
          const s = new Set(prev);
          s.delete(id as string);
          return s;
        });
      }
      onToggleTask(id);
    },
    [
      allRemindersForSection,
      pendingMoveIds,
      onToggleTask,
      setLocalCompletedIds,
      setLocalTaskCache,
    ]
  );

  const handleHideReminder = useCallback(
    (id: string) => {
      setHiddenReminderIds((prev) => new Set([...prev, id]));
      setLocalCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [setHiddenReminderIds, setLocalCompletedIds]
  );

  return (
    <>
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: האירועים שלי */}
        <View>
          <SectionHeader
            title="האירועים שלי"
            subtitle="אירועים שיצרת או שאישרת הגעה"
          />
          {isLoadingEvents ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
          ) : myEvents.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallText}>
                עדיין לא הצטרפת לאירועים בקהילה זו
              </Text>
            </View>
          ) : (
            <View style={styles.eventsGrid}>
              {myEvents.map((ev) => {
                const privilegedFlyer =
                  communityMyRole === 'owner' ||
                  communityMyRole === 'admin' ||
                  ev.createdBy === currentUserId;
                const showTaskMetrics =
                  privilegedFlyer || ev.tasksVisibleToParticipants === true;
                return (
                  <CommunityEventFlyerCard
                    key={ev._id}
                    event={ev}
                    isSavedToMyCalendar={ev.isSavedToMyCalendar}
                    onCalendarToggle={handleCalendarToggle}
                    rsvpStatus={rsvpMap[ev._id] ?? 'none'}
                    taskSummary={taskCountsMap[ev._id]}
                    cardWidth={flyerCardWidth}
                    flyerDetailsOnly={privilegedFlyer}
                    showTaskMetrics={showTaskMetrics}
                    onOpenDetails={onOpenEventDetails}
                    onRsvpSelect={onInlineRsvp}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── Section 2: כדאי לזכור (accordion) */}
        <View>
          {/* Header — always visible */}
          <Pressable
            onPress={() => setIsRemindersOpen((v) => !v)}
            style={styles.accordionHeader}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`כדאי לזכור, ${remindersSummaryText}`}
            accessibilityState={{ expanded: isRemindersOpen }}
          >
            {/* Left: chevron + summary badge */}
            <View style={styles.accordionLeft}>
              <Ionicons
                name={isRemindersOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#6b7280"
              />
              {!isLoadingReminders && (
                <View style={styles.reminderSummaryBadge}>
                  <Text style={styles.reminderSummaryText}>
                    {remindersSummaryText}
                  </Text>
                </View>
              )}
            </View>
            {/* Right: title */}
            <Text style={styles.accordionTitle}>כדאי לזכור</Text>
          </Pressable>

          {/* Body — visible only when open */}
          {isRemindersOpen &&
            (isLoadingReminders ? (
              <ActivityIndicator
                color={PRIMARY}
                style={{ marginVertical: 16 }}
              />
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                {/* Group 1: open (not completed) */}
                {openReminderItems.map((t) => (
                  <ReminderRowAll
                    key={t._id}
                    task={t}
                    onToggle={handleToggleInSection}
                  />
                ))}
                {/* Group 1: pending items (transitioning to completed — visually shown as completed) */}
                {pendingMoveItems.map((t) => (
                  <ReminderRowAll
                    key={t._id}
                    task={{ ...t, completed: true }}
                    onToggle={handleToggleInSection}
                  />
                ))}
                {/* Group 2: completed */}
                {completedReminderItems.length > 0 && (
                  <>
                    <Text style={styles.completedGroupTitle}>הושלמו</Text>
                    {completedReminderItems.map((t) => (
                      <ReminderRowAll
                        key={t._id}
                        task={t}
                        onToggle={handleToggleInSection}
                        onHide={handleHideReminder}
                      />
                    ))}
                  </>
                )}
                {/* Empty state */}
                {openReminderItems.length === 0 &&
                  pendingMoveItems.length === 0 &&
                  completedReminderItems.length === 0 && (
                    <View style={styles.emptySmall}>
                      <Text style={styles.emptySmallText}>
                        אין תזכורות לקהילה זו
                      </Text>
                    </View>
                  )}
              </View>
            ))}
        </View>

        {/* ── Section 3: אירועים נוספים */}
        <View>
          <SectionHeader
            title="אירועים נוספים"
            subtitle="אירועים בקהילה שעדיין לא הגבת אליהם"
          />
          {isLoadingEvents ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
          ) : pendingEvents.length === 0 ? (
            <View style={[styles.emptySmall, { alignItems: 'center', gap: 8 }]}>
              <Ionicons name="calendar-outline" size={36} color="#d1d5db" />
              <Text style={[styles.emptySmallText, { textAlign: 'center' }]}>
                אין אירועים נוספים להצגה
              </Text>
            </View>
          ) : (
            <View style={styles.eventsGrid}>
              {pendingEvents.map((ev) => {
                const privilegedFlyer =
                  communityMyRole === 'owner' || communityMyRole === 'admin';
                const showTaskMetrics =
                  privilegedFlyer || ev.tasksVisibleToParticipants === true;
                return (
                  <CommunityEventFlyerCard
                    key={ev._id}
                    event={ev}
                    isSavedToMyCalendar={ev.isSavedToMyCalendar}
                    onCalendarToggle={handleCalendarToggle}
                    rsvpStatus={rsvpMap[ev._id] ?? 'none'}
                    taskSummary={taskCountsMap[ev._id]}
                    cardWidth={flyerCardWidth}
                    flyerDetailsOnly={privilegedFlyer}
                    showTaskMetrics={showTaskMetrics}
                    onOpenDetails={onOpenEventDetails}
                    onRsvpSelect={onInlineRsvp}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── Section 4: פעילות בקהילה */}
        <View>
          <SectionHeader title="פעילות בקהילה" />
          {isLoadingActivityPreview ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
          ) : activityPreview.length === 0 ? (
            <View style={styles.activityPlaceholder}>
              <Ionicons name="pulse-outline" size={36} color="#d1d5db" />
              <Text style={[styles.emptySmallText, { textAlign: 'center' }]}>
                פעילות אחרונה תופיע כאן בקרוב
              </Text>
            </View>
          ) : (
            <ActivityList
              activities={activityPreview}
              onOpenEventDetails={onOpenEventDetails}
            />
          )}
        </View>

        {/* ── Section 5: אירועים שבוטלו (24h window) */}
        {recentlyCancelledEvents.length > 0 ? (
          <View style={styles.cancelledEventsSection}>
            <Text style={styles.cancelledEventsTitle}>אירועים שבוטלו</Text>
            <View style={styles.eventsGrid}>
              {recentlyCancelledEvents.map((ev) => {
                const privilegedCancelled =
                  communityMyRole === 'owner' ||
                  communityMyRole === 'admin' ||
                  ev.createdBy === currentUserId;
                const showTaskMetrics =
                  privilegedCancelled || ev.tasksVisibleToParticipants === true;
                return (
                  <CommunityEventFlyerCard
                    key={ev._id}
                    event={ev}
                    rsvpStatus="none"
                    taskSummary={taskCountsMap[ev._id]}
                    cardWidth={flyerCardWidth}
                    flyerDetailsOnly
                    showTaskMetrics={showTaskMetrics}
                    onOpenDetails={onOpenEventDetails}
                    onRsvpSelect={onInlineRsvp}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <AppConfirmationDialog
        cancelLabel="ביטול"
        confirmDestructive
        confirmLabel="להסיר בכל זאת"
        message={CALENDAR_REMOVE_CONFIRM_MESSAGE}
        onCancel={handleCancelCalendarRemoval}
        onConfirm={handleConfirmCalendarRemoval}
        title={CALENDAR_REMOVE_CONFIRM_TITLE}
        visible={calendarRemoveConfirmationEventId !== null}
      />
    </>
  );
}

// ─── Tab: אירועים ─────────────────────────────────────────────────────────────

interface TabEventsProps {
  communityId: Id<'communities'>;
  rsvpMap: Record<string, RsvpStatus>;
  onRsvpPress: (eventId: Id<'events'>) => void;
  onOpenEventDetails: (eventId: Id<'events'>) => void;
  selectedMonth: Date;
  onMonthChange: (d: Date) => void;
  searchQuery: string;
  currentUserId?: Id<'users'>;
  taskCountsMap: Record<string, TaskSummary>;
}

function TabEvents({
  communityId,
  rsvpMap,
  onRsvpPress,
  onOpenEventDetails,
  selectedMonth,
  onMonthChange,
  searchQuery,
  currentUserId,
  taskCountsMap,
}: TabEventsProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<EventDoc[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const monthStart = useMemo(
    () =>
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      ).getTime(),
    [selectedMonth]
  );
  const monthEnd = useMemo(
    () =>
      new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime(),
    [selectedMonth]
  );

  const page = useQuery(api.events.listByCommunityPaged, {
    communityId,
    cursor,
    numItems: 20,
    fromTime: monthStart,
    toTime: monthEnd,
  });

  useEffect(() => {
    if (page?.page) {
      setAccumulated((prev) => {
        const ids = new Set(prev.map((e) => e._id));
        const newItems = (page.page as EventDoc[]).filter(
          (e) => !ids.has(e._id)
        );
        return cursor === null
          ? (page.page as EventDoc[])
          : [...prev, ...newItems];
      });
      setLoadingMore(false);
    }
  }, [page, cursor]);

  // Reset when month changes
  useEffect(() => {
    setCursor(null);
    setAccumulated([]);
  }, [monthStart]);

  const gracePeriod = 24 * 60 * 60 * 1000;
  const activeEvents = accumulated.filter((ev) => ev.status !== 'cancelled');
  const cancelledEvents = accumulated.filter(
    (ev) =>
      ev.status === 'cancelled' &&
      ev.cancelledAt !== undefined &&
      Date.now() - ev.cancelledAt < gracePeriod
  );

  const filtered = useMemo(() => {
    let result = activeEvents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q)
      );
    }
    const now = Date.now();
    return result.sort((a, b) => {
      const aPast = isEventPast(a);
      const bPast = isEventPast(b);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return a.startTime - b.startTime;
    });
  }, [activeEvents, searchQuery]);

  const monthLabel = selectedMonth.toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  });

  const renderItem = useCallback(
    ({ item }: { item: EventDoc }) => (
      <EventRow
        event={item}
        rsvpStatus={rsvpMap[item._id] ?? 'none'}
        onRsvpPress={onRsvpPress}
        onOpenDetails={onOpenEventDetails}
        taskSummary={taskCountsMap[item._id]}
      />
    ),
    [rsvpMap, onRsvpPress, onOpenEventDetails, taskCountsMap]
  );

  const keyExtractor = useCallback((item: EventDoc) => item._id, []);

  const handleLoadMore = useCallback(() => {
    if (page?.isDone === false && page.continueCursor && !loadingMore) {
      setLoadingMore(true);
      setCursor(page.continueCursor);
    }
  }, [page, loadingMore]);

  return (
    <View style={styles.tabFlex}>
      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(selectedMonth);
            d.setMonth(d.getMonth() + 1);
            onMonthChange(d);
          }}
          style={styles.monthArrow}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חודש הבא"
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(selectedMonth);
            d.setMonth(d.getMonth() - 1);
            onMonthChange(d);
          }}
          style={styles.monthArrow}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חודש קודם"
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {page === undefined ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyFull}>
          <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>אין אירועים בחודש זה</Text>
        </View>
      ) : (
        <FlatList<EventDoc>
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            <View>
              {loadingMore ? (
                <ActivityIndicator
                  color={PRIMARY}
                  style={{ marginVertical: 16 }}
                />
              ) : null}
              {cancelledEvents.length > 0 ? (
                <View style={styles.cancelledEventsSection}>
                  <Text style={styles.cancelledEventsTitle}>
                    אירועים שבוטלו
                  </Text>
                  <Text style={styles.cancelledEventsSubtitle}>
                    אירועים שבוטלו יוסרו מהתצוגה לאחר 24 שעות מרגע ביטולם
                  </Text>
                  {cancelledEvents.map((ev) => (
                    <EventRow
                      key={ev._id}
                      event={ev}
                      rsvpStatus="none"
                      onRsvpPress={() => {}}
                      onOpenDetails={onOpenEventDetails}
                      isCancelled
                      cancelReason={ev.cancelReason}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Tab: תזכורות ─────────────────────────────────────────────────────────────

interface TabRemindersProps {
  communityId: Id<'communities'>;
  onToggle: (id: Id<'tasks'>) => void;
}

function TabReminders({ communityId, onToggle }: TabRemindersProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<TaskDoc[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const since30Days = useMemo(() => Date.now() - 30 * 24 * 60 * 60 * 1000, []);

  const page = useQuery(api.tasks.listCommunityRemindersPaged, {
    communityId,
    cursor,
    numItems: 20,
  });

  const completedPage = useQuery(api.tasks.listCompletedCommunityReminders, {
    communityId,
    since: since30Days,
  });

  useEffect(() => {
    if (page?.page) {
      setAccumulated((prev) => {
        const ids = new Set(prev.map((t) => t._id));
        const newItems = (page.page as TaskDoc[]).filter(
          (t) => !ids.has(t._id)
        );
        return cursor === null
          ? (page.page as TaskDoc[])
          : [...prev, ...newItems];
      });
      setLoadingMore(false);
    }
  }, [page, cursor]);

  const handleLoadMore = useCallback(() => {
    if (page?.isDone === false && page.continueCursor && !loadingMore) {
      setLoadingMore(true);
      setCursor(page.continueCursor);
    }
  }, [page, loadingMore]);

  const completedTasks = (completedPage ?? []) as TaskDoc[];
  const historyCount = completedTasks.length;

  if (page === undefined) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section 1: תזכורות פתוחות */}
      <View style={{ marginHorizontal: 16, marginTop: 16 }}>
        <SectionHeader title="תזכורות פתוחות" />
        {accumulated.length === 0 ? (
          <View style={[styles.emptySmall, { alignItems: 'center', gap: 8 }]}>
            <Ionicons
              name="checkmark-circle-outline"
              size={36}
              color="#d1d5db"
            />
            <Text style={[styles.emptySmallText, { textAlign: 'center' }]}>
              כל התזכורות טופלו 🎉
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {accumulated.map((t) => (
              <ReminderRowAll key={t._id} task={t} onToggle={onToggle} />
            ))}
            {loadingMore ? (
              <ActivityIndicator
                color={PRIMARY}
                style={{ marginVertical: 8 }}
              />
            ) : page?.isDone === false ? (
              <TouchableOpacity
                onPress={handleLoadMore}
                style={{ paddingVertical: 12, alignItems: 'center' }}
                accessible
                accessibilityRole="button"
                accessibilityLabel="טען עוד"
              >
                <Text
                  style={{ color: PRIMARY, fontSize: 14, fontWeight: '600' }}
                >
                  טען עוד
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Section 2: תזכורות אחרונות (30 days history) */}
      {historyCount > 0 ? (
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              onPress={() => setShowHistory((v) => !v)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                showHistory ? 'הסתר היסטוריה' : `הצג היסטוריה ${historyCount}`
              }
            >
              <Text style={styles.sectionAction}>
                {showHistory ? 'הסתר' : `הצג היסטוריה (${historyCount})`}
              </Text>
            </TouchableOpacity>
            <View style={styles.sectionRight}>
              <Text style={styles.sectionTitle}>תזכורות אחרונות</Text>
              <Text style={styles.sectionSubtitle}>
                תזכורות שטופלו נשמרות כאן עד 30 יום
              </Text>
            </View>
          </View>
          {showHistory ? (
            <View style={{ gap: 8 }}>
              {completedTasks.map((t) => (
                <ReminderRowAll key={t._id} task={t} onToggle={onToggle} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Tab: פעילות ─────────────────────────────────────────────────────────────

interface TabActivityProps {
  communityId: Id<'communities'>;
  onOpenEventDetails: (eventId: Id<'events'>) => void;
}

function TabActivity({ communityId, onOpenEventDetails }: TabActivityProps) {
  const activityArgs = useMemo(
    () => ({ communityId, limit: 50 }),
    [communityId]
  );
  const activities = useQuery(
    api.communityActivities.listCommunityActivities,
    activityArgs
  ) as CommunityActivityItem[] | undefined;

  if (activities === undefined) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyFull}>
        <Ionicons name="pulse-outline" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>פעילות הקהילה תופיע כאן בקרוב</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <ActivityList
        activities={activities}
        grouped
        onOpenEventDetails={onOpenEventDetails}
      />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const convex = useConvex();
  const communityId = id as Id<'communities'>;

  // ── Queries
  const community = useQuery(api.communities.getCommunity, { communityId });
  const myRsvps = useQuery(api.eventRsvps.listByUser);
  const currentUserId = useQuery(api.users.getMyId) ?? undefined;
  const taskCountsMap =
    useQuery(api.eventTasks.getTaskCountsByCommunity, { communityId }) ?? {};

  // ── Mutations
  const upsertRsvp = useMutation(api.eventRsvps.upsertRsvp);
  const setRsvpNoAndUnclaimMyEventTasks = useMutation(
    api.eventRsvps.setRsvpNoAndUnclaimMyEventTasks
  );
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const deleteCommunity = useMutation(api.communities.deleteCommunity);
  const markCommunityViewed = useMutation(api.communities.markCommunityViewed);
  const updateJoinApprovalMode = useMutation(
    api.communities.updateCommunityJoinApprovalMode
  );

  // ── Local state
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (tab && (TABS as readonly string[]).includes(tab)) return tab as Tab;
    return 'הכל';
  });
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 8, y: 80 });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState({ x: 8, y: 80 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [joinApprovalOpen, setJoinApprovalOpen] = useState(false);
  const [joinApprovalDraft, setJoinApprovalDraft] =
    useState<JoinApprovalMode>('automatic');
  const [joinApprovalSaving, setJoinApprovalSaving] = useState(false);
  const [rsvpSheet, setRsvpSheet] = useState<Id<'events'> | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<Id<'events'> | null>(
    null
  );
  const [blockedRsvpDialog, setBlockedRsvpDialog] = useState<{
    eventId: Id<'events'>;
    count: number;
  } | null>(null);
  const lastDragCloseTime = useRef<number>(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionCanExpand, setDescriptionCanExpand] = useState(false);
  const menuBtnRef = useRef<View>(null);

  // Reset description when switching communities
  useEffect(() => {
    setDescriptionExpanded(false);
    setDescriptionCanExpand(false);
  }, [communityId, community?.description]);

  // Mark viewed for list "new events" hint — only for fully approved members
  useEffect(() => {
    if (community === undefined || community === null) return;
    if (community.myMembershipStatus === 'pending') return;
    markCommunityViewed({ communityId }).catch(() => {
      // non-blocking
    });
  }, [communityId, community, markCommunityViewed]);
  const addBtnRef = useRef<View>(null);

  // ── Persisted TabAll state — lifted here so it survives tab switches
  const [hiddenReminderIds, setHiddenReminderIds] = useState<Set<string>>(
    new Set()
  );
  const [localCompletedIds, setLocalCompletedIds] = useState<Set<string>>(
    new Set()
  );
  const [localTaskCache, setLocalTaskCache] = useState<Map<string, TaskDoc>>(
    new Map()
  );

  // ── Back navigation — inner tabs go back to הכל, הכל goes to communities list
  const handleBack = useCallback(() => {
    if (activeTab !== 'הכל') {
      setActiveTab('הכל');
      return;
    }
    router.replace(
      '/(authenticated)/communities' as Parameters<typeof router.replace>[0]
    );
  }, [router, activeTab]);

  // ── RSVP map
  const rsvpMap = useMemo<Record<string, RsvpStatus>>(() => {
    if (!myRsvps) return {};
    return Object.fromEntries(
      myRsvps.map((r) => [r.eventId, r.status as RsvpStatus])
    );
  }, [myRsvps]);

  // ── Handlers
  const handleBlockedRsvpNo = useCallback(
    (eventId: Id<'events'>, count: number) => {
      setBlockedRsvpDialog({ eventId, count });
    },
    []
  );

  const handleRsvpSelect = useCallback(
    async (status: RsvpStatus) => {
      if (!rsvpSheet) return;
      if (status === 'no') {
        const assignedState = await convex.query(
          api.eventRsvps.hasMyAssignedEventTasksForEvent,
          { eventId: rsvpSheet }
        );
        if (assignedState.hasAssignedTasks) {
          handleBlockedRsvpNo(rsvpSheet, assignedState.count);
          return;
        }
      }
      upsertRsvp({ eventId: rsvpSheet, status }).catch((error) => {
        if (
          status === 'no' &&
          getConvexErrorCode(error) === 'RSVP_NO_BLOCKED_BY_ACTIVE_TASK'
        ) {
          handleBlockedRsvpNo(rsvpSheet, 1);
          return;
        }
        Alert.alert('שגיאה', 'לא ניתן לשמור תגובה');
      });
    },
    [convex, handleBlockedRsvpNo, rsvpSheet, upsertRsvp]
  );

  const handleInlineRsvp = useCallback(
    async (eventId: Id<'events'>, status: RsvpStatus) => {
      if (status === 'no') {
        const assignedState = await convex.query(
          api.eventRsvps.hasMyAssignedEventTasksForEvent,
          { eventId }
        );
        if (assignedState.hasAssignedTasks) {
          handleBlockedRsvpNo(eventId, assignedState.count);
          return;
        }
      }
      await upsertRsvp({ eventId, status }).catch((error) => {
        if (
          status === 'no' &&
          getConvexErrorCode(error) === 'RSVP_NO_BLOCKED_BY_ACTIVE_TASK'
        ) {
          handleBlockedRsvpNo(eventId, 1);
          return;
        }
        Alert.alert('שגיאה', 'לא ניתן לעדכן אישור הגעה');
      });
    },
    [convex, handleBlockedRsvpNo, upsertRsvp]
  );

  const handleOpenEventDetails = useCallback((eventId: Id<'events'>) => {
    if (Date.now() - lastDragCloseTime.current < 600) return;

    setSelectedEventId(eventId);
  }, []);

  const handleCloseEventDetails = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleNavigateToLocation = useCallback((location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('שגיאה', 'לא ניתן לפתוח ניווט כרגע')
    );
  }, []);

  const handleToggleTask = useCallback(
    (taskId: Id<'tasks'>) => {
      toggleCompleted({ id: taskId }).catch(() =>
        Alert.alert('שגיאה', 'לא ניתן לעדכן תזכורת')
      );
      // TODO: add optimistic update
    },
    [toggleCompleted]
  );

  const handleDeleteCommunity = useCallback(() => {
    Alert.alert(
      'מחיקת קהילה',
      'מחיקת קהילה תמחק גם את כל האירועים והתזכורות שלה עבור כל החברים. פעולה זו אינה הפיכה.',
      [
        { text: 'בטל', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCommunity({ communityId });
              router.back();
            } catch {
              Alert.alert('שגיאה', 'לא ניתן למחוק את הקהילה');
            }
          },
        },
      ]
    );
  }, [deleteCommunity, communityId, router]);

  const handleOpenJoinApprovalSettings = useCallback(() => {
    setJoinApprovalDraft(community?.joinApprovalMode ?? 'automatic');
    setJoinApprovalOpen(true);
  }, [community?.joinApprovalMode]);

  const handleSaveJoinApproval = useCallback(async () => {
    try {
      setJoinApprovalSaving(true);
      await updateJoinApprovalMode({
        communityId,
        joinApprovalMode: joinApprovalDraft,
      });
      setJoinApprovalOpen(false);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לשמור את ההגדרות');
    } finally {
      setJoinApprovalSaving(false);
    }
  }, [communityId, joinApprovalDraft, updateJoinApprovalMode]);

  const handleSeeMoreEvents = useCallback(() => setActiveTab('אירועים'), []);
  const handleSeeMoreReminders = useCallback(() => setActiveTab('תזכורות'), []);

  const handleShare = useCallback(() => {
    const code = community?.inviteCode;
    const name = community?.name ?? 'קהילה';
    const message = code
      ? `הצטרפו לקהילה "${name}":\ninyomi://community-join/${code}`
      : `הצטרפו לקהילה "${name}" באפליקציית InYomi`;
    // Delay to ensure the ⋯ menu modal has fully dismissed before the system Share sheet opens
    setTimeout(async () => {
      try {
        await Share.share({ message });
      } catch (e) {
        console.error('Share failed:', e);
        Alert.alert('שגיאה', 'לא ניתן לשתף כרגע');
      }
    }, 300);
  }, [community]);

  // Overflow menu opens from the LEFT — position uses left: px
  const handleMenuPress = useCallback(() => {
    if (!menuBtnRef.current) {
      setMenuPos({ x: 8, y: 80 });
      setMenuOpen(true);
      return;
    }
    menuBtnRef.current.measure((_fx, _fy, _w, h, px, py) => {
      setMenuPos({ x: Math.max(0, px), y: py + h + 4 });
      setMenuOpen(true);
    });
  }, []);

  // Add popover anchored to exact button position using measureInWindow
  const handleAddPress = useCallback(() => {
    if (!addBtnRef.current) {
      setAddMenuPos({ x: 8, y: 80 });
      setAddMenuOpen(true);
      return;
    }
    addBtnRef.current.measureInWindow((x, y, _w, h) => {
      setAddMenuPos({ x, y: y + h + 4 });
      setAddMenuOpen(true);
    });
  }, []);

  const overflowItems = useMemo<OverflowItem[]>(
    () => [
      {
        label: 'הצג ביומן',
        iconName: 'calendar-outline',
        onPress: () => {
          // TODO: add communityId filter to calendar screen
          router.push(
            `/(authenticated)/calendar?communityId=${communityId}` as Parameters<
              typeof router.push
            >[0]
          );
        },
      },
      ...(community?.myRole === 'owner' || community?.myRole === 'admin'
        ? [
            {
              label: 'ערוך קהילה',
              iconName: 'create-outline' as const,
              onPress: () =>
                router.push({
                  pathname: '/(authenticated)/community-edit/[id]',
                  params: { id: communityId, returnTo: 'detail' },
                }),
            },
          ]
        : []),
      {
        label: 'ניהול חברים',
        iconName: 'people-outline',
        onPress: () =>
          router.push(
            `/(authenticated)/community-members/${communityId}?returnTab=${activeTab}` as Parameters<
              typeof router.push
            >[0]
          ),
      },
      ...(community?.myRole === 'owner' || community?.myRole === 'admin'
        ? [
            {
              label: 'הגדרות הצטרפות',
              iconName: 'settings-outline' as const,
              onPress: handleOpenJoinApprovalSettings,
            },
          ]
        : []),
      {
        label: 'שיתוף קישור',
        iconName: 'share-outline',
        onPress: handleShare,
      },
      {
        label: 'מחיקת קהילה',
        iconName: 'trash-outline',
        danger: true,
        onPress: handleDeleteCommunity,
      },
    ],
    [
      community,
      communityId,
      router,
      activeTab,
      handleOpenJoinApprovalSettings,
      handleDeleteCommunity,
      handleShare,
    ]
  );

  // ── Loading / not found
  if (community === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (community === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>אין לך גישה לקהילה הזו</Text>
          <Text style={styles.emptySubText}>
            יכול להיות שהוסרת מהקהילה או שהקישור כבר לא פעיל.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() =>
              router.replace(
                '/(authenticated)/communities' as Parameters<
                  typeof router.replace
                >[0]
              )
            }
            accessible
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>חזרה לקהילות</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (community.myMembershipStatus === 'pending') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.pendingGateHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.pendingGateTitle} numberOfLines={1}>
            {community.name}
          </Text>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerIconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזרה לרשימת הקהילות"
          >
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingCenter}>
          <Ionicons name="time-outline" size={52} color="#94a3b8" />
          <Text style={[styles.emptyText, styles.pendingGateMessage]}>
            בקשת ההצטרפות נשלחה וממתינה לאישור מנהל הקהילה
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const memberLabel = `${community.tags?.[0] ? `${community.tags[0]} • ` : ''}${community.memberCount} חברים`;
  const descriptionTrimmed = community.description?.trim();
  const showDescription = !!descriptionTrimmed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header */}
      <View style={styles.header}>
        {/* שמאל: ⋯ בלבד */}
        <View style={styles.headerLeft}>
          <View ref={menuBtnRef}>
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.headerIconBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel="אפשרויות"
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ימין: › + שם + "+" */}
        <View style={styles.headerRight}>
          <View ref={addBtnRef}>
            <TouchableOpacity
              onPress={handleAddPress}
              activeOpacity={0.75}
              accessible
              accessibilityRole="button"
              accessibilityLabel="הוסף אירוע או תזכורת"
              style={styles.communityHeaderAddButton}
            >
              <Plus size={18} color="#36a9e2" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {community.name}
            </Text>
            <Text style={styles.headerSubtitle}>{memberLabel}</Text>
            {showDescription ? (
              <View style={styles.headerDescriptionWrap}>
                <Text
                  style={[
                    styles.headerDescription,
                    styles.headerDescriptionMeasurer,
                  ]}
                  onTextLayout={(e) => {
                    const n = e.nativeEvent.lines.length;
                    setDescriptionCanExpand(n > 1);
                  }}
                >
                  {descriptionTrimmed}
                </Text>
                <View style={styles.headerDescriptionRow}>
                  <Text
                    style={[
                      styles.headerDescription,
                      descriptionCanExpand &&
                        styles.headerDescriptionWithToggle,
                    ]}
                    numberOfLines={descriptionExpanded ? 4 : 1}
                  >
                    {descriptionTrimmed}
                  </Text>
                  {descriptionCanExpand ? (
                    <TouchableOpacity
                      onPress={() => setDescriptionExpanded((s) => !s)}
                      style={styles.headerDescriptionToggleWrap}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={descriptionExpanded ? 'פחות' : 'עוד'}
                    >
                      <Text style={styles.headerDescriptionToggle}>
                        {descriptionExpanded ? 'פחות' : 'עוד'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerIconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(tab)}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab}
            >
              <Text
                style={[styles.tabChipText, active && styles.tabChipTextActive]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content */}
      {activeTab === 'הכל' && (
        <TabAll
          communityId={communityId}
          rsvpMap={rsvpMap}
          onToggleTask={handleToggleTask}
          onOpenEventDetails={handleOpenEventDetails}
          onSeeMoreEvents={handleSeeMoreEvents}
          onSeeMoreReminders={handleSeeMoreReminders}
          hiddenReminderIds={hiddenReminderIds}
          setHiddenReminderIds={setHiddenReminderIds}
          localCompletedIds={localCompletedIds}
          setLocalCompletedIds={setLocalCompletedIds}
          localTaskCache={localTaskCache}
          setLocalTaskCache={setLocalTaskCache}
          isRemindersOpen={isRemindersOpen}
          setIsRemindersOpen={setIsRemindersOpen}
          currentUserId={currentUserId}
          taskCountsMap={taskCountsMap}
          onInlineRsvp={handleInlineRsvp}
          communityMyRole={community?.myRole ?? undefined}
        />
      )}
      {activeTab === 'אירועים' && (
        <TabEvents
          communityId={communityId}
          rsvpMap={rsvpMap}
          onRsvpPress={setRsvpSheet}
          onOpenEventDetails={handleOpenEventDetails}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          searchQuery={searchQuery}
          currentUserId={currentUserId}
          taskCountsMap={taskCountsMap}
        />
      )}
      {activeTab === 'תזכורות' && (
        <TabReminders communityId={communityId} onToggle={handleToggleTask} />
      )}
      {activeTab === 'פעילות' && (
        <TabActivity
          communityId={communityId}
          onOpenEventDetails={handleOpenEventDetails}
        />
      )}

      {/* ── Modals */}
      <AddPopoverMenu
        visible={addMenuOpen}
        position={addMenuPos}
        communityId={communityId}
        canCreateCommunityEvent={
          community?.myRole === 'owner' || community?.myRole === 'admin'
        }
        onClose={() => setAddMenuOpen(false)}
      />

      <RsvpBottomSheet
        eventId={rsvpSheet}
        currentStatus={rsvpSheet ? (rsvpMap[rsvpSheet] ?? 'none') : 'none'}
        onSelect={handleRsvpSelect}
        onClose={() => setRsvpSheet(null)}
      />

      <EventDetailsBottomSheet
        eventId={selectedEventId}
        visible={selectedEventId !== null}
        onDragClose={() => {
          lastDragCloseTime.current = Date.now();
        }}
        onClose={handleCloseEventDetails}
        onNavigate={handleNavigateToLocation}
      />

      <OverflowMenu
        visible={menuOpen}
        position={menuPos}
        items={overflowItems}
        onClose={() => setMenuOpen(false)}
      />

      <JoinApprovalSettingsModal
        visible={joinApprovalOpen}
        value={joinApprovalDraft}
        saving={joinApprovalSaving}
        onChange={setJoinApprovalDraft}
        onClose={() => setJoinApprovalOpen(false)}
        onSave={handleSaveJoinApproval}
      />

      <SearchModal
        visible={searchOpen}
        value={searchQuery}
        onChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
      />
      <RsvpBlockedByTaskDialog
        assignedTaskCount={blockedRsvpDialog?.count ?? 1}
        onClose={() => setBlockedRsvpDialog(null)}
        onConfirm={() => {
          if (!blockedRsvpDialog) return;
          const eventId = blockedRsvpDialog.eventId;
          setBlockedRsvpDialog(null);
          setRsvpNoAndUnclaimMyEventTasks({ eventId }).catch(() =>
            Alert.alert('שגיאה', 'לא ניתן לעדכן אישור הגעה')
          );
        }}
        visible={blockedRsvpDialog !== null}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerTextBlock: { alignItems: 'flex-end', flex: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'right',
  },
  headerDescriptionWrap: { marginTop: 6, width: '100%' },
  headerDescriptionRow: {
    alignItems: 'flex-end',
  },
  headerDescription: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  headerDescriptionWithToggle: { width: '100%' },
  headerDescriptionMeasurer: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    maxWidth: '100%',
  },
  headerDescriptionToggleWrap: { marginTop: 2, minHeight: 18 },
  headerDescriptionToggle: {
    fontSize: 12,
    color: '#36a9e2',
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  communityHeaderAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF7FD',
    borderWidth: 1,
    borderColor: '#BEE7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tabs strip
  tabsScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    maxHeight: 50,
  },
  tabsRow: {
    flexGrow: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabChip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabChipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  tabChipTextActive: { color: '#fff', fontWeight: '600' },

  // ── Scroll / flex
  tabScroll: { flex: 1 },
  tabFlex: { flex: 1 },
  tabContent: { padding: 16, gap: 20, paddingBottom: 100 },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sectionRight: { flex: 1, alignItems: 'flex-end' },
  sectionLeft: { alignItems: 'flex-start', minWidth: 60 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  sectionAction: { fontSize: 13, color: PRIMARY, fontWeight: '600' },

  // ── Events grid
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  flyerCard: {
    minHeight: 272,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  flyerCardBody: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
  },
  flyerPill: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  flyerPillText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  flyerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    minHeight: 48,
  },
  flyerImportantItemsChip: {
    alignSelf: 'center',
    backgroundColor: '#E6F4FB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BAE6FD',
  },
  flyerImportantItemsSlot: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  flyerImportantItemsChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    textAlign: 'center',
  },
  flyerDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 9,
    paddingHorizontal: 4,
    gap: 8,
  },
  flyerDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    maxHeight: 1,
    opacity: 0.75,
  },
  flyerDividerDiamond: {
    fontSize: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
  flyerDate: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 4,
  },
  flyerTime: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  flyerLocation: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 8,
    width: '100%',
  },
  flyerMeta: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 3,
    width: '100%',
  },
  flyerMetaEmphasis: {
    fontWeight: '700',
  },
  flyerMetaDone: {
    color: '#16a34a',
  },
  flyerMetaLast: {
    marginBottom: 0,
  },
  taskSummaryPressable: {
    width: '100%',
  },
  myTasksIndicator: {
    color: PRIMARY,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  myTasksTooltipBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15,23,42,0.08)',
  },
  myTasksTooltip: {
    minWidth: 220,
    maxWidth: 300,
    alignItems: 'flex-end',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: 6,
  },
  myTasksTooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  myTasksTooltipText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  flyerCtaWrap: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 0,
  },
  flyerCtaBtn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  flyerCtaText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  flyerInlineRsvpRow: {
    minHeight: 44,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  flyerInlineRsvpBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  flyerInlineRsvpText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  // ── Event Card (הכל tab — full height redesign)
  eventCard: {
    width: '47%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
  },
  eventCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eventCardBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  eventCardBadgeCancelled: { borderRadius: 999 },
  eventCardBadgeTextCancelled: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  eventCardBottom: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    gap: 3,
  },
  eventCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'right',
  },
  eventCardMeta: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'right',
  },
  eventCardConfirmed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86efac',
    textAlign: 'right',
    marginTop: 4,
  },
  eventCardTaskSummary: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
    marginTop: 2,
  },
  eventCardTaskSummaryDone: {
    color: '#86efac',
  },
  cancelledEventsSection: {
    paddingTop: 24,
    gap: 12,
  },
  cancelledEventsTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    color: '#111827',
  },
  cancelledEventsSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  // Keep eventBadge for EventRow (אירועים tab) — unchanged
  eventBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  eventBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // ── Event Row (events tab)
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  eventRowLeft: { alignItems: 'center', gap: 4, minWidth: 44 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventRowDate: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  eventRowContent: { flex: 1, alignItems: 'flex-end', gap: 4 },
  eventRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    width: '100%',
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
  },
  eventRowLocation: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  eventRowCancelReason: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  eventRowCancelledBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventRowCancelledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  rsvpStatusBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rsvpStatusText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  eventRowTaskSummary: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 2,
  },
  eventRowTaskSummaryDone: {
    color: '#16a34a',
  },

  // ── Tasks
  taskList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  taskSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  taskTitle: { flex: 1, fontSize: 14, color: '#111827', textAlign: 'right' },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  taskDue: { fontSize: 11, color: '#9ca3af', minWidth: 36, textAlign: 'left' },

  // ── Month selector
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },

  // ── See more
  seeMoreBtn: { alignSelf: 'flex-end', marginTop: 8 },
  seeMoreText: { fontSize: 13, color: PRIMARY, fontWeight: '600' },

  // ── Empty states
  emptySmall: { paddingVertical: 16, alignItems: 'flex-end' },
  emptySmallText: { fontSize: 13, color: '#9ca3af', textAlign: 'right' },
  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  pendingGateHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  pendingGateTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  pendingGateMessage: {
    marginTop: 18,
    paddingHorizontal: 24,
    lineHeight: 24,
  },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  emptySubText: {
    maxWidth: 300,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    textAlign: 'center',
  },

  // ── Retry
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── RSVP Bottom Sheet
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 12,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    justifyContent: 'flex-end',
  },
  sheetOptionActive: { backgroundColor: '#f8fafc' },
  sheetOptionText: { fontSize: 17, color: '#374151', textAlign: 'right' },

  // ── Add Action Sheet
  addSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  addSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    justifyContent: 'flex-end',
  },
  addSheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSheetLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
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
  popoverSingleItem: {
    borderTopWidth: 0,
  },
  popoverBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  popoverLabel: { fontSize: 15, color: '#374151', textAlign: 'right', flex: 1 },
  popoverDanger: { color: '#ef4444' },

  // ── Reminder rows (כדאי לזכור section in הכל tab)
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  reminderCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reminderCheckboxDone: { backgroundColor: PRIMARY },
  reminderTitle: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
  },
  reminderTitleDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  reminderDue: {
    fontSize: 11,
    color: '#9ca3af',
    minWidth: 36,
    textAlign: 'left',
  },
  reminderHideBtn: { padding: 4, flexShrink: 0 },

  // ── Activity placeholder (Section 4 in הכל tab)
  activityPlaceholder: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
  },
  activityRowPressed: { backgroundColor: '#f8fafc' },
  activityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8f6fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTextBlock: { flex: 1, gap: 2 },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  activityDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  activityTime: {
    minWidth: 64,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'left',
  },
  activityDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eef2f7',
    marginLeft: 14,
    marginRight: 58,
  },
  activityTimeline: { gap: 14 },
  activityGroup: { gap: 8 },
  activityGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'right',
    paddingHorizontal: 2,
  },

  // ── Accordion (כדאי לזכור)
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  accordionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderSummaryBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  reminderSummaryText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  completedGroupTitle: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '500',
  },

  // ── Search modal
  searchBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  searchBox: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },
});
