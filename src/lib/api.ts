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
  const { prompt, config } = buildTranscribePayload(knownPeople);
  const res = await post<AITextResponse>('/transcribe', { audio, mimeType, prompt, config });
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

// Общий билдер payload для транскрипции (используется в transcribeRecording и retranscribeFromUrl)
function buildTranscribePayload(knownPeople: string[] = []): { prompt: string; config: Record<string, unknown> } {
  const knownPeoplePrefix = knownPeople.length > 0
    ? `Known participants from previous recordings: ${knownPeople.join(', ')}. Use these names when identifying speakers. `
    : '';

  const prompt =
    knownPeoplePrefix +
    'Please analyze this personal audio note or voice journal. ' +
    'CRITICAL: If the audio is empty, silent, or contains no speech, you MUST return a JSON object with title \'[Тишина]\' and empty fields. Do not invent or hallucinate speech. ' +
    'LANGUAGE RULE: The transcript.text field must be in the EXACT language spoken in the audio. ALL other fields (title, summary, keyMoments, actionItems, ideas, mentions, tags, openQuestions, bigQuestions, mood, richActionItems) MUST be written in Russian only — no English. ' +
    '1. Transcribe the audio EXACTLY in the language it was spoken. ' +
    '2. Transcribe ALL speech verbatim — every word spoken, every speaker in the room, grouped by speaker turns. Do NOT summarize or condense the transcript. ' +
    'SPEAKER DIARIZATION: This is critical. Listen carefully for changes in voice, tone, or speaking style. ' +
    'If multiple voices are present — even subtle differences — assign separate speaker labels. ' +
    'Use "Участник 1", "Участник 2", etc. initially. ' +
    'If you hear a name spoken (e.g. "Слушай Катя", "Максим, как ты думаешь", answering each other by name), replace the label with that name. ' +
    'NEVER merge different speakers into one. When in doubt about voice changes, create a new speaker entry. ' +
    'Each time the speaker changes, start a new transcript item. For solo recordings use "Я". ' +
    '3. Provide a short, warm summary of the entry — IN RUSSIAN. ' +
    '4. Extract 3-5 key thoughts or moments — IN RUSSIAN. ' +
    '5. List EVERY action item, task, to-do, commitment, or thing that needs to be done — even if phrased casually like "надо бы", "не забыть", "нужно". Write action items IN RUSSIAN. If nothing was mentioned, return an empty array. ' +
    '6. Identify the overall mood or emotional tone — IN RUSSIAN (например: Вдохновлённый, Усталый, Задумчивый, Воодушевлённый, Деловой). ' +
    '7. Extract any creative ideas or insights — IN RUSSIAN. ' +
    '8. List any specific mentions (books, movies, people, places, tools) — proper names can stay as-is. ' +
    '9. Extract open questions — IN RUSSIAN — questions asked but left unanswered, or topics requiring future resolution. ' +
    '10. Identify conversation participants by name. Look for address patterns like "Максим, как ты думаешь" or "Слушай, Анна". Map each name to their speaker label. ' +
    '11. For each action item, also extract: who is responsible (assignee) if mentioned, and any deadline if mentioned. ' +
    '12. Extract big strategic questions — IN RUSSIAN — the main unresolved themes or challenges being discussed. ' +
    'Return the response in JSON format.';

  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'A short, catchy title for the recording' },
        summary: { type: 'STRING', description: 'A short summary of what the conversation is about' },
        keyMoments: { type: 'ARRAY', items: { type: 'STRING' }, description: '3-5 key moments or main ideas from the conversation' },
        actionItems: { type: 'ARRAY', items: { type: 'STRING' } },
        mood: { type: 'STRING' },
        ideas: { type: 'ARRAY', items: { type: 'STRING' } },
        mentions: { type: 'ARRAY', items: { type: 'STRING' } },
        transcript: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              speaker: { type: 'STRING', description: 'Speaker name or identifier (e.g., Speaker 1)' },
              timestamp: { type: 'STRING', description: 'Approximate timestamp (e.g., 00:15)' },
              text: { type: 'STRING', description: 'The transcribed text, grouped into large, readable paragraphs' },
            },
          },
        },
        tags: { type: 'ARRAY', items: { type: 'STRING' } },
        openQuestions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Questions asked but left unanswered, or topics requiring future resolution' },
        participants: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Person name as spoken/addressed in the conversation' },
              speakerLabel: { type: 'STRING', description: 'The speaker label this person maps to (e.g., Участник 1, Я)' },
              role: { type: 'STRING', description: 'Their role if mentioned (optional)' },
            },
          },
        },
        richActionItems: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING', description: 'The action item text' },
              assignee: { type: 'STRING', description: 'Who is responsible for this task, if mentioned' },
              deadline: { type: 'STRING', description: 'Deadline or time frame, if mentioned' },
            },
          },
        },
        bigQuestions: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Main strategic or unresolved themes and challenges being discussed',
        },
      },
      required: ['title', 'summary', 'transcript', 'actionItems', 'ideas', 'keyMoments', 'mood', 'tags'],
    },
  };

  return { prompt, config };
}

/** Повторная транскрипция записи по URL (файл фетчится на сервере и загружается в File API) */
export async function retranscribeFromUrl(
  audioUrl: string,
  mimeType: string,
  knownPeople: string[] = []
): Promise<TranscribeResult> {
  const { prompt, config } = buildTranscribePayload(knownPeople);
  const res = await post<AITextResponse>('/retranscribe', { audioUrl, mimeType, prompt, config });
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

/** Simple audio transcription (quick notes, chat voice) */
export async function transcribeAudio(
  audio: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const res = await post<AITextResponse>('/transcribe', { audio, mimeType, prompt });
  return res.text || '';
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
 * Загружает аудио blob в Cloudflare R2.
 * Шаги: 1) получаем presigned URL с сервера, 2) PUT blob напрямую в R2.
 * Возвращает публичный URL для воспроизведения.
 */
export async function uploadAudioToR2(
  blob: Blob,
  recordingId: string,
): Promise<{ publicUrl: string; r2Key: string }> {
  const authHeader = await getAuthHeader();
  const hasAuth = Object.keys(authHeader).length > 0;
  console.log('[R2] Starting upload. Auth header present:', hasAuth, '| blob size:', blob.size, '| type:', blob.type);

  // Шаг 1: получаем presigned URL с сервера
  const presignRes = await fetch(`${API_ROOT}/api/r2/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ recordingId, contentType: blob.type || 'audio/webm' }),
  });

  console.log('[R2] Presign response status:', presignRes.status);
  if (!presignRes.ok) {
    const errText = await presignRes.text();
    throw new Error(`Presign failed: ${presignRes.status} — ${errText}`);
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json() as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };
  console.log('[R2] Got presign URL. Public URL will be:', publicUrl);

  // Шаг 2: загружаем blob напрямую в R2
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type || 'audio/webm' },
  });

  console.log('[R2] Upload response status:', uploadRes.status);
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`R2 upload failed: ${uploadRes.status} — ${errText}`);
  }

  console.log('[R2] Upload SUCCESS →', publicUrl);
  return { publicUrl, r2Key: key };
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
