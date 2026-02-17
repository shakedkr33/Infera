export interface Participant {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  color: string;
}

export interface EventTask {
  id: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  assignee?: Participant;
  dueDate?: number;
  colorDot?: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReminderType =
  | 'hour_before'
  | 'morning_same_day'
  | 'day_before_evening';

export interface EventData {
  id?: string;
  title: string;
  date: number;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  recurrence: RecurrenceType;
  location?: string;
  locationCoords?: { lat: number; lng: number };
  notes?: string;
  remindersEnabled: boolean;
  reminderTypes: ReminderType[];
  participants: Participant[];
  tasks: EventTask[];
  showAllTasksToAll: boolean;
  createdAt: number;
}
