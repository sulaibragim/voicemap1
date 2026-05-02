import type { Recording, Note } from '../types';

// Унифицированный тип для любого напоминания
export interface ReminderItem {
  key: string;
  kind: 'recording' | 'note';
  text: string;
  date: string;
  time: string;
  // recording-specific
  recordingId?: string;
  recordingTitle?: string;
  taskIndex?: number;
  notified?: boolean;
  // note-specific
  noteId?: string;
  isCompleted?: boolean;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  if (iso === todayISO) return 'Сегодня';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (iso === tomorrow.toISOString().slice(0, 10)) return 'Завтра';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function buildFlatList(recordings: Recording[], notes: Note[]): ReminderItem[] {
  const items: ReminderItem[] = [];

  // Напоминания из записей (taskReminders)
  for (const rec of recordings) {
    if (!rec.taskReminders) continue;
    for (const [key, reminder] of Object.entries(rec.taskReminders)) {
      const taskIndex = Number(key);
      items.push({
        key: `rec-${rec.id}-${taskIndex}`,
        kind: 'recording',
        text: rec.actionItems?.[taskIndex] ?? 'Задача',
        date: reminder.date,
        time: reminder.time,
        recordingId: rec.id,
        recordingTitle: rec.title,
        taskIndex,
        notified: reminder.notified,
      });
    }
  }

  // Напоминания из заметок (тип 'Напоминание')
  for (const note of notes) {
    if (note.type !== 'Напоминание' || note.isCompleted) continue;
    const date = note.dueDate || '';
    const time = note.dueTime || '09:00';
    items.push({
      key: `note-${note.id}`,
      kind: 'note',
      text: note.content,
      date,
      time,
      noteId: note.id,
      isCompleted: note.isCompleted,
    });
  }

  return items;
}

export type Section = 'overdue' | 'today' | 'upcoming' | 'nodatetime';

export function classifyReminder(item: ReminderItem, todayISO: string, currentTime: string): Section {
  if (!item.date) return 'nodatetime';
  if (item.date < todayISO) return 'overdue';
  if (item.date === todayISO && item.time < currentTime) return 'overdue';
  if (item.date === todayISO) return 'today';
  return 'upcoming';
}

export function sortByDateTime(a: ReminderItem, b: ReminderItem): number {
  return (a.date + a.time).localeCompare(b.date + b.time);
}

export const SECTION_CONFIG: Record<Section, { label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  overdue:    { label: 'Просроченные', colorClass: 'text-error/80',            bgClass: 'bg-error/5',                      borderClass: 'border-error/20' },
  today:      { label: 'Сегодня',      colorClass: 'text-yellow-400',          bgClass: 'bg-yellow-400/5',                 borderClass: 'border-yellow-400/20' },
  upcoming:   { label: 'Скоро',        colorClass: 'text-on-surface-variant',  bgClass: 'bg-surface-container-highest',    borderClass: 'border-white/10' },
  nodatetime: { label: 'Без даты',     colorClass: 'text-on-surface-variant',  bgClass: 'bg-surface-container',            borderClass: 'border-white/5' },
};
