import { describe, it, expect } from 'vitest';
import { buildNote, defaultReminderTime } from '../lib/noteBuilder';

const NOW = new Date(2026, 6, 23, 14, 30, 0); // 23 июля 2026, 14:30

describe('buildNote — общее', () => {
  it('кладёт тип и текст как есть', () => {
    const note = buildNote({ type: 'Идея', content: 'Записывать мысли голосом' }, NOW);
    expect(note.type).toBe('Идея');
    expect(note.content).toBe('Записывать мысли голосом');
  });

  it('id получается из времени создания', () => {
    const note = buildNote({ type: 'Идея', content: 'текст' }, NOW);
    expect(note.id).toBe(String(NOW.getTime()));
  });
});

describe('buildNote — Идея', () => {
  it('не тащит поля задач и напоминаний: у идеи нет ни срока, ни статуса', () => {
    const note = buildNote({ type: 'Идея', content: 'мысль' }, NOW);

    expect(note.priority).toBeUndefined();
    expect(note.kanbanStatus).toBeUndefined();
    expect(note.isCompleted).toBeUndefined();
    expect(note.dueDate).toBeUndefined();
    expect(note.isRecurring).toBeUndefined();
  });

  it('срок игнорируется, даже если его передали', () => {
    const note = buildNote({ type: 'Идея', content: 'мысль', dueDate: '2026-08-01' }, NOW);
    expect(note.dueDate).toBeUndefined();
  });
});

describe('buildNote — Задача', () => {
  it('заводится незавершённой и в первой колонке', () => {
    const note = buildNote({ type: 'Задача', content: 'позвонить' }, NOW);
    expect(note.isCompleted).toBe(false);
    expect(note.kanbanStatus).toBe('new');
  });

  it('приоритет по умолчанию — средний', () => {
    expect(buildNote({ type: 'Задача', content: 'дело' }, NOW).priority).toBe('medium');
  });

  it('уважает заданный приоритет', () => {
    const note = buildNote({ type: 'Задача', content: 'срочно', priority: 'high' }, NOW);
    expect(note.priority).toBe('high');
  });

  it('срок добавляется только если задан — пустые поля в документ не пишем', () => {
    const withDue = buildNote({ type: 'Задача', content: 'дело', dueDate: '2026-08-01', dueTime: '10:00' }, NOW);
    expect(withDue.dueDate).toBe('2026-08-01');
    expect(withDue.dueTime).toBe('10:00');

    const withoutDue = buildNote({ type: 'Задача', content: 'дело', dueDate: '', dueTime: '' }, NOW);
    expect('dueDate' in withoutDue).toBe(false);
    expect('dueTime' in withoutDue).toBe(false);
  });
});

describe('buildNote — Напоминание', () => {
  it('несёт срок и флаги уведомлений', () => {
    const note = buildNote({
      type: 'Напоминание', content: 'купить молоко',
      dueDate: '2026-07-24', dueTime: '09:00',
    }, NOW);

    expect(note.dueDate).toBe('2026-07-24');
    expect(note.dueTime).toBe('09:00');
    expect(note.notifiedOneHour).toBe(false);
    expect(note.notifiedFiveMin).toBe(false);
  });

  it('повтор сбрасывается, когда флаг снят — иначе напоминание оживёт само', () => {
    const note = buildNote({
      type: 'Напоминание', content: 'зарядка',
      isRecurring: false, recurringPattern: 'daily',
    }, NOW);

    expect(note.isRecurring).toBe(false);
    expect(note.recurringPattern).toBe('none');
  });

  it('повтор сохраняется, когда флаг стоит', () => {
    const note = buildNote({
      type: 'Напоминание', content: 'зарядка',
      isRecurring: true, recurringPattern: 'daily',
    }, NOW);

    expect(note.isRecurring).toBe(true);
    expect(note.recurringPattern).toBe('daily');
  });
});

describe('defaultReminderTime', () => {
  it('предлагает завтра в девять утра', () => {
    const { date, time } = defaultReminderTime(NOW);
    expect(date).toBe('2026-07-24');
    expect(time).toBe('09:00');
  });

  it('корректно переходит через конец месяца', () => {
    expect(defaultReminderTime(new Date(2026, 6, 31, 12, 0)).date).toBe('2026-08-01');
  });

  it('корректно переходит через конец года', () => {
    expect(defaultReminderTime(new Date(2026, 11, 31, 12, 0)).date).toBe('2027-01-01');
  });
});
