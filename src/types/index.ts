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
  taskReminders?: Record<number, { date: string; time: string; notified?: boolean }>;
  appendAudios?: Array<{ url: string; label: string; addedAt: string; r2Key?: string }>;
  participants?: Participant[];
  richActionItems?: RichActionItem[];
  bigQuestions?: string[];
  // Статус AI-обработки. 'quota' — аудио сохранено, но расшифровка пропущена:
  // израсходован месячный лимит. Запись можно расшифровать после апгрейда тарифа.
  aiStatus?: 'processing' | 'done' | 'error' | 'quota';
  // Отметка о том, что запись проиндексирована для RAG-поиска (Firestore Timestamp с сервера).
  // Тип не уточняем до конкретной формы Timestamp — клиент это поле только читает
  // (наличие/отсутствие), а не парсит как дату.
  ragIndexedAt?: unknown;
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

/** Источник ответа поиска: запись + момент внутри неё */
export interface MessageSource {
  recordingId: string;
  title: string;
  /** Таймкод внутри записи: "12:34" или "1:02:33" */
  timestamp: string;
  snippet: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isAudio?: boolean;
  /** Найденные записи — показываются под ответом ассистента */
  sources?: MessageSource[];
}
