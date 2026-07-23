// Разбивка транскрипта записи на смысловые куски (chunks) для RAG-индексации.
// ЧИСТАЯ функция: без побочных эффектов, без обращений к сети/Firestore —
// детерминированная и легко тестируемая (см. src/test/chunk.test.ts).

// Минимальная реплика транскрипта, которую умеет резать chunkTranscript.
// Специально не импортируем src/types/TranscriptItem — сервер держит
// собственные типы, независимые от клиентского кода.
export interface TranscriptEntry {
  speaker: string;
  timestamp: string;
  text: string;
}

// Метаданные записи, необходимые чтобы привязать куски обратно к записи в UI.
export interface RecordingMeta {
  recordingId: string;
  title: string;
  date: string;
}

export interface Chunk {
  recordingId: string;
  chunkIndex: number;
  text: string;
  speakers: string[];
  startTimestamp: string;
  recordingTitle: string;
  recordingDate: string;
}

// Мягкие границы размера куска в символах: копим реплики, пока не наберём
// минимум; стараемся не превышать максимум, но реплику никогда не режем.
const MIN_CHUNK_CHARS = 400;
const MAX_CHUNK_CHARS = 600;

// Реплики, которые нужно пропускать при чанкинге (пустые/технические маркеры тишины).
const SILENCE_MARKERS = new Set(['', '[тишина]']);

function isMeaningful(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length === 0) return false;
  return !SILENCE_MARKERS.has(cleaned.toLowerCase());
}

// Приводит произвольный JSON (например, ответ Gemini, распарсенный на сервере)
// к массиву TranscriptEntry, молча отбрасывая некорректные элементы.
// Используется на границе интеграции (processing.ts), сам chunkTranscript
// уже ожидает валидный вход и не занимается санитайзингом.
export function toTranscriptEntries(input: unknown): TranscriptEntry[] {
  if (!Array.isArray(input)) return [];
  const result: TranscriptEntry[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const { speaker, timestamp, text } = record;
    if (typeof speaker === 'string' && typeof timestamp === 'string' && typeof text === 'string') {
      result.push({ speaker, timestamp, text });
    }
  }
  return result;
}

// Разбивает транскрипт записи на куски (chunks), пригодные для эмбеддинга.
// Реплики одного и того же говорящего идущие подряд склеиваются в один кусок,
// пока размер не достигнет ~400-600 символов. Реплика никогда не разрезается
// пополам между двумя кусками. Пустые реплики и "[Тишина]" пропускаются.
//
// summary (опционально) — краткое саммари записи; если передано, в конец
// списка кусков добавляется один сводный кусок целиком из summary.
export function chunkTranscript(
  transcript: TranscriptEntry[],
  meta: RecordingMeta,
  summary?: string,
): Chunk[] {
  const chunks: Chunk[] = [];

  let bufferEntries: TranscriptEntry[] = [];
  let bufferLines: string[] = [];
  let bufferLength = 0;
  let chunkIndex = 0;

  const flush = (): void => {
    if (bufferEntries.length === 0) return;
    const speakers = Array.from(new Set(bufferEntries.map(e => e.speaker)));
    chunks.push({
      recordingId: meta.recordingId,
      chunkIndex,
      text: bufferLines.join('\n'),
      speakers,
      startTimestamp: bufferEntries[0].timestamp,
      recordingTitle: meta.title,
      recordingDate: meta.date,
    });
    chunkIndex += 1;
    bufferEntries = [];
    bufferLines = [];
    bufferLength = 0;
  };

  for (const entry of transcript) {
    if (!isMeaningful(entry.text)) continue;
    const line = `${entry.speaker}: ${entry.text.trim()}`;

    if (bufferLines.length > 0) {
      // +1 за перевод строки, который добавится при склейке этой реплики с предыдущими
      const prospectiveLength = bufferLength + 1 + line.length;
      // Кусок уже набрал минимальный размер, а эта реплика перегрузит его сверх
      // максимума — закрываем текущий кусок ДО добавления реплики, чтобы новая
      // реплика полностью ушла в следующий кусок (а не резалась пополам).
      if (bufferLength >= MIN_CHUNK_CHARS && prospectiveLength > MAX_CHUNK_CHARS) {
        flush();
      }
    }

    bufferEntries.push(entry);
    bufferLines.push(line);
    bufferLength = bufferLines.join('\n').length;
  }
  flush();

  const cleanSummary = summary?.trim();
  if (cleanSummary) {
    chunks.push({
      recordingId: meta.recordingId,
      chunkIndex,
      text: `Резюме записи «${meta.title}»: ${cleanSummary}`,
      speakers: [],
      startTimestamp: '',
      recordingTitle: meta.title,
      recordingDate: meta.date,
    });
  }

  return chunks;
}
