import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  type GestureResponderEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityEventNameTag } from '@/components/CommunityEventNameTag';
import type { EventItem } from '@/components/EventDetailsBottomSheet';
import { EventDetailsBottomSheet } from '@/components/EventDetailsBottomSheet';
import type { AssignedEventTask } from '@/components/InlineEventTasksSection';
import { InlineEventTasksSection } from '@/components/InlineEventTasksSection';
import type { ImportantItem } from '@/components/InlineImportantItemsSection';
import { InlineImportantItemsSection } from '@/components/InlineImportantItemsSection';
import { MainScreenHeader } from '@/components/MainScreenHeader';
import { NavigationPickerModal } from '@/components/NavigationPickerModal';
import type { ProfileCircle } from '@/components/ProfileCircles';
import { ProfileCircles } from '@/components/ProfileCircles';
import { TaskDetailsBottomSheet } from '@/components/tasks/TaskDetailsBottomSheet';
import { useNotifications } from '@/contexts/NotificationsContext';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getAvatarInitials } from '@/lib/avatarInitials';
import { useBirthdaySheets } from '@/lib/components/birthday/BirthdaySheetsProvider';
import { NotificationsDrawer } from '@/lib/components/notifications/NotificationsDrawer';
import { APP_IS_RTL, rtl } from '@/lib/rtl';
import { parseGeoUri } from '@/lib/utils/geoUri';

/**
 * Android: root View uses `direction: 'rtl'` (`app/_layout.tsx`). Yoga lays out `flexDirection: 'row'`
 * with inline-start on the physical RIGHT — so JSX order must be reversed vs iOS for the same visuals.
 * (`direction: 'ltr'` on nested Views is unreliable on Android.)
 */
const ANDROID_MATCH_IOS_LAYOUT = Platform.OS === 'android' && APP_IS_RTL;

// ===== Constants =====
const PRIMARY_BLUE = '#36a9e2';
const BG_COLOR = '#f6f7f8';
const COMPACT_CELL_HEIGHT = 54;

/** Horizontal month swipe — distance (px) or velocity to commit */
const MONTH_SWIPE_DISTANCE = 56;
const MONTH_SWIPE_VELOCITY = 420;

/** Calendar panel snap thresholds */
const OPEN_DRAG_DISTANCE = 28;
const CLOSE_DRAG_DISTANCE = 28;
const SNAP_VELOCITY = 260;

// Dynamic panel height building blocks
const PANEL_FIXED_HEIGHT = 56; // compact grid chrome (day-name header row + padding)
const CALENDAR_HANDLE_HEIGHT = 44; // tap-to-toggle arrow handle
const COMPACT_ROW_HEIGHT = COMPACT_CELL_HEIGHT + 4; // cell + weekRow marginBottom
const EXPANDED_DAY_HEADER_HEIGHT = 24;
const EXPANDED_ROW_ITEM_HEIGHT = 20;
const EXPANDED_ROW_ITEM_HEIGHT_SINGLE = 42;
const EXPANDED_GRID_BOTTOM_PADDING = 124;
const EDIT_POPOVER_WIDTH = 112;
const EDIT_POPOVER_HEIGHT = 52;
/** Height when month grid collapses to a single week row (day selected, week-only mode) */
const WEEK_ONLY_PANEL_HEIGHT =
  PANEL_FIXED_HEIGHT + COMPACT_ROW_HEIGHT + CALENDAR_HANDLE_HEIGHT; // 56 + 58 + 44 = 158

type SnapState = 'compact' | 'expanded';

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const HEBREW_DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const HEBREW_WEEKDAYS_FULL = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
];

// ===== Types =====
interface CalendarEvent {
  id: string;
  title: string;
  name?: string;
  subject?: string;
  summary?: string;
  time: string;
  category: string;
  categoryColor: string;
  communityId?: string;
  location?: string;
  /** geo:lat,lng URI — present when the event was saved with autocomplete coordinates */
  locationUrl?: string;
  icon?: string;
  cancelled?: boolean;
  assigneeColors?: string[];
  sourceType?: 'event' | 'linked';
  /** Disambiguates list keys when same id appears from multiple sources */
  listKey?: string;
  /** Community events shown outside community screen — real name from Convex */
  communityName?: string;
  /** For stable ordering inside a day cell */
  sortTimeMs?: number;
  /** Expanded month chip styling */
  eventVisualKind?: 'community' | 'shared' | 'personal';
  /** True when the current viewer created this event; false for Type B (shared-with-viewer) events */
  isViewerCreator?: boolean;
  /** Resolved family-member profiles for compact card circles (personal events only) */
  profileCircles?: ProfileCircle[];
  profileCirclesExtraCount?: number;
  profileCirclesContext?: 'sharedWith' | 'alsoAddedToCalendar';
}

interface BirthdayInfo {
  name: string;
  age?: number;
}

interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  birthday?: BirthdayInfo;
}

// ===== Mock Data =====
const MOCK_TIMELINE_DATA = [
  {
    dayLabel: 'היום, יום חמישי',
    dayNumber: '24',
    isToday: true,
    events: [
      {
        id: '1',
        category: 'משפחה',
        categoryColor: '#ff922b',
        title: 'ארוחת צהריים משפחתית',
        time: '13:00',
        location: 'בבית',
        icon: 'home',
        cancelled: false,
      },
      {
        id: '2',
        category: 'בריאות',
        categoryColor: PRIMARY_BLUE,
        title: 'תור לרופא שיניים',
        time: '10:00',
        location: 'מרפאת כללית, תל אביב',
        icon: 'location-on',
        cancelled: false,
      },
      {
        id: '3',
        category: 'אישי',
        categoryColor: '#9ca3af',
        title: 'קפה עם אמא',
        time: '08:30',
        location: 'קפה לנדוור',
        icon: 'local-cafe',
        cancelled: true,
      },
    ],
  },
  {
    dayLabel: 'אתמול, יום רביעי',
    dayNumber: '23',
    isToday: false,
    events: [
      {
        id: '4',
        category: 'כושר',
        categoryColor: '#7950f2',
        title: 'אימון בחדר כושר',
        time: '18:00',
        location: 'הולמס פלייס',
        icon: 'fitness-center',
        cancelled: false,
      },
      {
        id: '5',
        category: 'קניות',
        categoryColor: '#51cf66',
        title: 'קניות לשבת',
        time: '16:30',
        location: 'שופרסל דיל',
        icon: 'shopping-cart',
        cancelled: false,
      },
    ],
  },
  {
    dayLabel: 'יום שלישי',
    dayNumber: '22',
    isToday: false,
    events: [
      {
        id: '6',
        category: 'עבודה',
        categoryColor: '#6b7280',
        title: 'פגישת צוות שבועית',
        time: '09:00',
        location: '',
        icon: '',
        cancelled: false,
      },
    ],
  },
];

type MockTimelineEvent = (typeof MOCK_TIMELINE_DATA)[number]['events'][number];
type TimelineEventRow = MockTimelineEvent & {
  sourceType?: 'event' | 'linked';
  communityName?: string;
  endTime?: string;
  locationUrl?: string;
  myAssignedTasks?: AssignedEventTask[];
  importantItems?: ImportantItem[];
  /** True for rows synthesised from the personal tasks table */
  isPersonalTask?: boolean;
  /** True when the task dueDate is in the past and not yet completed */
  isOverdue?: boolean;
  /** Subtask checklist items — only for personal task rows */
  subtasks?: { id: string; title: string; completed: boolean }[];
  /** Initials of the non-self assignee — only for personal task rows */
  assigneeInitials?: string;
  /** Background colour for the assignee avatar — only for personal task rows */
  assigneeColor?: string;
  /** All non-self assignees for multi-circle display on compact task rows. */
  assigneeDisplays?: { initials: string; color: string }[];
  /** Resolved family-member profiles to display as overlapping circles on the card */
  profileCircles?: ProfileCircle[];
  /** Count of external (non-family) participants, shown as "+N" after the circles */
  profileCirclesExtraCount?: number;
  /** Semantic context: 'sharedWith' for personal items, 'alsoAddedToCalendar' for community events */
  profileCirclesContext?: 'sharedWith' | 'alsoAddedToCalendar';
};

/** Lightweight task item for monthly selected-day panels (DayEventsList / CalendarDayEventsSheet) */
type CalendarDayTask = {
  id: string;
  title: string;
  time: string;
  isOverdue: boolean;
  assigneeInitials?: string;
  assigneeColor?: string;
  /** All non-self assignees for multi-circle display on compact task cards. */
  assigneeDisplays?: { initials: string; color: string }[];
  subtasks?: { id: string; title: string; completed: boolean }[];
};

interface TimelineDayGroup {
  dayLabel: string;
  dayNumber: string;
  isToday: boolean;
  events: TimelineEventRow[];
  sortKey: number;
}

// ===== Task filter (mirrors Home screen rule) =====
function isEventDerivedImportantItemTask(task: {
  sourceType?: string;
}): boolean {
  return (
    task.sourceType === 'community_event_important_item' ||
    task.sourceType === 'community_event_important_items_bundle'
  );
}

/**
 * Resolves the first non-self assignee on a task for avatar display.
 * Mirrors the same function in the Home screen.
 */
/**
 * Like resolveNonSelfAssigneeCalendar but returns ALL non-self assignees for
 * multi-circle display (e.g. ינ + של) on compact calendar task cards.
 */
function resolveAllNonSelfAssigneesCalendar(
  task: {
    assignedTo?: unknown;
    assignedToUserIds?: unknown;
    assignedToMemberId?: unknown;
    assignedToMemberIds?: unknown;
    createdBy?: unknown;
    assigneeMemberProfiles?: {
      id: string;
      name: string;
      color: string | null;
    }[];
  },
  currentUserId: string | undefined,
  byUserId: Map<string, { initials: string; color: string }>,
  byMemberId: Map<string, { initials: string; color: string }>,
  selfEntityId: string | undefined
): { initials: string; color: string }[] {
  const displays: { initials: string; color: string }[] = [];
  const seen = new Set<string>();

  const creatorId = task.createdBy as string | undefined;
  const isCreator = !!currentUserId && creatorId === currentUserId;

  const userAssignees: string[] = [
    ...((task.assignedToUserIds as string[] | undefined) ?? []),
    ...(task.assignedTo ? [task.assignedTo as string] : []),
  ];
  const memberAssignees: string[] = [
    ...((task.assignedToMemberIds as string[] | undefined) ?? []),
    ...(task.assignedToMemberId ? [task.assignedToMemberId as string] : []),
  ];

  const viewerIsUserAssignee =
    currentUserId !== undefined && userAssignees.includes(currentUserId);
  const viewerIsMemberAssignee =
    selfEntityId !== undefined && memberAssignees.includes(selfEntityId);
  const viewerIsAssignee = viewerIsUserAssignee || viewerIsMemberAssignee;

  if (
    !isCreator &&
    viewerIsAssignee &&
    creatorId &&
    creatorId !== currentUserId
  ) {
    const info = byUserId.get(creatorId);
    if (info?.initials && !seen.has(`u:${creatorId}`)) {
      seen.add(`u:${creatorId}`);
      displays.push(info);
    }
  }

  for (const uid of userAssignees) {
    if (!uid || uid === currentUserId) continue;
    if (seen.has(`u:${uid}`)) continue;
    const info = byUserId.get(uid);
    if (info?.initials) {
      seen.add(`u:${uid}`);
      displays.push(info);
    }
  }

  const profiles = task.assigneeMemberProfiles ?? [];
  for (const mid of memberAssignees) {
    if (!mid || mid === selfEntityId) continue;
    if (seen.has(`m:${mid}`)) continue;
    const embedded = profiles.find((p) => p.id === mid);
    if (embedded?.name) {
      const initials = getAvatarInitials(embedded.name);
      if (initials) {
        seen.add(`m:${mid}`);
        displays.push({ initials, color: embedded.color ?? '#36a9e2' });
        continue;
      }
    }
    const info = byMemberId.get(mid);
    if (info?.initials) {
      seen.add(`m:${mid}`);
      displays.push(info);
    }
  }

  return displays;
}

/**
 * Correct overdue check.
 * - Timed tasks: overdue only after the specific dueAt moment.
 * - Date-only tasks: overdue only when the due calendar day is strictly before today.
 */
function calcTaskOverdue(
  dueDate: number,
  dueAt: number | null | undefined,
  hasTime: boolean | null | undefined,
  nowMs: number
): boolean {
  if (hasTime && dueAt) return dueAt < nowMs;
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  return dueDay.getTime() < todayStart.getTime();
}

// ===== Event Helpers =====
function calculateDuration(event: CalendarEvent): number {
  const durations: Record<string, number> = {
    משפחה: 60,
    בריאות: 60,
    אישי: 45,
    כושר: 60,
    קניות: 30,
    עבודה: 120,
    חוגים: 45,
  };
  return durations[event.category] ?? 60;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    משפחה: 'people',
    בריאות: 'local-hospital',
    אישי: 'person',
    כושר: 'fitness-center',
    קניות: 'shopping-cart',
    עבודה: 'work',
    חוגים: 'palette',
  };
  return icons[category] ?? 'event';
}

function openEventEditFromCalendar(
  router: ReturnType<typeof useRouter>,
  event: CalendarEvent
): void {
  if (event.sourceType === 'linked') return;

  router.push({
    pathname: '/(authenticated)/event-edit/[id]',
    params: {
      id: event.id,
      ...(event.communityId ? { returnCommunityId: event.communityId } : {}),
    },
  });
}

function getHebrewCalendarDayLabel(
  year: number,
  month: number,
  day: number
): string {
  const date = new Date(year, month, day);
  const weekday = HEBREW_WEEKDAYS_FULL[date.getDay()];
  const monthName = HEBREW_MONTHS[month];
  return `${weekday}, ${day} ב${monthName}`;
}

function getCalendarEventTitle(event: CalendarEvent): string {
  return (
    event.title ||
    event.name ||
    event.subject ||
    event.summary ||
    'אירוע ללא כותרת'
  );
}

function estimateSingleEventHeight(title: string): number {
  const CHARS_PER_LINE = 5;
  const LINE_HEIGHT = 14;
  const TIME_LINE_HEIGHT = 11;
  const PADDING_VERTICAL = 4;
  const lineCount = Math.max(1, Math.ceil(title.length / CHARS_PER_LINE));
  return PADDING_VERTICAL + lineCount * LINE_HEIGHT + TIME_LINE_HEIGHT + 6;
}

function getExpandedWeekHeight(
  week: CalendarDay[],
  baseWeekHeight = 0
): number {
  const maxVisibleItems = Math.max(
    1,
    ...week.map((day) => {
      if (!day.isCurrentMonth) return 0;
      return day.events.length + (day.birthday != null ? 1 : 0);
    })
  );
  const maxEventsHeight = Math.max(
    0,
    ...week.map((day) => {
      if (!day.isCurrentMonth) return 0;
      const birthdayHeight =
        day.birthday != null ? EXPANDED_ROW_ITEM_HEIGHT + 4 : 0;
      const eventHeight =
        day.events.length === 1
          ? Math.max(
              EXPANDED_ROW_ITEM_HEIGHT_SINGLE,
              estimateSingleEventHeight(
                day.events[0].title ??
                  day.events[0].name ??
                  day.events[0].subject ??
                  day.events[0].summary ??
                  ''
              )
            )
          : day.events.length * EXPANDED_ROW_ITEM_HEIGHT;
      return birthdayHeight + eventHeight;
    })
  );
  const gapHeight = maxVisibleItems * 3;

  const contentRequiredHeight =
    EXPANDED_DAY_HEADER_HEIGHT + maxEventsHeight + gapHeight + 10;

  return Math.max(baseWeekHeight, contentRequiredHeight);
}

// ===== Calendar Grid Helpers =====
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function generateCalendarGrid(
  year: number,
  month: number,
  monthlyEventsOverride?: Record<number, CalendarEvent[]>
): CalendarDay[][] {
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  const eventsSource = monthlyEventsOverride ?? {};

  const allDays: CalendarDay[] = [];

  for (let i = firstDayOffset - 1; i >= 0; i--) {
    allDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    allDays.push({
      day: d,
      isCurrentMonth: true,
      isToday: d === todayDay && month === todayMonth && year === todayYear,
      events: eventsSource[d] ?? [],
    });
  }

  const minCells = 35;
  const targetCells = allDays.length <= minCells ? minCells : 42;
  const remaining = targetCells - allDays.length;
  for (let i = 1; i <= remaining; i++) {
    allDays.push({
      day: i,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  if (weeks.length === 6 && weeks[5].every((d) => !d.isCurrentMonth)) {
    weeks.pop();
  }

  return weeks;
}

interface CalendarMonthNavBarProps {
  headerMonthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTitlePress: () => void;
}

function CalendarMonthNavBar({
  headerMonthLabel,
  onPrevMonth,
  onNextMonth,
  onTitlePress,
}: CalendarMonthNavBarProps): React.JSX.Element {
  return (
    <View style={styles.monthNavRow}>
      <Pressable
        onPress={ANDROID_MATCH_IOS_LAYOUT ? onPrevMonth : onNextMonth}
        hitSlop={12}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={ANDROID_MATCH_IOS_LAYOUT ? 'חודש קודם' : 'חודש הבא'}
        style={styles.monthChevronButton}
      >
        <MaterialIcons
          name={ANDROID_MATCH_IOS_LAYOUT ? 'chevron-right' : 'chevron-left'}
          size={24}
          color="#647b87"
        />
      </Pressable>
      <Pressable
        onPress={onTitlePress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`בחר חודש ושנה, ${headerMonthLabel}`}
        style={styles.monthTitleButton}
      >
        <Text style={styles.monthYear}>{headerMonthLabel}</Text>
      </Pressable>
      <Pressable
        onPress={ANDROID_MATCH_IOS_LAYOUT ? onNextMonth : onPrevMonth}
        hitSlop={12}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={ANDROID_MATCH_IOS_LAYOUT ? 'חודש הבא' : 'חודש קודם'}
        style={styles.monthChevronButton}
      >
        <MaterialIcons
          name={ANDROID_MATCH_IOS_LAYOUT ? 'chevron-left' : 'chevron-right'}
          size={24}
          color="#647b87"
        />
      </Pressable>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sheetCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    direction: 'rtl',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  closeButtonGhost: {
    width: 32,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'center',
  },
  sheetBirthday: {
    fontSize: 13,
    color: '#be185d',
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 10,
  },
  sheetScroll: {
    flexGrow: 0,
    maxHeight: 360,
  },
  sheetScrollContent: {
    paddingBottom: 4,
  },
  sheetEmpty: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'right',
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  sheetRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sheetRowCommunity: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  sheetRowShared: {
    backgroundColor: '#f8fafc',
    borderColor: '#e5e7eb',
  },
  sheetEventLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sheetEventTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111517',
    textAlign: 'right',
  },
  sheetEventTitleCancelled: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  sheetEventTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#647b87',
    minWidth: 44,
    textAlign: 'right',
  },
  sheetTaskRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sheetTaskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111517',
    textAlign: 'right',
  },
  sheetOverdueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  sheetOverdueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  sheetTaskTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sheetTaskAssigneeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTaskAssigneeInitials: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  sheetTaskSubtasksRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  sheetTaskSubtasksText: {
    fontSize: 11,
    color: '#64748b',
  },
});

const editPopoverStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    position: 'absolute',
    width: EDIT_POPOVER_WIDTH,
    height: EDIT_POPOVER_HEIGHT,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY_BLUE,
    textAlign: 'center',
  },
});

interface EventEditMenuState {
  event: CalendarEvent;
  x: number;
  y: number;
}

interface MonthYearPickerModalProps {
  visible: boolean;
  selectedMonth: number;
  selectedYear: number;
  onClose: () => void;
  onConfirm: (month: number, year: number) => void;
}

interface CalendarEventEditPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
}

function CalendarEventEditPopover({
  visible,
  x,
  y,
  onClose,
  onEdit,
}: CalendarEventEditPopoverProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="סגור תפריט עריכה"
        accessibilityRole="button"
        onPress={onClose}
        style={editPopoverStyles.backdrop}
      />
      <View style={[editPopoverStyles.card, { left: x, top: y }]}>
        <Pressable
          accessibilityLabel="עריכה"
          accessibilityRole="button"
          accessible={true}
          onPress={onEdit}
          style={editPopoverStyles.button}
        >
          <Text style={editPopoverStyles.buttonText}>עריכה</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function MonthYearPickerModal({
  visible,
  selectedMonth,
  selectedYear,
  onClose,
  onConfirm,
}: MonthYearPickerModalProps): React.JSX.Element {
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 21 }, (_, index) => currentYear - 10 + index),
    [currentYear]
  );
  const [draftMonth, setDraftMonth] = useState(selectedMonth);
  const [draftYear, setDraftYear] = useState(selectedYear);

  useEffect(() => {
    if (!visible) return;
    setDraftMonth(selectedMonth);
    setDraftYear(selectedYear);
  }, [selectedMonth, selectedYear, visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={pickerStyles.modalRoot} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="סגור בוחר חודש ושנה"
          accessibilityRole="button"
          onPress={onClose}
          style={pickerStyles.backdrop}
        />

        <View style={pickerStyles.card}>
          <Text style={pickerStyles.title}>בחירת חודש</Text>

          <View style={pickerStyles.columns}>
            <View style={pickerStyles.column}>
              <Text style={pickerStyles.columnTitle}>חודש</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={pickerStyles.columnScroll}
              >
                {HEBREW_MONTHS.map((monthName, monthIndex) => {
                  const isActive = draftMonth === monthIndex;
                  return (
                    <Pressable
                      key={monthName}
                      accessibilityLabel={monthName}
                      accessibilityRole="button"
                      accessible={true}
                      onPress={() => setDraftMonth(monthIndex)}
                      style={[
                        pickerStyles.optionButton,
                        isActive && pickerStyles.optionButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          pickerStyles.optionText,
                          isActive && pickerStyles.optionTextActive,
                        ]}
                      >
                        {monthName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={pickerStyles.column}>
              <Text style={pickerStyles.columnTitle}>שנה</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={pickerStyles.columnScroll}
              >
                {years.map((yearValue) => {
                  const isActive = draftYear === yearValue;
                  return (
                    <Pressable
                      key={String(yearValue)}
                      accessibilityLabel={String(yearValue)}
                      accessibilityRole="button"
                      accessible={true}
                      onPress={() => setDraftYear(yearValue)}
                      style={[
                        pickerStyles.optionButton,
                        isActive && pickerStyles.optionButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          pickerStyles.optionText,
                          isActive && pickerStyles.optionTextActive,
                        ]}
                      >
                        {String(yearValue)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={pickerStyles.actions}>
            <Pressable
              accessibilityLabel="ביטול בחירת חודש"
              accessibilityRole="button"
              accessible={true}
              onPress={onClose}
              style={pickerStyles.secondaryButton}
            >
              <Text style={pickerStyles.secondaryButtonText}>ביטול</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="הצג חודש נבחר"
              accessibilityRole="button"
              accessible={true}
              onPress={() => onConfirm(draftMonth, draftYear)}
              style={pickerStyles.primaryButton}
            >
              <Text style={pickerStyles.primaryButtonText}>הצג</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface CalendarDayEventsSheetProps {
  visible: boolean;
  onClose: () => void;
  dayLabel: string;
  birthday?: BirthdayInfo;
  events: CalendarEvent[];
  tasks?: CalendarDayTask[];
  onEventNavigate: (event: CalendarEvent) => void;
  onEventLongPress: (
    event: CalendarEvent,
    pressEvent: GestureResponderEvent
  ) => void;
  onOpenTaskSheet: (id: string) => void;
}

function CalendarDayEventsSheet({
  visible,
  onClose,
  dayLabel,
  birthday,
  events,
  tasks = [],
  onEventNavigate,
  onEventLongPress,
  onOpenTaskSheet,
}: CalendarDayEventsSheetProps): React.JSX.Element {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={sheetStyles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={sheetStyles.backdrop}
          onPress={onClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="סגור"
        />
        <View style={sheetStyles.sheetCard} accessibilityViewIsModal>
          <View style={sheetStyles.sheetTopRow}>
            <View style={sheetStyles.closeButtonGhost} />
            <Text style={sheetStyles.sheetTitle}>{dayLabel}</Text>
            <Pressable
              accessibilityLabel="סגור חלון אירועי יום"
              accessibilityRole="button"
              accessible={true}
              onPress={onClose}
              style={sheetStyles.closeButton}
            >
              <MaterialIcons color="#647b87" name="close" size={18} />
            </Pressable>
          </View>

          {birthday != null ? (
            <Text style={sheetStyles.sheetBirthday}>
              🎂 יום הולדת: {birthday.name}
            </Text>
          ) : null}

          <ScrollView
            style={sheetStyles.sheetScroll}
            contentContainerStyle={sheetStyles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {events.length === 0 && tasks.length === 0 ? (
              <Text style={sheetStyles.sheetEmpty}>אין אירועים ביום הזה</Text>
            ) : null}

            {events.map((ev) => {
              const kind = ev.eventVisualKind ?? 'personal';
              return (
                <Pressable
                  key={ev.listKey ?? ev.id}
                  style={[
                    sheetStyles.sheetRow,
                    kind === 'community' && sheetStyles.sheetRowCommunity,
                    kind === 'shared' && sheetStyles.sheetRowShared,
                  ]}
                  onPress={() => onEventNavigate(ev)}
                  onLongPress={(pressEvent) => onEventLongPress(ev, pressEvent)}
                  delayLongPress={340}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${ev.time !== '' ? `${ev.time} ` : ''}${ev.title}`}
                >
                  <View style={sheetStyles.sheetEventLine}>
                    {ev.time !== '' ? (
                      <Text style={sheetStyles.sheetEventTime}>{ev.time}</Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={[
                        sheetStyles.sheetEventTitle,
                        ev.cancelled && sheetStyles.sheetEventTitleCancelled,
                      ]}
                    >
                      {ev.title}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {tasks.map((task) => (
              <View key={task.id} style={{ marginBottom: 8 }}>
                <CalendarTaskCard
                  task={task}
                  onOpenTaskSheet={onOpenTaskSheet}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ===== Main Component =====
export default function CalendarScreen(): React.JSX.Element {
  const router = useRouter();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const {
    communityId: rawCommunityId,
    view: returnView,
    date: returnDate,
    month: returnMonth,
    collapsed: returnCollapsed,
  } = useLocalSearchParams<{
    communityId?: string;
    view?: string;
    date?: string;
    month?: string;
    collapsed?: string;
  }>();
  // Guard against the string "undefined" being passed as a route param
  const communityId =
    rawCommunityId === 'undefined' ? undefined : rawCommunityId;

  const communityEvents = useQuery(
    api.events.listByCommunity,
    communityId ? { communityId: communityId as Id<'communities'> } : 'skip'
  );

  const communityData = useQuery(
    api.communities.getById,
    communityId ? { communityId: communityId as Id<'communities'> } : 'skip'
  );

  const spaceId = useQuery(api.users.getMySpace);

  const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');
  const [slideAnim] = useState(new Animated.Value(0));
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(0);
  const SEGMENT_PAD = 4;
  const pillWidth =
    segmentContainerWidth > 0
      ? (segmentContainerWidth - SEGMENT_PAD * 2) / 2
      : 0;
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const lastDragCloseTime = useRef<number>(0);

  const [taskSheetTaskId, setTaskSheetTaskId] = useState<string | null>(null);
  const [taskSheetVisible, setTaskSheetVisible] = useState(false);
  const {
    unseenCount,
    markAllSeen,
    isLoading: notifLoading,
  } = useNotifications();

  const handleBellPress = (): void => {
    if (!isNotificationsOpen) {
      setIsNotificationsOpen(true);
    }
    if (!notifLoading) {
      markAllSeen();
    }
  };

  const handleOpenEventDetails = useCallback((event: CalendarEvent): void => {
    if (Date.now() - lastDragCloseTime.current < 600) return;
    // Personal task rows are display-only in the calendar — not openable as events
    if (event.id.startsWith('task:')) return;

    if (event.sourceType === 'linked') {
      setSelectedEvent({
        id: event.id,
        time: event.time,
        title: event.title,
        location: event.location,
        type: 'event',
        iconColor: event.categoryColor,
        completed: false,
        canEdit: false,
      });
      setSelectedEventId(null);
      return;
    }

    setSelectedEvent(null);
    setSelectedEventId(event.id);
  }, []);

  const closeEventSheet = (): void => {
    setSelectedEventId(null);
    setSelectedEvent(null);
  };

  const [navPickerLocation, setNavPickerLocation] = useState<string | null>(
    null
  );
  const [navPickerLocationUrl, setNavPickerLocationUrl] = useState<
    string | null
  >(null);

  const handleNavigateToLocation = (
    location: string,
    locationUrl?: string
  ): void => {
    setNavPickerLocation(location);
    setNavPickerLocationUrl(locationUrl ?? null);
  };

  const today = useMemo(() => new Date(), []);
  const [monthlyVisibleDate, setMonthlyVisibleDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const displayYear = monthlyVisibleDate.getFullYear();
  const displayMonth = monthlyVisibleDate.getMonth();
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate()
  );
  const [daySheetDay, setDaySheetDay] = useState<number | null>(null);
  const [monthlyViewportHeight, setMonthlyViewportHeight] = useState(0);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [eventEditMenu, setEventEditMenu] = useState<EventEditMenuState | null>(
    null
  );
  const longPressGuardRef = useRef<{ key: string; until: number } | null>(null);
  const timelineScrollRef = useRef<ScrollView | null>(null);
  const didAutoScrollTimelineRef = useRef(false);

  const isFiltered = !!communityId;

  // === Personal events for the displayed month ===
  const monthRange = useMemo(() => {
    const from = new Date(displayYear, displayMonth, 1).setHours(0, 0, 0, 0);
    const to = new Date(displayYear, displayMonth + 1, 0).setHours(
      23,
      59,
      59,
      999
    );
    return { from, to };
  }, [displayYear, displayMonth]);

  const timelineRange = useMemo(() => {
    const fromDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    fromDate.setMonth(fromDate.getMonth() - 4);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    toDate.setMonth(toDate.getMonth() + 8);
    toDate.setHours(23, 59, 59, 999);

    return { from: fromDate.getTime(), to: toDate.getTime() };
  }, [today]);

  const personalEvents =
    useQuery(api.events.listByDateRange, {
      from: monthRange.from,
      to: monthRange.to,
    }) ?? [];

  /** Community events (RSVP yes for members; creators/admins unchanged) — merged into unfiltered month + timeline */
  const aggregateCommunityEvents =
    useQuery(
      api.events.listCommunityEventsForDate,
      !isFiltered ? { from: monthRange.from, to: monthRange.to } : 'skip'
    ) ?? [];

  const timelinePersonalEvents =
    useQuery(api.events.listByDateRange, {
      from: timelineRange.from,
      to: timelineRange.to,
    }) ?? [];

  const timelineCommunityEvents =
    useQuery(
      api.events.listCommunityEventsForDate,
      !isFiltered ? { from: timelineRange.from, to: timelineRange.to } : 'skip'
    ) ?? [];

  // My assigned event tasks for the timeline date range — grouped per event
  const timelineAssignedEventTasks =
    useQuery(api.eventTasks.listMyAssignedEventTasksForDate, {
      from: timelineRange.from,
      to: timelineRange.to,
    }) ?? [];

  const timelineTasksByEventId = useMemo(() => {
    const map: Record<string, AssignedEventTask[]> = {};
    for (const t of timelineAssignedEventTasks) {
      if (!map[t.eventId]) map[t.eventId] = [];
      map[t.eventId].push({
        id: t._id,
        title: t.title,
        completed: t.completed,
      });
    }
    return map;
  }, [timelineAssignedEventTasks]);

  // Family contacts + current user — needed for assignee avatars on task cards
  const familyContacts = useQuery(api.members.listMyFamilyContacts);
  const currentUser = useQuery(api.users.getCurrentUser);

  const memberMaps = useMemo(() => {
    const byUserId = new Map<string, { initials: string; color: string }>();
    const byMemberId = new Map<string, { initials: string; color: string }>();
    const selfEntityId = familyContacts?.selfEntityId as string | undefined;
    for (const member of familyContacts?.members ?? []) {
      const name = (member.displayName ?? '').trim();
      const initials = getAvatarInitials(name);
      const info = {
        initials,
        color: (member.color ?? '#36a9e2') as string,
      };
      if (member.matchedUserId)
        byUserId.set(member.matchedUserId as string, info);
      byMemberId.set(member._id as string, info);
    }
    return { byUserId, byMemberId, selfEntityId };
  }, [familyContacts?.members, familyContacts?.selfEntityId]);

  // Full-profile lookup maps for ProfileCircles (need name, not just initials).
  // Excludes the current user so they never appear in their own shared-with list.
  const familyProfilesByUserId = useMemo(() => {
    const map = new Map<string, ProfileCircle>();
    const currentUserId = currentUser?._id as string | undefined;
    for (const member of familyContacts?.members ?? []) {
      const uid = (member as { matchedUserId?: string }).matchedUserId;
      if (!uid || uid === currentUserId) continue;
      const name = (member.displayName ?? '').trim();
      if (!name) continue;
      map.set(uid, {
        id: uid,
        name,
        color: (member.color ?? '#36a9e2') as string,
      });
    }
    return map;
  }, [familyContacts?.members, currentUser?._id]);

  const familyProfilesByMemberId = useMemo(() => {
    const map = new Map<string, ProfileCircle>();
    const selfEntityId = familyContacts?.selfEntityId as string | undefined;
    for (const member of familyContacts?.members ?? []) {
      const mid = member._id as string;
      if (mid === selfEntityId) continue;
      const name = (member.displayName ?? '').trim();
      if (!name) continue;
      map.set(mid, {
        id: mid,
        name,
        color: (member.color ?? '#36a9e2') as string,
      });
    }
    return map;
  }, [familyContacts?.members, familyContacts?.selfEntityId]);

  // All community events saved by family members — used for profile circles on
  // timeline event cards without querying per-event (O(family_size) DB calls).
  const familyAllSaved =
    useQuery(api.profileCircles.getFamilyAllSavedCommunityEvents) ?? {};

  // Personal tasks for the calendar — fetched once, filtered client-side
  const calendarTasksRaw = useQuery(api.tasks.listMyTasks) ?? [];

  const calendarPersonalTasks = useMemo(
    () =>
      calendarTasksRaw.filter(
        (t) =>
          t.dueDate != null &&
          !t.completed &&
          !isEventDerivedImportantItemTask(t)
      ),
    [calendarTasksRaw]
  );

  /** Task count per day-of-month for the currently displayed month (monthly indicator) */
  const calendarTasksByDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of calendarPersonalTasks) {
      if (t.dueDate == null) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() !== displayYear || d.getMonth() !== displayMonth)
        continue;
      const day = d.getDate();
      map[day] = (map[day] ?? 0) + 1;
    }
    return map;
  }, [calendarPersonalTasks, displayYear, displayMonth]);

  // FIXED: linked (shared) events for the displayed month — shown as dots alongside personal events
  const linkedEvents =
    useQuery(
      api.linkedEvents.getLinkedEventsForSpace,
      spaceId
        ? {
            spaceId: spaceId as Id<'spaces'>,
            from: monthRange.from,
            to: monthRange.to,
          }
        : 'skip'
    ) ?? [];

  // === Calendar grid data ===
  const grid = useMemo(() => {
    if (isFiltered) {
      // Community filter active — suppress personal event dots
      return generateCalendarGrid(displayYear, displayMonth, {});
    }
    if (
      personalEvents.length === 0 &&
      linkedEvents.length === 0 &&
      aggregateCommunityEvents.length === 0
    ) {
      // No personal events (or still loading) — fall back to empty dots
      return generateCalendarGrid(displayYear, displayMonth, {});
    }
    // Build real event markers keyed by day-of-month
    const eventsByDay: Record<number, CalendarEvent[]> = {};
    for (const ev of personalEvents) {
      const d = new Date(ev.startTime);
      if (d.getFullYear() !== displayYear || d.getMonth() !== displayMonth)
        continue;
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      const isSavedCommunityInSpace = Boolean(ev.communityId);
      const evS = ev as {
        createdBy?: string;
        allFamily?: boolean;
        sharedWithUserIds?: string[];
        sharedWithFamilyMemberIds?: string[];
        participants?: string[];
        sharedMemberProfiles?: Array<{
          id: string;
          displayName: string;
          color: string;
          isViewer: boolean;
        }>;
      };
      const calGridUserId = currentUser?._id as string | undefined;
      const isViewerCreator = isSavedCommunityInSpace
        ? undefined
        : !!calGridUserId && evS.createdBy === calGridUserId;

      // Profile circles for compact personal event cards in the day list
      let gridPc: ProfileCircle[] = [];
      let gridPcExtra = 0;
      let gridPcContext: 'sharedWith' | 'alsoAddedToCalendar' = 'sharedWith';
      if (isSavedCommunityInSpace) {
        gridPc = familyAllSaved[ev._id as string] ?? [];
        gridPcContext = 'alsoAddedToCalendar';
      } else {
        const totalParticipants = evS.participants?.length ?? 0;
        if (isViewerCreator) {
          if (evS.allFamily) {
            gridPc = [...familyProfilesByMemberId.values()];
            gridPcExtra = Math.max(0, totalParticipants - gridPc.length);
          } else {
            const resolved = evS.sharedMemberProfiles ?? [];
            for (const p of resolved) {
              if (p.isViewer) continue;
              gridPc.push({ id: p.id, name: p.displayName, color: p.color });
            }
            const familyCount = (evS.sharedWithFamilyMemberIds ?? []).length;
            gridPcExtra = Math.max(0, totalParticipants - familyCount);
          }
        } else {
          const resolved = evS.sharedMemberProfiles ?? [];
          const creatorId = evS.createdBy;
          const circles: ProfileCircle[] = [];
          if (creatorId) {
            const cp =
              familyProfilesByUserId.get(creatorId) ??
              familyProfilesByMemberId.get(creatorId);
            if (cp) circles.push(cp);
          }
          for (const p of resolved) {
            if (p.isViewer) continue;
            circles.push({ id: p.id, name: p.displayName, color: p.color });
          }
          const externalCount = Math.max(
            0,
            totalParticipants - (evS.sharedWithFamilyMemberIds?.length ?? 0)
          );
          gridPc = circles;
          gridPcExtra = externalCount;
        }
      }

      const personalRow = {
        id: ev._id,
        listKey: `${ev._id}-personal`,
        title: ev.title,
        time: ev.allDay
          ? ''
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        category: isSavedCommunityInSpace ? 'קהילה' : 'אישי',
        categoryColor: isSavedCommunityInSpace ? '#36a9e2' : PRIMARY_BLUE,
        communityId: ev.communityId,
        assigneeColors: [],
        sourceType: 'event' as const,
        communityName: ev.communityName,
        sortTimeMs: ev.startTime,
        eventVisualKind: isSavedCommunityInSpace
          ? ('community' as const)
          : ('personal' as const),
        isViewerCreator,
        profileCircles: gridPc.length > 0 ? gridPc : undefined,
        profileCirclesExtraCount: gridPcExtra > 0 ? gridPcExtra : undefined,
        profileCirclesContext: gridPcContext,
      };
      if (!eventsByDay[day].some((e) => e.id === personalRow.id)) {
        eventsByDay[day].push(personalRow);
      }
    }
    // FIXED: add linked event dots with a distinct teal-blue shade
    for (const ev of linkedEvents) {
      const d = new Date(ev.startTime);
      if (d.getFullYear() !== displayYear || d.getMonth() !== displayMonth)
        continue;
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      const linkedRow = {
        id: ev._id,
        listKey: `${ev._id}-linked`,
        title: ev.title,
        time: ev.allDay
          ? ''
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        category: 'משותף',
        categoryColor: '#0284c7',
        assigneeColors: [],
        cancelled: ev.sourceStatus === 'cancelled',
        sourceType: 'linked' as const,
        sortTimeMs: ev.startTime,
        eventVisualKind: 'shared' as const,
      };
      if (!eventsByDay[day].some((e) => e.id === linkedRow.id)) {
        eventsByDay[day].push(linkedRow);
      }
    }
    for (const ev of aggregateCommunityEvents) {
      const d = new Date(ev.startTime);
      if (d.getFullYear() !== displayYear || d.getMonth() !== displayMonth)
        continue;
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      const communityRow = {
        id: ev._id,
        listKey: `${ev._id}-community`,
        title: ev.title,
        time: ev.allDay
          ? ''
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        category: 'קהילה',
        categoryColor: '#36a9e2',
        communityId: ev.communityId,
        assigneeColors: [],
        sourceType: 'event' as const,
        communityName: ev.communityName,
        sortTimeMs: ev.startTime,
        eventVisualKind: 'community' as const,
      };
      if (!eventsByDay[day].some((e) => e.id === communityRow.id)) {
        eventsByDay[day].push(communityRow);
      }
    }
    for (const k of Object.keys(eventsByDay)) {
      const di = Number(k);
      eventsByDay[di].sort((a, b) => (a.sortTimeMs ?? 0) - (b.sortTimeMs ?? 0));
    }
    return generateCalendarGrid(displayYear, displayMonth, eventsByDay);
  }, [
    displayYear,
    displayMonth,
    isFiltered,
    personalEvents,
    linkedEvents,
    aggregateCommunityEvents,
    currentUser?._id,
    familyProfilesByUserId,
    familyProfilesByMemberId,
    familyAllSaved,
  ]);

  // === Dynamic panel heights ===
  const compactPanelHeight =
    PANEL_FIXED_HEIGHT +
    grid.length * COMPACT_ROW_HEIGHT +
    CALENDAR_HANDLE_HEIGHT;
  const expandedPanelHeight =
    monthlyViewportHeight > 0
      ? Math.max(compactPanelHeight, monthlyViewportHeight)
      : Math.max(compactPanelHeight, Math.round(screenHeight * 0.58));
  const expandedWeekBaseHeight = useMemo((): number | undefined => {
    if (monthlyViewportHeight <= 0 || grid.length === 0) return undefined;

    const expandedGridChromeHeight = 52;
    const availableGridHeight = Math.max(
      0,
      monthlyViewportHeight - expandedGridChromeHeight
    );

    return Math.max(72, Math.floor(availableGridHeight / grid.length));
  }, [grid.length, monthlyViewportHeight]);

  const calendarHeight = useSharedValue(compactPanelHeight);
  const savedHeight = useSharedValue(compactPanelHeight);
  const compactHeightSV = useSharedValue(compactPanelHeight);
  const expandedHeightSV = useSharedValue(expandedPanelHeight);
  const [snapState, setSnapState] = useState<SnapState>('compact');
  const isExpanded = snapState === 'expanded';

  // Week-only collapse: collapses the month grid to the selected week row.
  const [isWeekCollapsed, setIsWeekCollapsed] = useState(false);
  // Guard ref: prevents firing collapse/expand state changes on every scroll frame.
  const weekCollapseGuard = useRef(false);

  // Which grid row index contains selectedDay (for week-only rendering).
  const selectedWeekIndex = useMemo(() => {
    if (selectedDay == null) return -1;
    return grid.findIndex((week) =>
      week.some((d) => d.day === selectedDay && d.isCurrentMonth)
    );
  }, [grid, selectedDay]);

  // Reset week-collapse and guard when the selected day is cleared.
  useEffect(() => {
    if (selectedDay == null) {
      setIsWeekCollapsed(false);
      weekCollapseGuard.current = false;
    }
  }, [selectedDay]);

  // Sync shared values when month or viewport changes.
  useEffect(() => {
    compactHeightSV.value = compactPanelHeight;
    expandedHeightSV.value = expandedPanelHeight;
    calendarHeight.value = withSpring(
      snapState === 'expanded' ? expandedPanelHeight : compactPanelHeight,
      {
        damping: 20,
        stiffness: 90,
      }
    );
  }, [
    compactPanelHeight,
    expandedPanelHeight,
    calendarHeight,
    compactHeightSV,
    expandedHeightSV,
    snapState,
  ]);

  // === Day events list animation (lifted from MonthlyGrid) ===
  const isShowingListRef = useRef(selectedDay != null);
  const [visibleDay, setVisibleDay] = useState<number | null>(selectedDay);
  const listAnim = useRef(
    new Animated.Value(selectedDay != null ? 1 : 0)
  ).current;

  useEffect(() => {
    if (selectedDay != null) {
      setVisibleDay(selectedDay);
      if (!isShowingListRef.current) {
        listAnim.setValue(0);
        Animated.timing(listAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      isShowingListRef.current = true;
    } else {
      Animated.timing(listAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setVisibleDay(null);
      });
      isShowingListRef.current = false;
    }
  }, [selectedDay, listAnim]);

  const visibleDayData = useMemo((): CalendarDay | null => {
    if (visibleDay == null) return null;
    for (const week of grid) {
      for (const d of week) {
        if (d.day === visibleDay && d.isCurrentMonth) return d;
      }
    }
    return null;
  }, [grid, visibleDay]);

  const sheetDayData = useMemo((): CalendarDay | null => {
    if (daySheetDay == null) return null;
    for (const week of grid) {
      for (const d of week) {
        if (d.day === daySheetDay && d.isCurrentMonth) return d;
      }
    }
    return null;
  }, [grid, daySheetDay]);

  const daySheetLabel = useMemo((): string => {
    if (sheetDayData == null) return '';
    return getHebrewCalendarDayLabel(
      displayYear,
      displayMonth,
      sheetDayData.day
    );
  }, [sheetDayData, displayYear, displayMonth]);

  /** Tasks for the compact below-grid day panel */
  const visibleDayTasks = useMemo((): CalendarDayTask[] => {
    if (visibleDay == null) return [];
    const nowMs = Date.now();
    const currentUserId = currentUser?._id as string | undefined;
    return calendarPersonalTasks
      .filter((t) => {
        if (t.dueDate == null) return false;
        const d = new Date(t.dueDate);
        return (
          d.getFullYear() === displayYear &&
          d.getMonth() === displayMonth &&
          d.getDate() === visibleDay
        );
      })
      .map((t) => {
        const assigneeDisplays = resolveAllNonSelfAssigneesCalendar(
          t,
          currentUserId,
          memberMaps.byUserId,
          memberMaps.byMemberId,
          memberMaps.selfEntityId
        );
        return {
          id: `task:${t._id}`,
          title: t.title,
          time:
            t.hasTime && t.dueAt
              ? `${String(new Date(t.dueAt).getHours()).padStart(2, '0')}:${String(new Date(t.dueAt).getMinutes()).padStart(2, '0')}`
              : '',
          isOverdue: calcTaskOverdue(t.dueDate ?? 0, t.dueAt, t.hasTime, nowMs),
          assigneeInitials: assigneeDisplays[0]?.initials,
          assigneeColor: assigneeDisplays[0]?.color,
          assigneeDisplays:
            assigneeDisplays.length > 0 ? assigneeDisplays : undefined,
          subtasks: (t.subtasks ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          })),
        };
      });
  }, [
    calendarPersonalTasks,
    visibleDay,
    displayYear,
    displayMonth,
    currentUser,
    memberMaps,
  ]);

  /** Tasks for the expanded day-sheet modal */
  const sheetDayTasks = useMemo((): CalendarDayTask[] => {
    if (daySheetDay == null) return [];
    const nowMs = Date.now();
    const currentUserId = currentUser?._id as string | undefined;
    return calendarPersonalTasks
      .filter((t) => {
        if (t.dueDate == null) return false;
        const d = new Date(t.dueDate);
        return (
          d.getFullYear() === displayYear &&
          d.getMonth() === displayMonth &&
          d.getDate() === daySheetDay
        );
      })
      .map((t) => {
        const assigneeDisplays = resolveAllNonSelfAssigneesCalendar(
          t,
          currentUserId,
          memberMaps.byUserId,
          memberMaps.byMemberId,
          memberMaps.selfEntityId
        );
        return {
          id: `task:${t._id}`,
          title: t.title,
          time:
            t.hasTime && t.dueAt
              ? `${String(new Date(t.dueAt).getHours()).padStart(2, '0')}:${String(new Date(t.dueAt).getMinutes()).padStart(2, '0')}`
              : '',
          isOverdue: calcTaskOverdue(t.dueDate ?? 0, t.dueAt, t.hasTime, nowMs),
          assigneeInitials: assigneeDisplays[0]?.initials,
          assigneeColor: assigneeDisplays[0]?.color,
          assigneeDisplays:
            assigneeDisplays.length > 0 ? assigneeDisplays : undefined,
          subtasks: (t.subtasks ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          })),
        };
      });
  }, [
    calendarPersonalTasks,
    daySheetDay,
    displayYear,
    displayMonth,
    currentUser,
    memberMaps,
  ]);

  // Resets week-collapse state + guard — called from pan gesture and snap toggle.
  const resetWeekCollapse = useCallback((): void => {
    setIsWeekCollapsed(false);
    weekCollapseGuard.current = false;
  }, []);

  // === Tap-to-toggle for the arrow handle ===
  const toggleCalendarSnap = useCallback((): void => {
    // Always clear week-only mode when toggling the main snap
    resetWeekCollapse();

    const nextState: SnapState =
      snapState === 'expanded' ? 'compact' : 'expanded';
    const targetHeight =
      nextState === 'expanded' ? expandedHeightSV.value : compactHeightSV.value;

    calendarHeight.value = withSpring(targetHeight, {
      damping: 22,
      stiffness: 120,
    });

    setSnapState(nextState);
  }, [
    calendarHeight,
    compactHeightSV,
    expandedHeightSV,
    resetWeekCollapse,
    snapState,
  ]);

  // === Scroll-triggered week-collapse for the selected-day panel ===
  // Collapse-only: scrolling down > 20px collapses the month grid to the
  // selected week. Expansion back to full month is handled exclusively by the
  // pan/handle gesture — never by scroll returning to the top.
  const handleDayListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }): void => {
      const y = event.nativeEvent.contentOffset.y;
      if (y > 20 && selectedDay != null && !weekCollapseGuard.current) {
        weekCollapseGuard.current = true;
        setIsWeekCollapsed(true);
        calendarHeight.value = withSpring(WEEK_ONLY_PANEL_HEIGHT, {
          damping: 22,
          stiffness: 120,
        });
      }
    },
    [selectedDay, calendarHeight]
  );

  // === Pan gesture for the bottom arrow handle only ===
  // drag DOWN (positive translationY) = expand, drag UP = collapse
  const panGesture = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .failOffsetX([-48, 48])
    .onBegin(() => {
      'worklet';
      savedHeight.value = calendarHeight.value;
    })
    .onUpdate((event) => {
      'worklet';
      const newHeight = savedHeight.value + event.translationY;
      // When starting from week-only (below compact), allow smooth dragging
      // upward from that smaller height rather than clamping to compact.
      const minH =
        savedHeight.value < compactHeightSV.value
          ? savedHeight.value
          : compactHeightSV.value;
      calendarHeight.value = Math.max(
        minH,
        Math.min(expandedHeightSV.value, newHeight)
      );
    })
    .onEnd((event) => {
      'worklet';
      const currentHeight = calendarHeight.value;
      const compact = compactHeightSV.value;
      const expanded = expandedHeightSV.value;

      let targetHeight: number;

      // Detect if the drag started from week-only (height well below compact).
      const startedWeekOnly = savedHeight.value < compact - 4;

      if (startedWeekOnly) {
        // Any downward drag from week-only restores the full-month compact view.
        // A big drag / fast flick goes straight to expanded.
        if (
          event.translationY > OPEN_DRAG_DISTANCE ||
          event.velocityY > SNAP_VELOCITY
        ) {
          targetHeight = expanded;
        } else {
          targetHeight = compact;
        }
      } else {
        const midpoint = compact + (expanded - compact) * 0.35;
        const startedCompact = savedHeight.value <= compact + 4;
        const startedExpanded = savedHeight.value >= expanded - 4;

        if (
          startedCompact &&
          (event.translationY > OPEN_DRAG_DISTANCE ||
            event.velocityY > SNAP_VELOCITY)
        ) {
          targetHeight = expanded;
        } else if (
          startedExpanded &&
          (event.translationY < -CLOSE_DRAG_DISTANCE ||
            event.velocityY < -SNAP_VELOCITY)
        ) {
          targetHeight = compact;
        } else {
          targetHeight = currentHeight >= midpoint ? expanded : compact;
        }
      }

      calendarHeight.value = withSpring(targetHeight, {
        damping: 22,
        stiffness: 120,
      });

      const newState: SnapState =
        targetHeight === compact ? 'compact' : 'expanded';
      runOnJS(setSnapState)(newState);
      // Pan always restores full-month view, so clear week-only mode + guard.
      runOnJS(resetWeekCollapse)();
    });

  const animatedCalendarStyle = useAnimatedStyle(() => ({
    height: calendarHeight.value,
  }));

  // === View mode persistence ===
  const loadViewMode = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@calendar_view_mode');
      if (saved === 'timeline' || saved === 'monthly') {
        setViewMode(saved);
        Animated.timing(slideAnim, {
          toValue: saved === 'timeline' ? 1 : 0,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    } catch (_error) {
      // Silently handle storage read failure
    }
  }, [slideAnim]);

  useEffect(() => {
    loadViewMode();
  }, [loadViewMode]);

  // Restore calendar context when returning from Create Event with explicit params.
  // Fires whenever the return params change (i.e., after router.replace back here).
  useEffect(() => {
    if (!returnView) return;

    if (returnView === 'timeline') {
      setViewMode('timeline');
      slideAnim.setValue(1);
    } else if (returnView === 'month') {
      setViewMode('monthly');
      slideAnim.setValue(0);

      const shouldBeCollapsed = returnCollapsed !== 'false';
      setSnapState(shouldBeCollapsed ? 'compact' : 'expanded');

      if (returnMonth) {
        const parts = returnMonth.split('-');
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
          setMonthlyVisibleDate(new Date(y, m - 1, 1));
        }
      }

      if (returnDate) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(returnDate);
        if (match) {
          const d = Number(match[3]);
          if (d >= 1 && d <= 31) setSelectedDay(d);
        }
      }
    }
    // slideAnim is a stable Animated.Value instance (from useState) — it never
    // changes, so including it in deps does not add unwanted re-runs.
  }, [returnView, returnDate, returnMonth, returnCollapsed, slideAnim]);

  const saveViewMode = async (mode: 'timeline' | 'monthly'): Promise<void> => {
    try {
      await AsyncStorage.setItem('@calendar_view_mode', mode);
    } catch (_error) {
      // Silently handle storage write failure
    }
  };

  const handleViewModeChange = (mode: 'timeline' | 'monthly'): void => {
    // Prevent switching to monthly view when community filter is active
    if (isFiltered && mode === 'monthly') return;

    setEventEditMenu(null);
    setDaySheetDay(null);
    setIsMonthPickerVisible(false);
    setViewMode(mode);
    saveViewMode(mode);

    Animated.spring(slideAnim, {
      toValue: mode === 'timeline' ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();
  };

  const headerMonth =
    viewMode === 'monthly'
      ? `${HEBREW_MONTHS[displayMonth]} ${displayYear}`
      : `${HEBREW_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  const goToPrevMonth = useCallback((): void => {
    setDaySheetDay(null);
    setEventEditMenu(null);
    setMonthlyVisibleDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
    setSelectedDay(null);
  }, []);

  const goToNextMonth = useCallback((): void => {
    setDaySheetDay(null);
    setEventEditMenu(null);
    setMonthlyVisibleDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
    setSelectedDay(null);
  }, []);

  const handleMonthPickerConfirm = useCallback(
    (month: number, year: number): void => {
      setIsMonthPickerVisible(false);
      setDaySheetDay(null);
      setEventEditMenu(null);
      setMonthlyVisibleDate(new Date(year, month, 1));
      setSelectedDay(null);
    },
    []
  );

  const applyMonthSwipe = useCallback(
    (translationX: number, velocityX: number) => {
      if (isFiltered || viewMode !== 'monthly') return;
      if (
        translationX <= -MONTH_SWIPE_DISTANCE ||
        velocityX <= -MONTH_SWIPE_VELOCITY
      ) {
        goToNextMonth();
        return;
      }
      if (
        translationX >= MONTH_SWIPE_DISTANCE ||
        velocityX >= MONTH_SWIPE_VELOCITY
      ) {
        goToPrevMonth();
      }
    },
    [goToNextMonth, goToPrevMonth, isFiltered, viewMode]
  );

  const monthSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isFiltered && viewMode === 'monthly')
        .activeOffsetX([-20, 20])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          runOnJS(applyMonthSwipe)(e.translationX, e.velocityX);
        }),
    [applyMonthSwipe, isFiltered, viewMode]
  );

  const openDayEventsSheet = useCallback((day: number) => {
    setEventEditMenu(null);
    setSelectedDay(day);
    setDaySheetDay(day);
  }, []);

  const closeDayEventsSheet = useCallback(() => {
    setEventEditMenu(null);
    setDaySheetDay(null);
  }, []);

  const handleExpandedEventNavigate = useCallback(
    (event: CalendarEvent) => {
      const key = event.listKey ?? event.id;
      const guard = longPressGuardRef.current;
      if (guard && guard.key === key && Date.now() < guard.until) {
        longPressGuardRef.current = null;
        return;
      }
      longPressGuardRef.current = null;
      setEventEditMenu(null);
      setDaySheetDay(null);
      handleOpenEventDetails(event);
    },
    [handleOpenEventDetails]
  );

  const handleExpandedEventLongPress = useCallback(
    (event: CalendarEvent, pressEvent: GestureResponderEvent) => {
      const key = event.listKey ?? event.id;
      longPressGuardRef.current = { key, until: Date.now() + 700 };
      if (event.sourceType === 'linked') return;
      // Type B (shared-with-viewer) events: recipient cannot edit or delete
      if (event.isViewerCreator === false) return;

      const x = Math.min(
        Math.max(12, pressEvent.nativeEvent.pageX - EDIT_POPOVER_WIDTH / 2),
        screenWidth - EDIT_POPOVER_WIDTH - 12
      );
      const y = Math.min(
        Math.max(90, pressEvent.nativeEvent.pageY - EDIT_POPOVER_HEIGHT - 10),
        screenHeight - EDIT_POPOVER_HEIGHT - 24
      );

      setEventEditMenu({ event, x, y });
    },
    [screenHeight, screenWidth]
  );

  const handleExpandedEditAction = useCallback(() => {
    if (eventEditMenu == null) return;
    const eventToEdit = eventEditMenu.event;
    setEventEditMenu(null);
    closeDayEventsSheet();
    openEventEditFromCalendar(router, eventToEdit);
  }, [closeDayEventsSheet, eventEditMenu, router]);

  const handleExpandedCreateForDay = useCallback(
    (cellDate: Date) => {
      setEventEditMenu(null);
      const ts = new Date(
        cellDate.getFullYear(),
        cellDate.getMonth(),
        cellDate.getDate(),
        0,
        0,
        0,
        0
      ).getTime();
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
      const monthStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}`;
      router.push({
        pathname: '/(authenticated)/event/new',
        params: {
          selectedDate: String(ts),
          returnTo: 'calendar',
          sourceView: 'month',
          sourceDate: dateStr,
          sourceMonth: monthStr,
          sourceCollapsed: snapState === 'compact' ? 'true' : 'false',
        },
      } as Parameters<typeof router.push>[0]);
    },
    [router, snapState, displayYear, displayMonth]
  );

  // ── Auto-switch to timeline view when community filter is active
  useEffect(() => {
    if (communityId) {
      setViewMode('timeline');
      // Immediately snap — no animation delay since this is initialization
      slideAnim.setValue(1);
    }
  }, [communityId, slideAnim]);

  // ── Build timeline data: use real events when filtering by community
  const timelineData = useMemo(() => {
    const todayD = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const todayKey = `${todayD.getFullYear()}-${todayD.getMonth()}-${todayD.getDate()}`;
    const todayLabel = todayD.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    if (!isFiltered) {
      // Personal + community around today for independent timeline browsing
      if (
        timelinePersonalEvents.length === 0 &&
        timelineCommunityEvents.length === 0
      ) {
        return [];
      }

      const grouped: Record<
        string,
        {
          dayLabel: string;
          dayNumber: string;
          isToday: boolean;
          events: TimelineEventRow[];
          sortKey: number;
        }
      > = {};

      for (const event of timelinePersonalEvents) {
        const d = new Date(event.startTime);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const isToday =
          d.getFullYear() === todayD.getFullYear() &&
          d.getMonth() === todayD.getMonth() &&
          d.getDate() === todayD.getDate();

        if (!grouped[key]) {
          grouped[key] = {
            dayLabel: d.toLocaleDateString('he-IL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
            dayNumber: String(d.getDate()),
            isToday,
            events: [],
            sortKey: d.getTime(),
          };
        }

        const timeStr = event.allDay
          ? ''
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        // Same event id can appear only once per day (mirrors grid dedupe vs community merge)
        if (grouped[key].events.some((e) => e.id === event._id)) {
          continue;
        }

        const isSavedCommunityInSpace = Boolean(event.communityId);
        const endD1 = event.endTime ? new Date(event.endTime) : null;
        const myTasks1 = timelineTasksByEventId[event._id];
        const rawImportantItems1 = (
          event as { importantItems?: ImportantItem[] }
        ).importantItems;

        // Profile circles for personal events
        let pc1: ProfileCircle[] = [];
        let pc1Extra = 0;
        let pc1Context: 'sharedWith' | 'alsoAddedToCalendar' = 'sharedWith';
        if (isSavedCommunityInSpace) {
          pc1 = familyAllSaved[event._id as string] ?? [];
          pc1Context = 'alsoAddedToCalendar';
        } else {
          const evS = event as {
            createdBy?: string;
            allFamily?: boolean;
            sharedWithUserIds?: string[];
            sharedWithFamilyMemberIds?: string[];
            participants?: string[];
            sharedMemberProfiles?: Array<{
              id: string;
              displayName: string;
              color: string;
              isViewer: boolean;
            }>;
          };
          const calCurrentUserId = currentUser?._id as string | undefined;
          const isCreator =
            !!calCurrentUserId && evS.createdBy === calCurrentUserId;
          const totalParticipants = evS.participants?.length ?? 0;

          if (isCreator) {
            // Creator's view: show selected family recipients.
            // Uses server-resolved sharedMemberProfiles so display is reliable
            // even if the local map has a key mismatch.
            if (evS.allFamily) {
              // Use byMemberId so manual family members (entity rows with no
              // matchedUserId) are included alongside app-user family members.
              // selfEntityId is already excluded from familyProfilesByMemberId.
              pc1 = [...familyProfilesByMemberId.values()];
              pc1Extra = Math.max(0, totalParticipants - pc1.length);
            } else {
              const resolved = evS.sharedMemberProfiles ?? [];
              for (const p of resolved) {
                // Safety: never show the current viewer's own circle.
                if (p.isViewer) continue;
                pc1.push({ id: p.id, name: p.displayName, color: p.color });
              }
              const familyCount = (evS.sharedWithFamilyMemberIds ?? []).length;
              pc1Extra = Math.max(0, totalParticipants - familyCount);
            }
          } else {
            // Recipient's view: show the creator's circle + all other recipients.
            // Other-recipient circles come from server-resolved sharedMemberProfiles
            // (cross-space safe). The isViewer flag skips the current viewer's circle.
            const resolved = evS.sharedMemberProfiles ?? [];
            const creatorId = evS.createdBy;
            const circles: ProfileCircle[] = [];
            if (creatorId) {
              const creatorProfile =
                familyProfilesByUserId.get(creatorId) ??
                familyProfilesByMemberId.get(creatorId);
              if (creatorProfile) circles.push(creatorProfile);
            }
            for (const p of resolved) {
              if (p.isViewer) continue;
              circles.push({ id: p.id, name: p.displayName, color: p.color });
            }
            // External participants are never shown as circles; count them in +N.
            // participants stores all display names (family + external) so
            // subtracting the family member ID count gives external count.
            const externalCount = Math.max(
              0,
              totalParticipants - (evS.sharedWithFamilyMemberIds?.length ?? 0)
            );
            // Pass all circles unsliced; ProfileCircles handles maxVisible cap.
            pc1 = circles;
            pc1Extra = externalCount;
          }
        }

        grouped[key].events.push({
          id: event._id,
          category: isSavedCommunityInSpace ? 'קהילה' : 'אישי',
          categoryColor: isSavedCommunityInSpace ? '#36a9e2' : PRIMARY_BLUE,
          title: event.title,
          time: timeStr,
          endTime: endD1
            ? `${String(endD1.getHours()).padStart(2, '0')}:${String(endD1.getMinutes()).padStart(2, '0')}`
            : undefined,
          location: event.location ?? '',
          locationUrl: (event as { locationUrl?: string }).locationUrl,
          icon: 'event',
          cancelled: event.status === 'cancelled',
          sourceType: 'event',
          communityName: event.communityName,
          myAssignedTasks:
            myTasks1 && myTasks1.length > 0 ? myTasks1 : undefined,
          importantItems: rawImportantItems1?.length
            ? rawImportantItems1
            : undefined,
          profileCircles: pc1.length > 0 ? pc1 : undefined,
          profileCirclesExtraCount: pc1Extra > 0 ? pc1Extra : undefined,
          profileCirclesContext: pc1Context,
        });
      }

      for (const event of timelineCommunityEvents) {
        const d = new Date(event.startTime);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const isToday =
          d.getFullYear() === todayD.getFullYear() &&
          d.getMonth() === todayD.getMonth() &&
          d.getDate() === todayD.getDate();

        if (!grouped[key]) {
          grouped[key] = {
            dayLabel: d.toLocaleDateString('he-IL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
            dayNumber: String(d.getDate()),
            isToday,
            events: [],
            sortKey: d.getTime(),
          };
        }

        const timeStr = event.allDay
          ? ''
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        // Skip if already added from personal list or duplicate community row
        if (grouped[key].events.some((e) => e.id === event._id)) {
          continue;
        }

        const myTasks2 = timelineTasksByEventId[event._id];
        const endD2 = event.endTime ? new Date(event.endTime) : null;
        const rawImportantItems2 = (
          event as { importantItems?: ImportantItem[] }
        ).importantItems;
        const pc2 = familyAllSaved[event._id as string] ?? [];
        grouped[key].events.push({
          id: event._id,
          category: 'קהילה',
          categoryColor: '#36a9e2',
          title: event.title,
          time: timeStr,
          endTime: endD2
            ? `${String(endD2.getHours()).padStart(2, '0')}:${String(endD2.getMinutes()).padStart(2, '0')}`
            : undefined,
          location: event.location ?? '',
          locationUrl: (event as { locationUrl?: string }).locationUrl,
          icon: 'event',
          cancelled: false,
          sourceType: 'event',
          communityName: event.communityName,
          myAssignedTasks:
            myTasks2 && myTasks2.length > 0 ? myTasks2 : undefined,
          importantItems: rawImportantItems2?.length
            ? rawImportantItems2
            : undefined,
          profileCircles: pc2.length > 0 ? pc2 : undefined,
          profileCirclesContext: 'alsoAddedToCalendar',
        });
      }

      // Personal tasks — inserted on their original dueDate (date-truth preserved)
      const nowMs = Date.now();
      for (const t of calendarPersonalTasks) {
        if (t.dueDate == null) continue;
        if (t.dueDate < timelineRange.from || t.dueDate > timelineRange.to)
          continue;

        const d = new Date(t.dueDate);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const isToday =
          d.getFullYear() === todayD.getFullYear() &&
          d.getMonth() === todayD.getMonth() &&
          d.getDate() === todayD.getDate();

        if (!grouped[key]) {
          grouped[key] = {
            dayLabel: d.toLocaleDateString('he-IL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
            dayNumber: String(d.getDate()),
            isToday,
            events: [],
            sortKey: d.getTime(),
          };
        }

        const taskId = `task:${t._id}`;
        if (grouped[key].events.some((e) => e.id === taskId)) continue;

        const timeStr =
          t.hasTime && t.dueAt
            ? `${String(new Date(t.dueAt).getHours()).padStart(2, '0')}:${String(new Date(t.dueAt).getMinutes()).padStart(2, '0')}`
            : '';

        const currentUserId = currentUser?._id as string | undefined;
        const assigneeDisplays = resolveAllNonSelfAssigneesCalendar(
          t,
          currentUserId,
          memberMaps.byUserId,
          memberMaps.byMemberId,
          memberMaps.selfEntityId
        );

        grouped[key].events.push({
          id: taskId,
          category: 'משימה',
          categoryColor: PRIMARY_BLUE,
          title: t.title,
          time: timeStr,
          location: '',
          icon: 'check-box-outline-blank',
          cancelled: false,
          isPersonalTask: true,
          isOverdue: calcTaskOverdue(t.dueDate, t.dueAt, t.hasTime, nowMs),
          subtasks: (t.subtasks ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          })),
          assigneeInitials: assigneeDisplays[0]?.initials,
          assigneeColor: assigneeDisplays[0]?.color,
          assigneeDisplays:
            assigneeDisplays.length > 0 ? assigneeDisplays : undefined,
        });
      }

      // Sort each day group: timed items chronologically, untimed at the bottom
      for (const group of Object.values(grouped)) {
        group.events.sort((a, b) => {
          if (!a.time && !b.time) return 0;
          if (!a.time) return 1;
          if (!b.time) return -1;
          const [ah = 0, am = 0] = a.time.split(':').map(Number);
          const [bh = 0, bm = 0] = b.time.split(':').map(Number);
          return ah * 60 + am - (bh * 60 + bm);
        });
      }

      if (!grouped[todayKey]) {
        grouped[todayKey] = {
          dayLabel: todayLabel,
          dayNumber: String(todayD.getDate()),
          isToday: true,
          events: [],
          sortKey: todayD.getTime(),
        };
      }

      return Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey);
    }

    // Community filter active — show community events only
    if (!communityEvents || communityEvents.length === 0) return [];

    const grouped: Record<
      string,
      {
        dayLabel: string;
        dayNumber: string;
        isToday: boolean;
        events: TimelineEventRow[];
        sortKey: number;
      }
    > = {};

    for (const event of communityEvents) {
      const d = new Date(event.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const isToday =
        d.getFullYear() === todayD.getFullYear() &&
        d.getMonth() === todayD.getMonth() &&
        d.getDate() === todayD.getDate();

      if (!grouped[key]) {
        grouped[key] = {
          dayLabel: d.toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }),
          dayNumber: String(d.getDate()),
          isToday,
          events: [],
          sortKey: event.startTime,
        };
      }
      if (grouped[key].events.some((e) => e.id === event._id)) {
        continue;
      }
      const myTasks3 = timelineTasksByEventId[event._id];
      const endD3 = event.endTime ? new Date(event.endTime) : null;
      const rawImportantItems3 = (event as { importantItems?: ImportantItem[] })
        .importantItems;
      const pc3 = familyAllSaved[event._id as string] ?? [];
      grouped[key].events.push({
        id: event._id,
        category: 'קהילה',
        categoryColor: '#36a9e2',
        title: event.title,
        time: new Date(event.startTime).toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        endTime: endD3
          ? `${String(endD3.getHours()).padStart(2, '0')}:${String(endD3.getMinutes()).padStart(2, '0')}`
          : undefined,
        location: event.location ?? '',
        icon: 'event',
        cancelled: event.status === 'cancelled',
        sourceType: 'event',
        communityName: communityData?.name,
        myAssignedTasks: myTasks3 && myTasks3.length > 0 ? myTasks3 : undefined,
        importantItems: rawImportantItems3?.length
          ? rawImportantItems3
          : undefined,
        profileCircles: pc3.length > 0 ? pc3 : undefined,
        profileCirclesContext: 'alsoAddedToCalendar',
      });
    }

    if (!grouped[todayKey]) {
      grouped[todayKey] = {
        dayLabel: todayLabel,
        dayNumber: String(todayD.getDate()),
        isToday: true,
        events: [],
        sortKey: todayD.getTime(),
      };
    }

    // Sort ascending so the list can scroll to past and future around today.
    return Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey);
  }, [
    today,
    isFiltered,
    communityEvents,
    timelinePersonalEvents,
    timelineCommunityEvents,
    communityData?.name,
    timelineTasksByEventId,
    calendarPersonalTasks,
    timelineRange,
    memberMaps,
    currentUser,
    familyProfilesByUserId,
    familyProfilesByMemberId,
    familyAllSaved,
  ]);

  useEffect(() => {
    if (viewMode !== 'timeline') return;
    didAutoScrollTimelineRef.current = false;
  }, [viewMode]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        ANDROID_MATCH_IOS_LAYOUT ? styles.safeAreaRtl : null,
      ]}
    >
      <View style={styles.container}>
        {/* Community filter banner */}
        {communityId ? (
          <View style={styles.communityBanner}>
            <Pressable
              onPress={() => router.setParams({ communityId: undefined })}
              style={styles.communityBannerClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel="בטל סינון קהילה"
            >
              <MaterialIcons name="close" size={16} color="#fff" />
            </Pressable>
            <Text style={styles.communityBannerText}>
              {communityData?.name
                ? `מסונן לפי: ${communityData.name}`
                : 'מסונן לפי קהילה'}
            </Text>
            <MaterialIcons name="filter-list" size={16} color="#fff" />
          </View>
        ) : null}

        {/* Header */}
        <View style={styles.header}>
          <MainScreenHeader
            title="היומן שלי"
            onNotificationsPress={handleBellPress}
            notificationsCount={unseenCount}
            returnTo="/(authenticated)/calendar"
          />

          {/* View Toggle — iOS: rtl.flexDirection. Android: LTR track so pill translateX matches segments (חודשי right). */}
          <View
            style={[
              styles.segmentedControl,
              ANDROID_MATCH_IOS_LAYOUT
                ? styles.segmentedControlAndroidTrack
                : { flexDirection: rtl.flexDirection },
            ]}
            onLayout={(e) =>
              setSegmentContainerWidth(e.nativeEvent.layout.width)
            }
          >
            {pillWidth > 0 && (
              <Animated.View
                style={[
                  styles.segmentedSlider,
                  {
                    width: pillWidth,
                    transform: [
                      {
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -pillWidth],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            {ANDROID_MATCH_IOS_LAYOUT ? (
              <>
                <Pressable
                  style={styles.segmentButton}
                  onPress={() => handleViewModeChange('timeline')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="תצוגת ציר זמן"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      viewMode === 'timeline' && styles.segmentTextActive,
                    ]}
                  >
                    ציר זמן
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.segmentButton}
                  onPress={() => handleViewModeChange('monthly')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFiltered
                      ? 'תצוגה חודשית (לא זמינה בסינון קהילה)'
                      : 'תצוגה חודשית'
                  }
                  accessibilityState={{ disabled: isFiltered }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      viewMode === 'monthly' && styles.segmentTextActive,
                      isFiltered && styles.segmentTextDisabled,
                    ]}
                  >
                    חודשי
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.segmentButton}
                  onPress={() => handleViewModeChange('monthly')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFiltered
                      ? 'תצוגה חודשית (לא זמינה בסינון קהילה)'
                      : 'תצוגה חודשית'
                  }
                  accessibilityState={{ disabled: isFiltered }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      viewMode === 'monthly' && styles.segmentTextActive,
                      isFiltered && styles.segmentTextDisabled,
                    ]}
                  >
                    חודשי
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.segmentButton}
                  onPress={() => handleViewModeChange('timeline')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="תצוגת ציר זמן"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      viewMode === 'timeline' && styles.segmentTextActive,
                    ]}
                  >
                    ציר זמן
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {viewMode === 'monthly' ? (
            <View style={styles.monthHeaderWrap}>
              <CalendarMonthNavBar
                headerMonthLabel={headerMonth}
                onNextMonth={goToNextMonth}
                onPrevMonth={goToPrevMonth}
                onTitlePress={() => setIsMonthPickerVisible(true)}
              />
            </View>
          ) : null}
        </View>

        {/* Content */}
        {viewMode === 'timeline' ? (
          <ScrollView
            ref={timelineScrollRef}
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <TimelineView
              data={timelineData}
              onTodayLayout={(y) => {
                if (didAutoScrollTimelineRef.current) return;
                didAutoScrollTimelineRef.current = true;
                requestAnimationFrame(() => {
                  timelineScrollRef.current?.scrollTo({
                    y: Math.max(0, y - 12),
                    animated: false,
                  });
                });
              }}
              onEventPress={handleOpenEventDetails}
              onNavigate={handleNavigateToLocation}
              onOpenTaskSheet={(id) => {
                setTaskSheetTaskId(id);
                setTaskSheetVisible(true);
              }}
              onAddPress={(dateStr) => {
                router.push({
                  pathname: '/(authenticated)/event/new',
                  params: {
                    date: dateStr,
                    returnTo: 'calendar',
                    sourceView: 'timeline',
                    sourceDate: dateStr,
                  },
                } as Parameters<typeof router.push>[0]);
              }}
            />
          </ScrollView>
        ) : (
          <View
            style={styles.content}
            onLayout={(event) => {
              setMonthlyViewportHeight(event.nativeEvent.layout.height);
            }}
          >
            <ReAnimated.View
              style={[styles.calendarPanel, animatedCalendarStyle]}
            >
              {isExpanded ? (
                <ScrollView
                  contentContainerStyle={styles.expandedCalendarScrollContent}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  style={styles.expandedCalendarScroll}
                >
                  <GestureDetector gesture={monthSwipeGesture}>
                    <View
                      collapsable={false}
                      style={styles.expandedCalendarGridHost}
                    >
                      <MonthlyGrid
                        displayMonth={displayMonth}
                        displayYear={displayYear}
                        expandedWeekBaseHeight={expandedWeekBaseHeight}
                        grid={grid}
                        selectedDay={selectedDay}
                        isExpanded={isExpanded}
                        tasksByDay={calendarTasksByDay}
                        onCreateEventForDay={handleExpandedCreateForDay}
                        onNavigateToEvent={handleExpandedEventNavigate}
                        onOpenDaySheet={openDayEventsSheet}
                        onSelectDay={setSelectedDay}
                      />
                    </View>
                  </GestureDetector>
                </ScrollView>
              ) : (
                <GestureDetector gesture={monthSwipeGesture}>
                  <View collapsable={false}>
                    <MonthlyGrid
                      displayMonth={displayMonth}
                      displayYear={displayYear}
                      expandedWeekBaseHeight={undefined}
                      grid={
                        isWeekCollapsed && selectedWeekIndex >= 0
                          ? ([grid[selectedWeekIndex]] as typeof grid)
                          : grid
                      }
                      selectedDay={selectedDay}
                      isExpanded={isExpanded}
                      tasksByDay={calendarTasksByDay}
                      onCreateEventForDay={handleExpandedCreateForDay}
                      onNavigateToEvent={handleExpandedEventNavigate}
                      onOpenDaySheet={openDayEventsSheet}
                      onSelectDay={setSelectedDay}
                    />
                  </View>
                </GestureDetector>
              )}

              <GestureDetector gesture={panGesture}>
                <Pressable
                  onPress={toggleCalendarSnap}
                  style={styles.dragHandleContainer}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isExpanded ? 'סגור את היומן' : 'פתח את היומן'
                  }
                >
                  <MaterialIcons
                    name={
                      isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'
                    }
                    size={30}
                    color="#647b87"
                  />
                </Pressable>
              </GestureDetector>
            </ReAnimated.View>

            {!isExpanded ? (
              <ScrollView
                style={styles.dailyEventsScroll}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleDayListScroll}
              >
                {visibleDay != null &&
                  (visibleDayData != null || visibleDayTasks.length > 0) && (
                    <DayEventsList
                      dayData={
                        visibleDayData ?? {
                          day: visibleDay,
                          isCurrentMonth: true,
                          isToday:
                            today.getDate() === visibleDay &&
                            today.getMonth() === displayMonth &&
                            today.getFullYear() === displayYear,
                          events: [],
                        }
                      }
                      year={displayYear}
                      month={displayMonth}
                      anim={listAnim}
                      tasks={visibleDayTasks}
                      onEventPress={handleOpenEventDetails}
                      onClose={() => setSelectedDay(null)}
                      onOpenTaskSheet={(id) => {
                        setTaskSheetTaskId(id);
                        setTaskSheetVisible(true);
                      }}
                    />
                  )}
              </ScrollView>
            ) : null}
          </View>
        )}

        {/* Notifications Drawer */}
        <NotificationsDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
        <TaskDetailsBottomSheet
          taskId={taskSheetTaskId}
          visible={taskSheetVisible}
          onClose={() => setTaskSheetVisible(false)}
        />
        <EventDetailsBottomSheet
          event={selectedEvent}
          eventId={selectedEventId}
          visible={selectedEventId !== null || selectedEvent !== null}
          onDragClose={() => {
            lastDragCloseTime.current = Date.now();
          }}
          onClose={closeEventSheet}
          onNavigate={handleNavigateToLocation}
        />
        <NavigationPickerModal
          location={navPickerLocation}
          latitude={parseGeoUri(navPickerLocationUrl)?.lat}
          longitude={parseGeoUri(navPickerLocationUrl)?.lng}
          onClose={() => {
            setNavPickerLocation(null);
            setNavPickerLocationUrl(null);
          }}
          visible={navPickerLocation !== null}
        />
        <CalendarDayEventsSheet
          birthday={sheetDayData?.birthday}
          dayLabel={daySheetLabel}
          events={sheetDayData?.events ?? []}
          tasks={sheetDayTasks}
          onClose={closeDayEventsSheet}
          onEventLongPress={handleExpandedEventLongPress}
          onEventNavigate={handleExpandedEventNavigate}
          onOpenTaskSheet={(id) => {
            closeDayEventsSheet();
            setTaskSheetTaskId(id);
            setTaskSheetVisible(true);
          }}
          visible={
            daySheetDay !== null &&
            (sheetDayData != null || sheetDayTasks.length > 0)
          }
        />
        <MonthYearPickerModal
          onClose={() => setIsMonthPickerVisible(false)}
          onConfirm={handleMonthPickerConfirm}
          selectedMonth={displayMonth}
          selectedYear={displayYear}
          visible={isMonthPickerVisible}
        />
        <CalendarEventEditPopover
          onClose={() => setEventEditMenu(null)}
          onEdit={handleExpandedEditAction}
          visible={eventEditMenu != null}
          x={eventEditMenu?.x ?? 0}
          y={eventEditMenu?.y ?? 0}
        />
      </View>
    </SafeAreaView>
  );
}

// ===== Monthly Grid =====
interface MonthlyGridProps {
  grid: CalendarDay[][];
  displayYear: number;
  displayMonth: number;
  expandedWeekBaseHeight?: number;
  selectedDay: number | null;
  isExpanded: boolean;
  /** Count of personal tasks per day-of-month for lightweight indicator */
  tasksByDay: Record<number, number>;
  onSelectDay: (day: number | null) => void;
  onOpenDaySheet: (day: number) => void;
  onNavigateToEvent: (event: CalendarEvent) => void;
  onCreateEventForDay: (cellDate: Date) => void;
}

function hebrewPrefix(
  title: string | undefined | null,
  maxPixelWidth: number
): string {
  const t = title ?? 'אירוע ללא כותרת';

  const NARROW = new Set(['י', 'ו', 'ן', 'ל', 'ז', 'ר', 'ת', "'", '׳', '״']);
  const MEDIUM = new Set([
    'ה',
    'ח',
    'ע',
    'ב',
    'ד',
    'כ',
    'נ',
    'פ',
    'ק',
    'ץ',
    'ף',
    'ך',
  ]);

  const widthOf = (ch: string): number => {
    if (ch === ' ') return 2.8;
    if (NARROW.has(ch)) return 3.5;
    if (MEDIUM.has(ch)) return 5.0;
    return 6.0;
  };

  let acc = 0;
  let cutIndex = t.length;
  for (let i = 0; i < t.length; i++) {
    acc += widthOf(t[i]);
    if (acc > maxPixelWidth) {
      cutIndex = i;
      break;
    }
  }

  return t.slice(0, cutIndex);
}

function MonthlyGrid({
  grid,
  displayYear,
  displayMonth,
  expandedWeekBaseHeight,
  selectedDay,
  isExpanded,
  tasksByDay,
  onSelectDay,
  onOpenDaySheet,
  onNavigateToEvent,
  onCreateEventForDay,
}: MonthlyGridProps): React.JSX.Element {
  return (
    <View
      style={[
        mStyles.gridContainer,
        isExpanded && mStyles.gridContainerExpanded,
      ]}
    >
      {/* Day Name Headers */}
      <View
        style={[
          mStyles.weekRow,
          isExpanded && mStyles.weekRowExpanded,
          { flexDirection: rtl.flexDirection },
        ]}
      >
        {HEBREW_DAY_NAMES.map((name, i) => (
          <View key={name} style={mStyles.dayHeaderCell}>
            <Text
              style={[
                mStyles.dayHeaderText,
                i === 6 && mStyles.shabbatHeaderText,
              ]}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Rows */}
      {grid.map((week) => {
        const weekKey = week
          .map((d) => `${d.isCurrentMonth ? 'c' : 'o'}${d.day}`)
          .join('-');
        const weekHeight = isExpanded
          ? getExpandedWeekHeight(week, expandedWeekBaseHeight)
          : undefined;

        return (
          <View
            key={weekKey}
            style={[
              mStyles.weekRow,
              isExpanded && mStyles.weekRowExpanded,
              { flexDirection: rtl.flexDirection },
            ]}
          >
            {week.map((dayData) => (
              <DayCell
                key={`${dayData.isCurrentMonth ? 'c' : 'o'}-${dayData.day}`}
                dayData={dayData}
                displayMonth={displayMonth}
                displayYear={displayYear}
                isSelected={
                  selectedDay === dayData.day && dayData.isCurrentMonth
                }
                isExpanded={isExpanded}
                weekHeight={weekHeight}
                taskCount={
                  dayData.isCurrentMonth ? (tasksByDay[dayData.day] ?? 0) : 0
                }
                onCompactPress={() => {
                  if (dayData.isCurrentMonth) {
                    onSelectDay(
                      selectedDay === dayData.day ? null : dayData.day
                    );
                  }
                }}
                onCreateEventForDay={onCreateEventForDay}
                onNavigateToEvent={onNavigateToEvent}
                onOpenDaySheet={onOpenDaySheet}
                onSelectDay={onSelectDay}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ===== Day Cell =====
interface DayCellProps {
  dayData: CalendarDay;
  displayYear: number;
  displayMonth: number;
  isSelected: boolean;
  isExpanded: boolean;
  weekHeight?: number;
  /** Number of personal tasks due on this day (0 if none or out of month) */
  taskCount: number;
  onCompactPress: () => void;
  onSelectDay: (day: number | null) => void;
  onOpenDaySheet: (day: number) => void;
  onNavigateToEvent: (event: CalendarEvent) => void;
  onCreateEventForDay: (cellDate: Date) => void;
}

function DayCell({
  dayData,
  displayYear,
  displayMonth,
  isSelected,
  isExpanded,
  weekHeight,
  taskCount,
  onCompactPress,
  onSelectDay,
  onOpenDaySheet,
  onNavigateToEvent,
  onCreateEventForDay,
}: DayCellProps): React.JSX.Element {
  const { findBirthdayByName, openBirthdayCard } = useBirthdaySheets();
  const hasEventsForDay = dayData.isCurrentMonth && dayData.events.length > 0;
  const isSingleEventDay = dayData.events.length === 1;
  const hasMultipleEvents = dayData.events.length > 1;
  const cellDate = useMemo(
    () => new Date(displayYear, displayMonth, dayData.day, 0, 0, 0, 0),
    [displayYear, displayMonth, dayData.day]
  );

  const handleBirthdayPress = useCallback((): void => {
    if (dayData.birthday == null) return;
    const found = findBirthdayByName(dayData.birthday.name);
    if (found) openBirthdayCard(found);
  }, [dayData.birthday, findBirthdayByName, openBirthdayCard]);

  const openSheetForThisDay = (): void => {
    if (dayData.isCurrentMonth) onOpenDaySheet(dayData.day);
  };

  const longPressCreate = (): void => {
    if (!dayData.isCurrentMonth) return;
    onCreateEventForDay(cellDate);
  };

  const expandedAccessibilityLabel = (): string =>
    dayData.events.length > 0
      ? `${dayData.events.length} אירועים`
      : 'אין אירועים ביום הזה';

  const selectThisDay = (): void => {
    if (!dayData.isCurrentMonth) return;
    onSelectDay(dayData.day);
  };

  const openMultiEventDay = (): void => {
    if (!hasMultipleEvents) return;
    openSheetForThisDay();
  };

  // ── Compact (collapsed month) ──
  if (!isExpanded) {
    return (
      <Pressable
        style={[
          mStyles.dayCell,
          !dayData.isCurrentMonth && mStyles.dayCellOtherMonth,
        ]}
        accessibilityHint="לחץ לצפייה באירועי היום, לחיצה ארוכה ליצירת אירוע"
        accessibilityLabel={`יום ${dayData.day}${dayData.birthday ? `, יום הולדת ${dayData.birthday.name}` : ''}${dayData.events.length > 0 ? `, ${dayData.events.length} אירועים` : ''}`}
        accessibilityRole="button"
        accessible={true}
        delayLongPress={480}
        onLongPress={longPressCreate}
        onPress={onCompactPress}
      >
        <View
          style={[
            mStyles.dayNumWrapper,
            dayData.isToday && !isSelected && mStyles.dayNumTodayBg,
            isSelected && mStyles.dayNumSelectedBg,
          ]}
        >
          <Text
            style={[
              mStyles.dayNumText,
              !dayData.isCurrentMonth && mStyles.dayNumOtherMonth,
              dayData.isToday && !isSelected && mStyles.dayNumTodayText,
              isSelected && mStyles.dayNumSelectedText,
            ]}
          >
            {dayData.day}
          </Text>
        </View>

        {dayData.birthday != null && (
          <Pressable
            accessibilityHint="לחץ לצפייה בימי הולדת"
            accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
            accessibilityRole="button"
            accessible={true}
            delayLongPress={480}
            hitSlop={6}
            onLongPress={longPressCreate}
            onPress={handleBirthdayPress}
          >
            <Text style={mStyles.birthdayEmoji}>🎂</Text>
          </Pressable>
        )}

        {hasEventsForDay && (
          <View
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
            style={mStyles.eventIndicatorBar}
          />
        )}

        {taskCount > 0 && (
          <View
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
            style={mStyles.taskIndicatorDot}
          />
        )}
      </Pressable>
    );
  }

  // ── Expanded month ──
  return (
    <Pressable
      accessibilityHint="לחיצה ארוכה ליצירת אירוע"
      accessibilityLabel={`יום ${dayData.day}, ${expandedAccessibilityLabel()}`}
      accessibilityRole="button"
      accessible={true}
      delayLongPress={420}
      disabled={!dayData.isCurrentMonth}
      onLongPress={longPressCreate}
      onPress={() => {
        if (!dayData.isCurrentMonth) return;
        if (hasMultipleEvents) {
          openMultiEventDay();
          return;
        }
        selectThisDay();
      }}
      style={[
        mStyles.dayCell,
        mStyles.dayCellExpanded,
        weekHeight != null ? { height: weekHeight } : null,
        !dayData.isCurrentMonth && mStyles.dayCellOtherMonth,
      ]}
    >
      <Pressable
        accessibilityHint="לחיצה ארוכה ליצירת אירוע"
        accessibilityLabel={`יום ${dayData.day}, ${expandedAccessibilityLabel()}`}
        accessibilityRole="button"
        accessible={true}
        delayLongPress={420}
        disabled={!dayData.isCurrentMonth}
        hitSlop={2}
        onLongPress={() => {
          longPressCreate();
        }}
        onPress={() => {
          if (!dayData.isCurrentMonth) return;
          if (hasMultipleEvents) {
            openMultiEventDay();
            return;
          }
          selectThisDay();
        }}
        style={mStyles.dayNumRowExpanded}
      >
        <View
          style={[
            mStyles.dayNumWrapperSmall,
            dayData.isToday && !isSelected && mStyles.dayNumTodayBg,
            isSelected && mStyles.dayNumSelectedBg,
          ]}
        >
          <Text
            style={[
              mStyles.dayNumTextSmall,
              !dayData.isCurrentMonth && mStyles.dayNumOtherMonth,
              dayData.isToday && !isSelected && mStyles.dayNumTodayText,
              isSelected && mStyles.dayNumSelectedText,
            ]}
          >
            {dayData.day}
          </Text>
        </View>
      </Pressable>

      {dayData.isCurrentMonth && (
        <View style={mStyles.expandedEvents}>
          {dayData.birthday != null && (
            <Pressable
              accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
              accessibilityRole="button"
              accessible={true}
              delayLongPress={420}
              onLongPress={longPressCreate}
              onPress={handleBirthdayPress}
              style={mStyles.expandedBirthdayRow}
            >
              <Text style={mStyles.expandedBirthdayText}>
                🎂 {dayData.birthday.name}
              </Text>
            </Pressable>
          )}

          {dayData.events.map((event) => {
            const kind = event.eventVisualKind ?? 'personal';
            const eventTitle = getCalendarEventTitle(event);
            const rowStyle =
              kind === 'community'
                ? mStyles.expandedEventRowCommunity
                : kind === 'shared'
                  ? mStyles.expandedEventRowShared
                  : mStyles.expandedEventRowPersonal;
            const accessLabel =
              event.time !== '' ? `${eventTitle} ${event.time}` : eventTitle;

            return (
              <Pressable
                key={event.listKey ?? event.id}
                accessibilityLabel={accessLabel}
                accessibilityRole="button"
                accessible={true}
                delayLongPress={420}
                onLongPress={longPressCreate}
                onPress={() => {
                  if (hasMultipleEvents) {
                    openSheetForThisDay();
                    return;
                  }
                  onNavigateToEvent(event);
                }}
                style={[
                  mStyles.expandedEventRow,
                  rowStyle,
                  isSingleEventDay
                    ? mStyles.expandedEventRowSingle
                    : mStyles.expandedEventRowCompact,
                  event.cancelled && mStyles.expandedEventRowCancelled,
                ]}
              >
                {isSingleEventDay ? (
                  <View style={mStyles.expandedEventSingleContainer}>
                    <Text
                      style={[
                        mStyles.expandedEventSingleTitle,
                        event.cancelled && mStyles.expandedEventTitleCancelled,
                      ]}
                    >
                      {eventTitle}
                    </Text>
                    {event.time !== '' && (
                      <Text style={mStyles.expandedEventTimeText}>
                        {event.time}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text
                    ellipsizeMode="clip"
                    numberOfLines={1}
                    style={[
                      mStyles.expandedEventText,
                      event.cancelled && mStyles.expandedEventTitleCancelled,
                    ]}
                  >
                    {hebrewPrefix(eventTitle, 36)}
                  </Text>
                )}
              </Pressable>
            );
          })}

          {taskCount > 0 && (
            <View
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
              style={mStyles.expandedTaskRow}
            >
              <Text style={mStyles.expandedTaskText}>
                {taskCount === 1 ? '✓ משימה' : `✓ ${taskCount} משימות`}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityHint="לחיצה ארוכה ליצירת אירוע חדש"
            accessibilityLabel="אזור יום"
            accessibilityRole="button"
            accessible={true}
            delayLongPress={420}
            style={mStyles.expandedDayFiller}
            onLongPress={longPressCreate}
            onPress={() => {
              if (hasMultipleEvents) {
                openMultiEventDay();
                return;
              }
              selectThisDay();
            }}
          />
        </View>
      )}
    </Pressable>
  );
}

// ===== Calendar Task Card =====
// Single component used by both the monthly selected-day panel and the timeline.

interface CalendarTaskCardProps {
  task: CalendarDayTask;
  onOpenTaskSheet: (id: string) => void;
}

function CalendarTaskCard({
  task,
  onOpenTaskSheet,
}: CalendarTaskCardProps): React.JSX.Element {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const subtasks = task.subtasks ?? [];
  const completedCount = subtasks.filter((s) => s.completed).length;
  // Strip the "task:" prefix that wraps the Convex _id in calendar rows.
  const rawId = task.id.replace(/^task:/, '');

  return (
    <Pressable
      style={styles.eventCard}
      onPress={() => onOpenTaskSheet(rawId)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`משימה: ${task.title}${task.time ? `, ${task.time}` : ''}${task.isOverdue ? ', באיחור' : ''}`}
    >
      {/* Blue accent bar */}
      <View
        style={[styles.eventAccentBar, { backgroundColor: PRIMARY_BLUE }]}
      />

      <View style={styles.eventCardContent}>
        {/* Header: tag + time + overdue + assignee */}
        <View style={styles.eventCardHeader}>
          <View
            style={[
              styles.categoryTag,
              { backgroundColor: `${PRIMARY_BLUE}18` },
            ]}
          >
            <Text style={[styles.categoryTagText, { color: PRIMARY_BLUE }]}>
              משימה
            </Text>
          </View>
          {task.time !== '' ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b' }}>
              {task.time}
            </Text>
          ) : null}
          {task.isOverdue ? (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>באיחור</Text>
            </View>
          ) : null}
          {(task.assigneeDisplays?.length ?? 0) > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(task.assigneeDisplays ?? []).slice(0, 3).map((d, i) => (
                <View
                  key={`${d.initials}:${d.color}`}
                  style={[
                    styles.taskAssigneeAvatar,
                    {
                      backgroundColor: d.color,
                      marginLeft: i === 0 ? 0 : -6,
                      zIndex: 3 - i,
                    },
                  ]}
                >
                  <Text style={styles.taskAssigneeInitials}>{d.initials}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.eventTitle}>{task.title}</Text>

        {/* Subtask expand / collapse — same pattern as Home screen */}
        {subtasks.length > 0 ? (
          <View style={{ marginTop: 2 }}>
            <Pressable
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 2,
              }}
              onPress={(e) => {
                e.stopPropagation?.();
                setSubtasksExpanded((v) => !v);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={
                subtasksExpanded ? 'כווץ סעיפים' : 'הרחב סעיפים'
              }
            >
              <MaterialIcons
                name={subtasksExpanded ? 'expand-less' : 'expand-more'}
                size={16}
                color="#94a3b8"
              />
              <Text
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  textAlign: 'right',
                  flex: 1,
                }}
              >
                {completedCount} מתוך {subtasks.length} סעיפים
              </Text>
            </Pressable>

            {subtasksExpanded ? (
              <View style={{ marginTop: 4, gap: 4 }}>
                {subtasks.map((sub) => (
                  <View
                    key={sub.id}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: sub.completed ? PRIMARY_BLUE : '#cbd5e1',
                        backgroundColor: sub.completed
                          ? PRIMARY_BLUE
                          : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sub.completed ? (
                        <MaterialIcons name="check" size={12} color="#fff" />
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: sub.completed ? '#94a3b8' : '#334155',
                        textDecorationLine: sub.completed
                          ? 'line-through'
                          : 'none',
                        flex: 1,
                        textAlign: 'right',
                      }}
                    >
                      {sub.title}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ===== Day Events List =====
interface DayEventsListProps {
  dayData: CalendarDay;
  year: number;
  month: number;
  anim: Animated.Value;
  tasks?: CalendarDayTask[];
  onEventPress: (event: CalendarEvent) => void;
  onClose: () => void;
  onOpenTaskSheet: (id: string) => void;
}

function DayEventsList({
  dayData,
  year,
  month,
  anim,
  tasks = [],
  onEventPress,
  onClose,
  onOpenTaskSheet,
}: DayEventsListProps): React.JSX.Element {
  const router = useRouter();
  const { findBirthdayByName, openBirthdayCard } = useBirthdaySheets();

  const dayLabel = useMemo((): string => {
    const date = new Date(year, month, dayData.day);
    const weekday = HEBREW_WEEKDAYS_FULL[date.getDay()];
    const monthName = HEBREW_MONTHS[month];
    if (dayData.isToday) {
      return `היום, ${dayData.day} ב${monthName}`;
    }
    return `${weekday}, ${dayData.day} ב${monthName}`;
  }, [dayData.day, dayData.isToday, year, month]);

  const hasContent =
    dayData.events.length > 0 || dayData.birthday != null || tasks.length > 0;

  return (
    <Animated.View
      style={[
        dStyles.wrapper,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Header — Android RTL: first item is physical right; close right / add left matches iOS */}
      <View style={dStyles.header}>
        {ANDROID_MATCH_IOS_LAYOUT ? (
          <>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={dStyles.closeBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="סגור רשימת אירועים"
            >
              <MaterialIcons name="close" size={20} color="#647b87" />
            </Pressable>
            <Text
              style={[
                dStyles.headerTitle,
                { textAlign: rtl.textAlign ?? 'right' },
              ]}
            >
              {dayLabel}
            </Text>
            <Pressable
              style={dStyles.addBtn}
              onPress={() => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayData.day).padStart(2, '0')}`;
                const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
                router.push({
                  pathname: '/(authenticated)/event/new',
                  params: {
                    date: dateStr,
                    returnTo: 'calendar',
                    sourceView: 'month',
                    sourceDate: dateStr,
                    sourceMonth: monthStr,
                    sourceCollapsed: 'true',
                  },
                } as Parameters<typeof router.push>[0]);
              }}
              accessible={true}
              accessibilityLabel="הוסף אירוע חדש"
            >
              <Text style={dStyles.addBtnText}>+ הוסף אירוע</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={dStyles.addBtn}
              onPress={() => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayData.day).padStart(2, '0')}`;
                const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
                router.push({
                  pathname: '/(authenticated)/event/new',
                  params: {
                    date: dateStr,
                    returnTo: 'calendar',
                    sourceView: 'month',
                    sourceDate: dateStr,
                    sourceMonth: monthStr,
                    sourceCollapsed: 'true',
                  },
                } as Parameters<typeof router.push>[0]);
              }}
              accessible={true}
              accessibilityLabel="הוסף אירוע חדש"
            >
              <Text style={dStyles.addBtnText}>+ הוסף אירוע</Text>
            </Pressable>
            <Text
              style={[
                dStyles.headerTitle,
                { textAlign: rtl.textAlign ?? 'right' },
              ]}
            >
              {dayLabel}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={dStyles.closeBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="סגור רשימת אירועים"
            >
              <MaterialIcons name="close" size={20} color="#647b87" />
            </Pressable>
          </>
        )}
      </View>

      {/* Birthday Card */}
      {dayData.birthday != null && (
        <Pressable
          style={dStyles.birthdayCard}
          onPress={() => {
            const found = findBirthdayByName(dayData.birthday?.name ?? '');
            if (found) openBirthdayCard(found);
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`יום הולדת ${dayData.birthday.name}`}
        >
          <Text style={dStyles.birthdayEmoji}>🎂</Text>
          <View style={dStyles.birthdayContent}>
            <Text style={dStyles.birthdayTitle}>
              יום הולדת: {dayData.birthday.name}
            </Text>
            {dayData.birthday.age != null && (
              <Text style={dStyles.birthdayAge}>
                {dayData.birthday.age} שנים
              </Text>
            )}
          </View>
          <MaterialIcons name="chevron-left" size={20} color="#e64980" />
        </Pressable>
      )}

      {/* Event Cards */}
      {dayData.events.map((event) => {
        const duration = calculateDuration(event);
        const iconName = getCategoryIcon(event.category);
        return (
          <Pressable
            key={event.listKey ?? event.id}
            style={dStyles.card}
            onPress={() => onEventPress(event)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${event.time}, ${duration} דקות`}
          >
            {ANDROID_MATCH_IOS_LAYOUT ? (
              <>
                <View
                  style={[
                    dStyles.iconBox,
                    { backgroundColor: `${event.categoryColor}20` },
                  ]}
                >
                  <MaterialIcons
                    name={iconName as 'event'}
                    size={20}
                    color={event.categoryColor}
                  />
                </View>
                <View style={dStyles.content}>
                  {event.communityName ? (
                    <View style={{ marginBottom: 4 }}>
                      <CommunityEventNameTag name={event.communityName} />
                    </View>
                  ) : null}
                  <Text style={dStyles.eventTitle}>{event.title}</Text>
                  {event.location != null && event.location !== '' && (
                    <View style={dStyles.locationRow}>
                      <View style={dStyles.locationDot} />
                      <Text style={dStyles.locationText}>{event.location}</Text>
                    </View>
                  )}
                  {(event.profileCircles?.length ?? 0) > 0 ||
                  (event.profileCirclesExtraCount ?? 0) > 0 ? (
                    <View style={{ marginTop: 4 }}>
                      <ProfileCircles
                        profiles={event.profileCircles ?? []}
                        extraCount={event.profileCirclesExtraCount ?? 0}
                        context={event.profileCirclesContext ?? 'sharedWith'}
                      />
                    </View>
                  ) : (event.assigneeColors?.length ?? 0) > 0 ? (
                    <View style={dStyles.assigneeDots}>
                      {event.assigneeColors?.slice(0, 4).map((color) => (
                        <View
                          key={color}
                          style={[
                            dStyles.assigneeDot,
                            { backgroundColor: color },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                <View
                  style={[
                    dStyles.divider,
                    { backgroundColor: `${event.categoryColor}50` },
                  ]}
                />
                <View style={dStyles.timeCol}>
                  <Text style={dStyles.timeText}>{event.time}</Text>
                  <Text style={dStyles.durationText}>{duration} דק׳</Text>
                </View>
              </>
            ) : (
              <>
                <View style={dStyles.timeCol}>
                  <Text style={dStyles.timeText}>{event.time}</Text>
                  <Text style={dStyles.durationText}>{duration} דק׳</Text>
                </View>
                <View
                  style={[
                    dStyles.divider,
                    { backgroundColor: `${event.categoryColor}50` },
                  ]}
                />
                <View style={dStyles.content}>
                  {event.communityName ? (
                    <View style={{ marginBottom: 4 }}>
                      <CommunityEventNameTag name={event.communityName} />
                    </View>
                  ) : null}
                  <Text style={dStyles.eventTitle}>{event.title}</Text>
                  {event.location != null && event.location !== '' && (
                    <View style={dStyles.locationRow}>
                      <View style={dStyles.locationDot} />
                      <Text style={dStyles.locationText}>{event.location}</Text>
                    </View>
                  )}
                  {(event.profileCircles?.length ?? 0) > 0 ||
                  (event.profileCirclesExtraCount ?? 0) > 0 ? (
                    <View style={{ marginTop: 4 }}>
                      <ProfileCircles
                        profiles={event.profileCircles ?? []}
                        extraCount={event.profileCirclesExtraCount ?? 0}
                        context={event.profileCirclesContext ?? 'sharedWith'}
                      />
                    </View>
                  ) : (event.assigneeColors?.length ?? 0) > 0 ? (
                    <View style={dStyles.assigneeDots}>
                      {event.assigneeColors?.slice(0, 4).map((color) => (
                        <View
                          key={color}
                          style={[
                            dStyles.assigneeDot,
                            { backgroundColor: color },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                <View
                  style={[
                    dStyles.iconBox,
                    { backgroundColor: `${event.categoryColor}20` },
                  ]}
                >
                  <MaterialIcons
                    name={iconName as 'event'}
                    size={20}
                    color={event.categoryColor}
                  />
                </View>
              </>
            )}
          </Pressable>
        );
      })}

      {/* Personal Task Cards — unified CalendarTaskCard */}
      {tasks.map((task) => (
        <View key={task.id} style={{ marginBottom: 8 }}>
          <CalendarTaskCard task={task} onOpenTaskSheet={onOpenTaskSheet} />
        </View>
      ))}

      {/* Empty State */}
      {!hasContent && (
        <View style={dStyles.emptyState}>
          <MaterialIcons name="calendar-today" size={40} color="#d1d5db" />
          <Text style={dStyles.emptyText}>אין אירועים מתוכננים ליום זה</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ===== Timeline Helpers =====

/** Returns all calendar days strictly between two Date values (local time). */
function buildMissingDays(
  fromDate: Date,
  toDate: Date
): Array<{ dateStr: string; dayLabel: string; dayNumber: string }> {
  const result: Array<{
    dateStr: string;
    dayLabel: string;
    dayNumber: string;
  }> = [];
  const cursor = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate() + 1
  );
  const endMs = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate()
  ).getTime();

  while (cursor.getTime() < endMs) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const d = cursor.getDate();
    result.push({
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayLabel: cursor.toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      dayNumber: String(d),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// ===== Timeline View =====
function TimelineView({
  data,
  onTodayLayout,
  onEventPress,
  onNavigate,
  onAddPress,
  onOpenTaskSheet,
}: {
  data: TimelineDayGroup[];
  onTodayLayout?: (y: number) => void;
  onEventPress: (event: CalendarEvent) => void;
  onNavigate: (location: string, locationUrl?: string) => void;
  onAddPress: (dateStr: string) => void;
  onOpenTaskSheet: (id: string) => void;
}): React.JSX.Element {
  const [openGaps, setOpenGaps] = useState<Record<string, boolean>>({});
  const myImportantItemChecks =
    useQuery(api.tasks.getMyImportantItemChecks) ?? {};

  if (data.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          gap: 16,
          paddingTop: 80,
        }}
      >
        <MaterialIcons name="event-busy" size={48} color="#d1d5db" />
        <Text style={{ fontSize: 16, color: '#9ca3af', textAlign: 'center' }}>
          אין אירועים לקהילה זו
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineContainer}>
      {data.map((dayGroup, idx) => {
        const sk = new Date(dayGroup.sortKey);
        const dateStr = `${sk.getFullYear()}-${String(sk.getMonth() + 1).padStart(2, '0')}-${String(sk.getDate()).padStart(2, '0')}`;

        const nextGroup = data[idx + 1];
        const missingDays =
          nextGroup != null
            ? buildMissingDays(sk, new Date(nextGroup.sortKey))
            : [];
        const isGapOpen =
          missingDays.length > 0 ? (openGaps[dateStr] ?? false) : false;

        return (
          <Fragment key={`group-${dayGroup.sortKey}`}>
            {/* Day group */}
            <View
              onLayout={(event) => {
                if (!dayGroup.isToday || onTodayLayout == null) return;
                onTodayLayout(event.nativeEvent.layout.y);
              }}
              style={styles.dayGroup}
            >
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <View
                  style={[
                    styles.dayNumberCircle,
                    dayGroup.isToday && styles.dayNumberCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumberText,
                      dayGroup.isToday && styles.dayNumberTextToday,
                    ]}
                  >
                    {dayGroup.dayNumber}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.dayLabel,
                    dayGroup.isToday && styles.dayLabelToday,
                  ]}
                >
                  {dayGroup.dayLabel}
                </Text>
                <View style={styles.dayDivider} />
                <Pressable
                  onPress={() => onAddPress(dateStr)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`הוסף אירוע בתאריך ${dayGroup.dayLabel}`}
                  style={({ pressed }) => [
                    styles.addEventPill,
                    pressed && styles.addEventPillPressed,
                  ]}
                >
                  <Text style={styles.addEventPillText}>הוסף</Text>
                </Pressable>
              </View>

              {/* Vertical Timeline Line */}
              <View style={styles.timelineLineWrapper}>
                <View style={styles.timelineVerticalLine} />

                {/* Events */}
                <View style={styles.eventsWrapper}>
                  {dayGroup.events.map((event: TimelineEventRow) => (
                    <View key={event.id} style={styles.eventRow}>
                      {/* Color Dot */}
                      <View
                        style={[
                          styles.eventDot,
                          { borderColor: event.categoryColor },
                          event.cancelled && styles.eventDotCancelled,
                        ]}
                      />

                      {/* Time column + Card (RTL: time on visual right) */}
                      <View style={styles.eventRowInner}>
                        {/* Time column — outside the card */}
                        <View style={styles.eventTimeColumn}>
                          {event.time ? (
                            <>
                              <Text style={styles.eventTimeText}>
                                {event.endTime ? `${event.time}-` : event.time}
                              </Text>
                              {event.endTime ? (
                                <Text style={styles.eventEndTimeText}>
                                  {event.endTime}
                                </Text>
                              ) : null}
                            </>
                          ) : null}
                        </View>

                        {/* Event / Task Card */}
                        <View style={styles.timelineEventCardColumn}>
                          {event.isPersonalTask ? (
                            /* ── Personal task card — unified CalendarTaskCard ── */
                            <CalendarTaskCard
                              task={{
                                id: event.id,
                                title: event.title,
                                time: event.time,
                                isOverdue: event.isOverdue ?? false,
                                assigneeInitials: event.assigneeInitials,
                                assigneeColor: event.assigneeColor,
                                assigneeDisplays: event.assigneeDisplays,
                                subtasks: event.subtasks,
                              }}
                              onOpenTaskSheet={onOpenTaskSheet}
                            />
                          ) : (
                            /* ── Regular event card ── */
                            <Pressable
                              style={[
                                styles.eventCard,
                                event.cancelled && styles.eventCardCancelled,
                                event.myAssignedTasks &&
                                  event.myAssignedTasks.length > 0 &&
                                  styles.eventCardWithTasks,
                              ]}
                              onPress={() => onEventPress(event)}
                              accessible={true}
                              accessibilityRole="button"
                              accessibilityLabel={`${event.title}${event.time ? `, ${event.time}` : ''}`}
                            >
                              {/* Color accent bar */}
                              <View
                                style={[
                                  styles.eventAccentBar,
                                  {
                                    backgroundColor: event.cancelled
                                      ? '#9ca3af'
                                      : event.categoryColor,
                                  },
                                ]}
                              />

                              {/* Card inner content */}
                              <View style={styles.eventCardContent}>
                                {/* Header: category tag + community name tag + profile circles */}
                                <View style={styles.eventCardHeader}>
                                  <View
                                    style={[
                                      styles.categoryTag,
                                      {
                                        backgroundColor: `${event.categoryColor}20`,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.categoryTagText,
                                        {
                                          color: event.cancelled
                                            ? '#9ca3af'
                                            : event.categoryColor,
                                        },
                                      ]}
                                    >
                                      {event.category}
                                    </Text>
                                  </View>
                                  {event.communityName ? (
                                    <CommunityEventNameTag
                                      name={event.communityName}
                                    />
                                  ) : null}
                                  {(event.profileCircles?.length ?? 0) > 0 ||
                                  (event.profileCirclesExtraCount ?? 0) > 0 ? (
                                    <ProfileCircles
                                      profiles={event.profileCircles ?? []}
                                      extraCount={
                                        event.profileCirclesExtraCount ?? 0
                                      }
                                      context={
                                        event.profileCirclesContext ??
                                        'sharedWith'
                                      }
                                      size={22}
                                    />
                                  ) : null}
                                </View>

                                {/* Event Title */}
                                <Text
                                  style={[
                                    styles.eventTitle,
                                    event.cancelled &&
                                      styles.eventTitleCancelled,
                                  ]}
                                >
                                  {event.title}
                                </Text>

                                {/* Location + nav button */}
                                {event.location ? (
                                  <>
                                    <View style={styles.locationRow}>
                                      <MaterialIcons
                                        name="location-on"
                                        size={13}
                                        color="#94a3b8"
                                      />
                                      <Text
                                        style={styles.locationText}
                                        numberOfLines={1}
                                      >
                                        {event.location}
                                      </Text>
                                    </View>
                                    <Pressable
                                      style={styles.eventNavBtn}
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        onNavigate(
                                          event.location as string,
                                          event.locationUrl
                                        );
                                      }}
                                      accessible={true}
                                      accessibilityRole="button"
                                      accessibilityLabel="נווט"
                                    >
                                      <MaterialIcons
                                        name="near-me"
                                        size={13}
                                        color="#8d6e63"
                                      />
                                      <Text style={styles.eventNavBtnText}>
                                        נווט
                                      </Text>
                                    </Pressable>
                                  </>
                                ) : null}
                              </View>
                            </Pressable>
                          )}
                          {!event.isPersonalTask &&
                          event.myAssignedTasks &&
                          event.myAssignedTasks.length > 0 ? (
                            <View style={styles.calendarTaskExpansionContainer}>
                              <InlineEventTasksSection
                                tasks={event.myAssignedTasks}
                              />
                            </View>
                          ) : null}
                          {!event.isPersonalTask &&
                          event.importantItems &&
                          event.importantItems.length > 0 ? (
                            <View style={styles.calendarTaskExpansionContainer}>
                              <InlineImportantItemsSection
                                eventId={String(event.id)}
                                items={event.importantItems}
                                checks={
                                  myImportantItemChecks[String(event.id)] ?? {}
                                }
                              />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Gap toggle: shown between two groups when days are missing */}
            {missingDays.length > 0 && (
              <View style={styles.gapRow}>
                <Pressable
                  onPress={() =>
                    setOpenGaps((prev) => ({
                      ...prev,
                      [dateStr]: !(prev[dateStr] ?? false),
                    }))
                  }
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isGapOpen
                      ? 'הסתר ימים ללא אירועים'
                      : `הצג ${missingDays.length === 1 ? 'יום' : 'ימים'} ללא אירועים`
                  }
                  hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
                  style={({ pressed }) => [
                    styles.gapToggleButton,
                    pressed && styles.gapToggleButtonPressed,
                  ]}
                >
                  {isGapOpen ? (
                    <Minus size={18} color={PRIMARY_BLUE} strokeWidth={2} />
                  ) : (
                    <Plus size={18} color={PRIMARY_BLUE} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
            )}

            {/* Empty day rows rendered when gap is open */}
            {isGapOpen &&
              missingDays.map((day) => (
                <View key={day.dateStr} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayNumberCircle}>
                      <Text style={styles.dayNumberText}>{day.dayNumber}</Text>
                    </View>
                    <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                    <View style={styles.dayDivider} />
                    <Pressable
                      onPress={() => onAddPress(day.dateStr)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`הוסף אירוע בתאריך ${day.dayLabel}`}
                      style={({ pressed }) => [
                        styles.addEventPill,
                        pressed && styles.addEventPillPressed,
                      ]}
                    >
                      <Text style={styles.addEventPillText}>הוסף</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
          </Fragment>
        );
      })}

      {/* End indicator */}
      <View style={styles.endIndicator}>
        <MaterialIcons name="history" size={30} color="#d1d5db" />
        <Text style={styles.endText}>סוף ההיסטוריה המוצגת</Text>
      </View>
    </View>
  );
}

// ===== General Styles =====
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  /** Ensures RTL Yoga layout for this screen if a navigator strips root `direction` inheritance (Android). */
  safeAreaRtl: {
    direction: 'rtl',
  },
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },

  /* Community filter banner */
  communityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    backgroundColor: '#36a9e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  communityBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'right',
  },
  communityBannerClose: {
    padding: 4,
  },

  /* Header */
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  monthHeaderWrap: {
    marginTop: 6,
    marginBottom: 0,
    paddingHorizontal: 2,
  },
  monthTimelineWrap: {
    marginBottom: 12,
    alignItems: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 38,
    width: '100%',
  },
  monthChevronButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  monthTitleButton: {
    flex: 1,
    alignItems: 'center',
  },
  monthNavRowPanel: {
    paddingVertical: 2,
  },
  monthYearPanel: {
    fontSize: 15,
    fontWeight: '700',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },

  /* Segmented Control */
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    height: 40,
  },
  /** Android: LTR row → ציר זמן left, חודשי right; matches pill anchored `right: 4` + translateX for monthly/timeline. */
  segmentedControlAndroidTrack: {
    direction: 'ltr',
    flexDirection: 'row',
  },
  segmentedSlider: {
    position: 'absolute',
    top: 4,
    right: 4,
    height: 32,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#647b87',
  },
  segmentTextActive: {
    color: PRIMARY_BLUE,
    fontWeight: '700',
  },
  segmentTextDisabled: {
    color: '#b0bec5',
    fontWeight: '600',
  },

  /* Content */
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  /* Timeline */
  timelineContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  dayGroup: {
    marginBottom: 32,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dayNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberCircleToday: {
    backgroundColor: `${PRIMARY_BLUE}20`,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#647b87',
  },
  dayNumberTextToday: {
    color: PRIMARY_BLUE,
  },
  dayLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#647b87',
  },
  dayLabelToday: {
    color: '#111517',
  },
  dayDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  addEventPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e8f5fd',
  },
  addEventPillPressed: {
    opacity: 0.7,
  },
  addEventPillText: {
    fontSize: 13,
    color: PRIMARY_BLUE,
    fontWeight: '600',
  },
  gapRow: {
    alignItems: 'flex-start',
    paddingLeft: 6,
    marginTop: -16,
    marginBottom: 8,
  },
  gapToggleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  gapToggleButtonPressed: {
    backgroundColor: '#e8f5fd',
  },

  /* Timeline Line */
  timelineLineWrapper: {
    position: 'relative',
    paddingRight: 40,
  },
  timelineVerticalLine: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  eventsWrapper: {
    gap: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventRowInner: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTimeColumn: {
    width: 44,
    alignItems: 'center',
    paddingTop: 14,
    flexShrink: 0,
  },
  eventTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  eventEndTimeText: {
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 1,
  },
  eventDot: {
    position: 'absolute',
    right: -31,
    top: 24,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  eventDotCancelled: {
    borderColor: '#9ca3af',
  },

  /* Event Card */
  timelineEventCardColumn: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  eventCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  eventCardWithTasks: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  calendarTaskExpansionContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  eventCardCancelled: {
    opacity: 0.6,
  },
  eventAccentBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  eventCardContent: {
    padding: 12,
    paddingRight: 16,
  },
  eventCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  overdueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  overdueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  taskAssigneeAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskAssigneeInitials: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  taskSubtasksRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  taskSubtasksText: {
    fontSize: 11,
    color: '#b45309',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111517',
    marginBottom: 4,
    textAlign: 'right',
  },
  eventTitleCancelled: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#9ca3af',
    color: '#9ca3af',
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'right',
    flex: 1,
  },
  eventNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(141,110,99,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  eventNavBtnText: {
    color: '#8d6e63',
    fontWeight: '700',
    fontSize: 12,
  },
  profileCirclesRow: {
    marginTop: 6,
  },

  /* End Indicator */
  endIndicator: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  endText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },

  /* Calendar Panel (monthly view) */
  calendarPanel: {
    backgroundColor: BG_COLOR,
    overflow: 'hidden',
  },
  expandedCalendarScroll: {
    flex: 1,
  },
  expandedCalendarScrollContent: {
    paddingBottom: EXPANDED_GRID_BOTTOM_PADDING,
  },
  expandedCalendarGridHost: {},
  dragHandleContainer: {
    height: CALENDAR_HANDLE_HEIGHT,
    minHeight: CALENDAR_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_COLOR,
    zIndex: 2,
  },
  dailyEventsScroll: {
    flex: 1,
  },

  /* FAB */
});

// ===== Monthly View Styles =====
const mStyles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  gridContainerExpanded: {
    paddingHorizontal: 8,
  },
  weekRow: {
    gap: 4,
    marginBottom: 4,
  },
  weekRowExpanded: {
    gap: 3,
  },

  /* Day Header */
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  shabbatHeaderText: {
    color: PRIMARY_BLUE,
  },

  /* Day Cell */
  dayCell: {
    flex: 1,
    height: COMPACT_CELL_HEIGHT,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    position: 'relative',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dayCellExpanded: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 3,
  },
  dayCellOtherMonth: {
    backgroundColor: '#fafafa',
    shadowOpacity: 0,
    elevation: 0,
  },

  /* Day Number */
  dayNumWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumWrapperSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumTodayBg: {
    backgroundColor: `${PRIMARY_BLUE}15`,
  },
  dayNumSelectedBg: {
    backgroundColor: PRIMARY_BLUE,
  },
  dayNumText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  dayNumTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
  },
  dayNumOtherMonth: {
    color: '#d1d5db',
  },
  dayNumTodayText: {
    color: PRIMARY_BLUE,
    fontWeight: '700',
  },
  dayNumSelectedText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayNumRowExpanded: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: EXPANDED_DAY_HEADER_HEIGHT,
    paddingHorizontal: 2,
    marginBottom: 1,
  },

  /* Birthday */
  birthdayEmoji: {
    fontSize: 10,
    lineHeight: 14,
  },

  eventIndicatorBar: {
    position: 'absolute',
    right: 12,
    bottom: 6,
    left: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: `${PRIMARY_BLUE}45`,
  },

  /* Expanded Cell Content */
  expandedEvents: {
    width: '100%',
    gap: 3,
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  expandedBirthdayRow: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#fff1f2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffe4e6',
  },
  expandedBirthdayText: {
    fontSize: 10,
    color: '#be185d',
    fontWeight: '600',
    textAlign: 'right',
  },
  expandedEventRow: {
    width: '100%',
    borderRadius: 6,
    paddingHorizontal: 3,
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  expandedEventRowCompact: {
    minHeight: EXPANDED_ROW_ITEM_HEIGHT,
    paddingVertical: 1,
  },
  expandedEventRowSingle: {
    minHeight: EXPANDED_ROW_ITEM_HEIGHT_SINGLE,
    paddingVertical: 2,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  expandedEventRowCancelled: {
    opacity: 0.72,
  },
  expandedEventRowPersonal: {
    backgroundColor: '#f9fafb',
    borderColor: '#eef0f3',
  },
  expandedEventRowCommunity: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  expandedEventRowShared: {
    backgroundColor: '#f8fafc',
    borderColor: '#e8ecf1',
  },
  expandedEventSingleContainer: {
    width: '100%',
    paddingHorizontal: 1,
    paddingTop: 1,
    paddingBottom: 1,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  expandedEventSingleTitle: {
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
    fontSize: 10,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 13,
    includeFontPadding: false,
  },
  expandedEventText: {
    width: '100%',
    minWidth: 0,
    textAlign: 'right',
    flexShrink: 1,
    fontSize: 10,
    color: '#111827',
    includeFontPadding: false,
  },
  expandedEventTimeText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'right',
    width: '100%',
    marginTop: 1,
    includeFontPadding: false,
  },
  expandedEventTitleCancelled: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  expandedDayFiller: {
    flex: 1,
    minHeight: 8,
  },

  /* Task indicators */
  taskIndicatorDot: {
    position: 'absolute',
    right: 4,
    bottom: 10,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  expandedTaskRow: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#fffbeb',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fde68a',
    alignItems: 'flex-end',
  },
  expandedTaskText: {
    fontSize: 9,
    color: '#b45309',
    fontWeight: '600',
    textAlign: 'right',
  },
});

const pickerStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    direction: 'rtl',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'center',
    marginBottom: 14,
  },
  columns: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#647b87',
    textAlign: 'right',
    marginBottom: 8,
  },
  columnScroll: {
    maxHeight: 260,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  optionButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111517',
    textAlign: 'right',
  },
  optionTextActive: {
    color: PRIMARY_BLUE,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#647b87',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// ===== Day Events List Styles =====
const dStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 88,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111517',
    flex: 1,
    marginHorizontal: 12,
  },
  addBtn: {
    backgroundColor: `${PRIMARY_BLUE}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_BLUE,
  },
  closeBtn: {
    padding: 4,
  },

  /* Birthday Card */
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fce7f3',
    marginBottom: 8,
  },
  birthdayEmoji: {
    fontSize: 28,
  },
  birthdayContent: {
    flex: 1,
  },
  birthdayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#be185d',
    textAlign: 'right',
  },
  birthdayAge: {
    fontSize: 13,
    color: '#9d174d',
    marginTop: 2,
    textAlign: 'right',
  },

  /* Event Card - Stitch Design */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeCol: {
    alignItems: 'center',
    minWidth: 52,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111517',
  },
  durationText: {
    fontSize: 11,
    color: '#647b87',
    marginTop: 3,
  },
  divider: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111517',
    textAlign: 'right',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  locationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#647b87',
  },
  locationText: {
    fontSize: 13,
    color: '#647b87',
  },
  assigneeDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  assigneeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Task Card (day panel) */
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  taskIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
  },
  taskOverdueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  taskOverdueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  taskTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  taskAssigneeAvatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskAssigneeInitialsSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  taskSubtasksRowDay: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  taskSubtasksTextDay: {
    fontSize: 11,
    color: '#64748b',
  },

  /* Empty State */
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
