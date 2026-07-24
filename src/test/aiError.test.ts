import { describe, it, expect } from 'vitest';
import { classifyAiError } from '../../server/lib/aiError';

/**
 * Разбор отказов Gemini в понятную причину.
 *
 * Раньше мёртвый ключ, исчерпанная квота и недоступная модель выглядели
 * одинаково — «AI request failed». Владелец видел ошибку и не мог понять,
 * менять ключ, ждать сброса квоты или это сбой сети.
 */

/** Ошибка в том виде, в каком её отдаёт SDK: сообщение плюс числовой статус */
function apiError(message: string, status?: number): Error {
  const err = new Error(message);
  if (status !== undefined) Object.assign(err, { status });
  return err;
}

describe('classifyAiError — недействительный ключ', () => {
  it('узнаёт отказ по ключу и советует, что чинить', () => {
    const info = classifyAiError(apiError('API key not valid. Please pass a valid API key.', 400));
    expect(info.reason).toBe('invalid_key');
    expect(info.message).toContain('GEMINI_API_KEY');
  });

  it('узнаёт отозванный ключ и отказ в правах', () => {
    expect(classifyAiError(apiError('Permission denied', 403)).reason).toBe('invalid_key');
    expect(classifyAiError(apiError('Unauthorized', 401)).reason).toBe('invalid_key');
  });

  it('отдаёт 502: проблема на нашей стороне, а не у пользователя', () => {
    expect(classifyAiError(apiError('API key not valid', 400)).status).toBe(502);
  });
});

describe('classifyAiError — исчерпанная квота', () => {
  it('узнаёт превышение лимита в разных формулировках', () => {
    expect(classifyAiError(apiError('Quota exceeded', 429)).reason).toBe('quota');
    expect(classifyAiError(apiError('RESOURCE_EXHAUSTED')).reason).toBe('quota');
    expect(classifyAiError(apiError('rate limit reached')).reason).toBe('quota');
  });

  it('советует подождать, а не чинить', () => {
    expect(classifyAiError(apiError('Quota exceeded', 429)).message).toContain('через несколько минут');
  });

  it('отдаёт 429 — это временно и повторяемо', () => {
    expect(classifyAiError(apiError('Quota exceeded', 429)).status).toBe(429);
  });
});

describe('classifyAiError — недоступная модель', () => {
  it('узнаёт отсутствующую модель', () => {
    // Реальный случай: text-embedding-004 отдавала 404 для этого ключа
    const info = classifyAiError(apiError('models/text-embedding-004 is not found', 404));
    expect(info.reason).toBe('model_missing');
    expect(info.message).toContain('Модель');
  });
});

describe('classifyAiError — сеть', () => {
  it('отличает сбой связи от отказа сервиса', () => {
    expect(classifyAiError(apiError('fetch failed')).reason).toBe('network');
    expect(classifyAiError(apiError('ECONNREFUSED')).reason).toBe('network');
    expect(classifyAiError(apiError('request timeout')).reason).toBe('network');
  });
});

describe('classifyAiError — неизвестное', () => {
  it('не выдумывает причину, но и не молчит', () => {
    const info = classifyAiError(apiError('Something strange happened'));
    expect(info.reason).toBe('unknown');
    expect(info.message).toContain('логах');
  });

  it('переживает не-Error значения', () => {
    expect(classifyAiError(undefined).reason).toBe('unknown');
    expect(classifyAiError(null).reason).toBe('unknown');
    expect(classifyAiError('строка').reason).toBe('unknown');
  });

  it('не раскрывает наружу текст от SDK — он остаётся в логах', () => {
    const secret = 'key=AIzaSyDsecret123 failed';
    expect(classifyAiError(apiError(secret)).message).not.toContain('AIzaSy');
  });
});
