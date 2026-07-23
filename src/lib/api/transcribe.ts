// Расшифровка аудио: запись, повторная расшифровка, голосовой ввод.
import type { TranscriptItem } from '../../types';
import { post, safeJsonParse, type AITextResponse } from './client';

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

/** Transcribe voice message for chat */
export async function transcribeChatVoice(audio: string, mimeType: string): Promise<string> {
  const res = await post<AITextResponse>('/chat-voice', { audio, mimeType });
  return res.text || '';
}
