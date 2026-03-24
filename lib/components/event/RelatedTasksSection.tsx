import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { EventTask, Participant } from '@/lib/types/event';

const PRIMARY = '#36a9e2';
const TINT = '#e8f5fd';

interface RelatedTasksSectionProps {
  tasks: EventTask[];
  participants: Participant[];
  completedCount: number;
  showAllTasksToAll: boolean;
  showToggle: boolean;
  onChange: (tasks: EventTask[]) => void;
  onToggleVisibility: (val: boolean) => void;
  /** Called when user taps "הוסף" in the no-participants state of the assign sheet */
  onAddParticipants?: () => void;
}

export function RelatedTasksSection({
  tasks,
  participants,
  completedCount,
  showAllTasksToAll,
  showToggle,
  onChange,
  onToggleVisibility,
  onAddParticipants,
}: RelatedTasksSectionProps): React.JSX.Element {
  // ── Assign sheet state ────────────────────────────────────────────────────
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [draftSelected, setDraftSelected] = useState<string[]>([]);

  const openAssignSheet = (task: EventTask): void => {
    setDraftSelected(task.assignedParticipantIds ?? []);
    setAssigningTaskId(task.id);
  };

  const closeAssignSheet = (): void => setAssigningTaskId(null);

  const toggleParticipantDraft = (pid: string): void => {
    setDraftSelected((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const saveAssignment = (): void => {
    const updated = tasks.map((t) =>
      t.id === assigningTaskId
        ? { ...t, assignedParticipantIds: draftSelected }
        : t
    );
    onChange(updated);
    closeAssignSheet();
  };

  // ── Task actions ──────────────────────────────────────────────────────────
  const toggleTask = (taskId: string): void => {
    onChange(tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (taskId: string): void => {
    onChange(tasks.filter((t) => t.id !== taskId));
  };

  const addTask = (): void => {
    Alert.prompt(
      'משימה חדשה',
      'הכנס שם המשימה',
      (text) => {
        if (text == null || text.trim() === '') return;
        const newTask: EventTask = {
          id: Date.now().toString(),
          title: text.trim(),
          completed: false,
        };
        onChange([...tasks, newTask]);
      },
      'plain-text',
      '',
      'default'
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Returns resolved Participant objects for a task's assignedParticipantIds */
  const resolveAssignees = (task: EventTask): Participant[] => {
    if (!task.assignedParticipantIds?.length) return [];
    return task.assignedParticipantIds
      .map((id) => participants.find((p) => p.id === id))
      .filter((p): p is Participant => p != null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderAssigneeAvatars = (task: EventTask): React.ReactNode => {
    const assignees = resolveAssignees(task);
    if (assignees.length === 0) return null;
    const visible = assignees.slice(0, 3);
    return (
      <View style={s.avatarsRow}>
        {visible.map((p) => (
          <View key={p.id} style={s.miniAvatar}>
            <Text style={s.miniAvatarText}>
              {(p.name.trim() || '?')[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        ))}
        {assignees.length > 3 && (
          <Text style={s.avatarCount}>+{assignees.length - 3}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={s.section}>
      {/* ── Header ── */}
      <View style={s.headerRow}>
        <View style={s.headerContent}>
          <Text style={s.label}>משימות קשורות</Text>
          <Text style={s.progressText}>
            {completedCount} מתוך {tasks.length} הושלמו
          </Text>
        </View>
        <View style={[s.iconCircle, { backgroundColor: TINT }]}>
          <MaterialIcons name="checklist" size={20} color={PRIMARY} />
        </View>
      </View>

      {/* ── Progress Bar ── */}
      {tasks.length > 0 && (
        <View style={s.progressBar}>
          <View
            style={[
              s.progressFill,
              { width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` },
            ]}
          />
        </View>
      )}

      {/* ── Task List ── */}
      {tasks.map((task) => (
        <View key={task.id} style={s.taskRow}>
          {/* Checkbox + title */}
          <Pressable
            onPress={() => toggleTask(task.id)}
            style={s.taskCheckArea}
            accessible={true}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            accessibilityLabel={task.title}
          >
            <View style={[s.checkbox, task.completed && s.checkboxDone]}>
              {task.completed && (
                <MaterialIcons name="check" size={14} color="#fff" />
              )}
            </View>
            <Text
              style={[s.taskTitle, task.completed && s.taskTitleDone]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            {task.colorDot != null && (
              <View style={[s.colorDot, { backgroundColor: task.colorDot }]} />
            )}
            {/* Compact assignee avatars */}
            {renderAssigneeAvatars(task)}
          </Pressable>

          {/* "הקצה" button */}
          <Pressable
            onPress={() => openAssignSheet(task)}
            style={s.assignBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`הקצה משימה: ${task.title}`}
            hitSlop={6}
          >
            <Text style={s.assignBtnText}>הקצה</Text>
          </Pressable>

          {/* Delete */}
          <Pressable
            onPress={() => deleteTask(task.id)}
            style={s.deleteBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`מחק משימה: ${task.title}`}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={16} color="#94a3b8" />
          </Pressable>
        </View>
      ))}

      {/* ── Add Task ── */}
      <Pressable
        style={s.addTaskRow}
        onPress={addTask}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="הוסף משימה חדשה"
      >
        <MaterialIcons name="add" size={18} color="#94a3b8" />
        <Text style={s.addTaskText}>הוסף משימה חדשה</Text>
      </Pressable>

      {/* ── Visibility Toggle ── */}
      {showToggle && (
        <View style={s.visibilityRow}>
          <Text style={s.visibilityText}>הצג את כל המשימות לכל המשתתפים</Text>
          <Switch
            value={showAllTasksToAll}
            onValueChange={onToggleVisibility}
            trackColor={{ true: PRIMARY, false: '#e2e8f0' }}
            thumbColor="#fff"
            accessible={true}
            accessibilityLabel="הצג משימות לכולם"
          />
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Task Assignment Bottom Sheet
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={assigningTaskId != null}
        transparent
        animationType="slide"
        onRequestClose={closeAssignSheet}
      >
        <Pressable style={s.sheetOverlay} onPress={closeAssignSheet} accessible={false}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            {/* Handle */}
            <View style={s.sheetHandle} />

            {/* Title */}
            <Text style={s.sheetTitle}>הקצאת משימה</Text>

            {participants.length === 0 ? (
              /* ── No-participants state ── */
              <View style={s.noParticipantsBox}>
                <MaterialIcons name="group-off" size={32} color="#cbd5e1" />
                <Text style={s.noParticipantsText}>
                  לא צורפו משתתפים לצורך הקצאת המשימה
                </Text>
                <Pressable
                  style={s.addParticipantsBtn}
                  onPress={() => {
                    closeAssignSheet();
                    onAddParticipants?.();
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="הוסף משתתפים"
                >
                  <Text style={s.addParticipantsBtnText}>הוסף משתתפים</Text>
                </Pressable>
              </View>
            ) : (
              /* ── Participant list ── */
              <>
                <Text style={s.sheetSectionLabel}>משתתפים</Text>
                <ScrollView
                  style={s.participantList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {participants.map((p) => {
                    const selected = draftSelected.includes(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        style={[s.participantRow, selected && s.participantRowSelected]}
                        onPress={() => toggleParticipantDraft(p.id)}
                        accessible={true}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={p.name}
                      >
                        {/* Selection indicator */}
                        <View style={[s.participantCheck, selected && s.participantCheckSelected]}>
                          {selected && (
                            <MaterialIcons name="check" size={14} color="#fff" />
                          )}
                        </View>

                        {/* Name + secondary */}
                        <View style={s.participantInfo}>
                          <Text style={s.participantName}>{p.name}</Text>
                          {(p.phone ?? p.email) != null && (
                            <Text style={s.participantSecondary} numberOfLines={1}>
                              {p.phone ?? p.email}
                            </Text>
                          )}
                        </View>

                        {/* Avatar */}
                        <View style={[s.participantAvatar, { backgroundColor: p.color }]}>
                          <Text style={s.participantAvatarText}>
                            {(p.name.trim() || '?')[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Save */}
                <Pressable
                  style={s.saveBtn}
                  onPress={saveAssignment}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="שמור הקצאה"
                >
                  <Text style={s.saveBtnText}>שמור</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: { flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'right',
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressBar: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },

  // ── Task row ──────────────────────────────────────────────────────────────
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 6,
  },
  taskCheckArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'right',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Compact assignee avatars inside task row ───────────────────────────────
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: PRIMARY,
  },
  avatarCount: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },

  // ── "הקצה" button ─────────────────────────────────────────────────────────
  assignBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: TINT,
  },
  assignBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },

  deleteBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  // ── Add task row ───────────────────────────────────────────────────────────
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  addTaskText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // ── Visibility toggle ─────────────────────────────────────────────────────
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  visibilityText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
  },

  // ── Assign bottom sheet ───────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // ── Participant list in sheet ──────────────────────────────────────────────
  participantList: {
    maxHeight: 280,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 12,
  },
  participantRowSelected: {
    backgroundColor: TINT,
  },
  participantCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCheckSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  participantInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  participantSecondary: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 1,
  },
  participantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // ── No-participants state ─────────────────────────────────────────────────
  noParticipantsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  noParticipantsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  addParticipantsBtn: {
    backgroundColor: TINT,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addParticipantsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },

  // ── Save button ───────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
