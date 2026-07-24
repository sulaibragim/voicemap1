// Сборка новой заметки из полей формы.
//
// Чистые функции без React: набор полей зависит от типа заметки, и правило
// «какой тип что несёт» лучше держать в одном месте, а не растекаться по
// разметке модалки.

import type { Note, NoteType, Priority, RecurringPattern } from '../types';

/** Время по умолчанию для напоминания, когда AI не распознал срок из речи */
const DEFAULT_REMINDER_HOUR = '09:00';

export interface NoteDraft {
  type: NoteType;
  content: string;
  dueDate?: string;
  dueTime?: string;
  priority?: Priority;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
}

/** «Завтра в 9 утра» — разумный дефолт: сегодня уже поздно, послезавтра забудется. */
export function defaultReminderTime(now: Date = new Date()): { date: string; time: string } {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    date: tomorrow.toISOString().split('T')[0],
    time: DEFAULT_REMINDER_HOUR,
  };
}

/** Дата создания в том виде, в каком её показывает интерфейс */
function formatCreatedAt(now: Date): string {
  return now.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Собирает заметку под её тип.
 *
 * Идея — только текст: у неё нет ни срока, ни статуса, и навешивать их значило бы
 * засорять документ полями, которые никто не читает.
 * Задача несёт приоритет и колонку канбана, напоминание — срок и повтор.
 */
export function buildNote(draft: NoteDraft, now: Date = new Date()): Note {
  const base: Note = {
    id: now.getTime().toString(),
    type: draft.type,
    content: draft.content,
    date: formatCreatedAt(now),
  };

  if (draft.type === 'Задача') {
    return {
      ...base,
      priority: draft.priority ?? 'medium',
      isCompleted: false,
      kanbanStatus: 'new',
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      ...(draft.dueTime ? { dueTime: draft.dueTime } : {}),
    };
  }

  if (draft.type === 'Напоминание') {
    const isRecurring = draft.isRecurring ?? false;
    return {
      ...base,
      dueDate: draft.dueDate || undefined,
      dueTime: draft.dueTime || undefined,
      isRecurring,
      // Повтор без флага бессмысленен: сбрасываем, чтобы напоминание не ожило само
      recurringPattern: isRecurring ? (draft.recurringPattern ?? 'none') : 'none',
      notifiedOneHour: false,
      notifiedFiveMin: false,
    };
  }

  return base;
}
