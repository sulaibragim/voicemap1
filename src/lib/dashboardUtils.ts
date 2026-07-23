import type { Note } from '../types';

// Парсит "MM:SS" → секунды
export function parseDuration(d: string): number {
  const [m, s] = d.split(':').map(n => parseInt(n, 10) || 0);
  return m * 60 + s;
}

// Секунды → "Xч Yм" или "X мин"
export function formatTotalTime(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}ч ${rem}м` : `${h}ч`;
}

export function snoozeNote(note: Note, hours: number): Note {
  const base = note.dueDate && note.dueTime
    ? new Date(`${note.dueDate}T${note.dueTime}`)
    : new Date();
  if (base < new Date()) base.setTime(new Date().getTime());
  base.setTime(base.getTime() + hours * 3600000);
  return { ...note, dueDate: base.toISOString().split('T')[0], dueTime: base.toTimeString().slice(0, 5) };
}

// ── WeeklyDigestCard utils ──────────────────────────────────────────────────

export const RU_MONTHS: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};

// Парсит строки дат из Recording.date (русский формат, ISO, точки)
export function parseRecDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const lower = dateStr.toLowerCase();
  if (lower.startsWith('сегодня')) { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  if (lower.startsWith('вчера')) { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d; }
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) return new Date(Number(dotMatch[3]), Number(dotMatch[2]) - 1, Number(dotMatch[1]));
  const ruMatch = dateStr.match(/^(\d{1,2})\s+([а-яё]+)/i);
  if (ruMatch) {
    const month = RU_MONTHS[ruMatch[2].toLowerCase()];
    if (month !== undefined) {
      const yearMatch = dateStr.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      return new Date(year, month, Number(ruMatch[1]));
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Ключ текущей ISO-недели вида "YYYY_Wnn"
export function getWeekKey(): string {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${d.getFullYear()}_W${week}`;
}
