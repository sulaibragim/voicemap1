import { describe, it, expect } from 'vitest';
import type { Note } from '../types';
import {
  parseNoteDate,
  priorityOrder,
  getReminderStatus,
  groupByDate,
} from '../lib/noteUtils';

// ─── Вспомогательная фабрика заметки ────────────────────────────────────────

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    type: 'Идея',
    content: 'Тестовая заметка',
    date: 'сегодня',
    ...overrides,
  };
}

// ─── parseNoteDate ───────────────────────────────────────────────────────────

describe('parseNoteDate', () => {
  it('парсит дату с годом "15 мая 2024"', () => {
    const result = parseNoteDate('15 мая 2024');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(4); // май = индекс 4
    expect(result!.getDate()).toBe(15);
  });

  it('парсит дату без года "3 января" — берёт текущий год', () => {
    const result = parseNoteDate('3 января,');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(new Date().getFullYear());
    expect(result!.getMonth()).toBe(0); // январь = индекс 0
    expect(result!.getDate()).toBe(3);
  });

  it('парсит дату "10 декабря 2023"', () => {
    const result = parseNoteDate('10 декабря 2023');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2023);
    expect(result!.getMonth()).toBe(11); // декабрь = индекс 11
    expect(result!.getDate()).toBe(10);
  });

  it('возвращает null при некорректной строке', () => {
    expect(parseNoteDate('не дата')).toBeNull();
    expect(parseNoteDate('')).toBeNull();
    expect(parseNoteDate('12345')).toBeNull();
  });
});

// ─── priorityOrder ───────────────────────────────────────────────────────────

describe('priorityOrder', () => {
  it('high имеет наименьший числовой приоритет (0)', () => {
    expect(priorityOrder['high']).toBe(0);
  });

  it('medium имеет приоритет 1', () => {
    expect(priorityOrder['medium']).toBe(1);
  });

  it('low имеет наибольший числовой приоритет (2)', () => {
    expect(priorityOrder['low']).toBe(2);
  });

  it('высокий приоритет меньше среднего (для сортировки по возрастанию)', () => {
    expect(priorityOrder['high']).toBeLessThan(priorityOrder['medium']);
    expect(priorityOrder['medium']).toBeLessThan(priorityOrder['low']);
  });
});

// ─── getReminderStatus ────────────────────────────────────────────────────────

describe('getReminderStatus', () => {
  it('возвращает null если нет dueDate', () => {
    const note = makeNote({ type: 'Напоминание' });
    expect(getReminderStatus(note)).toBeNull();
  });

  it('возвращает null если нет dueTime', () => {
    const note = makeNote({ type: 'Напоминание', dueDate: '2025-05-01' });
    expect(getReminderStatus(note)).toBeNull();
  });

  it('возвращает { overdue: true, urgent: true } для просроченного напоминания', () => {
    // Дата в прошлом
    const note = makeNote({
      type: 'Напоминание',
      dueDate: '2020-01-01',
      dueTime: '09:00',
    });
    const status = getReminderStatus(note);
    expect(status).not.toBeNull();
    expect(status!.overdue).toBe(true);
    expect(status!.urgent).toBe(true);
  });

  it('возвращает overdue: false для напоминания далеко в будущем (более 24 часов)', () => {
    // Дата далеко в будущем — более 24 часов вперёд
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const dateStr = future.toISOString().slice(0, 10);
    const note = makeNote({
      type: 'Напоминание',
      dueDate: dateStr,
      dueTime: '12:00',
    });
    const status = getReminderStatus(note);
    expect(status).not.toBeNull();
    expect(status!.overdue).toBe(false);
    expect(status!.urgent).toBe(false);
  });
});

// ─── groupByDate (noteUtils) ──────────────────────────────────────────────────

describe('groupByDate (notes)', () => {
  it('группирует сегодняшние заметки под меткой "Сегодня"', () => {
    const today = new Date();
    const day = today.getDate();
    const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const todayStr = `${day} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    const notes = [makeNote({ id: 'today-note', date: todayStr })];
    const groups = groupByDate(notes);
    const todayGroup = groups.find(g => g.label === 'Сегодня');
    expect(todayGroup).toBeDefined();
    expect(todayGroup!.notes[0].id).toBe('today-note');
  });

  it('группирует вчерашние заметки под меткой "Вчера"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const day = yesterday.getDate();
    const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const yesterdayStr = `${day} ${monthNames[yesterday.getMonth()]} ${yesterday.getFullYear()}`;

    const notes = [makeNote({ id: 'yesterday-note', date: yesterdayStr })];
    const groups = groupByDate(notes);
    const group = groups.find(g => g.label === 'Вчера');
    expect(group).toBeDefined();
    expect(group!.notes[0].id).toBe('yesterday-note');
  });

  it('группирует заметки этой недели под меткой "На этой неделе"', () => {
    // 3 дня назад — должно попасть в "На этой неделе"
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const day = threeDaysAgo.getDate();
    const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const dateStr = `${day} ${monthNames[threeDaysAgo.getMonth()]} ${threeDaysAgo.getFullYear()}`;

    const notes = [makeNote({ id: 'week-note', date: dateStr })];
    const groups = groupByDate(notes);
    const group = groups.find(g => g.label === 'На этой неделе');
    expect(group).toBeDefined();
    expect(group!.notes[0].id).toBe('week-note');
  });

  it('возвращает пустой массив при пустом вводе', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
