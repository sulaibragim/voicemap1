import { describe, it, expect } from 'vitest';
import { chunkTranscript, toTranscriptEntries, type TranscriptEntry } from '../../server/lib/chunk';

// ─── Вспомогательные фабрики ────────────────────────────────────────────────

const META = { recordingId: 'rec-1', title: 'Планёрка по проекту', date: '2026-07-22' };

function entry(speaker: string, timestamp: string, text: string): TranscriptEntry {
  return { speaker, timestamp, text };
}

// ─── Границы кусков (~400–600 символов) ─────────────────────────────────────

describe('chunkTranscript — границы кусков', () => {
  it('склеивает короткие реплики одного спикера в один кусок, пока не наберётся ~400-600 символов', () => {
    // Каждая строка "Спикер: " + 90 симв. текста = 98 символов ровно.
    // 6 реплик подряд → 6*98 + 5 переводов строки = 593 символа (< 600, ещё не переполняет).
    // 7-я реплика перегрузила бы кусок сверх 600 → должна уйти в новый кусок.
    const longText = 'A'.repeat(90);
    const transcript: TranscriptEntry[] = Array.from({ length: 7 }, (_, i) =>
      entry('Спикер', `t${i}`, longText)
    );

    const chunks = chunkTranscript(transcript, META);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text.length).toBe(593);
    expect(chunks[0].startTimestamp).toBe('t0');
    // Первые 6 реплик должны быть в первом куске
    for (let i = 0; i < 6; i++) {
      expect(chunks[0].text).toContain(`Спикер: ${longText}`);
    }
    // 7-я реплика ушла во второй кусок
    expect(chunks[1].startTimestamp).toBe('t6');
    expect(chunks[1].text).toBe(`Спикер: ${longText}`);
  });

  it('не режет реплику посередине, даже если она сама длиннее максимума куска', () => {
    const hugeText = 'B'.repeat(700);
    const transcript: TranscriptEntry[] = [
      entry('Я', 't0', hugeText),
      entry('Я', 't1', 'Привет'),
    ];

    const chunks = chunkTranscript(transcript, META);

    expect(chunks).toHaveLength(2);
    // Огромная реплика целиком в своём куске, без обрезки
    expect(chunks[0].text).toBe(`Я: ${hugeText}`);
    expect(chunks[0].text.length).toBe(hugeText.length + 3);
    // Следующая короткая реплика — в отдельном куске (не долеплена к переполненному)
    expect(chunks[1].text).toBe('Я: Привет');
    expect(chunks[1].startTimestamp).toBe('t1');
  });

  it('хвост короче минимума всё равно становится последним куском (реплики не теряются)', () => {
    const transcript: TranscriptEntry[] = [entry('Я', 't0', 'Короткая мысль')];
    const chunks = chunkTranscript(transcript, META);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Я: Короткая мысль');
    expect(chunks[0].startTimestamp).toBe('t0');
  });

  it('пустой транскрипт без summary даёт пустой список кусков', () => {
    expect(chunkTranscript([], META)).toEqual([]);
  });
});

// ─── Склейка спикеров ────────────────────────────────────────────────────────

describe('chunkTranscript — speakers', () => {
  it('собирает уникальный список спикеров куска в порядке первого появления', () => {
    const transcript: TranscriptEntry[] = [
      entry('Максим', 't0', 'Привет всем'),
      entry('Я', 't1', 'Привет, начинаем'),
      entry('Максим', 't2', 'Погнали'),
    ];

    const chunks = chunkTranscript(transcript, META);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].speakers).toEqual(['Максим', 'Я']);
    expect(chunks[0].text).toBe('Максим: Привет всем\nЯ: Привет, начинаем\nМаксим: Погнали');
  });
});

// ─── Пропуск тишины/пустых реплик ───────────────────────────────────────────

describe('chunkTranscript — пропуск пустых реплик', () => {
  it('пропускает пустые строки и маркеры "[Тишина]" (в любом регистре)', () => {
    const transcript: TranscriptEntry[] = [
      entry('Я', 't0', 'Первая мысль'),
      entry('Я', 't1', ''),
      entry('Я', 't2', '   '),
      entry('Участник 1', 't3', '[Тишина]'),
      entry('Участник 1', 't4', '[тишина]'),
      entry('Я', 't5', 'Вторая мысль'),
    ];

    const chunks = chunkTranscript(transcript, META);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Я: Первая мысль\nЯ: Вторая мысль');
    expect(chunks[0].speakers).toEqual(['Я']);
    expect(chunks[0].startTimestamp).toBe('t0');
  });

  it('если все реплики — тишина/пустые, а summary не передан — кусков нет', () => {
    const transcript: TranscriptEntry[] = [
      entry('Я', 't0', '[Тишина]'),
      entry('Я', 't1', ''),
    ];
    expect(chunkTranscript(transcript, META)).toEqual([]);
  });
});

// ─── Сводный кусок из summary ────────────────────────────────────────────────

describe('chunkTranscript — сводный кусок из summary', () => {
  it('добавляет один дополнительный кусок из summary в конец списка', () => {
    const transcript: TranscriptEntry[] = [entry('Я', 't0', 'Реплика')];
    const chunks = chunkTranscript(transcript, META, 'Обсудили дедлайны и распределили задачи.');

    expect(chunks).toHaveLength(2);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[1].speakers).toEqual([]);
    expect(chunks[1].startTimestamp).toBe('');
    expect(chunks[1].text).toContain(META.title);
    expect(chunks[1].text).toContain('Обсудили дедлайны и распределили задачи.');
  });

  it('не добавляет сводный кусок для пустого/пробельного summary', () => {
    const transcript: TranscriptEntry[] = [entry('Я', 't0', 'Реплика')];
    expect(chunkTranscript(transcript, META, '')).toHaveLength(1);
    expect(chunkTranscript(transcript, META, '   ')).toHaveLength(1);
    expect(chunkTranscript(transcript, META, undefined)).toHaveLength(1);
  });

  it('summary-кусок создаётся даже если сам транскрипт пуст', () => {
    const chunks = chunkTranscript([], META, 'Короткая запись без слов.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });
});

// ─── Метаданные и детерминизм ────────────────────────────────────────────────

describe('chunkTranscript — метаданные и детерминизм', () => {
  it('проставляет recordingId/recordingTitle/recordingDate на каждый кусок из meta', () => {
    const transcript: TranscriptEntry[] = [
      entry('Я', 't0', 'A'.repeat(500)),
      entry('Я', 't1', 'B'.repeat(500)),
    ];
    const chunks = chunkTranscript(transcript, META);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.recordingId).toBe(META.recordingId);
      expect(chunk.recordingTitle).toBe(META.title);
      expect(chunk.recordingDate).toBe(META.date);
    }
    // chunkIndex последовательны и уникальны
    expect(chunks.map(c => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('детерминирована: одинаковый вход даёт идентичный результат', () => {
    const transcript: TranscriptEntry[] = [
      entry('Максим', 't0', 'Первая реплика подлиннее для проверки'),
      entry('Я', 't1', 'Вторая реплика'),
    ];
    const a = chunkTranscript(transcript, META, 'Итог встречи');
    const b = chunkTranscript(transcript, META, 'Итог встречи');
    expect(a).toEqual(b);
  });
});

// ─── toTranscriptEntries (санитайзер unknown → TranscriptEntry[]) ──────────

describe('toTranscriptEntries', () => {
  it('отбрасывает не-массив и возвращает []', () => {
    expect(toTranscriptEntries(undefined)).toEqual([]);
    expect(toTranscriptEntries(null)).toEqual([]);
    expect(toTranscriptEntries('строка')).toEqual([]);
    expect(toTranscriptEntries({})).toEqual([]);
  });

  it('отбрасывает элементы с некорректными полями, оставляя валидные', () => {
    const input: unknown[] = [
      { speaker: 'Я', timestamp: '00:00', text: 'Привет' },
      { speaker: 'Я', timestamp: '00:05' }, // нет text
      { speaker: 123, timestamp: '00:10', text: 'Тест' }, // speaker не строка
      null,
      'мусор',
      { speaker: 'Максим', timestamp: '00:15', text: 'Погнали' },
    ];
    const result = toTranscriptEntries(input);
    expect(result).toEqual([
      { speaker: 'Я', timestamp: '00:00', text: 'Привет' },
      { speaker: 'Максим', timestamp: '00:15', text: 'Погнали' },
    ]);
  });
});
