import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  type ImageErrorEventData,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CommunityEventNameTag } from '@/components/CommunityEventNameTag';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { colors as tc } from '@/theme/colors';
import { getAvatarInitials } from '@/lib/avatarInitials';
import type { Birthday } from '@/lib/types/birthday';
import { getCountdownLabel } from '@/lib/utils/birthday';
import { parseGeoUri } from '@/lib/utils/geoUri';
import { APP_IS_RTL, getTextAlign, rtl } from '@/lib/rtl';

export type HomeDailyItem = {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  startAt?: number;
  endAt?: number;
  location: string;
  locationUrl?: string;
  remoteUrl?: string;
  type: 'event' | 'task';
  completed: boolean;
  /** Timestamp (ms) when the task was completed — used for "בוצעו היום" grouping. */
  completedAt?: number;
  groupName?: string;
  communityId?: string;
  linkedEventId?: string;
  pending?: boolean;
  rsvpStatus?: 'none' | 'yes' | 'no' | 'maybe';
  pendingPersonalInvite?: boolean;
  myPersonalRsvpStatus?: 'yes' | 'maybe' | 'no' | 'none';
  assigneeDisplays?: { initials: string; color: string }[];
  profileCircles?: unknown[];
  myAssignedTasks?: { id: string; title: string; completed: boolean }[];
};

export type HomeDailyTask = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: number;
  hasTime?: boolean;
  dueAt?: number;
  /** Timestamp (ms) when the task was completed — used for "בוצעו היום" grouping. */
  completedAt?: number;
  assigneeDisplays?: { initials: string; color: string }[];
};

// ─── Temporal state ───────────────────────────────────────────────────────────

type TemporalState = 'active' | 'ended' | 'upcoming' | 'overdue' | 'completed';
type DisplayMode = 'featured' | 'compact';

interface UnifiedTimelineCardProps {
  item: HomeDailyItem;
  temporalState: TemporalState;
  displayMode: DisplayMode;
  /** Badge label override for non-today featured items. */
  featuredBadgeLabel?: string;
  nowMs: number;
  onOpen: () => void;
  onNavigate?: () => void;
  onToggleComplete?: () => void;
  onOpenRemoteUrl?: () => void;
  /** Called when the user taps כן/אולי/לא on the card's inline RSVP row. */
  onRsvp?: (item: HomeDailyItem, status: 'yes' | 'maybe' | 'no') => void;
}

type HomeDailyCommandCenterProps = {
  selectedDate: Date;
  nowMs: number;
  scheduledItems: HomeDailyItem[];
  allDayItems: HomeDailyItem[];
  overdueTasks: HomeDailyTask[];
  /** Untimed tasks for the selected day (complete + incomplete). */
  untimedTasks: HomeDailyTask[];
  undatedTaskCount: number;
  /** All undated tasks — complete and incomplete. Collapsed section filters to incomplete. */
  undatedTasks: HomeDailyTask[];
  /**
   * Single authoritative source for "בוצעו היום": every task the user completed
   * today across all categories (timed, dated-untimed, overdue, undated).
   * Derived in index.tsx from convexTasks + convexUndatedTasks using nowMs
   * boundaries so it reacts to the existing clock rollover.
   */
  completedTodayTasksAllSources: HomeDailyTask[];
  birthdays: Birthday[];
  hasAnyBirthdays: boolean;
  onOpenItem: (item: HomeDailyItem) => void;
  onOpenTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onNavigate: (location: string, locationUrl?: string) => void;
  onOpenRemoteUrl: (url: string) => void;
  onRsvp: (item: HomeDailyItem, status: 'yes' | 'maybe' | 'no') => void;
  onOpenTasks: () => void;
  onOpenBirthday: (birthday: Birthday) => void;
  onOpenBirthdays: () => void;
  onAddBirthday: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTimeRange = (item: HomeDailyItem): string =>
  item.endTime ? `${item.time}–${item.endTime}` : item.time;

const formatElapsed = (startAt: number, nowMs: number): string => {
  const minutes = Math.max(1, Math.floor((nowMs - startAt) / 60_000));
  if (minutes < 60) {
    return minutes === 1 ? 'התחיל לפני דקה' : `התחיל לפני ${minutes} דקות`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'התחיל לפני שעה';
  if (hours === 2) return 'התחיל לפני שעתיים';
  return `התחיל לפני ${hours} שעות`;
};

const formatUntilStart = (startAt: number, nowMs: number): string | null => {
  const minutes = Math.ceil((startAt - nowMs) / 60_000);
  if (minutes <= 0) return null;
  if (minutes < 60) {
    return minutes === 1 ? 'מתחיל בעוד דקה' : `מתחיל בעוד ${minutes} דקות`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    if (hours === 1) return 'מתחיל בעוד שעה';
    if (hours === 2) return 'מתחיל בעוד שעתיים';
    return `מתחיל בעוד ${hours} שעות`;
  }
  return null;
};

const formatEnded = (endAt: number, nowMs: number): string => {
  const minutes = Math.max(1, Math.floor((nowMs - endAt) / 60_000));
  if (minutes < 60) {
    return minutes === 1 ? 'הסתיים לפני דקה' : `הסתיים לפני ${minutes} דקות`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'הסתיים לפני שעה';
  if (hours === 2) return 'הסתיים לפני שעתיים';
  return `הסתיים לפני ${hours} שעות`;
};

const isPendingInvitation = (item: HomeDailyItem): boolean =>
  (item.pendingPersonalInvite === true &&
    (item.myPersonalRsvpStatus ?? 'none') === 'none') ||
  (item.pending === true && (item.rsvpStatus ?? 'none') === 'none');

// Formats the original due date/time of an overdue task for display.
// NOTE: dueDate midnight must not use +86_400_000; calendar operations are used
// instead so DST transitions are handled correctly.
// When hasTime===true but dueAt is undefined, only the date label is returned
// (data inconsistency — dueAt is the authoritative time source).
const formatDueLabel = (
  dueDate: number,
  hasTime: boolean,
  dueAt: number | undefined,
  nowMs: number
): string => {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayStartMs = yesterdayStart.getTime();

  const dueDateDay = new Date(dueDate);
  dueDateDay.setHours(0, 0, 0, 0);
  const dueDateDayMs = dueDateDay.getTime();

  if (dueDateDayMs === yesterdayStartMs) {
    if (!hasTime) return 'אתמול';
    if (dueAt === undefined) return 'אתמול';
    const timeStr = new Date(dueAt).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `אתמול, ${timeStr}`;
  }

  const datePart = new Date(dueDate).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
  });
  if (!hasTime) return datePart;
  if (dueAt === undefined) return datePart;
  const timeStr = new Date(dueAt).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart}, ${timeStr}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const BirthdayAvatar = ({
  birthday,
}: {
  birthday: Birthday;
}): React.JSX.Element => {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getAvatarInitials(
    birthday.firstName?.trim() || birthday.name
  );
  const showImage = Boolean(birthday.photoUri) && !imageFailed;

  if (showImage) {
    return (
      <Image
        accessibilityLabel={`תמונה של ${birthday.name}`}
        onError={(_event: { nativeEvent: ImageErrorEventData }) =>
          setImageFailed(true)
        }
        source={{ uri: birthday.photoUri ?? '' }}
        style={styles.birthdayAvatar}
      />
    );
  }

  return (
    <View style={[styles.birthdayAvatar, styles.birthdayAvatarFallback]}>
      <Text style={styles.birthdayInitials}>{initials || '–'}</Text>
    </View>
  );
};

const SourceLabel = ({ item }: { item: HomeDailyItem }): React.JSX.Element => {
  if (item.communityId && item.groupName) {
    return <CommunityEventNameTag name={item.groupName} />;
  }
  if (item.type === 'task') {
    return <Text style={styles.sourceLabel}>משימה</Text>;
  }
  if (item.linkedEventId) {
    return <Text style={styles.sourceLabel}>אירוע משותף</Text>;
  }
  return <Text style={styles.sourceLabel}>אירוע אישי</Text>;
};

// ─── UnifiedTimelineCard ─────────────────────────────────────────────────────

const UnifiedTimelineCard = ({
  item,
  temporalState,
  displayMode,
  featuredBadgeLabel,
  nowMs,
  onOpen,
  onNavigate,
  onToggleComplete,
  onOpenRemoteUrl,
  onRsvp,
}: UnifiedTimelineCardProps): React.JSX.Element => {
  const hasNavigation =
    item.location.trim().length > 0 && parseGeoUri(item.locationUrl) !== null;
  const hasRemoteAction = Boolean(item.remoteUrl);
  const hasPrimaryAction = hasNavigation || hasRemoteAction;

  // Badge config by temporal state
  const badgeConfig = ((): { label: string; bg: string; color: string } | null => {
    switch (temporalState) {
      case 'active':
        return { label: 'מתקיים עכשיו', bg: tc.primaryLight, color: tc.primary };
      case 'upcoming':
        if (displayMode !== 'featured') return null;
        return {
          label: featuredBadgeLabel ?? 'הבא בתור',
          bg: tc.accentLight,
          color: tc.accent,
        };
      case 'ended':
        return { label: 'הסתיים', bg: '#F1F4F5', color: '#767C7E' };
      case 'overdue':
        return { label: 'באיחור', bg: '#FFF8EC', color: tc.warning };
      case 'completed':
        return { label: 'בוצע', bg: '#F1F4F5', color: '#92999C' };
    }
  })();

  // Context text (live time line)
  const contextText = ((): string | null => {
    if (temporalState === 'active' && item.startAt !== undefined) {
      return formatElapsed(item.startAt, nowMs);
    }
    if (temporalState === 'upcoming' && item.startAt !== undefined) {
      return formatUntilStart(item.startAt, nowMs);
    }
    if (temporalState === 'ended' && item.endAt !== undefined) {
      return formatEnded(item.endAt, nowMs);
    }
    return null;
  })();

  const isCompleted = temporalState === 'completed';
  const isEnded = temporalState === 'ended';
  const isOverdue = temporalState === 'overdue';

  const currentRsvpStatus = item.myPersonalRsvpStatus ?? item.rsvpStatus;
  // Show the inline כן/אולי/לא row only for unanswered-but-soft-committed events.
  // 'none': item stays in invitations (existing path, not this row).
  // 'maybe': item is on the timeline but needs a nudge — show the row.
  // 'yes': no row; answer is final. 'no': item excluded from timeline entirely.
  // Ended events don't benefit from re-RSVP nudging.
  const showMaybeRsvpRow =
    item.type === 'event' &&
    currentRsvpStatus === 'maybe' &&
    temporalState !== 'ended' &&
    onRsvp !== undefined;

  // ─── FEATURED card ───────────────────────────────────────────────────────────
  if (displayMode === 'featured') {
    const cardBorderStyle =
      isOverdue ? styles.overdueCardBorder : undefined;

    return (
      <View style={[styles.expandedCard, cardBorderStyle]}>
        <Pressable
          accessible={true}
          accessibilityLabel={`פתיחת פרטים: ${item.title}`}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [
            styles.expandedContent,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.expandedTopRow}>
            {badgeConfig ? (
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: badgeConfig.bg },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: badgeConfig.color },
                  ]}
                />
                <Text
                  style={[styles.statusText, { color: badgeConfig.color }]}
                >
                  {badgeConfig.label}
                </Text>
              </View>
            ) : null}
            <Text style={styles.timeRange}>{formatTimeRange(item)}</Text>
          </View>

          <View style={styles.sourceRow}>
            <SourceLabel item={item} />
          </View>

          <View style={styles.titleRow}>
            {item.type === 'task' ? (
              <TaskCheckbox
                checked={item.completed}
                onToggle={onToggleComplete ?? (() => {})}
              />
            ) : null}
            <Text
              numberOfLines={3}
              style={[
                styles.expandedTitle,
                isCompleted && styles.completedText,
              ]}
            >
              {item.title}
            </Text>
          </View>

          {item.location ? (
            <View style={styles.metadataRow}>
              <MaterialIcons name="location-on" size={17} color="#767C7E" />
              <Text numberOfLines={2} style={styles.metadataText}>
                {item.location}
              </Text>
            </View>
          ) : null}

          {contextText ? (
            <Text style={styles.contextText}>{contextText}</Text>
          ) : null}

          {(item.myAssignedTasks?.length ?? 0) > 0 ? (
            <Text style={styles.assignedTasksText}>
              {item.myAssignedTasks?.length === 1
                ? 'יש לך משימה אחת באירוע'
                : `יש לך ${item.myAssignedTasks?.length} משימות באירוע`}
            </Text>
          ) : null}
        </Pressable>

        {showMaybeRsvpRow ? (
          <View style={styles.rsvpRowFeatured}>
            {(
              [
                ['yes', 'כן'],
                ['maybe', 'אולי'],
                ['no', 'לא'],
              ] as const
            ).map(([status, label]) => (
              <Pressable
                accessibilityLabel={`${label}, ${item.title}`}
                accessibilityRole="button"
                accessible={true}
                key={status}
                onPress={() => onRsvp?.(item, status)}
                style={[
                  styles.rsvpButton,
                  status === currentRsvpStatus && styles.rsvpButtonPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.rsvpButtonText,
                    status === currentRsvpStatus && styles.rsvpButtonTextPrimary,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {hasPrimaryAction ? (
            <Pressable
              accessible={true}
              accessibilityLabel={hasRemoteAction ? 'הצטרפות לאירוע' : 'ניווט'}
              accessibilityRole="button"
              onPress={hasRemoteAction ? onOpenRemoteUrl : onNavigate}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.primaryActionPressed,
              ]}
            >
              <MaterialIcons
                color="#FFFFFF"
                name={hasRemoteAction ? 'videocam' : 'near-me'}
                size={18}
              />
              <Text style={styles.primaryActionText}>
                {hasRemoteAction ? 'הצטרפות' : 'ניווט'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessible={true}
            accessibilityLabel={`פרטים על ${item.title}`}
            accessibilityRole="button"
            onPress={onOpen}
            style={({ pressed }) => [
              styles.secondaryAction,
              !hasPrimaryAction && styles.secondaryActionFull,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>פרטים</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── COMPACT card ────────────────────────────────────────────────────────────
  const showNavIcon = !isEnded && !isCompleted && hasNavigation;
  const showCheckbox = item.type === 'task' && !isEnded;

  const compactCardStyles = [
    styles.compactRow,
    isEnded && styles.endedCompactRow,
    isOverdue && styles.overdueCompactRow,
    isCompleted && styles.completedCompactRow,
  ];

  // Horizontal row content — shared between default and RSVP-row render paths.
  const compactInner = (
    <>
      {item.time ? (
        <Text
          style={[
            styles.compactTime,
            (isCompleted || isEnded) && styles.compactTimeMuted,
          ]}
        >
          {formatTimeRange(item)}
        </Text>
      ) : (
        <View style={styles.compactTimePlaceholder} />
      )}
      <View style={styles.compactBody}>
        {badgeConfig ? (
          <View
            style={[
              styles.compactBadge,
              { backgroundColor: badgeConfig.bg },
            ]}
          >
            <Text
              style={[
                styles.compactBadgeText,
                { color: badgeConfig.color },
              ]}
            >
              {badgeConfig.label}
            </Text>
          </View>
        ) : null}
        <View style={styles.compactTitleRow}>
          {showCheckbox ? (
            <TaskCheckbox
              checked={item.completed}
              onToggle={onToggleComplete ?? (() => {})}
            />
          ) : null}
          <Text
            numberOfLines={2}
            style={[
              styles.compactTitle,
              isEnded && styles.endedText,
              isCompleted && styles.completedText,
            ]}
          >
            {item.title}
          </Text>
        </View>
        <View style={styles.compactMetaRow}>
          <SourceLabel item={item} />
          {item.location ? (
            <Text numberOfLines={1} style={styles.compactLocation}>
              · {item.location}
            </Text>
          ) : null}
        </View>
        {contextText ? (
          <Text style={styles.compactContextText}>{contextText}</Text>
        ) : null}
      </View>
      {showNavIcon ? (
        <Pressable
          accessible={true}
          accessibilityLabel={`ניווט אל ${item.title}`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onNavigate}
          style={styles.compactNav}
        >
          <MaterialIcons color={tc.primary} name="near-me" size={18} />
        </Pressable>
      ) : (
        <MaterialIcons color="#ADB3B5" name="chevron-left" size={22} />
      )}
    </>
  );

  if (showMaybeRsvpRow) {
    return (
      <View style={[...compactCardStyles, styles.compactCardWithRsvp]}>
        <Pressable
          accessible={true}
          accessibilityLabel={`פתיחת ${item.title}`}
          accessibilityRole="button"
          onPress={onOpen}
          style={styles.compactRowInner}
        >
          {compactInner}
        </Pressable>
        <View style={styles.rsvpRowCardSection}>
          {(
            [
              ['yes', 'כן'],
              ['maybe', 'אולי'],
              ['no', 'לא'],
            ] as const
          ).map(([status, label]) => (
            <Pressable
              accessibilityLabel={`${label}, ${item.title}`}
              accessibilityRole="button"
              accessible={true}
              key={status}
              onPress={() => onRsvp?.(item, status)}
              style={[
                styles.rsvpButton,
                status === currentRsvpStatus && styles.rsvpButtonPrimary,
              ]}
            >
              <Text
                style={[
                  styles.rsvpButtonText,
                  status === currentRsvpStatus && styles.rsvpButtonTextPrimary,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessible={true}
      accessibilityLabel={`פתיחת ${item.title}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={compactCardStyles}
    >
      {compactInner}
    </Pressable>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export function HomeDailyCommandCenter({
  selectedDate,
  nowMs,
  scheduledItems,
  allDayItems,
  overdueTasks,
  untimedTasks,
  undatedTaskCount,
  undatedTasks,
  completedTodayTasksAllSources,
  birthdays,
  hasAnyBirthdays,
  onOpenItem,
  onOpenTask,
  onToggleTask,
  onNavigate,
  onOpenRemoteUrl,
  onRsvp,
  onOpenTasks,
  onOpenBirthday,
  onOpenBirthdays,
  onAddBirthday,
}: HomeDailyCommandCenterProps): React.JSX.Element {
  const [undatedExpanded, setUndatedExpanded] = useState(false);
  const [endedExpanded, setEndedExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(true);

  const today = new Date(nowMs);
  const isToday = isSameCalendarDay(selectedDate, today);
  const selectedMidnight = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  ).getTime();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const isPast = selectedMidnight < todayMidnight;
  const isFuture = selectedMidnight > todayMidnight;

  // ─── Invitations ─────────────────────────────────────────────────────────
  const invitations = scheduledItems.filter(isPendingInvitation);
  const attentionCount =
    (isToday ? overdueTasks.length : 0) + invitations.length;
  const invitationIds = new Set(invitations.map((item) => item.id));

  // ─── Timeline items (invitations + RSVP 'no' excluded; ended events kept) ─
  const timelineItemsAll = scheduledItems.filter((item) => {
    if (invitationIds.has(item.id)) return false;
    if (item.rsvpStatus === 'no' || item.myPersonalRsvpStatus === 'no')
      return false;
    return true;
  });

  // ─── Today: ended events → "מוקדם יותר" ─────────────────────────────────
  const endedItems: HomeDailyItem[] = isToday
    ? timelineItemsAll.filter(
        (item) =>
          item.type === 'event' &&
          item.endAt !== undefined &&
          item.endAt <= nowMs
      )
    : [];

  // ─── Today: completed tasks → "בוצעו היום" ───────────────────────────────
  // Single source of truth: completedTodayTasksAllSources (from index.tsx) covers
  // timed, dated-untimed, overdue, and undated tasks completed today.
  // Defensive dedup guards against any theoretical duplicates in the source array.
  const taskToItem = (task: HomeDailyTask): HomeDailyItem => ({
    id: task.id,
    title: task.title,
    time: '',
    location: '',
    type: 'task',
    completed: true,
    completedAt: task.completedAt,
    assigneeDisplays: task.assigneeDisplays,
  });

  const completedTodayItems: HomeDailyItem[] = (() => {
    if (!isToday) return [];
    const seenIds = new Set<string>();
    return completedTodayTasksAllSources
      .filter((t) => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      })
      .map(taskToItem);
  })();

  // ─── Main timeline: active + upcoming + overdue (Today: minus ended + minus completed) ─
  const timelineItems: HomeDailyItem[] = isToday
    ? timelineItemsAll.filter((item) => {
        // exclude ended events
        if (
          item.type === 'event' &&
          item.endAt !== undefined &&
          item.endAt <= nowMs
        )
          return false;
        // exclude completed tasks (they go to "בוצעו היום")
        if (item.type === 'task' && item.completed) return false;
        return true;
      })
    : timelineItemsAll;

  // ─── Active events (Today only) ───────────────────────────────────────────
  const activeItems: HomeDailyItem[] = isToday
    ? timelineItems.filter(
        (item) =>
          item.type === 'event' &&
          item.startAt !== undefined &&
          item.endAt !== undefined &&
          item.startAt <= nowMs &&
          nowMs < item.endAt
      )
    : [];
  const activeIds = new Set(activeItems.map((item) => item.id));

  // ─── Featured item: first upcoming, non-completed, non-overdue ───────────
  const featuredItem =
    isPast || activeItems.length > 0
      ? null
      : (timelineItems.find(
          (item) =>
            !item.completed &&
            (isFuture || item.startAt === undefined || item.startAt > nowMs) &&
            // Defensive: never feature an event whose endAt has already passed.
            // Normally endedItems filtering removes these, but guards against any
            // edge case where endAt is stale or the filter ran with stale nowMs.
            !(item.type === 'event' && item.endAt !== undefined && item.endAt <= nowMs)
        ) ?? null);
  const featuredItemId = featuredItem?.id;

  // ─── Remaining (non-active, non-featured) items ───────────────────────────
  const remainingItems = timelineItems.filter(
    (item) => item.id !== featuredItemId && !activeIds.has(item.id)
  );

  // ─── Temporal state helper ────────────────────────────────────────────────
  const getTemporalState = (item: HomeDailyItem): TemporalState => {
    if (item.type === 'task') {
      if (item.completed) return 'completed';
      if (item.startAt !== undefined && item.startAt <= nowMs) return 'overdue';
      return 'upcoming';
    }
    if (item.endAt !== undefined && item.endAt <= nowMs) return 'ended';
    if (
      item.startAt !== undefined &&
      item.endAt !== undefined &&
      item.startAt <= nowMs &&
      nowMs < item.endAt
    )
      return 'active';
    return 'upcoming';
  };

  // ─── Misc ─────────────────────────────────────────────────────────────────
  const emptySuffix = isToday ? 'להיום' : isPast ? 'ביום הזה' : 'לתאריך הזה';

  // Untimed tasks for the selected day section (incomplete only on Today)
  const visibleUntimedTasks = isToday
    ? untimedTasks.filter((t) => !t.completed)
    : untimedTasks;

  // Undated tasks — incomplete only (always)
  const visibleUndatedTasks = undatedTasks.filter((t) => !t.completed);

  return (
    <View style={styles.root}>
      {/* ── Attention section (overdue + invitations) ────────────────────────── */}
      {attentionCount > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            דורש תשומת לב · {attentionCount}
          </Text>
          <View style={styles.attentionCard}>
            {isToday
              ? overdueTasks.map((task, index) => (
                  <View
                    key={task.id}
                    style={[
                      styles.attentionRow,
                      (index > 0 || invitations.length > 0) &&
                        styles.dividedRow,
                    ]}
                  >
                    <View style={styles.warmIcon}>
                      <MaterialIcons
                        color="#A75B20"
                        name="schedule"
                        size={19}
                      />
                    </View>
                    <Pressable
                      accessibilityLabel={`פתיחת משימה באיחור: ${task.title}`}
                      accessibilityRole="button"
                      accessible={true}
                      onPress={() => onOpenTask(task.id)}
                      style={styles.attentionBody}
                    >
                      <Text numberOfLines={2} style={styles.attentionTitle}>
                        {task.title}
                      </Text>
                      <Text style={styles.overdueLabel}>ממתינה להשלמה</Text>
                      {task.dueDate !== undefined ? (
                        <Text style={styles.overdueDueLabel}>
                          {formatDueLabel(
                            task.dueDate,
                            task.hasTime ?? false,
                            task.dueAt,
                            nowMs
                          )}
                        </Text>
                      ) : null}
                    </Pressable>
                    <TaskCheckbox
                      checked={task.completed}
                      onToggle={() => onToggleTask(task.id)}
                    />
                  </View>
                ))
              : null}
            {invitations.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.invitationBlock,
                  (index > 0 || (isToday && overdueTasks.length > 0)) &&
                    styles.dividedRow,
                ]}
              >
                <Pressable
                  accessibilityLabel={`פתיחת הזמנה: ${item.title}`}
                  accessibilityRole="button"
                  accessible={true}
                  onPress={() => onOpenItem(item)}
                  style={styles.invitationHeader}
                >
                  <View style={styles.inviteIcon}>
                    <MaterialIcons
                      color={tc.primary}
                      name="mail-outline"
                      size={20}
                    />
                  </View>
                  <View style={styles.attentionBody}>
                    <Text style={styles.attentionTitle}>
                      הזמנה ממתינה לאישור
                    </Text>
                    <Text numberOfLines={1} style={styles.invitationSubtitle}>
                      {item.title}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.rsvpRow}>
                  {(
                    [
                      ['yes', 'כן'],
                      ['maybe', 'אולי'],
                      ['no', 'לא'],
                    ] as const
                  ).map(([status, label]) => (
                    <Pressable
                      accessibilityLabel={`${label}, ${item.title}`}
                      accessibilityRole="button"
                      accessible={true}
                      key={status}
                      onPress={() => onRsvp(item, status)}
                      style={({ pressed }) => [
                        styles.rsvpButton,
                        status ===
                          (item.myPersonalRsvpStatus ?? item.rsvpStatus) &&
                          styles.rsvpButtonPrimary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rsvpButtonText,
                          status ===
                            (item.myPersonalRsvpStatus ?? item.rsvpStatus) &&
                            styles.rsvpButtonTextPrimary,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Schedule section ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isPast ? 'היום שהיה' : 'הלו״ז שלי'}
        </Text>

        {/* All-day events */}
        {allDayItems.length > 0 ? (
          <View style={styles.allDayGroup}>
            {allDayItems.map((item) => (
              <Pressable
                accessibilityLabel={`פתיחת אירוע לכל היום: ${item.title}`}
                accessibilityRole="button"
                accessible={true}
                key={item.id}
                onPress={() => onOpenItem(item)}
                style={styles.allDayRow}
              >
                <Text style={styles.allDayLabel}>כל היום</Text>
                <Text numberOfLines={2} style={styles.allDayTitle}>
                  {item.title}
                </Text>
                <MaterialIcons color="#ADB3B5" name="chevron-left" size={21} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── Today: "מוקדם יותר" (ended events) ─────────────────────────────── */}
        {isToday && endedItems.length > 0 ? (
          <View style={styles.collapsibleSection}>
            <Pressable
              accessible={true}
              accessibilityLabel={`מוקדם יותר, ${endedItems.length} אירועים, ${endedExpanded ? 'לחץ לכיווץ' : 'לחץ להרחבה'}`}
              accessibilityRole="button"
              onPress={() => setEndedExpanded((prev) => !prev)}
              style={styles.collapsibleHeader}
            >
              <Text style={styles.collapsibleHeaderText}>
                מוקדם יותר · {endedItems.length}
              </Text>
              <MaterialIcons
                color={tc.textSecondary}
                name={endedExpanded ? 'expand-less' : 'expand-more'}
                size={22}
              />
            </Pressable>
            {endedExpanded ? (
              <View style={styles.collapsibleContent}>
                {endedItems.map((item) => (
                  <UnifiedTimelineCard
                    displayMode="compact"
                    item={item}
                    key={item.id}
                    nowMs={nowMs}
                    onNavigate={() => onNavigate(item.location, item.locationUrl)}
                    onOpen={() => onOpenItem(item)}
                    onOpenRemoteUrl={() => {
                      if (item.remoteUrl) onOpenRemoteUrl(item.remoteUrl);
                    }}
                    onToggleComplete={() => onToggleTask(item.id)}
                    temporalState="ended"
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Active events — all featured ──────────────────────────────────── */}
        {activeItems.map((item) => (
          <UnifiedTimelineCard
            displayMode="featured"
            item={item}
            key={item.id}
            nowMs={nowMs}
            onNavigate={() => onNavigate(item.location, item.locationUrl)}
            onOpen={() => onOpenItem(item)}
            onOpenRemoteUrl={() => {
              if (item.remoteUrl) onOpenRemoteUrl(item.remoteUrl);
            }}
            onRsvp={onRsvp}
            onToggleComplete={() => onToggleTask(item.id)}
            temporalState="active"
          />
        ))}

        {/* ── Featured (first upcoming) item ───────────────────────────────── */}
        {featuredItem && !isPast ? (
          <UnifiedTimelineCard
            displayMode="featured"
            featuredBadgeLabel={isToday ? 'הבא בתור' : 'הראשון בלו״ז'}
            item={featuredItem}
            nowMs={nowMs}
            onNavigate={() =>
              onNavigate(featuredItem.location, featuredItem.locationUrl)
            }
            onOpen={() => onOpenItem(featuredItem)}
            onOpenRemoteUrl={() => {
              if (featuredItem.remoteUrl) onOpenRemoteUrl(featuredItem.remoteUrl);
            }}
            onRsvp={onRsvp}
            onToggleComplete={() => onToggleTask(featuredItem.id)}
            temporalState={getTemporalState(featuredItem)}
          />
        ) : null}

        {/* ── Remaining items (compact) ─────────────────────────────────────── */}
        {remainingItems.length > 0 ? (
          <View style={styles.compactGroup}>
            {remainingItems.map((item) => {
              const tState = getTemporalState(item);
              return (
                <UnifiedTimelineCard
                  displayMode="compact"
                  item={item}
                  key={item.id}
                  nowMs={nowMs}
                  onNavigate={() =>
                    onNavigate(item.location, item.locationUrl)
                  }
                  onOpen={() => onOpenItem(item)}
                  onOpenRemoteUrl={() => {
                    if (item.remoteUrl) onOpenRemoteUrl(item.remoteUrl);
                  }}
                  onRsvp={onRsvp}
                  onToggleComplete={() => onToggleTask(item.id)}
                  temporalState={tState}
                />
              );
            })}
          </View>
        ) : null}

        {/* Empty state */}
        {allDayItems.length === 0 &&
        activeItems.length === 0 &&
        !featuredItem &&
        remainingItems.length === 0 &&
        endedItems.length === 0 ? (
          <View style={styles.calmEmpty}>
            <MaterialIcons
              color={tc.primary}
              name="event-available"
              size={22}
            />
            <Text style={styles.calmEmptyText}>
              אין עוד דברים מתוזמנים {emptySuffix}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Untimed tasks for selected day ───────────────────────────────────── */}
      {visibleUntimedTasks.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>
              {isToday ? 'משימות להיום' : 'משימות לתאריך הזה'}
            </Text>
            <Pressable
              accessibilityLabel="פתיחת כל המשימות"
              accessibilityRole="button"
              accessible={true}
              onPress={onOpenTasks}
            >
              <Text style={styles.sectionLink}>הכל</Text>
            </Pressable>
          </View>
          <View style={styles.taskList}>
            {visibleUntimedTasks.map((task, index) => (
              <Pressable
                accessibilityLabel={`פתיחת משימה: ${task.title}`}
                accessibilityRole="button"
                accessible={true}
                key={task.id}
                onPress={() => onOpenTask(task.id)}
                style={[styles.taskRow, index > 0 && styles.dividedRow]}
              >
                <TaskCheckbox
                  checked={task.completed}
                  onToggle={() => onToggleTask(task.id)}
                />
                <Text
                  numberOfLines={2}
                  style={[
                    styles.taskTitle,
                    task.completed && styles.completedText,
                  ]}
                >
                  {task.title}
                </Text>
                <MaterialIcons color="#ADB3B5" name="chevron-left" size={21} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Today: "בוצעו היום" (completed tasks) ────────────────────────────── */}
      {isToday && completedTodayItems.length > 0 ? (
        <View style={styles.section}>
          <Pressable
            accessible={true}
            accessibilityLabel={`בוצעו היום, ${completedTodayItems.length} משימות, ${completedExpanded ? 'לחץ לכיווץ' : 'לחץ להרחבה'}`}
            accessibilityRole="button"
            onPress={() => setCompletedExpanded((prev) => !prev)}
            style={styles.collapsibleHeaderCard}
          >
            <Text style={styles.collapsibleHeaderText}>
              בוצעו היום · {completedTodayItems.length}
            </Text>
            <MaterialIcons
              color={tc.textSecondary}
              name={completedExpanded ? 'expand-less' : 'expand-more'}
              size={22}
            />
          </Pressable>
          {completedExpanded ? (
            <View style={styles.collapsibleContent}>
              {completedTodayItems.map((item) => (
                <UnifiedTimelineCard
                  displayMode="compact"
                  item={item}
                  key={item.id}
                  nowMs={nowMs}
                  onOpen={() => onOpenItem(item)}
                  onToggleComplete={() => onToggleTask(item.id)}
                  temporalState="completed"
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Today: undated tasks (incomplete only) ────────────────────────────── */}
      {isToday && undatedTaskCount > 0 ? (
        <View style={styles.section}>
          <Pressable
            accessibilityLabel={`${undatedTaskCount} משימות פתוחות ללא תאריך, ${undatedExpanded ? 'לחץ לכיווץ' : 'לחץ להרחבה'}`}
            accessibilityRole="button"
            accessible={true}
            onPress={() => setUndatedExpanded((prev) => !prev)}
            style={styles.undatedRow}
          >
            <Text style={styles.undatedText}>
              {undatedTaskCount === 1
                ? 'משימה פתוחה אחת ללא תאריך'
                : `${undatedTaskCount} משימות פתוחות ללא תאריך`}
            </Text>
            <MaterialIcons
              color={tc.primary}
              name={undatedExpanded ? 'expand-less' : 'expand-more'}
              size={23}
            />
          </Pressable>
          {undatedExpanded ? (
            <View style={styles.taskList}>
              {visibleUndatedTasks.map((task, index) => (
                <Pressable
                  accessibilityLabel={`פתיחת משימה: ${task.title}`}
                  accessibilityRole="button"
                  accessible={true}
                  key={task.id}
                  onPress={() => onOpenTask(task.id)}
                  style={[styles.taskRow, index > 0 && styles.dividedRow]}
                >
                  <TaskCheckbox
                    checked={task.completed}
                    onToggle={() => onToggleTask(task.id)}
                  />
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.taskTitle,
                      task.completed && styles.completedText,
                    ]}
                  >
                    {task.title}
                  </Text>
                  <MaterialIcons color="#ADB3B5" name="chevron-left" size={21} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Birthdays ─────────────────────────────────────────────────────────── */}
      {!isPast ? (
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>ימי הולדת קרובים</Text>
            {hasAnyBirthdays ? (
              <Pressable
                accessibilityLabel="פתיחת כל ימי ההולדת"
                accessibilityRole="button"
                accessible={true}
                onPress={onOpenBirthdays}
              >
                <Text style={styles.sectionLink}>הצג הכל</Text>
              </Pressable>
            ) : null}
          </View>
          {birthdays.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.birthdayRow}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              {birthdays.map((birthday) => (
                <Pressable
                  accessibilityLabel={`יום ההולדת של ${birthday.name}`}
                  accessibilityRole="button"
                  accessible={true}
                  key={birthday.id}
                  onPress={() => onOpenBirthday(birthday)}
                  style={styles.birthdayCard}
                >
                  <BirthdayAvatar
                    birthday={birthday}
                    key={birthday.photoUri ?? 'no-photo'}
                  />
                  <View style={styles.birthdayBody}>
                    <Text numberOfLines={1} style={styles.birthdayName}>
                      {birthday.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.birthdayCountdown}>
                      {getCountdownLabel(birthday)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : hasAnyBirthdays ? (
            <Text style={styles.noBirthdays}>
              אין ימי הולדת ב־30 הימים הקרובים
            </Text>
          ) : (
            <View style={styles.birthdayEmptyState}>
              <Text style={styles.birthdayEmptyText}>
                עדיין לא הוספת ימי הולדת
              </Text>
              <Pressable
                accessibilityLabel="הוספת יום הולדת ראשון"
                accessibilityRole="button"
                accessible={true}
                onPress={onAddBirthday}
                style={({ pressed }) => [
                  styles.birthdayAddButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.birthdayAddButtonText}>
                  + הוספת יום הולדת ראשון
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 22,
  },
  section: {
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#2D3335',
    fontSize: 17,
    fontWeight: '700',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  sectionLink: {
    color: tc.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  attentionCard: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9EDEE',
    backgroundColor: '#FFFFFF',
  },
  attentionRow: {
    minHeight: 68,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dividedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E9EB',
  },
  warmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1E7',
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7FD',
  },
  attentionBody: {
    flex: 1,
    minWidth: 0,
  },
  attentionTitle: {
    color: tc.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  overdueLabel: {
    color: tc.warning,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: getTextAlign(),
  },
  overdueDueLabel: {
    color: '#767C7E',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  invitationBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  invitationHeader: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 12,
  },
  invitationSubtitle: {
    color: '#5A6062',
    fontSize: 13,
    marginTop: 2,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  rsvpRow: {
    flexDirection: rtl.flexDirection,
    gap: 8,
  },
  rsvpButton: {
    minHeight: 44,
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tc.warmGray,
  },
  rsvpButtonPrimary: {
    backgroundColor: tc.primary,
  },
  rsvpButtonText: {
    color: tc.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  rsvpButtonTextPrimary: {
    color: tc.textOnPrimary,
  },
  // ── Inline RSVP row — featured card (between content and actionRow) ─────────
  rsvpRowFeatured: {
    flexDirection: rtl.flexDirection,
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  // ── Inline RSVP row — compact card ───────────────────────────────────────────
  // Overrides compactRow's horizontal flex to a column so the RSVP row can
  // sit below the main row content. Clears padding so each child controls its own.
  compactCardWithRsvp: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
    gap: 0,
    padding: 0,
  },
  // Restores the original compactRow horizontal layout + padding for the inner row.
  compactRowInner: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // RSVP button strip at the bottom of a compact card.
  rsvpRowCardSection: {
    flexDirection: rtl.flexDirection,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  // ── Expanded (featured) card ───────────────────────────────────────────────
  expandedCard: {
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E9EDEE',
    backgroundColor: '#FFFFFF',
    shadowColor: '#22343C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },
  overdueCardBorder: {
    borderColor: '#F5DFA0',
  },
  expandedContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  expandedTopRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPill: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timeRange: {
    color: '#334E6F',
    fontSize: 15,
    fontWeight: '700',
    writingDirection: 'ltr',
  },
  sourceRow: {
    alignItems: 'flex-start',
    marginTop: 12,
  },
  sourceLabel: {
    color: tc.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  expandedTitle: {
    flex: 1,
    color: '#15191A',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  metadataRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 7,
  },
  metadataText: {
    flex: 1,
    color: '#5A6062',
    fontSize: 13,
    lineHeight: 19,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  contextText: {
    color: '#334E6F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    textAlign: getTextAlign(),
  },
  assignedTasksText: {
    color: tc.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 7,
    textAlign: getTextAlign(),
  },
  actionRow: {
    flexDirection: rtl.flexDirection,
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  primaryAction: {
    minHeight: 48,
    flex: 1,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 24,
    backgroundColor: tc.primary,
  },
  primaryActionPressed: {
    backgroundColor: '#00597D',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D7DDDF',
    backgroundColor: '#FFFFFF',
  },
  secondaryActionFull: {
    flex: 1,
  },
  secondaryActionText: {
    color: tc.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  // ── Compact card ───────────────────────────────────────────────────────────
  compactGroup: {
    gap: 8,
  },
  compactRow: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 82,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8EA',
    shadowColor: '#22343C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  overdueCompactRow: {
    backgroundColor: '#FFF8EC',
    borderColor: '#F5DFA0',
  },
  completedCompactRow: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E5E7EB',
  },
  endedCompactRow: {
    backgroundColor: '#F8FAFB',
    borderColor: '#E5E7EB',
  },
  compactTime: {
    width: 82,
    color: '#44525A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: getTextAlign(),
    writingDirection: 'ltr',
  },
  compactTimeMuted: {
    color: '#ADB3B5',
    fontWeight: '600',
  },
  compactTimePlaceholder: {
    width: 82,
  },
  compactBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  compactBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 2,
  },
  compactBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  compactTitleRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 8,
  },
  compactTitle: {
    flex: 1,
    color: '#252A2C',
    fontSize: 15,
    fontWeight: '700',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  compactMetaRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 3,
  },
  compactLocation: {
    flex: 1,
    color: '#767C7E',
    fontSize: 11,
    textAlign: getTextAlign(),
  },
  compactContextText: {
    color: '#767C7E',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: getTextAlign(),
  },
  compactNav: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Collapsible sections ───────────────────────────────────────────────────
  collapsibleSection: {
    gap: 8,
  },
  collapsibleHeader: {
    minHeight: 48,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  collapsibleHeaderCard: {
    minHeight: 52,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E9EB',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  collapsibleHeaderText: {
    color: '#334E6F',
    fontSize: 14,
    fontWeight: '700',
    textAlign: getTextAlign(),
  },
  collapsibleContent: {
    gap: 8,
  },
  // ── All-day events ─────────────────────────────────────────────────────────
  allDayGroup: {
    gap: 7,
  },
  allDayRow: {
    minHeight: 54,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
    borderRadius: 17,
    paddingHorizontal: 14,
    backgroundColor: '#F1F4F5',
  },
  allDayLabel: {
    color: tc.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  allDayTitle: {
    flex: 1,
    color: '#252A2C',
    fontSize: 14,
    fontWeight: '700',
    textAlign: getTextAlign(),
  },
  calmEmpty: {
    minHeight: 62,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: '#F1F4F5',
  },
  calmEmptyText: {
    color: '#5A6062',
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Task list ──────────────────────────────────────────────────────────────
  taskList: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9EDEE',
    backgroundColor: '#FFFFFF',
  },
  taskRow: {
    minHeight: 60,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  taskTitle: {
    flex: 1,
    color: '#252A2C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  completedText: {
    color: '#92999C',
    textDecorationLine: 'line-through',
  },
  endedText: {
    color: '#92999C',
  },
  // ── Undated tasks row ──────────────────────────────────────────────────────
  undatedRow: {
    minHeight: 58,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E9EB',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  undatedText: {
    color: '#334E6F',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Birthdays ──────────────────────────────────────────────────────────────
  birthdayRow: {
    flexDirection: rtl.flexDirection,
    gap: 10,
    paddingLeft: 4,
  },
  birthdayCard: {
    width: 154,
    minHeight: 66,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9EDEE',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  birthdayAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5E9EB',
  },
  birthdayAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayInitials: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },
  birthdayBody: {
    flex: 1,
    minWidth: 0,
  },
  birthdayName: {
    color: '#252A2C',
    fontSize: 14,
    fontWeight: '800',
    textAlign: getTextAlign(),
  },
  birthdayCountdown: {
    color: tc.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: getTextAlign(),
  },
  noBirthdays: {
    color: '#767C7E',
    fontSize: 13,
    textAlign: getTextAlign(),
  },
  birthdayEmptyState: {
    gap: 12,
    alignItems: 'flex-start',
  },
  birthdayEmptyText: {
    color: '#767C7E',
    fontSize: 13,
    textAlign: getTextAlign(),
  },
  birthdayAddButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: tc.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayAddButtonText: {
    color: tc.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
