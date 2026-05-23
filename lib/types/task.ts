// ─── Legacy types (used by existing TaskEditorScreen) ─────────────────────────

export type DateOption = 'today' | 'other' | 'none';

export type ReminderOption =
  | 'none'
  | 'in_hour'
  | 'in_two_hours'
  | 'hour_before'
  | 'custom';

export type RepeatOption = 'daily' | 'weekly' | 'specific_days';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAssignee {
  id: string;
  name: string;
  initial: string;
  color: string;
}

// ─── New category types ────────────────────────────────────────────────────────

export type TaskCategory = 'personal' | 'shopping' | 'family' | 'work';

export const TASK_CATEGORIES: {
  key: TaskCategory;
  label: string;
}[] = [
  { key: 'personal', label: 'אישי' },
  { key: 'shopping', label: 'קניות' },
  { key: 'family', label: 'משפחה' },
  { key: 'work', label: 'עבודה' },
] as const;

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  personal: 'אישי',
  shopping: 'קניות',
  family: 'משפחה',
  work: 'עבודה',
};

export function isTaskCategory(value: string): value is TaskCategory {
  return ['personal', 'shopping', 'family', 'work'].includes(value);
}

export function getTaskCategoryLabel(category?: string): string {
  return category && isTaskCategory(category)
    ? TASK_CATEGORY_LABELS[category]
    : TASK_CATEGORY_LABELS.personal;
}

// ─── TaskDraft (used by TaskEditorScreen) ─────────────────────────────────────

export interface TaskDraft {
  title: string;
  dateOption: DateOption;
  selectedDate?: number;
  selectedTime?: string;
  reminder: ReminderOption;
  customReminder?: string;
  repeat?: RepeatOption;
  linkedEventId?: string;
  assignees: string[];
  subtasks: SubTask[];
  allowSubtaskEditing: boolean;
  notes: string;
  isRoutine: boolean;
  category: TaskCategory;
}
