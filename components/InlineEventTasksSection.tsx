/**
 * InlineEventTasksSection
 *
 * Renders an expandable "המשימות שלי" section that lives below an event card.
 * Used in Home timeline, Calendar timeline, and Calendar day sheet.
 *
 * - Shows a chevron only when tasks exist
 * - Expands/collapses inline (does NOT navigate)
 * - Each task row has a checkbox wired to eventTasks.toggleCompleted
 * - RTL-correct layout and Hebrew labels
 */
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export interface AssignedEventTask {
  id: string;
  title: string;
  completed: boolean;
}

interface InlineEventTasksSectionProps {
  tasks: AssignedEventTask[];
  /** When true the section starts expanded */
  defaultExpanded?: boolean;
}

export function InlineEventTasksSection({
  tasks,
  defaultExpanded = false,
}: InlineEventTasksSectionProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggleCompleted = useMutation(api.eventTasks.toggleCompleted);

  if (tasks.length === 0) return null;

  const allDone = tasks.every((t) => t.completed);
  const label =
    tasks.length === 1 ? 'משימה אחת שלי' : `${tasks.length} משימות שלי`;

  const handleToggle = async (id: string) => {
    try {
      await toggleCompleted({ id: id as Id<'eventTasks'> });
    } catch {
      // silently ignore — Convex will surface errors in dev
    }
  };

  return (
    <View style={s.wrapper}>
      {/* ── Chevron row ──────────────────────────────────────────────────── */}
      <Pressable
        style={s.chevronRow}
        onPress={() => setExpanded((v) => !v)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'כווץ משימות' : 'הצג משימות'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {allDone && !expanded ? (
          <Text style={s.allDoneText}>כל המשימות בוצעו ✓</Text>
        ) : (
          <Text style={s.summaryText}>{label}</Text>
        )}
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color="#36a9e2"
          style={s.chevronIcon}
        />
      </Pressable>

      {/* ── Task list ─────────────────────────────────────────────────────── */}
      {expanded && (
        <View style={s.taskList}>
          <Text style={s.sectionLabel}>המשימות שלי</Text>
          {tasks.map((task) => (
            <View key={task.id} style={s.taskRow}>
              <TaskCheckbox
                checked={task.completed}
                onToggle={() => handleToggle(task.id)}
              />
              <Text
                style={[s.taskTitle, task.completed && s.taskTitleDone]}
                numberOfLines={2}
              >
                {task.title}
              </Text>
            </View>
          ))}
          {allDone && <Text style={s.allDoneInList}>כל המשימות בוצעו ✓</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(54,169,226,0.12)',
    paddingTop: 6,
  },
  chevronRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 28,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  summaryText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#36a9e2',
    textAlign: 'right',
  },
  allDoneText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'right',
  },
  taskList: {
    marginTop: 6,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  taskRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    minHeight: 44,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    textAlign: 'right',
    lineHeight: 20,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  allDoneInList: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'right',
    marginTop: 4,
  },
});
