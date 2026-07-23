import { describe, it, expect } from 'vitest';

/**
 * Правило ретраев при загрузке аудио.
 *
 * Запись существует только в памяти браузера: уронить её из-за моргнувшего
 * вайфая нельзя — пользователь потеряет часовую встречу безвозвратно.
 * Но и повторять бессмысленное тоже нельзя: истёкший токен (401) или
 * исчерпанный лимит (429) от третьей попытки не исправятся, а пользователь
 * будет ждать впустую.
 *
 * Здесь зафиксировано решающее условие из src/lib/api.ts.
 */
function shouldRetry(status: number | null): boolean {
  if (status === null) return true;      // сеть не ответила — транзиентный сбой
  if (status < 500) return false;        // клиентская ошибка — повтор не поможет
  return true;                           // 5xx — сервер прилёг, пробуем ещё
}

describe('shouldRetry — что повторяем при загрузке аудио', () => {
  it('сетевой сбой повторяем: вайфай моргнул, запись терять нельзя', () => {
    expect(shouldRetry(null)).toBe(true);
  });

  it('ошибки сервера повторяем', () => {
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(502)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
  });

  it('истёкший токен не повторяем — от третьей попытки он не оживёт', () => {
    expect(shouldRetry(401)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
  });

  it('исчерпанный лимит не повторяем — это осознанный отказ, а не сбой', () => {
    expect(shouldRetry(429)).toBe(false);
  });

  it('битый запрос не повторяем', () => {
    expect(shouldRetry(400)).toBe(false);
    expect(shouldRetry(413)).toBe(false);
  });

  it('успех не повторяем', () => {
    expect(shouldRetry(200)).toBe(false);
  });
});
