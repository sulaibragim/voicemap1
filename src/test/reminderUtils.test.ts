import { describe, it, expect } from 'vitest';
import type { Recording, Note } from '../types';
import {
  formatDateShort,
  classifyReminder,
  sortByDateTime,
  buildFlatList,
  type ReminderItem,
} from '../lib/reminderUtils';

// ─── Вспомогательные фабрики ──────────────────────────────────────────────────

function makeReminderItem(overrides: Partial<ReminderItem> = {}): ReminderItem {
  return {
    key: 'item-1',
    kind: 'note',
    text: 'Тестовое напоминание',
    date: '',
    time: '09:00',
    ...overrides,
  };
}

function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: 'rec-1',
    title: 'Запись',
    date: '01.05.2025',
    duration: '00:30',
    tags: [],
    summary: '',
    transcript: [],
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'Напоминание',
    content: 'Тестовая заметка',
    date: 'сегодня',
    isCompleted: false,
    ...overrides,
  };
}

// ─── formatDateShort ──────────────────────────────────────────────────────────

describe('formatDateShort', () => {
  it('возвращает "Сегодня" для сегодняшней ISO-даты', () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    expect(formatDateShort(todayISO)).toBe('Сегодня');
  });

  it('возвращает "Завтра" для завтрашней ISO-даты', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    expect(formatDateShort(tomorrowISO)).toBe('Завтра');
  });

  it('возвращает локализованную дату для другой даты', () => {
    // Используем дату, которая точно не сегодня и не завтра
    const result = formatDateShort('2025-01-15');
    expect(result).not.toBe('Сегодня');
    expect(result).not.toBe('Завтра');
    // Должна содержать "15" как число дня
    expect(result).toContain('15');
  });

  it('возвращает строку как есть при некорректном формате', () => {
    expect(formatDateShort('не-дата')).toBe('не-дата');
  });
});

// ─── classifyReminder ────────────────────────────────────────────────────────

describe('classifyReminder', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  it('возвращает "nodatetime" при отсутствии даты', () => {
    const item = makeReminderItem({ date: '' });
    expect(classifyReminder(item, todayISO, '10:00')).toBe('nodatetime');
  });

  it('возвращает "overdue" для даты в прошлом', () => {
    const item = makeReminderItem({ date: '2020-01-01', time: '09:00' });
    expect(classifyReminder(item, todayISO, '10:00')).toBe('overdue');
  });

  it('возвращает "overdue" для сегодняшней даты с прошедшим временем', () => {
    // Устанавливаем текущее время позже времени напоминания
    const item = makeReminderItem({ date: todayISO, time: '06:00' });
    expect(classifyReminder(item, todayISO, '10:00')).toBe('overdue');
  });

  it('возвращает "today" для сегодняшней даты с будущим временем', () => {
    const item = makeReminderItem({ date: todayISO, time: '23:59' });
    expect(classifyReminder(item, todayISO, '00:01')).toBe('today');
  });

  it('возвращает "upcoming" для будущей даты', () => {
    const item = makeReminderItem({ date: tomorrowISO, time: '12:00' });
    expect(classifyReminder(item, todayISO, '10:00')).toBe('upcoming');
  });
});

// ─── sortByDateTime ───────────────────────────────────────────────────────────

describe('sortByDateTime', () => {
  it('сортирует по дате+времени лексикографически (ранее идёт первым)', () => {
    const a = makeReminderItem({ key: 'a', date: '2025-05-01', time: '09:00' });
    const b = makeReminderItem({ key: 'b', date: '2025-05-02', time: '08:00' });
    expect(sortByDateTime(a, b)).toBeLessThan(0);
    expect(sortByDateTime(b, a)).toBeGreaterThan(0);
  });

  it('возвращает 0 для идентичных дат и времени', () => {
    const a = makeReminderItem({ key: 'a', date: '2025-05-01', time: '10:00' });
    const b = makeReminderItem({ key: 'b', date: '2025-05-01', time: '10:00' });
    expect(sortByDateTime(a, b)).toBe(0);
  });

  it('сравнивает корректно по времени при одинаковой дате', () => {
    const earlier = makeReminderItem({ date: '2025-05-01', time: '08:00' });
    const later = makeReminderItem({ date: '2025-05-01', time: '18:00' });
    expect(sortByDateTime(earlier, later)).toBeLessThan(0);
  });
});

// ─── buildFlatList ────────────────────────────────────────────────────────────

describe('buildFlatList', () => {
  it('создаёт ReminderItem kind="recording" из записи с taskReminders', () => {
    const recording = makeRecording({
      id: 'rec-1',
      title: 'Митинг',
      actionItems: ['Написать отчёт'],
      taskReminders: {
        0: { date: '2025-05-10', time: '10:00', notified: false },
      },
    });
    const items = buildFlatList([recording], []);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('recording');
    expect(items[0].recordingId).toBe('rec-1');
    expect(items[0].text).toBe('Написать отчёт');
    expect(items[0].date).toBe('2025-05-10');
    expect(items[0].time).toBe('10:00');
    expect(items[0].taskIndex).toBe(0);
  });

  it('создаёт ReminderItem kind="note" из заметки типа "Напоминание"', () => {
    const note = makeNote({
      id: 'note-1',
      type: 'Напоминание',
      content: 'Купить молоко',
      dueDate: '2025-05-15',
      dueTime: '08:30',
      isCompleted: false,
    });
    const items = buildFlatList([], [note]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('note');
    expect(items[0].noteId).toBe('note-1');
    expect(items[0].text).toBe('Купить молоко');
    expect(items[0].date).toBe('2025-05-15');
    expect(items[0].time).toBe('08:30');
  });

  it('игнорирует завершённые заметки', () => {
    const note = makeNote({
      type: 'Напоминание',
      isCompleted: true,
    });
    const items = buildFlatList([], [note]);
    expect(items).toHaveLength(0);
  });

  it('игнорирует заметки не типа "Напоминание"', () => {
    const ideaNote = makeNote({ type: 'Идея' });
    const taskNote = makeNote({ type: 'Задача' });
    const items = buildFlatList([], [ideaNote, taskNote]);
    expect(items).toHaveLength(0);
  });

  it('возвращает пустой массив при пустом вводе', () => {
    expect(buildFlatList([], [])).toHaveLength(0);
  });

  it('объединяет напоминания из записей и заметок', () => {
    const recording = makeRecording({
      actionItems: ['Задача 1'],
      taskReminders: {
        0: { date: '2025-05-10', time: '10:00' },
      },
    });
    const note = makeNote({
      type: 'Напоминание',
      content: 'Заметка-напоминание',
      isCompleted: false,
    });
    const items = buildFlatList([recording], [note]);
    expect(items).toHaveLength(2);
    const kinds = items.map(i => i.kind);
    expect(kinds).toContain('recording');
    expect(kinds).toContain('note');
  });

  it('использует "Задача" как текст если actionItems не содержит индекс', () => {
    const recording = makeRecording({
      actionItems: [], // нет элементов под индексом 0
      taskReminders: {
        0: { date: '2025-05-10', time: '10:00' },
      },
    });
    const items = buildFlatList([recording], []);
    expect(items[0].text).toBe('Задача');
  });
});
