import type { Recording } from '../types';

// Поиск похожих записей по общим тегам, упоминаниям и ключевым словам идей
export function findRelated(current: Recording, all: Recording[]): Array<{ rec: Recording; reason: string }> {
  const results: Array<{ rec: Recording; score: number; reason: string }> = [];
  const curTags = new Set(current.tags.map(t => t.toLowerCase()));
  const curMentions = new Set((current.mentions ?? []).map(m => m.toLowerCase()));
  const curIdeas = new Set((current.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())));

  all.forEach(rec => {
    if (rec.id === current.id) return;
    let score = 0;
    const reasons: string[] = [];
    const sharedTags = rec.tags.filter(t => curTags.has(t.toLowerCase()));
    if (sharedTags.length > 0) { score += sharedTags.length * 3; reasons.push(`тег ${sharedTags[0]}`); }
    const sharedMentions = (rec.mentions ?? []).filter(m => curMentions.has(m.toLowerCase()));
    if (sharedMentions.length > 0) { score += sharedMentions.length * 2; if (reasons.length === 0) reasons.push(`упоминание ${sharedMentions[0]}`); }
    const recIdeaWords = new Set((rec.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())));
    const sharedIdeaWords = [...curIdeas].filter(w => recIdeaWords.has(w));
    if (sharedIdeaWords.length > 0) { score += sharedIdeaWords.length; if (reasons.length === 0) reasons.push('схожие идеи'); }
    if (score > 0) results.push({ rec, score, reason: reasons[0] ?? 'общая тема' });
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 3).map(({ rec, reason }) => ({ rec, reason }));
}

export function formatDeadlineDisplay(value: string): string {
  if (!value) return '';
  // ISO date YYYY-MM-DD → "25 апр" / "25 апр 2027"
  const d = new Date(value + 'T00:00:00');
  if (isNaN(d.getTime())) return value; // не ISO — показываем как есть
  const today = new Date();
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === today.getFullYear()
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('ru-RU', opts);
}

export function toIsoDate(value: string): string {
  // Если уже ISO — вернуть как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Иначе пустая строка (date input не примет текст)
  return '';
}

// --- Tag colours and sort/group utilities (extracted from RecordingsLibrary) ---

export const TAG_COLORS: Record<string, string> = {
  '#Идеи': 'bg-primary',
  '#Митинг': 'bg-secondary',
  '#Стартап': 'bg-tertiary',
  '#Личное': 'bg-[#F06292]',
  '#Проект': 'bg-[#4FC3F7]',
  '#Задачи': 'bg-[#81C784]',
};

export const TAG_TEXT: Record<string, string> = {
  '#Идеи': 'text-primary',
  '#Митинг': 'text-secondary',
  '#Стартап': 'text-tertiary',
  '#Личное': 'text-[#F06292]',
  '#Проект': 'text-[#4FC3F7]',
  '#Задачи': 'text-[#81C784]',
};

export type SortMode = 'date' | 'duration' | 'tasks' | 'mood';

export function getTagColor(tags: string[]): string {
  for (const t of tags) { if (TAG_COLORS[t]) return TAG_COLORS[t]; }
  return 'bg-on-surface-variant';
}

export function getTagTextColor(tags: string[]): string {
  for (const t of tags) { if (TAG_TEXT[t]) return TAG_TEXT[t]; }
  return 'text-on-surface-variant';
}

export function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

export function sortItems(items: Recording[], mode: SortMode): Recording[] {
  const sorted = [...items];
  if (mode === 'duration') {
    sorted.sort((a, b) => parseDurationToSeconds(b.duration) - parseDurationToSeconds(a.duration));
  } else if (mode === 'tasks') {
    sorted.sort((a, b) => (b.actionItems?.length ?? 0) - (a.actionItems?.length ?? 0));
  } else if (mode === 'mood') {
    sorted.sort((a, b) => (a.mood ?? '').localeCompare(b.mood ?? ''));
  }
  return sorted;
}

export function groupByDate(recordings: Recording[]): { label: string; items: Recording[] }[] {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, Recording[]> = {};
  recordings.forEach(r => {
    const d = new Date(r.date.replace(/\./g, '-') || r.date);
    const key = isNaN(d.getTime())
      ? 'Ранее'
      : d.toDateString() === today ? 'Сегодня'
      : d.toDateString() === yesterday ? 'Вчера'
      : r.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}
