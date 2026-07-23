import { describe, it, expect } from 'vitest';
import type { TranscriptionUsage } from '../lib/api';
import {
  formatDurationHuman,
  usagePercent,
  isUsageLow,
  planLabel,
  quotaToastMessage,
} from '../lib/usageFormat';

function usage(patch: Partial<TranscriptionUsage> = {}): TranscriptionUsage {
  const base: TranscriptionUsage = {
    plan: 'pro',
    month: '2026-07',
    usedSeconds: 0,
    limitSeconds: 20 * 3600,
    remainingSeconds: 20 * 3600,
  };
  return { ...base, ...patch };
}

describe('formatDurationHuman', () => {
  it('показывает часы и минуты', () => {
    expect(formatDurationHuman(2 * 3600 + 15 * 60)).toBe('2 ч 15 мин');
    expect(formatDurationHuman(20 * 3600)).toBe('20 ч');
    expect(formatDurationHuman(45 * 60)).toBe('45 мин');
  });

  it('короткие интервалы не превращает в «0 мин»', () => {
    expect(formatDurationHuman(30)).toBe('меньше минуты');
  });

  it('ноль, отрицательные и мусор дают «0 мин»', () => {
    expect(formatDurationHuman(0)).toBe('0 мин');
    expect(formatDurationHuman(-100)).toBe('0 мин');
    expect(formatDurationHuman(NaN)).toBe('0 мин');
  });
});

describe('formatDurationHuman — английский', () => {
  it('использует английские единицы', () => {
    expect(formatDurationHuman(2 * 3600 + 15 * 60, 'en')).toBe('2 h 15 min');
    expect(formatDurationHuman(45 * 60, 'en')).toBe('45 min');
    expect(formatDurationHuman(30, 'en')).toBe('less than a minute');
    expect(formatDurationHuman(0, 'en')).toBe('0 min');
  });

  it('не оставляет кириллицы в английском выводе', () => {
    expect(formatDurationHuman(3661, 'en')).not.toMatch(/[а-яА-Я]/);
  });
});

describe('usagePercent', () => {
  it('считает долю израсходованного', () => {
    expect(usagePercent(usage({ usedSeconds: 10 * 3600, limitSeconds: 20 * 3600 }))).toBe(50);
    expect(usagePercent(usage({ usedSeconds: 0 }))).toBe(0);
  });

  it('не вылезает за 100 при перерасходе', () => {
    expect(usagePercent(usage({ usedSeconds: 25 * 3600, limitSeconds: 20 * 3600 }))).toBe(100);
  });

  it('нулевой лимит считает полностью выбранным, а не делит на ноль', () => {
    expect(usagePercent(usage({ usedSeconds: 0, limitSeconds: 0 }))).toBe(100);
  });
});

describe('isUsageLow', () => {
  it('срабатывает с 85% и выше', () => {
    expect(isUsageLow(usage({ usedSeconds: 17 * 3600, limitSeconds: 20 * 3600 }))).toBe(true);
    expect(isUsageLow(usage({ usedSeconds: 16 * 3600, limitSeconds: 20 * 3600 }))).toBe(false);
  });
});

describe('planLabel', () => {
  it('переводит идентификатор тарифа в подпись', () => {
    expect(planLabel('free')).toBe('Бесплатный');
    expect(planLabel('pro')).toBe('Pro');
    expect(planLabel('team')).toBe('Team');
  });

  it('на английском отдаёт английскую подпись', () => {
    expect(planLabel('free', 'en')).toBe('Free');
    expect(planLabel('pro', 'en')).toBe('Pro');
  });
});

describe('quotaToastMessage', () => {
  it('называет лимит, когда сервер прислал снимок расхода', () => {
    expect(quotaToastMessage(usage({ limitSeconds: 2 * 3600 }))).toContain('2 ч в месяц');
  });

  it('без снимка остаётся осмысленным', () => {
    const message = quotaToastMessage(undefined);
    expect(message).toContain('Лимит расшифровки исчерпан');
    expect(message).not.toContain('(');
  });

  it('на английском не смешивает языки', () => {
    const message = quotaToastMessage(usage({ limitSeconds: 2 * 3600 }), 'en');
    expect(message).toContain('Transcription limit reached');
    expect(message).toContain('2 h per month');
    expect(message).not.toMatch(/[а-яА-Я]/);
  });

  it('всегда говорит, что аудио не потеряно', () => {
    expect(quotaToastMessage(usage())).toContain('Аудио сохранено');
  });
});
