// Общая логика работы с таймкодами транскрипта — переиспользуется плеером,
// секцией транскрипта (десктоп) и мобильными табами, чтобы не дублировать парсинг.

/** Парсит строку таймкода "MM:SS" или "H:MM:SS" в секунды */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

/**
 * Индекс последней реплики транскрипта, чей таймкод <= time — она считается
 * "активной" в данный момент воспроизведения (следующая ещё не началась).
 */
export function findActiveTranscriptIndex(transcript: { timestamp: string }[], time: number): number {
  if (!transcript || transcript.length === 0) return -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (time >= parseTimestamp(transcript[i].timestamp)) return i;
  }
  return 0;
}
