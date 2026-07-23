// Обвязка лимита расшифровки для роутов: одинаковая проверка «до» и списание «после»
// во всех трёх точках, где аудио уходит в Gemini (/transcribe, /retranscribe,
// /process-recording). Сама арифметика и работа с Firestore — в ./usage.

import type { Response } from 'express';
import {
  assertQuota,
  audioSecondsFromUsage,
  billableSeconds,
  recordUsage,
  QuotaExceededError,
  type UsageSnapshot,
} from './usage';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Проверка лимита ПЕРЕД вызовом Gemini.
 * Возвращает null — можно продолжать; снимок расхода — лимит выбран.
 *
 * Если падает сама проверка (Firestore недоступен), поведение разное:
 * в проде пробрасываем ошибку — тихо потерянный лимит превращается в неожиданный
 * счёт, а это ровно то, от чего защищаемся; в деве пропускаем, чтобы локальный
 * сервер без FIREBASE_SERVICE_ACCOUNT_JSON продолжал работать.
 */
export async function checkQuota(uid: string, estimatedSeconds: number): Promise<UsageSnapshot | null> {
  try {
    await assertQuota(uid, estimatedSeconds);
    return null;
  } catch (error) {
    if (error instanceof QuotaExceededError) return error.usage;
    console.error('[quota] check failed:', error);
    if (IS_PRODUCTION) throw error;
    return null;
  }
}

/**
 * Списывает фактический расход по usageMetadata ответа Gemini.
 * Никогда не бросает: расшифровка уже сделана и оплачена, и ронять её из-за
 * проблемы с учётом бессмысленно. Сбой видно в логах по метке [quota].
 */
export async function chargeUsage(uid: string, usageMetadata: unknown, clientSeconds: number): Promise<void> {
  try {
    const seconds = billableSeconds(clientSeconds, audioSecondsFromUsage(usageMetadata));
    await recordUsage(uid, seconds);
  } catch (error) {
    console.error('[quota] failed to record usage:', error);
  }
}

/** Единый формат отказа по лимиту — клиент разбирает его в QuotaExceededError. */
export function sendQuotaExceeded(res: Response, usage: UsageSnapshot): void {
  res.status(429).json({ error: 'quota_exceeded', usage });
}
