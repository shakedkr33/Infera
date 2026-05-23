import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MainScreenHeader } from '@/components/MainScreenHeader';
import { useNotifications } from '@/contexts/NotificationsContext';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { NotificationsDrawer } from '@/lib/components/notifications/NotificationsDrawer';

const PRIMARY_BLUE = '#36a9e2';

type Task = {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  dueDate?: number;
  createdAt?: number;
  completedAt?: number;
  updatedAt?: number;
  isUrgent?: boolean;
  subtasks?: {
    id: string;
    title: string;
    completed: boolean;
  }[];
};

type AssignedEventTask = {
  id: string;
  title: string;
  completed: boolean;
  eventTitle: string;
  eventStartTime: number;
  eventAllDay: boolean;
  communityName: string;
};

type ImportantItemTask = {
  id: string;
  title: string;
  completed: boolean;
  eventTitle: string;
  eventStartTime: number;
  eventAllDay: boolean;
  communityName: string;
};

type AnyTask =
  | ({ kind: 'personal'; effectiveDate?: number } & Task)
  | ({ kind: 'event'; effectiveDate: number } & AssignedEventTask)
  | ({ kind: 'important'; effectiveDate: number } & ImportantItemTask);

type Bucket = 'overdue' | 'today' | 'upcoming' | 'undated' | 'completed';

function formatEventTaskDate(timestamp: number, allDay: boolean): string {
  const date = new Date(timestamp);
  const dateText = date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
  });
  if (allDay) return `${dateText} · כל היום`;
  const timeText = date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateText} · ${timeText}`;
}

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'עבר המועד',
  today: 'היום',
  upcoming: 'בהמשך',
  undated: 'ללא תאריך',
  completed: 'בוצעו',
};

const BUCKET_ORDER: Bucket[] = [
  'overdue',
  'today',
  'upcoming',
  'undated',
  'completed',
];

function getTaskBucket(
  effectiveDate: number | undefined,
  completed: boolean
): Bucket {
  if (completed) return 'completed';
  if (effectiveDate === undefined) return 'undated';
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (effectiveDate < todayStart.getTime()) return 'overdue';
  if (effectiveDate <= todayEnd.getTime()) return 'today';
  return 'upcoming';
}

function getTaskSortValue(task: AnyTask, bucket: Bucket): number {
  switch (bucket) {
    case 'overdue':
      return task.effectiveDate ?? 0;
    case 'today':
    case 'upcoming':
      return task.effectiveDate ?? Number.MAX_SAFE_INTEGER;
    case 'undated':
      if (task.kind === 'personal') {
        return task.updatedAt ?? task.createdAt ?? 0;
      }
      return 0;
    case 'completed':
      if (task.kind === 'personal') {
        return task.completedAt ?? task.updatedAt ?? task.createdAt ?? 0;
      }
      return task.effectiveDate ?? 0;
  }
}

/* MOCK_TASKS – הוסר, נתונים מגיעים מ-Convex:
const MOCK_TASKS: Task[] = [
  { id: '1', title: 'לקבוע תור לרופא ילדים', category: 'אישי', isUrgent: true, isOverdue: true, completed: false },
  { id: '2', title: 'קניית מצרכים לשבת', category: 'אישי', completed: false, subtasks: [...] },
  { id: '3', title: 'סידור הבית לאורחים', category: 'אישי', completed: true },
  { id: '4', title: 'שליחת דוח חודשי', category: 'עבודה', completed: true },
];
*/

export default function TasksScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('הכל');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const {
    unseenCount,
    markAllSeen,
    isLoading: notificationsLoading,
  } = useNotifications();

  const handleBellPress = (): void => {
    if (!isNotificationsOpen) {
      setIsNotificationsOpen(true);
    }
    if (!notificationsLoading) {
      markAllSeen();
    }
  };

  // ── Convex: spaceId ──────────────────────────────────────────────────────
  // TODO: כאשר defaultSpaceId ייאכלס ב-onboarding, לעבור לשליפה ישירה מ-user.defaultSpaceId
  // getMySpace מחזיר את ה-spaceId ישירות (Id<'spaces'> | null)
  const spaceId = useQuery(api.users.getMySpace);

  // ── Convex: tasks queries ────────────────────────────────────────────────
  const convexTasks = useQuery(
    api.tasks.listBySpace,
    spaceId ? { spaceId: spaceId as Id<'spaces'> } : 'skip'
  );
  const convexUndated = useQuery(
    api.tasks.listUndated,
    spaceId ? { spaceId: spaceId as Id<'spaces'> } : 'skip'
  );
  const eventTaskRange = useMemo(() => {
    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 90);
    toDate.setHours(23, 59, 59, 999);
    return { from: fromDate.getTime(), to: toDate.getTime() };
  }, []);
  const assignedEventTaskRows = useQuery(
    api.eventTasks.listMyAssignedEventTasks,
    eventTaskRange
  );
  const importantItemTaskRows = useQuery(
    api.tasks.listMyImportantItemTasks,
    {}
  );

  // ממיר נתוני Convex לפורמט Task המקומי
  const allConvexTasks: Task[] = useMemo(() => {
    const mapTask = (t: NonNullable<typeof convexTasks>[number]): Task => ({
      id: t._id,
      title: t.title,
      category: t.category ?? 'אישי',
      completed: t.completed,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      updatedAt: t.updatedAt,
    });
    return [
      ...(convexTasks ?? []).map(mapTask),
      ...(convexUndated ?? []).map(mapTask),
    ];
  }, [convexTasks, convexUndated]);

  // ── Convex: mutations ────────────────────────────────────────────────────
  const toggleCompletedMutation = useMutation(api.tasks.toggleCompleted);
  const toggleEventTaskMutation = useMutation(api.eventTasks.toggleCompleted);
  const removeTaskMutation = useMutation(api.tasks.remove);

  const filters = ['הכל', 'אישי', 'אירועים'];

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // subtasks הם local-only עד שנוסיף subtasks לסכמת Convex
  // TODO: לחבר subtask toggle ל-Convex כשנוסיף שדה subtasks לטבלת tasks
  const toggleSubtask = (_taskId: string, _subtaskId: string) => {
    // TODO: לממש עם mutation כשיהיו subtasks ב-Convex
    console.log('toggleSubtask: not yet connected to Convex');
  };

  const toggleTaskCompletion = async (taskId: string) => {
    try {
      await toggleCompletedMutation({ id: taskId as Id<'tasks'> });
    } catch (e) {
      console.error('toggleTaskCompletion error:', e);
      // TODO: להוסיף optimistic UI בעתיד
    }
  };

  const _handleDeleteTask = async (taskId: string) => {
    try {
      await removeTaskMutation({ id: taskId as Id<'tasks'> });
    } catch (e) {
      console.error('handleDeleteTask error:', e);
    }
  };

  // ===== בניית רשימה מאוחדת + סינון =====
  const assignedEventTasks: AssignedEventTask[] = useMemo(
    () =>
      (assignedEventTaskRows ?? []).map((task) => ({
        id: task._id,
        title: task.title,
        completed: task.completed,
        eventTitle: task.eventTitle,
        eventStartTime: task.eventStartTime,
        eventAllDay: task.eventAllDay,
        communityName: task.communityName,
      })),
    [assignedEventTaskRows]
  );

  const importantItemTasks: ImportantItemTask[] = useMemo(
    () =>
      (importantItemTaskRows ?? []).map((task) => ({
        id: task._id,
        title: task.title,
        completed: task.completed,
        eventTitle: task.eventTitle,
        eventStartTime: task.eventStartTime,
        eventAllDay: task.eventAllDay,
        communityName: task.communityName,
      })),
    [importantItemTaskRows]
  );

  // Unified list: personal + event + important-item
  const allTasks: AnyTask[] = useMemo(
    () => [
      ...allConvexTasks.map(
        (t): AnyTask => ({
          kind: 'personal',
          ...t,
          effectiveDate: t.dueDate,
        })
      ),
      ...assignedEventTasks.map(
        (t): AnyTask => ({
          kind: 'event',
          ...t,
          effectiveDate: t.eventStartTime,
        })
      ),
      ...importantItemTasks.map(
        (t): AnyTask => ({
          kind: 'important',
          ...t,
          effectiveDate: t.eventStartTime,
        })
      ),
    ],
    [allConvexTasks, assignedEventTasks, importantItemTasks]
  );

  // Filter by active filter chip + search query
  const filteredAllTasks = useMemo(() => {
    const search = searchQuery.toLowerCase();
    return allTasks.filter((task) => {
      // category / kind filter
      let matchesFilter: boolean;
      if (activeFilter === 'הכל') {
        matchesFilter = true;
      } else if (activeFilter === 'אירועים') {
        matchesFilter = task.kind === 'event' || task.kind === 'important';
      } else {
        // "אישי" or any explicit category
        matchesFilter =
          task.kind === 'personal' && task.category === activeFilter;
      }
      if (!matchesFilter) return false;

      // text search
      if (!search) return true;
      if (task.title.toLowerCase().includes(search)) return true;
      if (task.kind === 'event' || task.kind === 'important') {
        return (
          task.eventTitle.toLowerCase().includes(search) ||
          task.communityName.toLowerCase().includes(search)
        );
      }
      return false;
    });
  }, [allTasks, activeFilter, searchQuery]);

  // Group into 5 buckets and sort each
  const buckets = useMemo((): Record<Bucket, AnyTask[]> => {
    const groups: Record<Bucket, AnyTask[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      undated: [],
      completed: [],
    };
    for (const task of filteredAllTasks) {
      groups[getTaskBucket(task.effectiveDate, task.completed)].push(task);
    }
    for (const bucket of BUCKET_ORDER) {
      const isDesc =
        bucket === 'overdue' || bucket === 'undated' || bucket === 'completed';
      groups[bucket].sort((a, b) => {
        const av = getTaskSortValue(a, bucket);
        const bv = getTaskSortValue(b, bucket);
        return isDesc ? bv - av : av - bv;
      });
    }
    return groups;
  }, [filteredAllTasks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSurface}>
          <MainScreenHeader
            title="המשימות שלי"
            showAdd={true}
            onAdd={() => router.push('/(authenticated)/task/new' as never)}
            onNotificationsPress={handleBellPress}
            notificationsCount={unseenCount}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialIcons
              name="search"
              size={20}
              color="#637588"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="חיפוש משימה..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <Pressable
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tasks List */}
        <ScrollView
          style={styles.tasksScrollView}
          showsVerticalScrollIndicator={false}
        >
          {BUCKET_ORDER.map((bucket) => {
            const tasks = buckets[bucket];
            if (tasks.length === 0) return null;
            const isOverdueBucket = bucket === 'overdue';
            return (
              <View key={bucket} style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    isOverdueBucket && styles.sectionTitleOverdue,
                  ]}
                >
                  {BUCKET_LABELS[bucket]}
                </Text>
                {tasks.map((task) => {
                  if (task.kind === 'event') {
                    return (
                      <EventTaskCard
                        key={task.id}
                        task={task}
                        isOverdue={isOverdueBucket}
                        onToggle={async () => {
                          try {
                            await toggleEventTaskMutation({
                              id: task.id as Id<'eventTasks'>,
                            });
                          } catch {
                            // silently ignore
                          }
                        }}
                      />
                    );
                  }
                  if (task.kind === 'important') {
                    return (
                      <ImportantItemTaskCard
                        key={task.id}
                        task={task}
                        isOverdue={isOverdueBucket}
                        onToggle={async () => {
                          try {
                            await toggleCompletedMutation({
                              id: task.id as Id<'tasks'>,
                            });
                          } catch {
                            // silently ignore
                          }
                        }}
                      />
                    );
                  }
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdueBucket}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpansion={() => toggleTaskExpansion(task.id)}
                      onToggleSubtask={(subtaskId) =>
                        toggleSubtask(task.id, subtaskId)
                      }
                      onToggleCompletion={() => toggleTaskCompletion(task.id)}
                      onPress={() =>
                        router.push(`/(authenticated)/task/${task.id}` as never)
                      }
                    />
                  );
                })}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        direction="rtl"
      />
    </SafeAreaView>
  );
}

// ===== Task Card Component =====
function TaskCard({
  task,
  isExpanded,
  isOverdue,
  onToggleExpansion,
  onToggleSubtask,
  onToggleCompletion,
  onPress,
}: {
  task: Task;
  isExpanded: boolean;
  isOverdue?: boolean;
  onToggleExpansion: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onToggleCompletion: () => void;
  onPress: () => void;
}) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks =
    task.subtasks?.filter((st) => st.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.taskCard,
        task.isUrgent && styles.taskCardUrgent,
        task.completed && styles.taskCardCompleted,
        isOverdue && !task.completed && styles.taskCardOverdue,
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`משימה: ${task.title}`}
    >
      <View style={styles.taskCardHeader}>
        {/* Checkbox */}
        <Pressable
          style={styles.checkbox}
          onPress={onToggleCompletion}
          accessible={true}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
        >
          {task.completed ? (
            <MaterialIcons name="check-circle" size={24} color={PRIMARY_BLUE} />
          ) : (
            <View
              style={[
                styles.checkboxEmpty,
                task.isUrgent && styles.checkboxUrgent,
              ]}
            />
          )}
        </Pressable>

        {/* Task Content */}
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              task.isUrgent && styles.taskTitleUrgent,
              task.completed && styles.taskTitleCompleted,
            ]}
          >
            {task.title}
          </Text>

          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{task.category}</Text>
            </View>
          </View>

          {/* Subtasks Progress */}
          {hasSubtasks && !task.completed && (
            <View style={styles.subtasksProgress}>
              <Text style={styles.subtasksProgressText}>
                {completedSubtasks} מתוך {totalSubtasks} הושלמו
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {/* Expand Button */}
        {hasSubtasks && !task.completed && (
          <Pressable
            style={styles.expandButton}
            onPress={onToggleExpansion}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'כווץ' : 'הרחב'}
          >
            <MaterialIcons
              name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color="#637588"
            />
          </Pressable>
        )}
      </View>

      {/* Subtasks List (Expanded) */}
      {isExpanded && hasSubtasks && task.subtasks && (
        <View style={styles.subtasksList}>
          {task.subtasks.map((subtask) => (
            <Pressable
              key={subtask.id}
              style={styles.subtaskItem}
              onPress={() => onToggleSubtask(subtask.id)}
              accessible={true}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: subtask.completed }}
            >
              <View
                style={[
                  styles.subtaskCheckbox,
                  subtask.completed && styles.subtaskCheckboxChecked,
                ]}
              >
                {subtask.completed && (
                  <MaterialIcons name="check" size={14} color="#ffffff" />
                )}
              </View>
              <Text
                style={[
                  styles.subtaskText,
                  subtask.completed && styles.subtaskTextCompleted,
                ]}
              >
                {subtask.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function EventTaskCard({
  task,
  isOverdue,
  onToggle,
}: {
  task: AssignedEventTask;
  isOverdue?: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={[
        styles.taskCard,
        task.completed && styles.taskCardCompleted,
        isOverdue && !task.completed && styles.taskCardOverdue,
      ]}
      accessible={true}
      accessibilityLabel={`משימת אירוע: ${task.title}`}
    >
      <View style={styles.taskCardHeader}>
        <Pressable
          style={styles.checkbox}
          onPress={onToggle}
          accessible={true}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          accessibilityLabel={task.completed ? 'בוטל סימון' : 'סמן כהושלם'}
        >
          {task.completed ? (
            <MaterialIcons name="check-circle" size={24} color={PRIMARY_BLUE} />
          ) : (
            <View style={styles.checkboxEmpty} />
          )}
        </Pressable>
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              task.completed && styles.taskTitleCompleted,
            ]}
          >
            {task.title}
          </Text>
          <Text style={styles.eventTaskMeta} numberOfLines={1}>
            {task.eventTitle}
          </Text>
          <Text style={styles.eventTaskMeta} numberOfLines={1}>
            {formatEventTaskDate(task.eventStartTime, task.eventAllDay)}
          </Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tag, styles.eventTaskTag]}>
              <Text style={styles.eventTaskTagText}>משימת אירוע</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{task.communityName}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ImportantItemTaskCard({
  task,
  isOverdue,
  onToggle,
}: {
  task: ImportantItemTask;
  isOverdue?: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={[
        styles.taskCard,
        task.completed && styles.taskCardCompleted,
        isOverdue && !task.completed && styles.taskCardOverdue,
      ]}
      accessible={true}
      accessibilityLabel={`חשוב לזכור: ${task.title}`}
    >
      <View style={styles.taskCardHeader}>
        <Pressable
          style={styles.checkbox}
          onPress={onToggle}
          accessible={true}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          accessibilityLabel={task.completed ? 'בוטל סימון' : 'סמן כהושלם'}
        >
          {task.completed ? (
            <MaterialIcons name="check-circle" size={24} color={PRIMARY_BLUE} />
          ) : (
            <View style={styles.checkboxEmpty} />
          )}
        </Pressable>
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              task.completed && styles.taskTitleCompleted,
            ]}
          >
            {task.title}
          </Text>
          <Text style={styles.eventTaskMeta} numberOfLines={1}>
            {task.eventTitle}
          </Text>
          <Text style={styles.eventTaskMeta} numberOfLines={1}>
            {formatEventTaskDate(task.eventStartTime, task.eventAllDay)}
          </Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tag, styles.importantItemTag]}>
              <Text style={styles.importantItemTagText}>חשוב לזכור</Text>
            </View>
            {task.communityName ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{task.communityName}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f7f8',
    direction: 'rtl',
  },

  /* Header */
  headerSurface: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111418',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_BLUE,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  /* Search */
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f6f7f8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111418',
    textAlign: 'right',
  },

  /* Filters */
  filtersContainer: {
    backgroundColor: '#ffffff',
    height: 55, // 👈 זה ימנע מהם להימתח על חצי מסך!
    flexGrow: 0, // 👈 זה מבטיח שהקונטיינר לא יגדל מעבר ל-55 פיקסלים
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filtersContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
    flexDirection: 'row-reverse', // RTL
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: PRIMARY_BLUE,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#637588',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  /* Tasks */
  tasksScrollView: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111418',
    marginBottom: 12,
    textAlign: 'right',
  },
  sectionTitleOverdue: {
    color: '#D97706',
  },

  /* Task Card */
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  taskCardUrgent: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  taskCardCompleted: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  taskCardOverdue: {
    backgroundColor: '#FFFBF0',
    borderRightWidth: 3,
    borderRightColor: '#FDE68A',
  },
  taskCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },

  /* Checkbox */
  checkbox: {
    marginLeft: 12,
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  checkboxUrgent: {
    borderColor: '#ef4444',
  },
  eventTaskIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  /* Task Content */
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111418',
    marginBottom: 8,
    textAlign: 'right',
  },
  taskTitleUrgent: {
    color: '#ef4444',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  eventTaskMeta: {
    fontSize: 13,
    color: '#637588',
    textAlign: 'right',
    marginBottom: 4,
  },

  /* Tags */
  tagsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  tagOverdue: {
    backgroundColor: '#fee2e2',
  },
  eventTaskTag: {
    backgroundColor: '#E8F5FD',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#637588',
  },
  eventTaskTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_BLUE,
  },
  importantItemTag: {
    backgroundColor: '#FEF3C7',
  },
  importantItemTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  tagTextOverdue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },

  /* Subtasks Progress */
  subtasksProgress: {
    marginTop: 4,
  },
  subtasksProgressText: {
    fontSize: 13,
    color: '#637588',
    marginBottom: 6,
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 3,
  },

  /* Expand Button */
  expandButton: {
    marginLeft: 8,
  },

  /* Subtasks List */
  subtasksList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  subtaskItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 4,
  },
  subtaskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  subtaskCheckboxChecked: {
    backgroundColor: PRIMARY_BLUE,
    borderColor: PRIMARY_BLUE,
  },
  subtaskText: {
    fontSize: 14,
    color: '#111418',
    textAlign: 'right',
  },
  subtaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
});
