// Форматирование расхода минут расшифровки для интерфейса.
// Чистые функции без React и без сети — их легко покрыть тестами.

import type { TranscriptionUsage } from './api';
import type { Lang } from '../i18n';

const PLAN_LABELS: Record<Lang, Record<TranscriptionUsage['plan'], string>> = {
  ru: { free: 'Бесплатный', pro: 'Pro', team: 'Team' },
  en: { free: 'Free', pro: 'Pro', team: 'Team' },
};

export function planLabel(plan: TranscriptionUsage['plan'], lang: Lang = 'ru'): string {
  const labels = PLAN_LABELS[lang] ?? PLAN_LABELS.ru;
  return labels[plan] ?? labels.free;
}

/** Секунды → «2 ч 15 мин» / «45 мин» / «меньше минуты». Отрицательные и мусор → «0 мин». */
export function formatDurationHuman(seconds: number, lang: Lang = 'ru'): string {
  const unitMin = lang === 'en' ? 'min' : 'мин';
  const unitHour = lang === 'en' ? 'h' : 'ч';

  if (!Number.isFinite(seconds) || seconds <= 0) return `0 ${unitMin}`;

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes === 0) return lang === 'en' ? 'less than a minute' : 'меньше минуты';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} ${unitMin}`;
  if (minutes === 0) return `${hours} ${unitHour}`;
  return `${hours} ${unitHour} ${minutes} ${unitMin}`;
}

/** Доля израсходованного, 0–100. Нулевой лимит трактуем как полностью выбранный. */
export function usagePercent(usage: TranscriptionUsage): number {
  if (!Number.isFinite(usage.limitSeconds) || usage.limitSeconds <= 0) return 100;
  const raw = (usage.usedSeconds / usage.limitSeconds) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Осталось меньше 15% лимита — пора предупредить, пока пользователь не упёрся в стену. */
export function isUsageLow(usage: TranscriptionUsage): boolean {
  return usagePercent(usage) >= 85;
}

/**
 * Текст тоста при отказе по лимиту. Аудио при этом сохраняется —
 * поэтому говорим не «ошибка», а что именно произошло и что делать дальше.
 */
export function quotaToastMessage(usage?: TranscriptionUsage, lang: Lang = 'ru'): string {
  if (lang === 'en') {
    const limit = usage ? ` (${formatDurationHuman(usage.limitSeconds, 'en')} per month)` : '';
    return `Transcription limit reached${limit}. The audio is saved — we'll transcribe it after a plan upgrade.`;
  }
  const limit = usage ? ` (${formatDurationHuman(usage.limitSeconds)} в месяц)` : '';
  return `Лимит расшифровки исчерпан${limit}. Аудио сохранено — расшифруем после апгрейда тарифа.`;
}
