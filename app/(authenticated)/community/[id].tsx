import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#36a9e2';

const TABS = ['הכל', 'אירועים', 'משימות', 'פעילות'] as const;
type Tab = (typeof TABS)[number];

const EVENT_COLORS = [
  '#36a9e2', '#f59e0b', '#10b981',
  '#8b5cf6', '#f43f5e', '#6366f1',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'yes' | 'no' | 'maybe' | 'none';

interface EventDoc {
  _id: Id<'events'>;
  title: string;
  startTime: number;
  endTime: number;
  allDay?: boolean;
  location?: string;
  description?: string;
  communityId?: Id<'communities'>;
}

interface TaskDoc {
  _id: Id<'tasks'>;
  title: string;
  dueDate?: number;
  completed: boolean;
}

interface RsvpDoc {
  _id: Id<'eventRsvps'>;
  eventId: Id<'events'>;
  userId: Id<'users'>;
  status: RsvpStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEventColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
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

function formatEventDate(ts: number, allDay?: boolean): string {
  const d = new Date(ts);
  if (allDay) {
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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
  return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ─── EventCard ────────────────────────────────────────────────────────────────

const RSVP_BADGE: Record<'yes' | 'maybe', { label: string; color: string }> = {
  yes: { label: 'נוסף ליומן', color: '#22c55e' },
  maybe: { label: 'ממתין לאישור', color: '#eab308' },
};

interface EventCardProps {
  event: EventDoc;
  rsvpStatus?: RsvpStatus;
  showRsvpButtons?: boolean;
  onRsvp?: (eventId: Id<'events'>, status: RsvpStatus) => void;
  past?: boolean;
}

function EventCard({ event, rsvpStatus, showRsvpButtons, onRsvp, past }: EventCardProps) {
  const color = getEventColor(event._id);
  const badge = rsvpStatus && rsvpStatus !== 'no' && rsvpStatus !== 'none'
    ? RSVP_BADGE[rsvpStatus]
    : null;

  return (
    <View style={[styles.eventCard, past && styles.eventCardPast]}>
      {/* Colored header */}
      <View style={[styles.eventCardHeader, { backgroundColor: color }]}>
        {/* Gradient overlay */}
        <View style={styles.eventCardOverlay} />
        {badge && (
          <View style={[styles.rsvpBadge, { backgroundColor: badge.color }]}>
            <Text style={styles.rsvpBadgeText}>{badge.label}</Text>
          </View>
        )}
        {past && (
          <View style={[styles.rsvpBadge, { backgroundColor: '#94a3b8' }]}>
            <Text style={styles.rsvpBadgeText}>עבר</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={styles.eventCardBody}>
        <Text style={styles.eventCardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.eventCardDate}>
          {formatEventDate(event.startTime, event.allDay)}
        </Text>
        {event.location ? (
          <Text style={styles.eventCardLocation} numberOfLines={1}>
            📍 {event.location}
          </Text>
        ) : null}

        {/* RSVP buttons */}
        {showRsvpButtons && onRsvp && (
          <View style={styles.rsvpButtons}>
            {(['yes', 'maybe', 'no'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.rsvpBtn,
                  rsvpStatus === s && { backgroundColor: PRIMARY },
                ]}
                onPress={() => onRsvp(event._id, s)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={s === 'yes' ? 'כן' : s === 'maybe' ? 'אולי' : 'לא'}
              >
                <Text style={[styles.rsvpBtnText, rsvpStatus === s && { color: '#fff' }]}>
                  {s === 'yes' ? 'כן' : s === 'maybe' ? 'אולי' : 'לא'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
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
      {/* Checkbox */}
      <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
        {task.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>

      {/* Title */}
      <Text
        style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
        numberOfLines={2}
      >
        {task.title}
      </Text>

      {/* Due date */}
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

function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} accessible accessibilityRole="button">
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.sectionHeaderRight}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Tab: הכל ────────────────────────────────────────────────────────────────

interface TabAllProps {
  myEvents: EventDoc[];
  unansweredEvents: EventDoc[];
  tasks: TaskDoc[];
  rsvpMap: Record<string, RsvpStatus>;
  onRsvp: (eventId: Id<'events'>, status: RsvpStatus) => void;
  onToggleTask: (id: Id<'tasks'>) => void;
  onSeeMoreEvents: () => void;
}

function TabAll({
  myEvents,
  unansweredEvents,
  tasks,
  rsvpMap,
  onRsvp,
  onToggleTask,
  onSeeMoreEvents,
}: TabAllProps) {
  const visibleMyEvents = myEvents.slice(0, 4);
  const extraCount = Math.max(0, myEvents.length - 4);

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── האירועים שלי */}
      {myEvents.length > 0 && (
        <View>
          <SectionHeader
            title="האירועים שלי"
            subtitle="אירועים שכבר הצטרפת אליהם או הגבת אליהם"
          />
          <View style={styles.eventsGrid}>
            {visibleMyEvents.map((ev) => (
              <EventCard
                key={ev._id}
                event={ev}
                rsvpStatus={rsvpMap[ev._id]}
              />
            ))}
          </View>
          {extraCount > 0 && (
            <TouchableOpacity
              style={styles.seeMoreBtn}
              onPress={onSeeMoreEvents}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`ראה עוד ${extraCount} אירועים`}
            >
              <Text style={styles.seeMoreText}>+ ראה עוד ({extraCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── כדאי לזכור (משימות) */}
      <View>
        <SectionHeader
          title="כדאי לזכור"
          actionLabel="ראה עוד"
          onAction={() => {
            // handled by parent tab switch
          }}
        />
        {tasks.length === 0 ? (
          <View style={styles.emptySmall}>
            <Text style={styles.emptySmallText}>אין משימות פתוחות לקהילה זו</Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {tasks.slice(0, 5).map((t) => (
              <TaskRow key={t._id} task={t} onToggle={onToggleTask} />
            ))}
          </View>
        )}
      </View>

      {/* ── אירועים נוספים */}
      {unansweredEvents.length > 0 && (
        <View>
          <SectionHeader
            title="אירועים נוספים"
            subtitle="אירועים בקהילה שעדיין לא הגבת אליהם"
          />
          <View style={styles.eventsGrid}>
            {unansweredEvents.map((ev) => (
              <EventCard
                key={ev._id}
                event={ev}
                rsvpStatus={rsvpMap[ev._id]}
                showRsvpButtons
                onRsvp={onRsvp}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── פעילות בקהילה (TODO) */}
      <View>
        <SectionHeader title="פעילות בקהילה" />
        <View style={styles.emptySmall}>
          <Text style={styles.emptySmallText}>
            {/* TODO: create activityFeed query in convex/communities.ts */}
            פעילות אחרונה תופיע כאן בקרוב
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Tab: אירועים ─────────────────────────────────────────────────────────────

interface TabEventsProps {
  events: EventDoc[];
  rsvpMap: Record<string, RsvpStatus>;
  onRsvp: (eventId: Id<'events'>, status: RsvpStatus) => void;
  selectedMonth: Date;
  onMonthChange: (d: Date) => void;
  searchQuery: string;
}

function TabEvents({ events, rsvpMap, onRsvp, selectedMonth, onMonthChange, searchQuery }: TabEventsProps) {
  const monthLabel = selectedMonth.toLocaleDateString('he-IL', {
    month: 'long', year: 'numeric',
  });

  const eventsInMonth = useMemo(() => {
    const start = new Date(
      selectedMonth.getFullYear(), selectedMonth.getMonth(), 1
    ).getTime();
    const end = new Date(
      selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999
    ).getTime();
    let filtered = events.filter((e) => e.startTime >= start && e.startTime <= end);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location ?? '').toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q)
      );
    }
    // מיון: עתידיים קודם, עברו אחרון
    const now = Date.now();
    return filtered.sort((a, b) => {
      const aPast = isEventPast(a);
      const bPast = isEventPast(b);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return a.startTime - b.startTime;
    });
  }, [events, selectedMonth, searchQuery]);

  const prevMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  };

  const nextMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  };

  return (
    <View style={styles.tabFlex}>
      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity
          onPress={nextMonth}
          style={styles.monthArrow}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חודש הבא"
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={prevMonth}
          style={styles.monthArrow}
          accessible
          accessibilityRole="button"
          accessibilityLabel="חודש קודם"
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {eventsInMonth.length === 0 ? (
        <View style={styles.emptyFull}>
          <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>אין אירועים בחודש זה</Text>
        </View>
      ) : (
        <FlatList<EventDoc>
          data={eventsInMonth}
          keyExtractor={(e) => e._id}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const past = isEventPast(item);
            return (
              <View style={past ? styles.pastEventRow : styles.eventRow}>
                {/* Color dot + date */}
                <View style={styles.eventRowLeft}>
                  <Text style={styles.eventRowDate}>
                    {new Date(item.startTime).toLocaleDateString('he-IL', {
                      day: 'numeric', month: 'short',
                    })}
                  </Text>
                  <View style={[styles.eventDot, { backgroundColor: getEventColor(item._id) }]} />
                </View>

                {/* Content */}
                <View style={styles.eventRowContent}>
                  <View style={styles.eventRowTop}>
                    {past && (
                      <View style={styles.pastBadge}>
                        <Text style={styles.pastBadgeText}>עבר</Text>
                      </View>
                    )}
                    <Text style={[styles.eventRowTitle, past && styles.textFaded]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                  {item.location ? (
                    <Text style={[styles.eventRowLocation, past && styles.textFaded]} numberOfLines={1}>
                      📍 {item.location}
                    </Text>
                  ) : null}
                  {!past && (
                    <View style={styles.rsvpButtons}>
                      {(['yes', 'maybe', 'no'] as const).map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.rsvpBtn,
                            rsvpMap[item._id] === s && { backgroundColor: PRIMARY },
                          ]}
                          onPress={() => onRsvp(item._id, s)}
                          accessible
                          accessibilityRole="button"
                        >
                          <Text
                            style={[
                              styles.rsvpBtnText,
                              rsvpMap[item._id] === s && { color: '#fff' },
                            ]}
                          >
                            {s === 'yes' ? 'כן' : s === 'maybe' ? 'אולי' : 'לא'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Tab: משימות ─────────────────────────────────────────────────────────────

interface TabTasksProps {
  tasks: TaskDoc[];
  onToggle: (id: Id<'tasks'>) => void;
}

function TabTasks({ tasks, onToggle }: TabTasksProps) {
  if (tasks.length === 0) {
    return (
      <View style={styles.emptyFull}>
        <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>אין משימות פתוחות לקהילה זו</Text>
        {/* TODO: add task creation from community context */}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.taskList}>
        {tasks.map((t) => (
          <TaskRow key={t._id} task={t} onToggle={onToggle} />
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Tab: פעילות (TODO) ───────────────────────────────────────────────────────

function TabActivity() {
  return (
    <View style={styles.emptyFull}>
      <Ionicons name="pulse-outline" size={48} color="#d1d5db" />
      <Text style={styles.emptyText}>פעילות הקהילה תופיע כאן בקרוב</Text>
      {/* TODO: create activityFeed query in convex/communities.ts */}
    </View>
  );
}

// ─── Overflow Popover ─────────────────────────────────────────────────────────

interface OverflowMenuItem {
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  danger?: boolean;
}

interface OverflowMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  items: OverflowMenuItem[];
  onClose: () => void;
}

function OverflowMenu({ visible, position, items, onClose }: OverflowMenuProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.popoverBackdrop} onPress={onClose} />
      <View style={[styles.popover, { top: position.y, right: position.x }]}>
        {items.map((m, idx) => (
          <Pressable
            key={m.label}
            style={[styles.popoverItem, idx < items.length - 1 && styles.popoverBorder]}
            onPress={() => { onClose(); m.onPress(); }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={m.label}
          >
            <Text style={[styles.popoverLabel, m.danger && styles.popoverDanger]}>
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
        />
        <Ionicons name="search" size={20} color="#9ca3af" />
      </View>
    </Modal>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────

interface FabProps {
  communityId: string;
}

function Fab({ communityId }: FabProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      {open && (
        <>
          <Pressable style={styles.fabBackdrop} onPress={() => setOpen(false)} />
          <TouchableOpacity
            style={[styles.fabMenuItem]}
            onPress={() => {
              setOpen(false);
              router.push(
                `/(authenticated)/task/new?communityId=${communityId}` as Parameters<typeof router.push>[0]
              );
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="יצירת משימה"
          >
            <Text style={styles.fabMenuLabel}>יצירת משימה</Text>
            <View style={[styles.fabMenuIcon, { backgroundColor: '#10b981' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setOpen(false);
              router.push(
                `/(authenticated)/event/new?communityId=${communityId}` as Parameters<typeof router.push>[0]
              );
            }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="יצירת אירוע"
          >
            <Text style={styles.fabMenuLabel}>יצירת אירוע</Text>
            <View style={[styles.fabMenuIcon, { backgroundColor: '#f59e0b' }]}>
              <Ionicons name="calendar-outline" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity
        style={[styles.fab, open && styles.fabOpen]}
        onPress={() => setOpen((v) => !v)}
        accessible
        accessibilityRole="button"
        accessibilityLabel="פעולות"
      >
        <Ionicons name={open ? 'close' : 'add'} size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const communityId = id as Id<'communities'>;

  // ── Queries
  const community = useQuery(api.communities.getCommunity, { communityId });
  const events = useQuery(api.events.listByCommunity, { communityId });
  const myRsvps = useQuery(api.eventRsvps.listByUser);
  const tasks = useQuery(api.tasks.listByCommunity, { communityId });

  // ── Mutations
  const upsertRsvp = useMutation(api.eventRsvps.upsertRsvp);
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const deleteCommunity = useMutation(api.communities.deleteCommunity);

  // ── Local state
  const [activeTab, setActiveTab] = useState<Tab>('הכל');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 16, y: 80 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuBtnRef = useRef<View>(null);

  // ── Derived data
  const now = Date.now();

  const rsvpMap = useMemo<Record<string, RsvpStatus>>(() => {
    if (!myRsvps) return {};
    return Object.fromEntries(myRsvps.map((r) => [r.eventId, r.status as RsvpStatus]));
  }, [myRsvps]);

  const futureEvents = useMemo<EventDoc[]>(() => {
    if (!events) return [];
    return (events as EventDoc[]).filter((e) => !isEventPast(e));
  }, [events]);

  const myEvents = useMemo<EventDoc[]>(
    () => futureEvents.filter((e) => ['yes', 'maybe'].includes(rsvpMap[e._id] ?? 'none')),
    [futureEvents, rsvpMap]
  );

  const unansweredEvents = useMemo<EventDoc[]>(
    () => futureEvents.filter((e) => !rsvpMap[e._id] || rsvpMap[e._id] === 'none'),
    [futureEvents, rsvpMap]
  );

  const communityTasks = useMemo<TaskDoc[]>(
    () => (tasks ?? []) as TaskDoc[],
    [tasks]
  );

  // ── Handlers
  const handleRsvp = useCallback(
    (eventId: Id<'events'>, status: RsvpStatus) => {
      upsertRsvp({ eventId, status }).catch(() =>
        Alert.alert('שגיאה', 'לא ניתן לשמור תגובה')
      );
    },
    [upsertRsvp]
  );

  const handleToggleTask = useCallback(
    (taskId: Id<'tasks'>) => {
      toggleCompleted({ id: taskId }).catch(() =>
        Alert.alert('שגיאה', 'לא ניתן לעדכן משימה')
      );
      // TODO: connect task completion to Convex mutation with optimistic update
    },
    [toggleCompleted]
  );

  const handleDeleteCommunity = useCallback(() => {
    Alert.alert(
      'מחיקת קהילה',
      'מחיקת הקהילה תמחק גם את כל האירועים והמשימות שלה. הפעולה אינה הפיכה.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחיקה',
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

  const handleMenuPress = useCallback(() => {
    if (!menuBtnRef.current) {
      setMenuOpen(true);
      return;
    }
    menuBtnRef.current.measure((_fx, _fy, _w, _h, _px, py) => {
      setMenuPos({ x: 16, y: py + _h + 4 });
      setMenuOpen(true);
    });
  }, []);

  const overflowItems = useMemo<OverflowMenuItem[]>(() => [
    {
      label: 'חיפוש אירוע',
      iconName: 'search-outline',
      onPress: () => { setActiveTab('אירועים'); setSearchOpen(true); },
    },
    {
      label: 'הצג ביומן',
      iconName: 'calendar-outline',
      onPress: () => {
        // TODO: add communityId filter to calendar screen
        router.push(
          `/(authenticated)/calendar?communityId=${communityId}` as Parameters<typeof router.push>[0]
        );
      },
    },
    {
      label: 'ניהול חברים',
      iconName: 'people-outline',
      onPress: () =>
        router.push(
          `/(authenticated)/community-members/${communityId}` as Parameters<typeof router.push>[0]
        ),
    },
    {
      label: 'התראות',
      iconName: 'notifications-outline',
      onPress: () => {
        Alert.alert(
          'התראות קהילה',
          'מעכשיו תקבלו התראה על כל אירוע חדש או שינוי באירועי הקהילה.',
          [{ text: 'אישור' }]
        );
        // TODO: add toggleMute mutation
      },
    },
    {
      label: 'שיתוף קישור',
      iconName: 'share-outline',
      onPress: () => {
        if (!community?.inviteCode) {
          Alert.alert('שגיאה', 'לא נמצא קישור הזמנה לקהילה זו');
          return;
        }
        Share.share({
          message: `הצטרפו לקהילה "${community.name}": https://inyomi.app/join/${community.inviteCode}`,
        });
      },
    },
    {
      label: 'מחיקת קהילה',
      iconName: 'trash-outline',
      danger: true,
      onPress: handleDeleteCommunity,
    },
  ], [community, communityId, router, handleDeleteCommunity]);

  // ── Loading / not found
  if (community === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (community === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>הקהילה לא נמצאה</Text>
        </View>
      </SafeAreaView>
    );
  }

  const memberLabel = `${community.tags?.[0] ? `${community.tags[0]} • ` : ''}${community.memberCount} חברים`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header */}
      <View style={styles.header}>
        {/* שמאל: חזרה + שיתוף + ⋯ */}
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
          <TouchableOpacity
            onPress={() => {
              if (!community.inviteCode) return;
              Share.share({
                message: `הצטרפו לקהילה "${community.name}": https://inyomi.app/join/${community.inviteCode}`,
              });
            }}
            style={styles.headerIconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="שיתוף"
          >
            <Ionicons name="share-outline" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* ימין: שם + תיאור */}
        <View style={styles.headerRight}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {community.name}
          </Text>
          <Text style={styles.headerSubtitle}>{memberLabel}</Text>
        </View>
      </View>

      {/* ── Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsRow}
      >
        {[...TABS].reverse().map((tab) => {
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
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content */}
      {activeTab === 'הכל' && (
        <TabAll
          myEvents={myEvents}
          unansweredEvents={unansweredEvents}
          tasks={communityTasks}
          rsvpMap={rsvpMap}
          onRsvp={handleRsvp}
          onToggleTask={handleToggleTask}
          onSeeMoreEvents={() => setActiveTab('אירועים')}
        />
      )}
      {activeTab === 'אירועים' && (
        <TabEvents
          events={(events ?? []) as EventDoc[]}
          rsvpMap={rsvpMap}
          onRsvp={handleRsvp}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          searchQuery={searchQuery}
        />
      )}
      {activeTab === 'משימות' && (
        <TabTasks tasks={communityTasks} onToggle={handleToggleTask} />
      )}
      {activeTab === 'פעילות' && <TabActivity />}

      {/* ── FAB */}
      <Fab communityId={communityId} />

      {/* ── Overflow menu */}
      <OverflowMenu
        visible={menuOpen}
        position={menuPos}
        items={overflowItems}
        onClose={() => setMenuOpen(false)}
      />

      {/* ── Search modal */}
      <SearchModal
        visible={searchOpen}
        value={searchQuery}
        onChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  headerRight: { flex: 1, alignItems: 'flex-end' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },

  // ── Tabs strip
  tabsScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    maxHeight: 50,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  tabChipTextActive: { color: '#fff' },

  // ── Scroll areas
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
  sectionHeaderRight: { flex: 1, alignItems: 'flex-end' },
  sectionHeaderLeft: { alignItems: 'flex-start' },
  sectionTitle: {
    fontSize: 17,
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
  sectionAction: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },

  // ── Events grid
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // ── Event Card
  eventCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  eventCardPast: { opacity: 0.45 },
  eventCardHeader: {
    height: 100,
    justifyContent: 'flex-end',
    padding: 8,
  },
  eventCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rsvpBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rsvpBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  eventCardBody: {
    padding: 10,
    gap: 4,
    alignItems: 'flex-end',
  },
  eventCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  eventCardDate: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
  },
  eventCardLocation: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
  },

  // ── RSVP buttons
  rsvpButtons: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    justifyContent: 'flex-end',
  },
  rsvpBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rsvpBtnText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },

  // ── See more
  seeMoreBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  seeMoreText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },

  // ── Task list
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
  taskTitle: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  taskDue: {
    fontSize: 11,
    color: '#9ca3af',
    minWidth: 36,
    textAlign: 'left',
  },

  // ── Events tab list
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
  pastEventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 12,
    opacity: 0.45,
  },
  eventRowLeft: { alignItems: 'center', gap: 4, minWidth: 48 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventRowDate: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  eventRowContent: { flex: 1, alignItems: 'flex-end', gap: 4 },
  eventRowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
  },
  eventRowLocation: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  pastBadge: {
    backgroundColor: '#94a3b8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pastBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  textFaded: { color: '#9ca3af' },

  // ── Empty states
  emptySmall: {
    paddingVertical: 16,
    alignItems: 'flex-end',
  },
  emptySmallText: { fontSize: 13, color: '#9ca3af', textAlign: 'right' },
  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },

  // ── FAB
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    alignItems: 'flex-start',
    gap: 10,
  },
  fabBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabOpen: { backgroundColor: '#374151' },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  fabMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabMenuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    textAlign: 'right',
  },

  // ── Overflow popover
  popoverBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  popover: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 210,
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
  popoverLabel: { fontSize: 15, color: '#374151', textAlign: 'right', flex: 1 },
  popoverDanger: { color: '#ef4444' },

  // ── Search modal
  searchBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
});
