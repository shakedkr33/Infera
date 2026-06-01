import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getAvatarInitials } from '@/lib/avatarInitials';
import { TASK_CATEGORY_LABELS } from '@/lib/types/task';

// ─── RTL helpers (same pattern as EventDetailsBottomSheet) ────────────────────

const _isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const isAndroidExpoGo = Platform.OS === 'android' && _isExpoGo;
const shouldSupplyInvertedRtlValues = isAndroidExpoGo || I18nManager.isRTL;
const HEB_TEXT_ALIGN: 'left' | 'right' = shouldSupplyInvertedRtlValues
  ? 'left'
  : 'right';
const HEB_ROW: 'row' | 'row-reverse' = shouldSupplyInvertedRtlValues
  ? 'row'
  : 'row-reverse';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number, hasTime?: boolean): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (hasTime) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  }
  return `${day}/${month}/${year}`;
}

function getCategoryLabel(category?: string | null): string | null {
  if (!category) return null;
  if (category in TASK_CATEGORY_LABELS) {
    return TASK_CATEGORY_LABELS[category as keyof typeof TASK_CATEGORY_LABELS];
  }
  // If it's already a Hebrew UI label (community/event), show as-is but filter noisy values
  if (category === 'קהילות' || category === 'אירועי יומן') return category;
  return null;
}

function tomorrowMs(
  currentDueDate?: number | null,
  hasTime?: boolean | null
): number {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  if (hasTime && currentDueDate) {
    const existing = new Date(currentDueDate);
    tomorrow.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
  } else {
    tomorrow.setHours(8, 0, 0, 0);
  }
  return tomorrow.getTime();
}

// ─── Avatar Circle ────────────────────────────────────────────────────────────

function AvatarCircle({
  name,
  color,
  size = 26,
}: {
  name: string;
  color: string | null;
  size?: number;
}): React.JSX.Element {
  const initial = getAvatarInitials(name);
  const bg = color ?? '#36a9e2';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={s.detailRow}>
      <MaterialIcons
        name={icon as never}
        size={18}
        color="#94a3b8"
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onPress,
  variant = 'default',
}: {
  icon: string;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger';
}): React.JSX.Element {
  const bgMap = {
    default: '#f1f5f9',
    primary: '#36a9e2',
    danger: '#fff1f2',
  };
  const colorMap = {
    default: '#334155',
    primary: '#fff',
    danger: '#ef4444',
  };
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.actionBtn,
        { backgroundColor: bgMap[variant], opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <MaterialIcons name={icon as never} size={18} color={colorMap[variant]} />
      <Text style={[s.actionBtnLabel, { color: colorMap[variant] }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Assignment Section ───────────────────────────────────────────────────────
// Shows:
//   • "נוצרה ע״י [name]"  — only when viewer is NOT the creator
//   • "משויך ל: [names]"  — when assignees exist
//   • "משימה אישית"       — when no assignees

function AssignmentSection({
  creatorProfile,
  currentUserIsCreator,
  assignees,
  currentUserId,
}: {
  creatorProfile: { id: string; name: string; color: string | null } | null;
  currentUserIsCreator: boolean;
  assignees: { id: string; name: string; color: string | null }[];
  currentUserId: string | null;
}): React.JSX.Element {
  const visibleAssignees = assignees.filter(
    (a) => a.id !== currentUserId && a.name.trim().length > 0
  );

  return (
    <>
      {/* "נוצרה ע״י" — shown only to non-creator viewers */}
      {!currentUserIsCreator && creatorProfile ? (
        <DetailRow icon="person-outline">
          <View style={[s.inlineRow, { flexDirection: HEB_ROW }]}>
            <AvatarCircle
              name={creatorProfile.name}
              color={creatorProfile.color}
            />
            <Text style={[s.detailText, { textAlign: HEB_TEXT_ALIGN }]}>
              {`נוצרה ע״י ${creatorProfile.name}`}
            </Text>
          </View>
        </DetailRow>
      ) : null}

      {/* "משויך ל" — shown only when there are visible (non-viewer) assignees */}
      {visibleAssignees.length > 0 ? (
        <DetailRow icon="people">
          <View
            style={[
              s.inlineRow,
              { flexDirection: HEB_ROW, flexWrap: 'wrap', gap: 6 },
            ]}
          >
            {visibleAssignees.map((a) => (
              <AvatarCircle key={a.id} name={a.name} color={a.color} />
            ))}
            <Text style={[s.detailText, { textAlign: HEB_TEXT_ALIGN }]}>
              {`משויך ל: ${visibleAssignees.map((a) => a.name).join(', ')}`}
            </Text>
          </View>
        </DetailRow>
      ) : null}
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TaskDetailsBottomSheetProps {
  taskId: string | null;
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskDetailsBottomSheet({
  taskId,
  visible,
  onClose,
}: TaskDetailsBottomSheetProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 28,
        stiffness: 130,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const task = useQuery(
    api.tasks.getTaskDetails,
    taskId ? { id: taskId as Id<'tasks'> } : 'skip'
  );
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const updateTask = useMutation(api.tasks.update);
  const softDelete = useMutation(api.tasks.softDeleteTask);

  const handleToggle = useCallback(async () => {
    if (!task) return;
    await toggleCompleted({ id: task._id });
  }, [task, toggleCompleted]);

  const handlePostpone = useCallback(async () => {
    if (!task) return;
    const newDue = tomorrowMs(task.dueDate ?? task.dueAt, task.hasTime);
    await updateTask({
      id: task._id,
      dueDate: newDue,
      ...(task.hasTime ? { hasTime: true, dueAt: newDue } : {}),
    });
  }, [task, updateTask]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    onClose();
    await softDelete({ id: task._id });
  }, [task, softDelete, onClose]);

  const handleEdit = useCallback(() => {
    if (!taskId) return;
    onClose();
    router.push({
      pathname: '/(authenticated)/task/[id]',
      params: { id: taskId },
    } as never);
  }, [taskId, router, onClose]);

  if (!visible) return null;

  const isEditable =
    task &&
    !task.communityId &&
    !task.sourceEventId &&
    task.sourceType !== 'community_event_important_item' &&
    task.category !== 'קהילות' &&
    task.category !== 'אירועי יומן';

  const isDeletable = !!isEditable && task.assignees.length === 0;

  const dueTs = task?.dueAt ?? task?.dueDate;
  const categoryLabel = task ? getCategoryLabel(task.category) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            {
              height: SHEET_HEIGHT,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {task === undefined ? (
            <View style={s.center}>
              <ActivityIndicator color="#36a9e2" />
            </View>
          ) : task === null ? (
            <View style={s.center}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>
                המשימה לא נמצאה
              </Text>
            </View>
          ) : (
            /* flex: 1 so ScrollView + sticky footer fill remaining sheet height */
            <View style={s.sheetBody}>
              {/* ── Header: title + edit + close ── */}
              <View style={[s.header, { flexDirection: HEB_ROW }]}>
                {/* Close (X) button — left side in RTL = physical right */}
                <Pressable
                  onPress={onClose}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="סגור"
                  style={s.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={22} color="#64748b" />
                </Pressable>

                <Text
                  style={[s.title, { textAlign: HEB_TEXT_ALIGN, flex: 1 }]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {isEditable ? (
                  <Pressable
                    onPress={handleEdit}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="עריכת משימה"
                    style={s.editBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialIcons name="edit" size={16} color="#36a9e2" />
                    <Text style={s.editBtnLabel}>עריכה</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Status badge */}
              <View
                style={[
                  s.badgeRow,
                  { flexDirection: HEB_ROW, justifyContent: 'flex-end' },
                ]}
              >
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: task.completed ? '#dcfce7' : '#fef3c7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.badgeText,
                      { color: task.completed ? '#16a34a' : '#d97706' },
                    ]}
                  >
                    {task.completed ? 'בוצע ✓' : 'לביצוע'}
                  </Text>
                </View>
              </View>

              {/* ── Scrollable content ── */}
              <ScrollView
                style={s.detailsScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                <View style={s.detailsCard}>
                  {/* Due date */}
                  {dueTs ? (
                    <DetailRow icon="event">
                      <Text
                        style={[s.detailText, { textAlign: HEB_TEXT_ALIGN }]}
                      >
                        {formatDate(dueTs, task.hasTime)}
                      </Text>
                    </DetailRow>
                  ) : null}

                  {/* Category (Hebrew only) */}
                  {categoryLabel ? (
                    <DetailRow icon="label-outline">
                      <Text
                        style={[s.detailText, { textAlign: HEB_TEXT_ALIGN }]}
                      >
                        {categoryLabel}
                      </Text>
                    </DetailRow>
                  ) : null}

                  {/* Creator + assignees */}
                  <AssignmentSection
                    creatorProfile={task.creatorProfile ?? null}
                    currentUserIsCreator={task.currentUserIsCreator}
                    assignees={task.assignees}
                    currentUserId={task.currentUserId ?? null}
                  />

                  {/* Notes */}
                  {task.description ? (
                    <DetailRow icon="notes">
                      <Text
                        style={[
                          s.detailText,
                          { textAlign: HEB_TEXT_ALIGN, lineHeight: 20 },
                        ]}
                      >
                        {task.description}
                      </Text>
                    </DetailRow>
                  ) : null}
                </View>

                {/* Subtasks — simple list, no toggleable circles */}
                {task.subtasks && task.subtasks.length > 0 ? (
                  <View style={s.subtasksCard}>
                    <Text
                      style={[s.subtasksHeader, { textAlign: HEB_TEXT_ALIGN }]}
                    >
                      {`תתי־משימות (${task.subtasks.filter((sub) => sub.completed).length}/${task.subtasks.length})`}
                    </Text>
                    {task.subtasks.map((sub) => (
                      <View
                        key={sub.id}
                        style={[s.subtaskRow, { flexDirection: HEB_ROW }]}
                      >
                        <Text
                          style={[
                            s.subtaskBullet,
                            { color: sub.completed ? '#22c55e' : '#cbd5e1' },
                          ]}
                        >
                          {sub.completed ? '✓' : '–'}
                        </Text>
                        <Text
                          style={[
                            s.subtaskText,
                            {
                              textAlign: HEB_TEXT_ALIGN,
                              color: sub.completed ? '#94a3b8' : '#334155',
                              textDecorationLine: sub.completed
                                ? 'line-through'
                                : 'none',
                            },
                          ]}
                        >
                          {sub.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              {/* ── Sticky footer: quick actions ── */}
              <View
                style={[
                  s.actions,
                  {
                    flexDirection: HEB_ROW,
                    paddingBottom: Math.max(insets.bottom, 16),
                  },
                ]}
              >
                <ActionBtn
                  icon="update"
                  label="דחה למחר"
                  onPress={handlePostpone}
                />
                <ActionBtn
                  icon={task.completed ? 'undo' : 'check-circle-outline'}
                  label={task.completed ? 'בטל סימון' : 'סמן כבוצע'}
                  variant="primary"
                  onPress={handleToggle}
                />
                {isDeletable ? (
                  <ActionBtn
                    icon="delete-outline"
                    label="מחק"
                    variant="danger"
                    onPress={handleDelete}
                  />
                ) : null}
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  handleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { flex: 1 },

  closeBtn: {
    padding: 4,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },

  header: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111418',
    lineHeight: 26,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    minHeight: 36,
  },
  editBtnLabel: { fontSize: 14, fontWeight: '600', color: '#36a9e2' },

  badgeRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  detailsScroll: { flex: 1, paddingHorizontal: 16 },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4f8',
  },
  detailText: { fontSize: 14, color: '#475569' },
  inlineRow: {
    alignItems: 'center',
    gap: 8,
  },

  subtasksCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  subtasksHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subtaskRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  subtaskBullet: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 14,
    textAlign: 'center',
  },
  subtaskText: { flex: 1, fontSize: 14 },

  actions: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    justifyContent: 'flex-start',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 60,
  },
  actionBtnLabel: { fontSize: 12, fontWeight: '600' },
});
