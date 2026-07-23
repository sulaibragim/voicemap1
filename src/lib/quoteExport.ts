// Сборка цитаты из выделенных реплик транскрипта.
// Чистые функции без DOM и React — работа с выделением живёт в useTranscriptSelection.
//
// Формат рассчитан на вставку в текст статьи: журналисту нужны сама реплика,
// имя спикера, таймкод (чтобы вернуться к звуку) и источник.

export interface QuoteFragment {
  speaker: string;
  /** Таймкод реплики: '12:34' / '1:02:33'. '--:--' означает «таймкода нет» */
  timestamp: string;
  /** Текст — уже обрезанный до выделения, если выделена только часть реплики */
  text: string;
}

export interface QuoteMeta {
  title: string;
  date: string;
}

const NO_TIMESTAMP = '--:--';

function hasTimestamp(timestamp: string): boolean {
  return Boolean(timestamp) && timestamp !== NO_TIMESTAMP;
}

/** Схлопывает переносы и двойные пробелы: выделение мышью почти всегда тащит их за собой. */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanFragments(fragments: QuoteFragment[]): QuoteFragment[] {
  return fragments
    .map(fragment => ({ ...fragment, text: normalizeText(fragment.text) }))
    .filter(fragment => fragment.text.length > 0);
}

/** «Планёрка по проекту, 23 июля» — источник под цитатой. */
function formatSource(meta: QuoteMeta): string {
  return [meta.title, meta.date].map(part => part?.trim()).filter(Boolean).join(', ');
}

/**
 * Готовая к вставке цитата.
 * Одна реплика оформляется кавычками с атрибуцией, несколько — диалогом с таймкодами.
 * Пустое выделение даёт пустую строку — вызывающий код на это опирается.
 */
export function buildQuoteText(fragments: QuoteFragment[], meta: QuoteMeta): string {
  const clean = cleanFragments(fragments);
  if (clean.length === 0) return '';

  const source = formatSource(meta);

  if (clean.length === 1) {
    const [only] = clean;
    const attribution = [only.speaker, hasTimestamp(only.timestamp) ? only.timestamp : '', source]
      .filter(Boolean)
      .join(' · ');
    return `«${only.text}»\n\n— ${attribution}`;
  }

  const dialogue = clean
    .map(fragment => (
      hasTimestamp(fragment.timestamp)
        ? `${fragment.speaker} [${fragment.timestamp}]: ${fragment.text}`
        : `${fragment.speaker}: ${fragment.text}`
    ))
    .join('\n');

  return source ? `${dialogue}\n\n— ${source}` : dialogue;
}

/** Диапазон цитаты для подписи на кнопке: '12:34' или '12:34 — 14:02'. Пусто, если таймкодов нет. */
export function buildQuoteRange(fragments: QuoteFragment[]): string {
  const stamps = cleanFragments(fragments)
    .map(fragment => fragment.timestamp)
    .filter(hasTimestamp);
  if (stamps.length === 0) return '';

  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  return first === last ? first : `${first} — ${last}`;
}

// Запрещённые в именах файлов Windows символы. Пробелы и дефисы оставляем —
// заголовок должен остаться читаемым. Фильтруем посимвольно, а не регуляркой:
// сюда же попадают управляющие символы, а регулярка с ними в исходнике хрупкая.
const FORBIDDEN_FILENAME_CHARS = '<>:"/\\|?*';

function stripUnsafeFileNameChars(value: string): string {
  return Array.from(value)
    .filter(char => char.charCodeAt(0) >= 0x20 && !FORBIDDEN_FILENAME_CHARS.includes(char))
    .join('');
}

/** Имя файла для скачивания цитаты. Пустой или мусорный заголовок заменяется на «Запись». */
export function buildQuoteFileName(meta: QuoteMeta): string {
  const safeTitle = stripUnsafeFileNameChars(normalizeText(meta.title ?? ''))
    .replace(/\.+$/, '')          // Windows не сохраняет имена, оканчивающиеся точкой
    .slice(0, 80)
    .trim();
  return `${safeTitle || 'Запись'} — цитата.txt`;
}
