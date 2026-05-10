export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday

export type EventType = 'fixed' | 'task';

export type CalendarEvent = {
  id: string;
  title: string;
  day: Day;
  startMinutes: number; // 0–1439, minutes from midnight
  endMinutes: number;
  recurring: boolean;
  type: EventType;
  completed: boolean;
  notes?: string;
  createdAt: number;
};

export type BehaviorLog = {
  date: string; // YYYY-MM-DD
  domain: string; // registrable domain
  hourBucket: number; // 0–23
  durationMs: number;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
};

export type Insight = {
  id: string;
  generatedAt: number;
  text: string;
  weekStart: string; // YYYY-MM-DD of Monday
};

export type InterventionMessage = {
  type: 'INTERVENE';
  taskTitle: string;
  cueText: string;
  taskEndMinutes: number;
};

export type OpenDashboardMessage = {
  type: 'OPEN_DASHBOARD';
  focusEventId?: string;
};

export type SnoozeDomainMessage = {
  type: 'SNOOZE_DOMAIN';
  domain: string;
  minutes: number;
};

export type RuntimeMessage =
  | InterventionMessage
  | OpenDashboardMessage
  | SnoozeDomainMessage;
