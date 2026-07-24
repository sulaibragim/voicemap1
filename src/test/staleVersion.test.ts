import { describe, it, expect } from 'vitest';
import { isStaleChunkError } from '../lib/staleVersion';

/**
 * Отличить «браузер держит старую версию» от прочих сбоев.
 *
 * Ошибиться в обе стороны плохо: пропустим — пользователь останется с
 * незагружающимся экраном до ручной чистки кэша; сработаем на чужой ошибке —
 * получим перезагрузку там, где она ничего не чинит.
 */

describe('isStaleChunkError — устаревший кэш', () => {
  it('узнаёт провал динамического импорта во всех формулировках браузеров', () => {
    // Chrome
    expect(isStaleChunkError(new Error(
      "Failed to fetch dynamically imported module: https://app/assets/SettingsView-abc.js",
    ))).toBe(true);
    // Safari
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
    // Firefox
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
    // Vite, когда пропал CSS сборки
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/index-abc.css'))).toBe(true);
  });

  it('принимает и строку, а не только Error', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(true);
  });
});

describe('isStaleChunkError — что перезагрузкой не чинится', () => {
  it('обычные ошибки приложения не трогаем', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of null'))).toBe(false);
    expect(isStaleChunkError(new TypeError('x is not a function'))).toBe(false);
  });

  it('сетевые и серверные сбои — не про кэш', () => {
    expect(isStaleChunkError(new Error('NetworkError when attempting to fetch resource'))).toBe(false);
    expect(isStaleChunkError(new Error('API error: 500'))).toBe(false);
    expect(isStaleChunkError(new Error('Failed to fetch'))).toBe(false);
  });

  it('пустое и мусор не считаются устаревшим кэшем', () => {
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError('')).toBe(false);
    expect(isStaleChunkError({ code: 42 })).toBe(false);
  });
});
