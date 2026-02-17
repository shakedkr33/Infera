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
}
