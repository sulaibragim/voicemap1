import { describe, it, expect } from 'vitest';
import { isSilent, isEmptyRecording, countEmptyRecordings, emptyRecordingIds } from '../lib/emptyRecording';
import type { Recording } from '../types';

function rec(patch: Partial<Recording> = {}): Recording {
  return {
    id: 'r1',
    title: 'Планёрка',
    date: '23 июля в 10:30',
    duration: '10:00',
    tags: [],
    summary: 'Обсудили запуск',
    transcript: [{ speaker: 'Я', timestamp: '00:03', text: 'Начнём' }],
    aiStatus: 'done',
    ...patch,
  } as Recording;
}

describe('isSilent', () => {
  it('узнаёт заглушку тишины на обоих языках', () => {
    expect(isSilent(rec({ title: '[Тишина]' }))).toBe(true);
    expect(isSilent(rec({ title: '[Silence]' }))).toBe(true);
  });

  it('не путает с настоящей записью', () => {
    expect(isSilent(rec({ title: 'Планёрка по проекту' }))).toBe(false);
    expect(isSilent(rec({ title: 'Тишина в переговорке' }))).toBe(false);
  });
});

describe('isEmptyRecording', () => {
  it('тишина — пустая, даже если длинная', () => {
    expect(isEmptyRecording(rec({ title: '[Тишина]', duration: '25:00' }))).toBe(true);
  });

  it('короткая запись без расшифровки — пустая', () => {
    expect(isEmptyRecording(rec({
      title: 'Запись', duration: '00:03', transcript: [], summary: '',
    }))).toBe(true);
  });

  it('короткая запись С расшифровкой — НЕ пустая', () => {
    // Три секунды «позвонить Максиму» — короткая, но полезная
    expect(isEmptyRecording(rec({
      duration: '00:03',
      transcript: [{ speaker: 'Я', timestamp: '00:01', text: 'позвонить Максиму' }],
    }))).toBe(false);
  });

  it('длинная запись без расшифровки НЕ считается пустой', () => {
    // Час аудио без транскрипта — это сбой обработки, а не мусор.
    // Выбросить такое значит потерять запись, которую можно расшифровать заново.
    expect(isEmptyRecording(rec({
      duration: '60:00', transcript: [], summary: '',
    }))).toBe(false);
  });

  it('запись в обработке никогда не пустая — результат ещё впереди', () => {
    expect(isEmptyRecording(rec({
      aiStatus: 'processing', title: 'Обрабатывается...', transcript: [], summary: '', duration: '00:02',
    }))).toBe(false);
  });

  it('упавшую с ошибкой не трогаем — её надо перезапустить, а не удалить', () => {
    expect(isEmptyRecording(rec({
      aiStatus: 'error', transcript: [], summary: '', duration: '00:03',
    }))).toBe(false);
  });

  it('запись без расшифровки из-за лимита не считается мусором', () => {
    expect(isEmptyRecording(rec({
      aiStatus: 'quota', title: 'Без расшифровки', transcript: [], summary: '', duration: '30:00',
    }))).toBe(false);
  });
});

describe('countEmptyRecordings и emptyRecordingIds', () => {
  const list = [
    rec({ id: 'good', title: 'Планёрка' }),
    rec({ id: 'silent', title: '[Тишина]', duration: '00:25' }),
    rec({ id: 'short', title: 'Запись', duration: '00:02', transcript: [], summary: '' }),
    rec({ id: 'failed', aiStatus: 'error', transcript: [], summary: '', duration: '00:03' }),
  ];

  it('считает только настоящий мусор', () => {
    expect(countEmptyRecordings(list)).toBe(2);
  });

  it('отдаёт их идентификаторы в порядке списка', () => {
    expect(emptyRecordingIds(list)).toEqual(['silent', 'short']);
  });

  it('на чистом списке ничего не находит', () => {
    expect(countEmptyRecordings([rec()])).toBe(0);
    expect(emptyRecordingIds([])).toEqual([]);
  });
});
