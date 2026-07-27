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
  assigneeDisplays?: { initials: string; color: string }[];
};

type HomeDailyCommandCenterProps = {
  selectedDate: Date;
  nowMs: number;
  scheduledItems: HomeDailyItem[];
  allDayItems: HomeDailyItem[];
  overdueTasks: HomeDailyTask[];
  untimedTasks: HomeDailyTask[];
  undatedTaskCount: number;
  birthdays: Birthday[];
  onOpenItem: (item: HomeDailyItem) => void;
  onOpenTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onNavigate: (location: string, locationUrl?: string) => void;
  onOpenRemoteUrl: (url: string) => void;
  onRsvp: (item: HomeDailyItem, status: 'yes' | 'maybe' | 'no') => void;
  onOpenTasks: () => void;
  onOpenBirthday: (birthday: Birthday) => void;
  onOpenBirthdays: () => void;
};

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

const isPendingInvitation = (item: HomeDailyItem): boolean =>
  (item.pendingPersonalInvite === true &&
    (item.myPersonalRsvpStatus ?? 'none') === 'none') ||
  (item.pending === true && (item.rsvpStatus ?? 'none') === 'none');

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

const ExpandedScheduleCard = ({
  item,
  status,
  context,
  onOpen,
  onNavigate,
  onOpenRemoteUrl,
  onToggleTask,
}: {
  item: HomeDailyItem;
  status: string;
  context?: string | null;
  onOpen: () => void;
  onNavigate: () => void;
  onOpenRemoteUrl: () => void;
  onToggleTask: () => void;
}): React.JSX.Element => {
  const hasNavigation =
    item.location.trim().length > 0 && parseGeoUri(item.locationUrl) !== null;
  const hasRemoteAction = Boolean(item.remoteUrl);
  const hasPrimaryAction = hasNavigation || hasRemoteAction;
  const isNow = status.includes('עכשיו');

  return (
    <View style={styles.expandedCard}>
      <Pressable
        accessibilityLabel={`פתיחת פרטים: ${item.title}`}
        accessibilityRole="button"
        accessible={true}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.expandedContent,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.expandedTopRow}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: isNow ? tc.primaryLight : tc.accentLight },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isNow ? tc.primary : tc.accent },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isNow ? tc.primary : tc.accent },
              ]}
            >
              {status}
            </Text>
          </View>
          <Text style={styles.timeRange}>{formatTimeRange(item)}</Text>
        </View>

        <View style={styles.sourceRow}>
          <SourceLabel item={item} />
        </View>

        <View style={styles.titleRow}>
          {item.type === 'task' ? (
            <TaskCheckbox checked={item.completed} onToggle={onToggleTask} />
          ) : null}
          <Text numberOfLines={3} style={styles.expandedTitle}>
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

        {context ? <Text style={styles.contextText}>{context}</Text> : null}

        {(item.myAssignedTasks?.length ?? 0) > 0 ? (
          <Text style={styles.assignedTasksText}>
            {item.myAssignedTasks?.length === 1
              ? 'יש לך משימה אחת באירוע'
              : `יש לך ${item.myAssignedTasks?.length} משימות באירוע`}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actionRow}>
        {hasPrimaryAction ? (
          <Pressable
            accessibilityLabel={hasRemoteAction ? 'הצטרפות לאירוע' : 'ניווט'}
            accessibilityRole="button"
            accessible={true}
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
          accessibilityLabel={`פרטים על ${item.title}`}
          accessibilityRole="button"
          accessible={true}
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
};

const CompactScheduleRow = ({
  item,
  onOpen,
  onNavigate,
  onToggleTask,
}: {
  item: HomeDailyItem;
  onOpen: () => void;
  onNavigate: () => void;
  onToggleTask: () => void;
}): React.JSX.Element => (
  <Pressable
    accessibilityLabel={`פתיחת ${item.title}`}
    accessibilityRole="button"
    accessible={true}
    onPress={onOpen}
    style={({ pressed }) => [styles.compactRow, pressed && styles.pressed]}
  >
    <Text style={styles.compactTime}>{formatTimeRange(item)}</Text>
    <View style={styles.compactBody}>
      <View style={styles.compactTitleRow}>
        {item.type === 'task' ? (
          <TaskCheckbox checked={item.completed} onToggle={onToggleTask} />
        ) : null}
        <Text
          numberOfLines={2}
          style={[styles.compactTitle, item.completed && styles.completedText]}
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
    </View>
    {item.location && parseGeoUri(item.locationUrl) ? (
      <Pressable
        accessibilityLabel={`ניווט אל ${item.title}`}
        accessibilityRole="button"
        accessible={true}
        hitSlop={10}
        onPress={onNavigate}
        style={styles.compactNav}
      >
        <MaterialIcons color={tc.primary} name="near-me" size={18} />
      </Pressable>
    ) : (
      <MaterialIcons color="#ADB3B5" name="chevron-left" size={22} />
    )}
  </Pressable>
);

export function HomeDailyCommandCenter({
  selectedDate,
  nowMs,
  scheduledItems,
  allDayItems,
  overdueTasks,
  untimedTasks,
  undatedTaskCount,
  birthdays,
  onOpenItem,
  onOpenTask,
  onToggleTask,
  onNavigate,
  onOpenRemoteUrl,
  onRsvp,
  onOpenTasks,
  onOpenBirthday,
  onOpenBirthdays,
}: HomeDailyCommandCenterProps): React.JSX.Element {
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

  const invitations = scheduledItems.filter(isPendingInvitation);
  const attentionCount =
    (isToday ? overdueTasks.length : 0) + invitations.length;
  const invitationIds = new Set(invitations.map((item) => item.id));
  const timelineItems = scheduledItems.filter((item) => {
    if (invitationIds.has(item.id)) return false;
    if (item.rsvpStatus === 'no' || item.myPersonalRsvpStatus === 'no') {
      return false;
    }
    // Today's command center focuses on what is still actionable. Past days
    // retain their full history, while events that already ended today recede.
    if (
      isToday &&
      item.type === 'event' &&
      item.endAt !== undefined &&
      item.endAt <= nowMs
    ) {
      return false;
    }
    return true;
  });
  const activeItems = isToday
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
  const nextItem =
    isPast || activeItems.length > 0
      ? null
      : (timelineItems.find(
          (item) =>
            !item.completed &&
            (isFuture || item.startAt === undefined || item.startAt > nowMs)
        ) ?? null);
  const primaryItem = activeItems[0] ?? nextItem;
  const primaryId = primaryItem?.id;
  const remainingItems = timelineItems.filter(
    (item) => item.id !== primaryId && !activeIds.has(item.id)
  );
  const overlappingItems = activeItems.slice(1);

  const emptySuffix = isToday ? 'להיום' : isPast ? 'ביום הזה' : 'לתאריך הזה';

  return (
    <View style={styles.root}>
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
                        status === 'yes' && styles.rsvpButtonPrimary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rsvpButtonText,
                          status === 'yes' && styles.rsvpButtonTextPrimary,
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isPast ? 'היום שהיה' : 'הלו״ז שלי'}
        </Text>

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

        {primaryItem && !isPast ? (
          <>
            <ExpandedScheduleCard
              context={
                activeItems.length > 0 && primaryItem.startAt
                  ? formatElapsed(primaryItem.startAt, nowMs)
                  : primaryItem.startAt
                    ? formatUntilStart(primaryItem.startAt, nowMs)
                    : null
              }
              item={primaryItem}
              onNavigate={() =>
                onNavigate(primaryItem.location, primaryItem.locationUrl)
              }
              onOpen={() => onOpenItem(primaryItem)}
              onOpenRemoteUrl={() => {
                if (primaryItem.remoteUrl)
                  onOpenRemoteUrl(primaryItem.remoteUrl);
              }}
              onToggleTask={() => onToggleTask(primaryItem.id)}
              status={
                activeItems.length > 1
                  ? `${activeItems.length} אירועים מתקיימים עכשיו`
                  : activeItems.length === 1
                    ? 'מתקיים עכשיו'
                    : isToday
                      ? 'הבא בתור'
                      : 'הראשון בלו״ז'
              }
            />

            {overlappingItems.length > 0 ? (
              <View style={styles.overlapGroup}>
                <Text style={styles.overlapTitle}>מתקיימים במקביל</Text>
                {overlappingItems.map((item) => (
                  <CompactScheduleRow
                    item={item}
                    key={item.id}
                    onNavigate={() =>
                      onNavigate(item.location, item.locationUrl)
                    }
                    onOpen={() => onOpenItem(item)}
                    onToggleTask={() => onToggleTask(item.id)}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {remainingItems.length > 0 ? (
          <View style={styles.compactGroup}>
            {primaryItem && !isPast ? (
              <Text style={styles.compactGroupTitle}>אחר כך</Text>
            ) : null}
            {remainingItems.map((item) => (
              <CompactScheduleRow
                item={item}
                key={item.id}
                onNavigate={() => onNavigate(item.location, item.locationUrl)}
                onOpen={() => onOpenItem(item)}
                onToggleTask={() => onToggleTask(item.id)}
              />
            ))}
          </View>
        ) : null}

        {allDayItems.length === 0 &&
        !primaryItem &&
        remainingItems.length === 0 ? (
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

      {untimedTasks.length > 0 ? (
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
            {untimedTasks.map((task, index) => (
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

      {isToday && undatedTaskCount > 0 ? (
        <View style={styles.section}>
          <Pressable
            accessibilityLabel={`${undatedTaskCount} משימות פתוחות ללא תאריך`}
            accessibilityRole="button"
            accessible={true}
            onPress={onOpenTasks}
            style={styles.undatedRow}
          >
            <Text style={styles.undatedText}>
              {undatedTaskCount === 1
                ? 'משימה פתוחה אחת ללא תאריך'
                : `${undatedTaskCount} משימות פתוחות ללא תאריך`}
            </Text>
            <MaterialIcons
              color={tc.primary}
              name="expand-more"
              size={23}
            />
          </Pressable>
        </View>
      ) : null}

      {!isPast ? (
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>ימי הולדת קרובים</Text>
            {birthdays.length > 0 ? (
              <Pressable
                accessibilityLabel="פתיחת כל ימי ההולדת"
                accessibilityRole="button"
                accessible={true}
                onPress={onOpenBirthdays}
              >
                <Text style={styles.sectionLink}>הכל</Text>
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
          ) : (
            <Text style={styles.noBirthdays}>
              אין ימי הולדת ב־30 הימים הקרובים
            </Text>
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
  overlapGroup: {
    gap: 8,
    marginTop: 4,
  },
  overlapTitle: {
    color: '#5A6062',
    fontSize: 12,
    fontWeight: '700',
    textAlign: getTextAlign(),
  },
  compactGroup: {
    gap: 8,
  },
  compactGroupTitle: {
    color: '#5A6062',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textAlign: getTextAlign(),
  },
  compactRow: {
    minHeight: 74,
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    gap: 11,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F1F4F5',
  },
  compactTime: {
    width: 82,
    color: '#44525A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: getTextAlign(),
    writingDirection: 'ltr',
  },
  compactBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
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
  compactNav: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pressed: {
    opacity: 0.72,
  },
});
