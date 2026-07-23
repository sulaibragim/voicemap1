import { describe, it, expect, beforeEach, vi } from 'vitest';

// Firestore подменяем целиком: проверяем решение про лимит, а не работу SDK.
// vi.hoisted — фабрика vi.mock поднимается выше импортов и не видит обычные const.
const state = vi.hoisted(() => ({
  profile: undefined as Record<string, unknown> | undefined,
  usage: undefined as Record<string, unknown> | undefined,
  written: [] as Record<string, unknown>[],
}));

vi.mock('firebase-admin/firestore', () => {
  const usageDoc = {
    get: async () => ({ data: () => state.usage }),
    set: async (data: Record<string, unknown>) => { state.written.push(data); },
  };
  const userDoc = {
    get: async () => ({ data: () => state.profile }),
    collection: () => ({ doc: () => usageDoc }),
  };
  return {
    getFirestore: () => ({ collection: () => ({ doc: () => userDoc }) }),
    FieldValue: {
      increment: (n: number) => ({ increment: n }),
      serverTimestamp: () => ({ serverTimestamp: true }),
    },
  };
});

const { getUsage, assertQuota, recordUsage, QuotaExceededError } = await import('../../server/lib/usage');
const { checkQuota } = await import('../../server/lib/quotaGuard');

const HOUR = 3600;
const FREE_LIMIT = 120 * 60;   // 2 часа
const PRO_LIMIT = 1200 * 60;   // 20 часов

beforeEach(() => {
  state.profile = undefined;
  state.usage = undefined;
  state.written = [];
});

describe('getUsage', () => {
  it('новый пользователь без документов — бесплатный тариф и нулевой расход', async () => {
    const usage = await getUsage('uid-1');
    expect(usage.plan).toBe('free');
    expect(usage.limitSeconds).toBe(FREE_LIMIT);
    expect(usage.usedSeconds).toBe(0);
    expect(usage.remainingSeconds).toBe(FREE_LIMIT);
  });

  it('читает тариф из профиля и расход из счётчика месяца', async () => {
    state.profile = { plan: 'pro' };
    state.usage = { seconds: 8 * HOUR };

    const usage = await getUsage('uid-1');
    expect(usage.plan).toBe('pro');
    expect(usage.limitSeconds).toBe(PRO_LIMIT);
    expect(usage.usedSeconds).toBe(8 * HOUR);
    expect(usage.remainingSeconds).toBe(PRO_LIMIT - 8 * HOUR);
  });

  it('при перерасходе остаток не уходит в минус', async () => {
    state.usage = { seconds: FREE_LIMIT + 500 };
    const usage = await getUsage('uid-1');
    expect(usage.remainingSeconds).toBe(0);
  });

  it('битое значение счётчика трактует как ноль, а не ломает ответ', async () => {
    state.usage = { seconds: 'много' };
    const usage = await getUsage('uid-1');
    expect(usage.usedSeconds).toBe(0);
  });
});

describe('assertQuota', () => {
  it('пропускает, когда запись помещается в остаток', async () => {
    state.usage = { seconds: 30 * 60 };
    await expect(assertQuota('uid-1', 10 * 60)).resolves.toBeTruthy();
  });

  it('пропускает, когда длительность неизвестна, но остаток есть', async () => {
    state.usage = { seconds: 30 * 60 };
    await expect(assertQuota('uid-1', 0)).resolves.toBeTruthy();
  });

  it('отказывает, когда лимит уже выбран', async () => {
    state.usage = { seconds: FREE_LIMIT };
    await expect(assertQuota('uid-1', 60)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('отказывает заранее, если запись длиннее остатка — не платим за заведомо лишний запрос', async () => {
    state.usage = { seconds: FREE_LIMIT - 5 * 60 };   // остался 5 минут
    await expect(assertQuota('uid-1', 30 * 60)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('в ошибке отдаёт снимок расхода — из него строится тело 429', async () => {
    state.profile = { plan: 'pro' };
    state.usage = { seconds: PRO_LIMIT };
    await expect(assertQuota('uid-1', 60)).rejects.toMatchObject({
      usage: { plan: 'pro', limitSeconds: PRO_LIMIT, remainingSeconds: 0 },
    });
  });
});

describe('recordUsage', () => {
  it('списывает атомарным инкрементом и помечает месяц', async () => {
    await recordUsage('uid-1', 754);
    expect(state.written).toHaveLength(1);
    expect(state.written[0]).toMatchObject({
      seconds: { increment: 754 },
      requests: { increment: 1 },
    });
    expect(state.written[0].month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('ничего не пишет при нулевом или отрицательном расходе', async () => {
    await recordUsage('uid-1', 0);
    await recordUsage('uid-1', -100);
    await recordUsage('uid-1', NaN);
    expect(state.written).toHaveLength(0);
  });
});

describe('checkQuota', () => {
  it('null означает «можно продолжать»', async () => {
    expect(await checkQuota('uid-1', 60)).toBeNull();
  });

  it('возвращает снимок расхода, когда лимит исчерпан', async () => {
    state.usage = { seconds: FREE_LIMIT };
    const result = await checkQuota('uid-1', 60);
    expect(result).toMatchObject({ plan: 'free', usedSeconds: FREE_LIMIT, remainingSeconds: 0 });
  });
});
