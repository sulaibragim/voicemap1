import { describe, it, expect } from 'vitest';
import type { Recording } from '../types';
import {
  formatDeadlineDisplay,
  toIsoDate,
  parseDurationToSeconds,
  getTagColor,
  getTagTextColor,
  sortItems,
  groupByDate,
} from '../lib/recordingUtils';

// ─── Вспомогательная фабрика записи ────────────────────────────────────────

function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: 'rec-1',
    title: 'Test recording',
    date: '01.05.2025',
    duration: '00:30',
    tags: [],
    summary: '',
    transcript: [],
    ...overrides,
  };
}

// ─── formatDeadlineDisplay ──────────────────────────────────────────────────

describe('formatDeadlineDisplay', () => {
  it('возвращает пустую строку при пустом вводе', () => {
    expect(formatDeadlineDisplay('')).toBe('');
  });

  it('форматирует ISO-дату текущего года без года', () => {
    const currentYear = new Date().getFullYear();
    const iso = `${currentYear}-04-25`;
    const result = formatDeadlineDisplay(iso);
    // Должен содержать "25" и название месяца, но НЕ год
    expect(result).toContain('25');
    expect(result).not.toContain(String(currentYear));
  });

  it('форматирует ISO-дату другого года с указанием года', () => {
    const result = formatDeadlineDisplay('2027-04-25');
    expect(result).toContain('2027');
    expect(result).toContain('25');
  });

  it('возвращает строку как есть если это не ISO-дата', () => {
    expect(formatDeadlineDisplay('не дата')).toBe('не дата');
    expect(formatDeadlineDisplay('25/04')).toBe('25/04');
  });
});

// ─── toIsoDate ───────────────────────────────────────────────────────────────

describe('toIsoDate', () => {
  it('возвращает ISO-дату без изменений', () => {
    expect(toIsoDate('2025-05-01')).toBe('2025-05-01');
  });

  it('возвращает пустую строку для не-ISO формата', () => {
    expect(toIsoDate('01.05.2025')).toBe('');
    expect(toIsoDate('25 апреля')).toBe('');
    expect(toIsoDate('')).toBe('');
  });
});

// ─── parseDurationToSeconds ──────────────────────────────────────────────────

describe('parseDurationToSeconds', () => {
  it('конвертирует "01:30" в 90 секунд', () => {
    expect(parseDurationToSeconds('01:30')).toBe(90);
  });

  it('конвертирует "00:45" в 45 секунд', () => {
    expect(parseDurationToSeconds('00:45')).toBe(45);
  });

  it('конвертирует "00:00" в 0 секунд', () => {
    expect(parseDurationToSeconds('00:00')).toBe(0);
  });

  it('возвращает 0 при некорректном формате', () => {
    expect(parseDurationToSeconds('abc')).toBe(0);
    expect(parseDurationToSeconds('')).toBe(0);
  });
});

// ─── getTagColor ─────────────────────────────────────────────────────────────

describe('getTagColor', () => {
  it('возвращает bg-primary для тега #Идеи', () => {
    expect(getTagColor(['#Идеи'])).toBe('bg-primary');
  });

  it('возвращает bg-secondary для тега #Митинг', () => {
    expect(getTagColor(['#Митинг'])).toBe('bg-secondary');
  });

  it('возвращает bg-on-surface-variant для неизвестного тега', () => {
    expect(getTagColor(['#НеизвестныйТег'])).toBe('bg-on-surface-variant');
  });

  it('возвращает bg-on-surface-variant для пустого массива', () => {
    expect(getTagColor([])).toBe('bg-on-surface-variant');
  });

  it('возвращает цвет первого совпадающего тега из массива', () => {
    // Функция итерирует теги по порядку и возвращает цвет первого совпадения
    // Если первый тег неизвестен, но второй совпадает — вернёт цвет второго
    expect(getTagColor(['#НеизвестныйТег', '#Идеи'])).toBe('bg-primary');
    // Первый тег совпал — возвращает его цвет
    expect(getTagColor(['#Идеи', '#Митинг'])).toBe('bg-primary');
  });
});

// ─── getTagTextColor ─────────────────────────────────────────────────────────

describe('getTagTextColor', () => {
  it('возвращает text-secondary для тега #Митинг', () => {
    expect(getTagTextColor(['#Митинг'])).toBe('text-secondary');
  });

  it('возвращает text-primary для тега #Идеи', () => {
    expect(getTagTextColor(['#Идеи'])).toBe('text-primary');
  });

  it('возвращает text-on-surface-variant для неизвестного тега', () => {
    expect(getTagTextColor(['#Неизвестный'])).toBe('text-on-surface-variant');
  });

  it('возвращает text-on-surface-variant для пустого массива', () => {
    expect(getTagTextColor([])).toBe('text-on-surface-variant');
  });
});

// ─── sortItems ────────────────────────────────────────────────────────────────

describe('sortItems', () => {
  it('сортирует по убыванию длительности при mode="duration"', () => {
    const recordings = [
      makeRecording({ id: 'a', duration: '00:30' }),
      makeRecording({ id: 'b', duration: '01:30' }),
      makeRecording({ id: 'c', duration: '00:45' }),
    ];
    const sorted = sortItems(recordings, 'duration');
    expect(sorted[0].id).toBe('b'); // 90 секунд
    expect(sorted[1].id).toBe('c'); // 45 секунд
    expect(sorted[2].id).toBe('a'); // 30 секунд
  });

  it('сортирует по убыванию числа задач при mode="tasks"', () => {
    const recordings = [
      makeRecording({ id: 'a', actionItems: ['задача'] }),
      makeRecording({ id: 'b', actionItems: ['задача1', 'задача2', 'задача3'] }),
      makeRecording({ id: 'c', actionItems: ['задача1', 'задача2'] }),
    ];
    const sorted = sortItems(recordings, 'tasks');
    expect(sorted[0].id).toBe('b'); // 3 задачи
    expect(sorted[1].id).toBe('c'); // 2 задачи
    expect(sorted[2].id).toBe('a'); // 1 задача
  });

  it('не мутирует исходный массив', () => {
    const recordings = [
      makeRecording({ id: 'a', duration: '01:00' }),
      makeRecording({ id: 'b', duration: '00:30' }),
    ];
    const original = [...recordings];
    sortItems(recordings, 'duration');
    expect(recordings[0].id).toBe(original[0].id);
  });

  it('возвращает исходный порядок при mode="date" (без сортировки)', () => {
    const recordings = [
      makeRecording({ id: 'a' }),
      makeRecording({ id: 'b' }),
    ];
    const sorted = sortItems(recordings, 'date');
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
  });
});

// ─── groupByDate ─────────────────────────────────────────────────────────────

describe('groupByDate', () => {
  // groupByDate делает r.date.replace(/\./g, '-'), поэтому:
  // "2025-05-01" → "2025-05-01" (ISO, корректно парсится)
  // Для "Сегодня"/"Вчера" нужно передавать ISO-дату, которую new Date() распарсит верно

  it('группирует сегодняшние записи под меткой "Сегодня"', () => {
    // Дату берём из ЛОКАЛЬНЫХ компонентов (не toISOString/UTC): groupByDate сравнивает
    // с локальной датой, а вечером в западных зонах UTC-дата уже «завтра» → тест флакал.
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayWithTime = `${todayISO}T12:00:00`;
    const recordings = [makeRecording({ id: 'today', date: todayWithTime })];
    const groups = groupByDate(recordings);
    const todayGroup = groups.find(g => g.label === 'Сегодня');
    expect(todayGroup).toBeDefined();
    expect(todayGroup!.items[0].id).toBe('today');
  });

  it('группирует вчерашние записи под меткой "Вчера"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const yesterdayWithTime = `${yesterdayISO}T12:00:00`;
    const recordings = [makeRecording({ id: 'yesterday', date: yesterdayWithTime })];
    const groups = groupByDate(recordings);
    const yesterdayGroup = groups.find(g => g.label === 'Вчера');
    expect(yesterdayGroup).toBeDefined();
    expect(yesterdayGroup!.items[0].id).toBe('yesterday');
  });

  it('возвращает пустой массив групп при пустом вводе', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
