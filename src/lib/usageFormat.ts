// Форматирование расхода минут расшифровки для интерфейса.
// Чистые функции без React и без сети — их легко покрыть тестами.

import type { TranscriptionUsage } from './api';

const PLAN_LABELS: Record<TranscriptionUsage['plan'], string> = {
  free: 'Бесплатный',
  pro: 'Pro',
  team: 'Team',
};

export function planLabel(plan: TranscriptionUsage['plan']): string {
  return PLAN_LABELS[plan] ?? PLAN_LABELS.free;
}

/** Секунды → «2 ч 15 мин» / «45 мин» / «меньше минуты». Отрицательные и мусор → «0 мин». */
export function formatDurationHuman(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 мин';

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes === 0) return 'меньше минуты';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

/** Короткая строка для карточки в Настройках: «Использовано 8 ч из 20 ч». */
export function formatUsageLine(usage: TranscriptionUsage): string {
  return `Использовано ${formatDurationHuman(usage.usedSeconds)} из ${formatDurationHuman(usage.limitSeconds)}`;
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
export function quotaToastMessage(usage?: TranscriptionUsage): string {
  const limit = usage ? ` (${formatDurationHuman(usage.limitSeconds)} в месяц)` : '';
  return `Лимит расшифровки исчерпан${limit}. Аудио сохранено — расшифруем после апгрейда тарифа.`;
}
