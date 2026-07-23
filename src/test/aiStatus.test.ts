import { describe, it, expect } from 'vitest';

/**
 * Правило: статус ошибки НЕ должен затирать уже сохранённую расшифровку.
 *
 * Живой случай (23 июля 2026): две записи на бою показывали «Ошибка обработки»,
 * хотя в базе лежали готовые заголовок, саммари, теги и транскрипт с таймкодами.
 * Сбой на шаге ПОСЛЕ сохранения транскрипта безусловно ставил aiStatus: 'error'
 * и прятал результат от пользователя.
 *
 * Здесь проверяется решающее условие. Оно продублировано в двух местах
 * (server/routes/processing.ts и src/App.tsx) — если правило где-то потеряют,
 * тест не поймает это автоматически, но зафиксирует ожидаемое поведение.
 */
function shouldMarkAsError(transcript: unknown): boolean {
  return !(Array.isArray(transcript) && transcript.length > 0);
}

const REPLICA = { speaker: 'Я', timestamp: '00:03', text: 'Мы читали мы читали' };

describe('shouldMarkAsError', () => {
  it('ставит ошибку, когда расшифровки нет — пользователь должен знать о сбое', () => {
    expect(shouldMarkAsError(undefined)).toBe(true);
    expect(shouldMarkAsError(null)).toBe(true);
    expect(shouldMarkAsError([])).toBe(true);
  });

  it('НЕ ставит ошибку, когда расшифровка уже сохранена', () => {
    expect(shouldMarkAsError([REPLICA])).toBe(false);
  });

  it('одной реплики достаточно, чтобы считать запись удавшейся', () => {
    // Реальный случай: 3-секундное аудио дало одну реплику «Паран кик ну му».
    // Результат скудный, но это не ошибка обработки — показывать его надо.
    expect(shouldMarkAsError([{ speaker: 'Я', timestamp: '00:01', text: 'Паран кик ну му' }])).toBe(false);
  });

  it('битое значение вместо массива трактуется как отсутствие расшифровки', () => {
    expect(shouldMarkAsError('транскрипт')).toBe(true);
    expect(shouldMarkAsError({ 0: REPLICA })).toBe(true);
  });
});
