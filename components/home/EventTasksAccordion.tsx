/**
 * EventTasksAccordion
 *
 * Expandable accordion for community-event tasks on the Home screen.
 *
 * - Receives server-filtered, already-authorized task data
 * - Managers see all tasks + a quiet visibility-status row
 * - Members see their own tasks (visibility disabled) or all tasks (visibility enabled)
 * - Checkboxes call the parent-supplied onToggleCompleted handler
 * - RTL-correct Hebrew layout
 */
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTextAlign, rtl } from '@/lib/rtl';
import { colors as tc } from '@/theme/colors';

export type AuthorizedHomeEventTask = {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
  assignedToUserId?: string;
  assignedToManual?: string;
  assigneeDisplay?: string;
  isAssignedToCurrentUser: boolean;
};

export type EventTaskAccordionData = {
  tasks: AuthorizedHomeEventTask[];
  canManageTasks: boolean;
  tasksVisibleToParticipants: boolean;
};

interface EventTasksAccordionProps {
  tasks: AuthorizedHomeEventTask[];
  canManageTasks: boolean;
  tasksVisibleToParticipants: boolean;
  expanded: boolean;
  onToggle: () => void;
  onToggleCompleted: (taskId: string) => void;
}

export function EventTasksAccordion({
  tasks,
  canManageTasks,
  tasksVisibleToParticipants,
  expanded,
  onToggle,
  onToggleCompleted,
}: EventTasksAccordionProps): React.JSX.Element | null {
  if (tasks.length === 0) return null;

  const summaryLabel = `משימות האירוע · ${tasks.length}`;

  return (
    <>
      {/* Divider between card body and accordion */}
      <View style={styles.divider} />

      {/* Accordion header */}
      <Pressable
        accessible={true}
        accessibilityLabel={`${summaryLabel}, ${expanded ? 'סגירת רשימת משימות' : 'פתיחת רשימת משימות'}`}
        accessibilityRole="button"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={onToggle}
        style={styles.headerRow}
      >
        <Text style={styles.headerText}>{summaryLabel}</Text>
        <MaterialIcons
          color={tc.textSecondary}
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
        />
      </Pressable>

      {/* Expanded content */}
      {expanded ? (
        <View style={styles.expandedContent}>
          {/* Manager-only visibility status row */}
          {canManageTasks ? (
            <View style={styles.visibilityRow}>
              <MaterialIcons
                color={tc.textSecondary}
                name={tasksVisibleToParticipants ? 'visibility' : 'lock-outline'}
                size={14}
              />
              <View style={styles.visibilityTextBlock}>
                <Text style={styles.visibilityTitle}>
                  {tasksVisibleToParticipants ? 'גלוי למשתתפים' : 'מוגבל למנהלים'}
                </Text>
                <Text style={styles.visibilityDesc}>
                  {tasksVisibleToParticipants
                    ? 'כל חברי הקהילה יכולים לראות את המשימות וההקצאות.'
                    : 'כל משתתף רואה רק משימות שהוקצו אליו.'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Task rows */}
          {tasks.map((task, index) => {
            const isAssigned =
              Boolean(task.assignedToUserId) ||
              Boolean(task.assignedToManual?.trim());
            const assignmentLabel = task.isAssignedToCurrentUser
              ? 'הוקצה אליי'
              : task.assigneeDisplay
                ? `${task.assigneeDisplay}`
                : isAssigned
                  ? 'הוקצה'
                  : 'לא הוקצה';

            // Managers may complete any task; regular members only their own assigned task.
            const canComplete =
              canManageTasks || task.isAssignedToCurrentUser;

            return (
              <View
                key={task.id}
                style={[styles.taskRow, index > 0 && styles.taskRowDivider]}
              >
                {/* Checkbox — disabled/read-only when not authorized */}
                {canComplete ? (
                  <Pressable
                    accessible={true}
                    accessibilityLabel={task.title}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: task.completed }}
                    hitSlop={11}
                    onPress={() => onToggleCompleted(task.id)}
                    style={styles.checkboxTouch}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        task.completed && styles.checkboxDone,
                      ]}
                    >
                      {task.completed ? (
                        <MaterialIcons color="#FFFFFF" name="check" size={10} />
                      ) : null}
                    </View>
                  </Pressable>
                ) : (
                  <View
                    accessible={true}
                    accessibilityLabel={task.title}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: task.completed, disabled: true }}
                    style={styles.checkboxTouch}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        styles.checkboxDisabled,
                        task.completed && styles.checkboxDoneDisabled,
                      ]}
                    >
                      {task.completed ? (
                        <MaterialIcons color="#C4C9CB" name="check" size={10} />
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Title + assignment label */}
                <View style={styles.taskBody}>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.taskTitle,
                      task.completed && styles.taskTitleDone,
                    ]}
                  >
                    {task.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.assignmentLabel,
                      task.isAssignedToCurrentUser && styles.assignmentLabelMe,
                      !isAssigned && styles.assignmentLabelUnassigned,
                    ]}
                  >
                    {assignmentLabel}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E9EB',
  },
  headerRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    color: '#334E6F',
    fontWeight: '700',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  expandedContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E9EB',
  },
  visibilityRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFB',
  },
  visibilityTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  visibilityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tc.textSecondary,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  visibilityDesc: {
    fontSize: 11,
    color: tc.textSecondary,
    marginTop: 1,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  taskRow: {
    flexDirection: rtl.flexDirection,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    minHeight: 48,
  },
  taskRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E9EB',
  },
  checkboxTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    flexShrink: 0,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ADB3B5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: '#52B788',
    borderColor: '#52B788',
  },
  checkboxDisabled: {
    borderColor: '#D4D8DA',
    backgroundColor: 'transparent',
  },
  checkboxDoneDisabled: {
    backgroundColor: '#D4D8DA',
    borderColor: '#D4D8DA',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D3335',
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  taskTitleDone: {
    color: '#92999C',
    textDecorationLine: 'line-through',
  },
  assignmentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: tc.textSecondary,
    textAlign: getTextAlign(),
    writingDirection: 'rtl',
  },
  assignmentLabelMe: {
    color: tc.primary,
    fontWeight: '700',
  },
  assignmentLabelUnassigned: {
    color: '#ADB3B5',
  },
});
