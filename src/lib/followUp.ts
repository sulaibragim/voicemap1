// Follow-up по задачам: «что ты обещал и не сделал».
//
// Отличие от экрана Фокус: тот показывает ВСЕ открытые задачи, а этот —
// только те, что уже протухли. Обещание, данное сегодня, ещё не долг;
// обещание двухнедельной давности с прошедшим дедлайном — уже да.
//
// Чистый модуль без React: только сборка и сортировка.

import { parseRecDate } from './dashboardUtils';
import { plural } from './plural';
import type { Lang } from '../i18n';
import type { Recording, RichActionItem } from '../types';

export interface FollowUpItem {
  recordingId: string;
  recordingTitle: string;
  /** Индекс в recording.actionItems — по нему отмечается выполнение */
  taskIndex: number;
  text: string;
  /** Сколько дней прошло с записи */
  ageDays: number;
  /** Дедлайн как его распознал AI — показываем как есть, даже если не разобрали в дату */
  deadline?: string;
  /** Дедлайн разобран и уже прошёл */
  isOverdue: boolean;
  /** Кому поручено. Пусто — обещал сам */
  assignees: string[];
}

export interface CollectOptions {
  /** Сколько дней задача должна повисеть, прежде чем попасть в follow-up */
  minAgeDays?: number;
  /** Максимум элементов в выдаче */
  limit?: number;
}

const DEFAULT_MIN_AGE_DAYS = 3;
const DEFAULT_LIMIT = 5;
const MS_PER_DAY = 86_400_000;

/** Разбирает дедлайн от AI в дату. Свободный текст («на следующей неделе») не трогаем — вернём undefined. */
export function parseDeadline(raw: string | undefined, now: Date): Date | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;

  if (value === 'сегодня') {
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);
    return today;
  }
  if (value === 'завтра') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    return tomorrow;
  }

  // ISO-дату разбираем вручную, как ЛОКАЛЬНУЮ. new Date('2026-04-27') по стандарту
  // читается как UTC-полночь, и западнее Гринвича это уже предыдущий день —
  // дедлайны съезжали на сутки, а вместе с ними и признак «просрочено».
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const local = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    local.setHours(23, 59, 59, 999);
    return Number.isNaN(local.getTime()) ? undefined : local;
  }

  const parsed = parseRecDate(raw);
  if (!parsed) return undefined;
  // Дата без времени означает «до конца дня», иначе дедлайн «30 июля»
  // считался бы просроченным в тот же день с утра.
  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

/** Ищет rich-версию задачи по тексту: массивы actionItems и richActionItems не гарантированно совпадают по порядку. */
function findRich(text: string, rich: RichActionItem[] | undefined): RichActionItem | undefined {
  if (!rich?.length) return undefined;
  const needle = text.trim().toLowerCase();
  return rich.find(item => typeof item.text === 'string' && item.text.trim().toLowerCase() === needle);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** У задач от AI ответственные лежат либо в assignees, либо в старом одиночном assignee. */
function collectAssignees(rich: RichActionItem | undefined): string[] {
  if (!rich) return [];
  if (Array.isArray(rich.assignees) && rich.assignees.length > 0) {
    return rich.assignees.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  }
  return typeof rich.assignee === 'string' && rich.assignee.trim() ? [rich.assignee.trim()] : [];
}

/**
 * Собирает протухшие обещания из записей.
 * Сортировка: сначала просроченные по дедлайну, дальше самые старые —
 * то, за что стыднее всего, оказывается сверху.
 */
export function collectFollowUps(
  recordings: Recording[],
  now: Date = new Date(),
  options: CollectOptions = {},
): FollowUpItem[] {
  const minAgeDays = options.minAgeDays ?? DEFAULT_MIN_AGE_DAYS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const items: FollowUpItem[] = [];

  for (const recording of recordings) {
    const tasks = recording.actionItems ?? [];
    if (tasks.length === 0) continue;

    const recordedAt = parseRecDate(recording.date);
    // Дату записи не разобрали — возраст неизвестен, а без него «протухло ли» не решить
    if (!recordedAt) continue;
    const ageDays = daysBetween(recordedAt, now);

    const done = recording.actionItemsDone ?? [];

    tasks.forEach((text, taskIndex) => {
      if (done[taskIndex] === true) return;
      if (typeof text !== 'string' || !text.trim()) return;

      const rich = findRich(text, recording.richActionItems);
      const deadlineDate = parseDeadline(rich?.deadline, now);
      const isOverdue = deadlineDate !== undefined && deadlineDate.getTime() < now.getTime();

      // Просроченный дедлайн важнее возраста: обещал на вчера — уже долг,
      // даже если запись сделана позавчера.
      if (!isOverdue && ageDays < minAgeDays) return;

      items.push({
        recordingId: recording.id,
        recordingTitle: recording.title,
        taskIndex,
        text: text.trim(),
        ageDays: Math.max(0, ageDays),
        deadline: rich?.deadline?.trim() || undefined,
        isOverdue,
        assignees: collectAssignees(rich),
      });
    });
  }

  items.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.ageDays - a.ageDays;
  });

  return items.slice(0, limit);
}

const MONTHS: Record<Lang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
       'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

/**
 * Человеческий вид дедлайна: '2026-04-27' → «27 апреля».
 * Неразобранный текст («на следующей неделе») показываем как есть — сочинять дату нельзя.
 */
export function formatDeadline(raw: string | undefined, now: Date = new Date(), lang: Lang = 'ru'): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';

  const parsed = parseDeadline(raw, now);
  if (!parsed) return raw.trim();

  const day = parsed.getDate();
  const month = (MONTHS[lang] ?? MONTHS.ru)[parsed.getMonth()];
  const sameYear = parsed.getFullYear() === now.getFullYear();
  // Английский порядок «April 27», русский — «27 апреля»
  if (lang === 'en') return sameYear ? `${month} ${day}` : `${month} ${day}, ${parsed.getFullYear()}`;
  return sameYear ? `${day} ${month}` : `${day} ${month} ${parsed.getFullYear()}`;
}

/** «2 недели назад» / «5 дней назад» / «вчера» — для подписи под задачей. */
export function formatAge(ageDays: number, lang: Lang = 'ru'): string {
  if (lang === 'en') return formatAgeEn(ageDays);

  if (!Number.isFinite(ageDays) || ageDays <= 0) return 'сегодня';
  if (ageDays === 1) return 'вчера';
  if (ageDays < 7) return `${ageDays} ${plural(ageDays, ['день', 'дня', 'дней'])} назад`;

  const weeks = Math.floor(ageDays / 7);
  if (weeks === 1) return 'неделю назад';
  if (weeks < 5) return `${weeks} ${plural(weeks, ['неделю', 'недели', 'недель'])} назад`;

  const months = Math.floor(ageDays / 30);
  return months <= 1 ? 'месяц назад' : `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])} назад`;
}

function formatAgeEn(ageDays: number): string {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 'today';
  if (ageDays === 1) return 'yesterday';
  if (ageDays < 7) return `${ageDays} days ago`;

  const weeks = Math.floor(ageDays / 7);
  if (weeks === 1) return 'a week ago';
  if (weeks < 5) return `${weeks} weeks ago`;

  const months = Math.floor(ageDays / 30);
  return months <= 1 ? 'a month ago' : `${months} months ago`;
}

/** «3 задачи» / «3 tasks» — счётчик для заголовка карточки. */
export function formatTaskCount(count: number, lang: Lang = 'ru'): string {
  if (lang === 'en') return `${count} ${count === 1 ? 'task' : 'tasks'}`;
  return `${count} ${plural(count, ['задача', 'задачи', 'задач'])}`;
}
