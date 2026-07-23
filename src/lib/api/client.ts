// Общая основа клиента API: адреса, авторизация, язык вывода AI, разбор ошибок.
// Всё остальное в src/lib/api/ строится на post() и getAuthHeader() отсюда.
//
// В продакшне (Capacitor / другой хост) используем абсолютный URL из env.
// В дев-режиме Vite проксирует /api на localhost:3001.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/ai';
export const API_ROOT = (import.meta.env.VITE_API_URL ?? '');

import { auth } from '../../firebase';

// ── Язык вывода AI ───────────────────────────────────────────────────────────
// Держим в модуле, а не протаскиваем параметром через два десятка вызовов.
// На сервер уходит только код языка из закрытого списка — промпт клиент не передаёт.

export type OutputLang = 'ru' | 'en';

let outputLang: OutputLang = 'ru';

/** Вызывается из App при загрузке и смене настроек пользователя. */
export function setApiLanguage(lang: OutputLang): void {
  outputLang = lang;
}

export function getApiLanguage(): OutputLang {
  return outputLang;
}

// Ретраи загрузки аудио: одинаковые для /api/r2/upload и /api/process-recording.
// Три попытки с нарастающей паузой покрывают типичное моргание сети.
export const UPLOAD_MAX_ATTEMPTS = 3;
export const UPLOAD_RETRY_BASE_MS = 800;

export async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// ── Лимит расшифровки ────────────────────────────────────────────────────────

/** Расход минут расшифровки за текущий месяц (сервер: GET /api/ai/usage) */
export interface TranscriptionUsage {
  plan: 'free' | 'pro' | 'team';
  /** Календарный месяц в UTC, формат YYYY-MM */
  month: string;
  usedSeconds: number;
  limitSeconds: number;
  remainingSeconds: number;
}

/** Сервер ответил 429: месячный лимит расшифровки исчерпан. */
export class QuotaExceededError extends Error {
  readonly usage?: TranscriptionUsage;

  constructor(usage?: TranscriptionUsage) {
    super('Transcription quota exceeded');
    this.name = 'QuotaExceededError';
    this.usage = usage;
  }
}

export function isTranscriptionUsage(value: unknown): value is TranscriptionUsage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.plan === 'string'
    && typeof v.month === 'string'
    && typeof v.usedSeconds === 'number'
    && typeof v.limitSeconds === 'number'
    && typeof v.remainingSeconds === 'number';
}

/**
 * 429 приходит от двух разных вещей: месячного лимита расшифровки
 * (error: 'quota_exceeded') и общего rate-limit'а сервера. Различаем по телу —
 * иначе «слишком часто» показывалось бы пользователю как «лимит исчерпан».
 */
export async function toApiError(res: Response): Promise<Error> {
  if (res.status !== 429) return new Error(`API error: ${res.status}`);
  try {
    const body = await res.json() as { error?: unknown; usage?: unknown };
    if (body.error === 'quota_exceeded') {
      return new QuotaExceededError(isTranscriptionUsage(body.usage) ? body.usage : undefined);
    }
  } catch {
    // Тело не JSON — трактуем как обычный rate-limit ниже
  }
  return new Error('API error: 429');
}

export async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    // lang добавляется ко всем AI-запросам централизованно — на нём сервер
    // выбирает язык саммари, идей, задач и ответов поиска
    body: JSON.stringify({ lang: outputLang, ...body }),
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

/** Текущий расход минут расшифровки. При ошибке возвращает null — UI просто не показывает блок. */

export async function fetchTranscriptionUsage(): Promise<TranscriptionUsage | null> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_BASE}/usage`, { headers: authHeader });
    if (!res.ok) return null;
    const body = await res.json() as unknown;
    return isTranscriptionUsage(body) ? body : null;
  } catch (e) {
    console.warn('[fetchTranscriptionUsage] failed:', e);
    return null;
  }
}

export function stripJsonMarkdown(raw: string): string {
  const trimmed = raw.trim();
  // Покрываем: ```json, ``` json, ```JSON, \r\n внутри блока
  const match = trimmed.match(/^```[\w\s]*\r?\n?([\s\S]*?)\r?\n?```$/i);
  return match ? match[1].trim() : trimmed;
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(stripJsonMarkdown(raw)) as T; }
  catch { return fallback; }
}

export interface AITextResponse {
  text: string;
}
