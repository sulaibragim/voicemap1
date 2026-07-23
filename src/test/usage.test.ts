import { describe, it, expect, afterEach } from 'vitest';
import {
  monthKey,
  resolvePlan,
  planLimitSeconds,
  parseDurationToSeconds,
  audioSecondsFromUsage,
  billableSeconds,
} from '../../server/lib/usage';

// Лимиты и ставка токенов читаются из env лениво — чистим после каждого теста,
// чтобы значения не протекали между кейсами.
const ENV_KEYS = ['PLAN_FREE_MINUTES', 'PLAN_PRO_MINUTES', 'PLAN_TEAM_MINUTES', 'GEMINI_AUDIO_TOKENS_PER_SEC'];
afterEach(() => {
  ENV_KEYS.forEach(key => { delete process.env[key]; });
});

describe('monthKey', () => {
  it('форматирует месяц как YYYY-MM с ведущим нулём', () => {
    expect(monthKey(new Date('2026-07-23T12:00:00Z'))).toBe('2026-07');
    expect(monthKey(new Date('2026-11-01T00:00:00Z'))).toBe('2026-11');
  });

  it('считает месяц по UTC, а не по локали сервера', () => {
    // 31 июля 23:30 UTC — в любом часовом поясе восточнее это уже 1 августа.
    // Ключ обязан остаться июльским, иначе счётчик прыгнет при переезде сервера.
    expect(monthKey(new Date('2026-07-31T23:30:00Z'))).toBe('2026-07');
    // И симметрично: 1 августа 00:30 UTC — уже август, хотя западнее ещё июль.
    expect(monthKey(new Date('2026-08-01T00:30:00Z'))).toBe('2026-08');
  });
});

describe('resolvePlan', () => {
  it('пропускает известные тарифы', () => {
    expect(resolvePlan('free')).toBe('free');
    expect(resolvePlan('pro')).toBe('pro');
    expect(resolvePlan('team')).toBe('team');
  });

  it('любое неизвестное или битое значение сводит к самому строгому тарифу', () => {
    expect(resolvePlan('enterprise')).toBe('free');
    expect(resolvePlan(undefined)).toBe('free');
    expect(resolvePlan(null)).toBe('free');
    expect(resolvePlan(42)).toBe('free');
    expect(resolvePlan({ plan: 'pro' })).toBe('free');
  });
});

describe('planLimitSeconds', () => {
  it('без env отдаёт лимиты по умолчанию', () => {
    expect(planLimitSeconds('free')).toBe(120 * 60);
    expect(planLimitSeconds('pro')).toBe(1200 * 60);
    expect(planLimitSeconds('team')).toBe(3600 * 60);
  });

  it('переопределяется переменной окружения — лимит меняется без пересборки', () => {
    process.env.PLAN_FREE_MINUTES = '30';
    expect(planLimitSeconds('free')).toBe(30 * 60);
  });

  it('игнорирует мусор и неположительные значения в env', () => {
    process.env.PLAN_PRO_MINUTES = 'много';
    expect(planLimitSeconds('pro')).toBe(1200 * 60);

    process.env.PLAN_PRO_MINUTES = '0';
    expect(planLimitSeconds('pro')).toBe(1200 * 60);

    process.env.PLAN_PRO_MINUTES = '-10';
    expect(planLimitSeconds('pro')).toBe(1200 * 60);
  });
});

describe('parseDurationToSeconds', () => {
  it('разбирает MM:SS и HH:MM:SS', () => {
    expect(parseDurationToSeconds('12:34')).toBe(754);
    expect(parseDurationToSeconds('00:45')).toBe(45);
    expect(parseDurationToSeconds('1:02:33')).toBe(3753);
  });

  it('принимает уже готовое число секунд', () => {
    expect(parseDurationToSeconds(90)).toBe(90);
    expect(parseDurationToSeconds(12.6)).toBe(13);
  });

  it('всё непонятное считает нулём, а не бросает', () => {
    expect(parseDurationToSeconds('')).toBe(0);
    expect(parseDurationToSeconds('--:--')).toBe(0);
    expect(parseDurationToSeconds('abc')).toBe(0);
    expect(parseDurationToSeconds('1:2:3:4')).toBe(0);
    expect(parseDurationToSeconds('-5:00')).toBe(0);
    expect(parseDurationToSeconds(null)).toBe(0);
    expect(parseDurationToSeconds(undefined)).toBe(0);
    expect(parseDurationToSeconds(NaN)).toBe(0);
  });
});

describe('audioSecondsFromUsage', () => {
  it('берёт чистое аудио из разбивки по модальностям', () => {
    const meta = {
      promptTokenCount: 32_500,
      promptTokensDetails: [
        { modality: 'TEXT', tokenCount: 500 },
        { modality: 'AUDIO', tokenCount: 32_000 },
      ],
    };
    // 32 000 токенов / 32 токена в секунду = 1000 секунд, текст промпта не в счёт
    expect(audioSecondsFromUsage(meta)).toBe(1000);
  });

  it('без разбивки использует общий promptTokenCount', () => {
    expect(audioSecondsFromUsage({ promptTokenCount: 3200 })).toBe(100);
  });

  it('уважает ставку токенов из env', () => {
    process.env.GEMINI_AUDIO_TOKENS_PER_SEC = '25';
    expect(audioSecondsFromUsage({ promptTokenCount: 2500 })).toBe(100);
  });

  it('на отсутствующих или битых метаданных отдаёт 0', () => {
    expect(audioSecondsFromUsage(undefined)).toBe(0);
    expect(audioSecondsFromUsage(null)).toBe(0);
    expect(audioSecondsFromUsage({})).toBe(0);
    expect(audioSecondsFromUsage({ promptTokenCount: 'много' })).toBe(0);
    expect(audioSecondsFromUsage({ promptTokensDetails: 'нет' })).toBe(0);
  });
});

describe('billableSeconds', () => {
  it('у честного клиента числа сходятся — берётся большее', () => {
    expect(billableSeconds(600, 598)).toBe(600);
    expect(billableSeconds(598, 600)).toBe(600);
  });

  it('заниженная клиентом длительность не уменьшает списание', () => {
    // Клиент заявил секунду на часовой записи — считаем по токенам
    expect(billableSeconds(1, 3600)).toBe(3600);
  });

  it('работает, когда известна только одна из величин', () => {
    expect(billableSeconds(0, 300)).toBe(300);
    expect(billableSeconds(300, 0)).toBe(300);
  });

  it('мусор и отрицательные значения не уводят списание в минус', () => {
    expect(billableSeconds(NaN, 120)).toBe(120);
    expect(billableSeconds(-50, -10)).toBe(0);
    expect(billableSeconds(0, 0)).toBe(0);
  });
});
