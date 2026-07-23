export interface TranscriptItem {
  speaker: string;
  timestamp: string;
  text: string;
  isAppended?: boolean;
}

export type NoteType = 'Идея' | 'Задача' | 'Напоминание';
export type Priority = 'high' | 'medium' | 'low';
export type RecurringPattern = 'daily' | 'weekly' | 'monthly' | 'none';
export type KanbanStatus = 'new' | 'in_progress' | 'done';

export interface Note {
  id: string;
  type: NoteType;
  content: string;
  date: string;
  // Tasks
  priority?: Priority;
  isCompleted?: boolean;
  completedAt?: string;
  kanbanStatus?: KanbanStatus;
  // Reminders
  dueDate?: string;
  dueTime?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  notifiedOneHour?: boolean;
  notifiedFiveMin?: boolean;
  isPinned?: boolean;
}

export interface Space {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
}

export interface Recording {
  id: string;
  title: string;
  date: string;
  duration: string;
  tags: string[];
  summary: string;
  transcript: TranscriptItem[];
  condensedTranscript?: TranscriptItem[];
  keyMoments?: string[];
  audioUrl?: string;
  r2Key?: string;           // Ключ файла в Cloudflare R2 (для удаления)
  ideas?: string[];
  actionItems?: string[];
  mentions?: string[];
  speakerNames?: Record<string, string>;
  actionItemsDone?: boolean[];
  openQuestions?: string[];
  pinned?: boolean;
  spaceId?: string;
  taskReminders?: Record<number, { date: string; time: string; notified?: boolean }>;
  appendAudios?: Array<{ url: string; label: string; addedAt: string; r2Key?: string }>;
  participants?: Participant[];
  richActionItems?: RichActionItem[];
  bigQuestions?: string[];
  aiStatus?: 'processing' | 'done' | 'error';  // статус AI-обработки
}

export interface Participant {
  name: string;
  speakerLabel: string; // "Участник 1", "Я", "Максим" etc.
  role?: string;        // "менеджер", "клиент" etc.
}

export interface RichActionItem {
  text: string;
  assignees?: string[];  // one or more responsible people
  assignee?: string;     // legacy single assignee (kept for backward compat)
  deadline?: string;     // "до завтра", "2026-04-25" etc.
}

export interface KnownPerson {
  name: string;
  firstMet: string;       // ISO date string
  recordingIds: string[];
}

export interface AppSettings {
  userName: string;
  autoStopMinutes: 5 | 10 | 15 | 30 | null;
  transcriptionLang: 'auto' | 'ru' | 'en';
  summaryDetail: 'brief' | 'standard' | 'detailed';
  extractIdeas: boolean;
  extractTasks: boolean;
}

export const defaultAppSettings: AppSettings = {
  userName: '',
  autoStopMinutes: 15,
  transcriptionLang: 'auto',
  summaryDetail: 'standard',
  extractIdeas: true,
  extractTasks: true,
};

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recordingId?: string;
  isAudio?: boolean;
  actionDone?: 'focus' | 'note' | 'ideas';
}
