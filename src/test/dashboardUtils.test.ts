import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatTotalTime,
  parseRecDate,
} from '../lib/dashboardUtils';

// ─── parseDuration ────────────────────────────────────────────────────────────

describe('parseDuration', () => {
  it('конвертирует "01:30" → 90 секунд', () => {
    expect(parseDuration('01:30')).toBe(90);
  });

  it('конвертирует "00:45" → 45 секунд', () => {
    expect(parseDuration('00:45')).toBe(45);
  });

  it('конвертирует "00:00" → 0 секунд', () => {
    expect(parseDuration('00:00')).toBe(0);
  });

  it('конвертирует "10:00" → 600 секунд', () => {
    expect(parseDuration('10:00')).toBe(600);
  });
});

// ─── formatTotalTime ──────────────────────────────────────────────────────────

describe('formatTotalTime', () => {
  it('форматирует 45 минут как "45 мин"', () => {
    expect(formatTotalTime(45 * 60)).toBe('45 мин');
  });

  it('форматирует 90 минут как "1ч 30м"', () => {
    expect(formatTotalTime(90 * 60)).toBe('1ч 30м');
  });

  it('форматирует 120 минут как "2ч" (без остатка)', () => {
    expect(formatTotalTime(120 * 60)).toBe('2ч');
  });

  it('форматирует 0 секунд как "0 мин"', () => {
    expect(formatTotalTime(0)).toBe('0 мин');
  });

  it('форматирует 1 минуту как "1 мин"', () => {
    expect(formatTotalTime(60)).toBe('1 мин');
  });

  it('форматирует 3 часа 15 минут как "3ч 15м"', () => {
    expect(formatTotalTime((3 * 60 + 15) * 60)).toBe('3ч 15м');
  });
});

// ─── parseRecDate ─────────────────────────────────────────────────────────────

describe('parseRecDate', () => {
  it('парсит "Сегодня" как сегодняшнюю дату', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = parseRecDate('Сегодня');
    expect(result).not.toBeNull();
    result!.setHours(0, 0, 0, 0);
    expect(result!.getTime()).toBe(today.getTime());
  });

  it('парсит "сегодня" (нижний регистр) как сегодняшнюю дату', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = parseRecDate('сегодня');
    expect(result).not.toBeNull();
    result!.setHours(0, 0, 0, 0);
    expect(result!.getTime()).toBe(today.getTime());
  });

  it('парсит "Вчера" как вчерашнюю дату', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const result = parseRecDate('Вчера');
    expect(result).not.toBeNull();
    result!.setHours(0, 0, 0, 0);
    expect(result!.getTime()).toBe(yesterday.getTime());
  });

  it('парсит формат "01.05.2025" в Date(2025, 4, 1)', () => {
    const result = parseRecDate('01.05.2025');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(4); // май = индекс 4
    expect(result!.getDate()).toBe(1);
  });

  it('парсит "1.5.2025" (без нулей) корректно', () => {
    const result = parseRecDate('1.5.2025');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(4);
    expect(result!.getDate()).toBe(1);
  });

  it('возвращает null для пустой строки', () => {
    expect(parseRecDate('')).toBeNull();
  });

  it('возвращает null при некорректном вводе', () => {
    expect(parseRecDate('не дата')).toBeNull();
  });
});
