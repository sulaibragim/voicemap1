import type { TranscriptItem } from '../types';
import { auth } from '../firebase';

// В продакшне (Capacitor / другой хост) используем абсолютный URL из env.
// В дев-режиме Vite проксирует /api на localhost:3001.
// В продакшне (Capacitor / другой хост) используем абсолютный URL из env.
// В дев-режиме Vite проксирует /api на localhost:3001.
const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/ai';
const API_ROOT = (import.meta.env.VITE_API_URL ?? '');

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
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
  mood?: string;
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
  knownPeople: string[] = []
): Promise<TranscribeResult> {
  // prompt/config больше не отправляются — сервер строит их сам (см. server/lib/gemini.ts)
  const res = await post<AITextResponse>('/transcribe', { audio, mimeType, knownPeople });
  const parsed = safeJsonParse<TranscribeResult>(res.text || '{}', {});
  return {
    title: parsed.title,
    summary: parsed.summary,
    keyMoments: parsed.keyMoments,
    actionItems: parsed.actionItems,
    mood: parsed.mood,
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
  knownPeople: string[] = []
): Promise<TranscribeResult> {
  // prompt/config больше не отправляются — сервер строит их сам (см. server/lib/gemini.ts)
  const res = await post<AITextResponse>('/retranscribe', { audioUrl, mimeType, knownPeople });
  const parsed = safeJsonParse<TranscribeResult>(res.text || '{}', {});
  return {
    title: parsed.title,
    summary: parsed.summary,
    keyMoments: parsed.keyMoments,
    actionItems: parsed.actionItems,
    mood: parsed.mood,
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

/** Chat with AI assistant */
export async function chatWithAI(prompt: string): Promise<{ text: string; action: string; actionTarget: string | null; actionData: Record<string, unknown> | null }> {
  const res = await post<AITextResponse>('/chat', { prompt });
  const cleaned = stripJsonMarkdown(res.text || '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return { text: res.text || 'Не смог обработать запрос.', action: 'NONE', actionTarget: null, actionData: null };
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
  recordings: Array<{ title: string; summary: string; ideas?: string[]; actionItems?: string[]; mood?: string; tags?: string[] }>
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
  const maxAttempts = 3;
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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

    if (attempt < maxAttempts) {
      console.warn(`[R2] Upload attempt ${attempt} failed (${lastErr}), retrying...`);
      await new Promise(r => setTimeout(r, attempt * 800));
    }
  }

  throw new Error(`R2 server upload failed after ${maxAttempts} attempts: ${lastErr}`);
}

/**
 * Отправляет аудио на сервер: R2 upload + фоновая транскрипция в одном запросе.
 * Сервер сразу возвращает publicUrl/r2Key, транскрипцию пишет в Firestore сам.
 */
export async function processRecordingAsync(
  blob: Blob,
  recordingId: string,
  metadata: { title: string; date: string; duration: string; knownPeople: string[] }
): Promise<{ publicUrl: string; r2Key: string }> {
  const authHeader = await getAuthHeader();
  const contentType = blob.type || 'audio/mp4';
  console.log('[processRecordingAsync] blob size:', blob.size, 'type:', contentType);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const res = await fetch(`${API_ROOT}/api/process-recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ recordingId, audioBase64: base64, contentType, metadata }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`process-recording failed: ${res.status} — ${err}`);
  }

  const { publicUrl, r2Key } = await res.json() as { publicUrl: string; r2Key: string };
  return { publicUrl, r2Key };
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
