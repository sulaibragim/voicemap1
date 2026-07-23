// AI-помощники: совет дня, дополнение записи, разбор задач и напоминаний,
// сжатие транскрипта, недельный дайджест.
import type { TranscriptItem } from '../../types';
import { post, safeJsonParse, type AITextResponse } from './client';

/** Daily tip generation */
export async function fetchDailyTip(context: string): Promise<{ title: string; text: string }> {
  const res = await post<AITextResponse>('/tip', { context });
  return safeJsonParse(res.text || '{}', { title: '', text: '' });
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
