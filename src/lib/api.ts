import type { TranscriptItem } from '../types';
import { auth } from '../firebase';

// В продакшне (Capacitor / другой хост) используем абсолютный URL из env.
// В дев-режиме Vite проксирует /api на localhost:3001.
// В продакшне (Capacitor / другой хост) используем абсолютный URL из env.
// В дев-режиме Vite проксирует /api на localhost:3001.
const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/ai';
const API_ROOT = (import.meta.env.VITE_API_URL ?? '');

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
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_MS = 800;

async function getAuthHeader(): Promise<Record<string, string>> {
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

function isTranscriptionUsage(value: unknown): value is TranscriptionUsage {
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

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
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

interface AITextResponse {
  text: string;
}

/** Daily tip generation */
export async function fetchDailyTip(context: string): Promise<{ title: string; text: string }> {
  const res = await post<AITextResponse>('/tip', { context });
  return safeJsonParse(res.text || '{}', { title: '', text: '' });
}

interface TranscribeResult {
  title?: string;
  summary?: string;
  keyMoments?: string[];
  actionItems?: string[];
  ideas?: string[];
  mentions?: string[];
  transcript?: TranscriptItem[];
  tags?: string[];
  openQuestions?: string[];
  participants?: Array<{ name: string; speakerLabel: string; role?: string }>;
  richActionItems?: Array<{ text: string; assignee?: string; assignees?: string[]; deadline?: string }>;
  bigQuestions?: string[];
}

/** Full audio transcription + analysis (recording) */
export async function transcribeRecording(
  audio: string,
  mimeType: string,
  knownPeople: string[] = [],
  durationSeconds?: number,
): Promise<TranscribeResult> {
  // prompt/config больше не отправляются — сервер строит их сам (см. server/lib/gemini.ts).
  // durationSeconds нужен только для предпроверки лимита; списывается фактический расход по токенам.
  const res = await post<AITextResponse>('/transcribe', { audio, mimeType, knownPeople, durationSeconds });
  const parsed = safeJsonParse<TranscribeResult>(res.text || '{}', {});
  return {
    title: parsed.title,
    summary: parsed.summary,
    keyMoments: parsed.keyMoments,
    actionItems: parsed.actionItems,
    ideas: parsed.ideas,
    mentions: parsed.mentions,
    transcript: parsed.transcript,
    tags: parsed.tags,
    openQuestions: parsed.openQuestions,
    participants: parsed.participants,
    richActionItems: parsed.richActionItems,
    bigQuestions: parsed.bigQuestions,
  };
}

/** Повторная транскрипция записи по URL (файл фетчится на сервере и загружается в File API) */
export async function retranscribeFromUrl(
  audioUrl: string,
  mimeType: string,
  knownPeople: string[] = [],
  durationSeconds?: number,
): Promise<TranscribeResult> {
  // prompt/config больше не отправляются — сервер строит их сам (см. server/lib/gemini.ts)
  const res = await post<AITextResponse>('/retranscribe', { audioUrl, mimeType, knownPeople, durationSeconds });
  const parsed = safeJsonParse<TranscribeResult>(res.text || '{}', {});
  return {
    title: parsed.title,
    summary: parsed.summary,
    keyMoments: parsed.keyMoments,
    actionItems: parsed.actionItems,
    ideas: parsed.ideas,
    mentions: parsed.mentions,
    transcript: parsed.transcript,
    tags: parsed.tags,
    openQuestions: parsed.openQuestions,
    participants: parsed.participants,
    richActionItems: parsed.richActionItems,
    bigQuestions: parsed.bigQuestions,
  };
}

function stripJsonMarkdown(raw: string): string {
  const trimmed = raw.trim();
  // Покрываем: ```json, ``` json, ```JSON, \r\n внутри блока
  const match = trimmed.match(/^```[\w\s]*\r?\n?([\s\S]*?)\r?\n?```$/i);
  return match ? match[1].trim() : trimmed;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(stripJsonMarkdown(raw)) as T; }
  catch { return fallback; }
}

// ── Голосовой/текстовый RAG-поиск по своим записям ───────────────────────────

/** Источник ответа: конкретная запись + момент внутри неё */
export interface SearchSource {
  recordingId: string;
  title: string;
  /** Таймкод внутри записи: "12:34" или "1:02:33" */
  timestamp: string;
  snippet: string;
}

export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

/** Type guard для одного источника из ответа сервера */
function isSearchSource(value: unknown): value is SearchSource {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.recordingId === 'string'
    && typeof v.title === 'string'
    && typeof v.timestamp === 'string'
    && typeof v.snippet === 'string';
}

/**
 * Поиск по своим записям (сервер: /api/ai/search — векторный индекс + Gemini).
 * Никогда не бросает наружу: при ошибке сети/сервера возвращает пустой результат.
 */
export async function searchRecordings(query: string, limit?: number): Promise<SearchResult> {
  const fallback: SearchResult = { answer: 'Не удалось выполнить поиск.', sources: [] };
  try {
    const body: Record<string, unknown> = { query };
    if (typeof limit === 'number') body.limit = limit;

    const raw = await post<unknown>('/search', body);
    if (typeof raw !== 'object' || raw === null) return fallback;

    const parsed = raw as Record<string, unknown>;
    const answer = typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer
      : 'Ничего не нашёл по этому запросу.';
    const sources = Array.isArray(parsed.sources) ? parsed.sources.filter(isSearchSource) : [];

    return { answer, sources };
  } catch (e) {
    console.warn('[searchRecordings] failed:', e);
    return fallback;
  }
}

/** Transcribe voice message for chat */
export async function transcribeChatVoice(audio: string, mimeType: string): Promise<string> {
  const res = await post<AITextResponse>('/chat-voice', { audio, mimeType });
  return res.text || '';
}

/** Append thought to recording */
export async function appendToRecording(prompt: string): Promise<{ summary: string; ideas: string[]; actionItems: string[] }> {
  const res = await post<AITextResponse>('/append', { prompt });
  return safeJsonParse(res.text || '{}', { summary: '', ideas: [], actionItems: [] });
}

/** Condense full transcript — remove filler, keep only substance */
export async function condenseTranscript(
  transcript: TranscriptItem[]
): Promise<TranscriptItem[]> {
  const res = await post<AITextResponse>('/condense-transcript', { transcript });
  const parsed = safeJsonParse<unknown>(res.text || '[]', []);
  return Array.isArray(parsed) ? parsed as TranscriptItem[] : [];
}

/** Develop/expand an idea from a recording */
export async function developIdea(idea: string, recordingTitle: string): Promise<string> {
  const res = await post<AITextResponse>('/develop-idea', { idea, recordingTitle });
  return res.text || '';
}

/** Parse voice-spoken text into clean task list */
export async function parseTasksFromVoice(text: string): Promise<string[]> {
  const res = await post<AITextResponse>('/parse-tasks', { text });
  const parsed = safeJsonParse<unknown>(res.text || '[]', []);
  return Array.isArray(parsed) ? parsed as string[] : [];
}

export interface DigestAIResult {
  mainTheme: string;
  themeSummary: string;
  insight: string;
}

/** Weekly AI review — theme and insight based on week's recordings */
export async function weeklyReview(
  recordings: Array<{ title: string; summary: string; ideas?: string[]; actionItems?: string[]; tags?: string[] }>
): Promise<DigestAIResult> {
  const res = await post<AITextResponse>('/weekly-review', { recordings });
  return safeJsonParse<DigestAIResult>(res.text || '{}', { mainTheme: '', themeSummary: '', insight: '' });
}

// ── Cloudflare R2 Audio Upload ────────────────────────────────────────────────

/**
 * Загружает аудио blob в Cloudflare R2 через наш сервер.
 * Сервер делает прямой S3 PUT — нет CORS проблем ни на Android, ни в браузере.
 */
export async function uploadAudioToR2(
  blob: Blob,
  recordingId: string,
): Promise<{ publicUrl: string; r2Key: string }> {
  const authHeader = await getAuthHeader();
  const contentType = blob.type || 'audio/mp4';
  console.log('[R2] Starting server-side upload. Size:', blob.size, '| type:', contentType);

  // Конвертируем blob в base64 для передачи на сервер
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // убираем "data:...;base64," префикс
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Загрузка с ретраями: сетевые ошибки и 5xx повторяем (до 3 попыток с backoff),
  // 4xx (например, истёкший токен) не ретраим — это не транзиентная ошибка.
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(`${API_ROOT}/api/r2/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ recordingId, contentType, audioBase64: base64 }),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error';
    }

    if (res) {
      if (res.ok) {
        const { publicUrl, key } = await res.json() as { publicUrl: string; key: string };
        console.log('[R2] Upload SUCCESS →', publicUrl, attempt > 1 ? `(попытка ${attempt})` : '');
        return { publicUrl, r2Key: key };
      }
      lastErr = `${res.status} — ${await res.text()}`;
      if (res.status < 500) break; // клиентская ошибка — ретрай не поможет
    }

    if (attempt < UPLOAD_MAX_ATTEMPTS) {
      console.warn(`[R2] Upload attempt ${attempt} failed (${lastErr}), retrying...`);
      await new Promise(r => setTimeout(r, attempt * UPLOAD_RETRY_BASE_MS));
    }
  }

  throw new Error(`R2 server upload failed after ${UPLOAD_MAX_ATTEMPTS} attempts: ${lastErr}`);
}

/**
 * Отправляет аудио на сервер: R2 upload + фоновая транскрипция в одном запросе.
 * Сервер сразу возвращает publicUrl/r2Key, транскрипцию пишет в Firestore сам.
 */
export async function processRecordingAsync(
  blob: Blob,
  recordingId: string,
  metadata: { title: string; date: string; duration: string; knownPeople: string[] }
): Promise<{ publicUrl: string; r2Key: string; queued: boolean; quota?: TranscriptionUsage }> {
  const authHeader = await getAuthHeader();
  const contentType = blob.type || 'audio/mp4';
  console.log('[processRecordingAsync] blob size:', blob.size, 'type:', contentType);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Ретраи как в uploadAudioToR2: запись существует только в памяти, и уронить её
  // из-за моргнувшего вайфая нельзя — пользователь потеряет часовую встречу без
  // возможности восстановить. Транзиентные сбои (сеть, 5xx) повторяем,
  // 4xx — нет: истёкший токен или исчерпанный лимит от повтора не исправятся.
  const payload = JSON.stringify({
    recordingId, audioBase64: base64, contentType,
    metadata: { ...metadata, lang: outputLang },
  });

  let res: Response | null = null;
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    res = null;
    try {
      res = await fetch(`${API_ROOT}/api/process-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: payload,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error';
    }

    if (res) {
      if (res.ok) break;
      lastErr = `${res.status} — ${await res.text()}`;
      if (res.status < 500) break;   // клиентская ошибка — ретрай не поможет
    }

    if (attempt < UPLOAD_MAX_ATTEMPTS) {
      console.warn(`[processRecordingAsync] Попытка ${attempt} не удалась (${lastErr}), повтор...`);
      await new Promise(r => setTimeout(r, attempt * UPLOAD_RETRY_BASE_MS));
    }
  }

  if (!res) {
    throw new Error(`process-recording failed after ${UPLOAD_MAX_ATTEMPTS} attempts: ${lastErr}`);
  }
  if (!res.ok) {
    throw new Error(`process-recording failed: ${lastErr}`);
  }

  // queued: false означает, что аудио сохранено, но расшифровка пропущена из-за
  // исчерпанного месячного лимита — запись можно расшифровать после апгрейда.
  const body = await res.json() as { publicUrl: string; r2Key: string; queued?: boolean; quota?: unknown };
  return {
    publicUrl: body.publicUrl,
    r2Key: body.r2Key,
    queued: body.queued !== false,
    quota: isTranscriptionUsage(body.quota) ? body.quota : undefined,
  };
}

/**
 * Удаляет аудиофайл из R2 при удалении записи.
 */
export async function deleteAudioFromR2(r2Key: string): Promise<void> {
  const authHeader = await getAuthHeader();
  await fetch(`${API_ROOT}/api/r2/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ key: r2Key }),
  });
}

/**
 * Удаляет поисковые чанки записи. Без этого голосовой поиск продолжит
 * находить уже удалённую запись. Ошибки не критичны — глушим, чтобы не
 * ломать удаление самой записи.
 */
export async function deleteRecordingChunks(recordingId: string): Promise<void> {
  try {
    const authHeader = await getAuthHeader();
    await fetch(`${API_ROOT}/api/ai/chunks/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ recordingId }),
    });
  } catch (e) {
    console.warn('[deleteRecordingChunks] failed:', e);
  }
}

// ── Бэкфилл поискового индекса (миграция старых записей) ────────────────────

export interface BackfillResult {
  processed: number;
  indexedChunks: number;
  failed: number;
  remaining: number;
}

/** Type guard для ответа /backfill — защищаемся от неожиданной формы JSON */
function isBackfillResult(value: unknown): value is BackfillResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.processed === 'number'
    && typeof v.indexedChunks === 'number'
    && typeof v.failed === 'number'
    && typeof v.remaining === 'number';
}

/**
 * Индексирует одну пачку ещё не проиндексированных записей пользователя (сервер: /api/ai/backfill).
 * Вызывается повторно на клиенте (в цикле), пока в ответе remaining > 0.
 * Бросает исключение при ошибке сети/сервера — вызывающий код (UI) должен сам решить,
 * останавливать ли цикл и как показать ошибку пользователю.
 */
export async function backfillSearchIndex(limit?: number): Promise<BackfillResult> {
  const body: Record<string, unknown> = {};
  if (typeof limit === 'number') body.limit = limit;

  const raw = await post<unknown>('/backfill', body);
  if (!isBackfillResult(raw)) {
    throw new Error('backfillSearchIndex: unexpected response shape');
  }
  return raw;
}

/** Parse reminder date/time from transcribed text */
export async function parseReminderTime(text: string): Promise<{ hasTime: boolean; date?: string; time?: string; summary: string }> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const humanDate = now.toLocaleString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'long',
  });

  // Явно передаём ISO-даты чтобы Gemini не путался с "завтра" / "сегодня"
  const currentDate =
    `${humanDate}` +
    ` | TODAY_ISO: ${now.toISOString().slice(0, 10)}` +
    ` | TOMORROW_ISO: ${tomorrow.toISOString().slice(0, 10)}` +
    ` | CURRENT_TIME: ${now.toTimeString().slice(0, 5)}`;

  const res = await post<AITextResponse>('/parse-reminder', { text, currentDate });
  return safeJsonParse(res.text || '{}', { hasTime: false, summary: '' });
}
