import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * requireAuth — единственная дверь ко всем платным и приватным роутам.
 * Дыра здесь означает: чужие записи читаются, чужой лимит тратится.
 *
 * Три режима работы: прод (только реальная верификация), дев с service account
 * (то же самое) и дев без него (декодирование JWT без проверки подписи — ТОЛЬКО
 * при явном opt-in ALLOW_INSECURE_DEV_AUTH).
 */

const state = vi.hoisted(() => ({
  verify: async (_token: string): Promise<{ uid: string }> => ({ uid: 'verified-uid' }),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: (token: string) => state.verify(token) }),
}));

const ORIGINAL_ENV = { ...process.env };

/** Собирает поддельные req/res и возвращает то, чем всё кончилось */
async function run(authHeader: string | undefined) {
  // Модуль читает NODE_ENV на уровне импорта — каждый прогон берём свежий
  vi.resetModules();
  const { requireAuth } = await import('../../server/lib/auth');

  const req = { headers: authHeader ? { authorization: authHeader } : {} } as Request;
  let status: number | null = null;
  let body: unknown = null;
  let nextCalled = false;

  const res = {
    status(code: number) { status = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  } as unknown as Response;

  await requireAuth(req, res, (() => { nextCalled = true; }) as NextFunction);

  return { status, body, nextCalled, uid: (req as Request & { uid?: string }).uid };
}

/** JWT без подписи: только payload имеет значение для дев-фолбэка */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

beforeEach(() => {
  state.verify = async () => ({ uid: 'verified-uid' });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ─── Общее для всех режимов ─────────────────────────────────────────────────

describe('requireAuth — заголовок', () => {
  it('без заголовка не пускает', async () => {
    const r = await run(undefined);
    expect(r.status).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  it('не пускает чужую схему авторизации', async () => {
    expect((await run('Basic dXNlcjpwYXNz')).status).toBe(401);
    expect((await run('bearer token')).status).toBe(401);   // регистр важен
    expect((await run('Bearer')).status).toBe(401);
  });
});

// ─── Продакшн ───────────────────────────────────────────────────────────────

describe('requireAuth — продакшн', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
  });

  it('пропускает с валидным токеном и кладёт uid из НЕГО, а не из тела запроса', async () => {
    state.verify = async () => ({ uid: 'real-user-42' });
    const r = await run('Bearer good-token');

    expect(r.nextCalled).toBe(true);
    expect(r.uid).toBe('real-user-42');
  });

  it('не пропускает с невалидным токеном', async () => {
    state.verify = async () => { throw new Error('Token expired'); };
    const r = await run('Bearer expired');

    expect(r.status).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  it('без service account отказывает всем — сервер сломан, а не «пускай всех»', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const r = await run('Bearer any-token');

    expect(r.status).toBe(500);
    expect(r.nextCalled).toBe(false);
  });

  it('НЕ принимает неподписанный JWT, даже если внутри есть uid', async () => {
    // Главная проверка: дев-фолбэк не должен просачиваться в прод.
    // Иначе кто угодно подделает payload и получит чужие записи.
    state.verify = async () => { throw new Error('Invalid signature'); };
    const r = await run(`Bearer ${fakeJwt({ sub: 'victim-uid' })}`);

    expect(r.status).toBe(401);
    expect(r.uid).toBeUndefined();
  });
});

// ─── Дев с service account: ведёт себя как прод ─────────────────────────────

describe('requireAuth — дев с service account', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
  });

  it('верифицирует токен по-настоящему', async () => {
    state.verify = async () => ({ uid: 'dev-user' });
    const r = await run('Bearer token');
    expect(r.uid).toBe('dev-user');
  });

  it('невалидный токен не проходит', async () => {
    state.verify = async () => { throw new Error('bad'); };
    expect((await run('Bearer bad')).status).toBe(401);
  });
});

// ─── Дев без service account: небезопасный фолбэк ───────────────────────────

describe('requireAuth — дев без service account', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  });

  it('без явного opt-in отказывает — безопасное поведение по умолчанию', async () => {
    delete process.env.ALLOW_INSECURE_DEV_AUTH;
    const r = await run(`Bearer ${fakeJwt({ sub: 'anyone' })}`);

    expect(r.status).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  it('значение кроме "true" не включает фолбэк', async () => {
    process.env.ALLOW_INSECURE_DEV_AUTH = '1';
    expect((await run(`Bearer ${fakeJwt({ sub: 'anyone' })}`)).status).toBe(401);

    process.env.ALLOW_INSECURE_DEV_AUTH = 'yes';
    expect((await run(`Bearer ${fakeJwt({ sub: 'anyone' })}`)).status).toBe(401);
  });

  it('с явным opt-in читает uid из payload без проверки подписи', async () => {
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    const r = await run(`Bearer ${fakeJwt({ sub: 'local-dev' })}`);

    expect(r.nextCalled).toBe(true);
    expect(r.uid).toBe('local-dev');
  });

  it('понимает user_id вместо sub', async () => {
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    const r = await run(`Bearer ${fakeJwt({ user_id: 'legacy-field' })}`);
    expect(r.uid).toBe('legacy-field');
  });

  it('payload без uid не проходит', async () => {
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    const r = await run(`Bearer ${fakeJwt({ email: 'a@b.c' })}`);
    expect(r.status).toBe(401);
  });

  it('мусор вместо JWT не роняет сервер', async () => {
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    expect((await run('Bearer не-jwt')).status).toBe(401);
    expect((await run('Bearer a.b')).status).toBe(401);
    expect((await run('Bearer a.b.c.d')).status).toBe(401);
  });
});
