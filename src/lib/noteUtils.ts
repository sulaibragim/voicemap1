import type { Note, NoteType, KanbanStatus } from '../types';
import { Lightbulb, CheckCircle2, ListTodo, StickyNote, RefreshCw } from 'lucide-react';
import { NOTE_CLASSES } from './noteTheme';

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type FilterTab = 'all' | NoteType;
export type ViewMode = 'timeline' | 'kanban';
export type SortBy = 'newest' | 'oldest' | 'priority';

// ─── Конфиги ──────────────────────────────────────────────────────────────────

export const typeConfig: Record<NoteType, {
  icon: typeof Lightbulb;
  color: string;
  bg: string;
  stripe: string;
  borderActive: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
}> = {
  'Идея':        { icon: NOTE_CLASSES['Идея'].icon,        color: NOTE_CLASSES['Идея'].text,        bg: NOTE_CLASSES['Идея'].bg,        stripe: NOTE_CLASSES['Идея'].stripe,        borderActive: NOTE_CLASSES['Идея'].border,        gradientFrom: NOTE_CLASSES['Идея'].gradientFrom,        gradientTo: NOTE_CLASSES['Идея'].gradientTo,        glowColor: NOTE_CLASSES['Идея'].glow },
  'Задача':      { icon: NOTE_CLASSES['Задача'].icon,      color: NOTE_CLASSES['Задача'].text,      bg: NOTE_CLASSES['Задача'].bg,      stripe: NOTE_CLASSES['Задача'].stripe,      borderActive: NOTE_CLASSES['Задача'].border,      gradientFrom: NOTE_CLASSES['Задача'].gradientFrom,      gradientTo: NOTE_CLASSES['Задача'].gradientTo,      glowColor: NOTE_CLASSES['Задача'].glow },
  'Напоминание': { icon: NOTE_CLASSES['Напоминание'].icon, color: NOTE_CLASSES['Напоминание'].text, bg: NOTE_CLASSES['Напоминание'].bg, stripe: NOTE_CLASSES['Напоминание'].stripe, borderActive: NOTE_CLASSES['Напоминание'].border, gradientFrom: NOTE_CLASSES['Напоминание'].gradientFrom, gradientTo: NOTE_CLASSES['Напоминание'].gradientTo, glowColor: NOTE_CLASSES['Напоминание'].glow },
};

export const priorityConfig: Record<string, { bg: string; text: string; dot: string }> = {
  high:   { bg: 'bg-error/15',              text: 'text-error',              dot: 'bg-error' },
  medium: { bg: 'bg-warning/15',            text: 'text-warning',            dot: 'bg-warning' },
  low:    { bg: 'bg-on-surface-variant/15', text: 'text-on-surface-variant', dot: 'bg-on-surface-variant' },
};

export const priorityLabels: Record<string, string> = {
  high: 'Высокий', medium: 'Средний', low: 'Низкий',
};

export const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const kanbanColumns: { status: KanbanStatus; label: string; accent: string; icon: typeof ListTodo; headerBg: string }[] = [
  { status: 'new',         label: 'Новые',    accent: 'border-t-primary/60',    icon: StickyNote,   headerBg: 'bg-primary/8' },
  { status: 'in_progress', label: 'В работе', accent: 'border-t-yellow-500/60', icon: RefreshCw,    headerBg: 'bg-yellow-500/8' },
  { status: 'done',        label: 'Готово',   accent: 'border-t-secondary/60',  icon: CheckCircle2, headerBg: 'bg-secondary/8' },
];

// ─── Утилиты парсинга дат ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};
const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export function parseNoteDate(dateStr: string): Date | null {
  const withYear = dateStr.match(/(\d+)\s+([а-яё]+)\s+(\d{4})/i);
  if (withYear) {
    const d = new Date(parseInt(withYear[3]), MONTH_MAP[withYear[2]] ?? 0, parseInt(withYear[1]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const withTime = dateStr.match(/(\d+)\s+([а-яё]+)[,\s]/i);
  if (withTime && MONTH_MAP[withTime[2]] !== undefined) {
    const d = new Date(new Date().getFullYear(), MONTH_MAP[withTime[2]], parseInt(withTime[1]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

export function groupByDate(notes: Note[]): { label: string; notes: Note[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const groupMap = new Map<string, { notes: Note[]; priority: number }>();

  for (const note of notes) {
    const noteDate = parseNoteDate(note.date);
    let label: string;
    let priority: number;

    if (!noteDate) {
      label = note.date; priority = 999;
    } else if (noteDate.getTime() === today.getTime()) {
      label = 'Сегодня'; priority = 0;
    } else if (noteDate.getTime() === yesterday.getTime()) {
      label = 'Вчера'; priority = 1;
    } else if (noteDate >= weekAgo) {
      label = 'На этой неделе'; priority = 2;
    } else {
      label = `${noteDate.getDate()} ${MONTH_NAMES[noteDate.getMonth()]}`;
      priority = 1000 + (today.getTime() - noteDate.getTime());
    }

    if (!groupMap.has(label)) groupMap.set(label, { notes: [], priority });
    groupMap.get(label)!.notes.push(note);
  }

  return Array.from(groupMap.entries())
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([label, { notes }]) => ({ label, notes }));
}

// Вычисление статуса напоминания — вне компонента, чтобы Date.now() не вызывался в рендере
export function getReminderStatus(note: Note): { text: string; urgent: boolean; overdue: boolean } | null {
  if (!note.dueDate || !note.dueTime) return null;
  const due = new Date(`${note.dueDate}T${note.dueTime}`);
  const diff = due.getTime() - Date.now();
  if (diff < 0) return { text: 'Просрочено', urgent: true, overdue: true };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return { text: `через ${Math.floor(hours / 24)} дн.`, urgent: false, overdue: false };
  if (hours > 0) return { text: `через ${hours} ч. ${mins} мин.`, urgent: false, overdue: false };
  return { text: `через ${mins} мин.`, urgent: true, overdue: false };
}
