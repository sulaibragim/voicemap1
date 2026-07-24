// Распознавание пустых записей.
//
// Микрофон включился, но никто ничего не сказал: нажали случайно, передумали,
// проверяли работает ли. Такая запись бесполезна — но выглядит в списке ровно
// как настоящая и мешает искать нужное.
//
// Файл в R2 при этом лежит и место занимает, поэтому удалять их полезно вдвойне.

import type { Recording } from '../types';

/**
 * Заглушки, которыми модель отвечает на аудио без речи. Приходят с сервера на
 * языке пользователя (см. server/lib/lang.ts), поэтому сверяем оба варианта.
 */
const SILENCE_TITLES = ['[Тишина]', '[Silence]'];

/** Совсем короткие записи чаще всего случайные — но судим не только по времени */
const SHORT_RECORDING_SECONDS = 5;

/** Длительность «MM:SS» / «H:MM:SS» → секунды. Непонятное считаем нулём. */
function durationSeconds(duration: string | undefined): number {
  if (typeof duration !== 'string') return 0;
  const parts = duration.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Модель прямо сказала, что речи нет */
export function isSilent(recording: Recording): boolean {
  return SILENCE_TITLES.includes(recording.title?.trim() ?? '');
}

/**
 * Запись, из которой ничего не вышло: речи нет либо расшифровка пустая.
 *
 * Записи в обработке и упавшие с ошибкой сюда НЕ попадают: у первых результат
 * ещё впереди, вторые нужно перезапустить, а не выбрасывать.
 */
export function isEmptyRecording(recording: Recording): boolean {
  if (recording.aiStatus === 'processing' || recording.aiStatus === 'error') return false;

  if (isSilent(recording)) return true;

  // Расшифровки нет вовсе, и запись слишком коротка, чтобы в ней что-то было
  const hasTranscript = Array.isArray(recording.transcript) && recording.transcript.length > 0;
  const hasSummary = Boolean(recording.summary?.trim());
  return !hasTranscript && !hasSummary && durationSeconds(recording.duration) <= SHORT_RECORDING_SECONDS;
}

/** Сколько таких накопилось — нужно, чтобы предложить убрать их разом */
export function countEmptyRecordings(recordings: Recording[]): number {
  return recordings.filter(isEmptyRecording).length;
}

/** Идентификаторы пустых записей — для группового удаления */
export function emptyRecordingIds(recordings: Recording[]): string[] {
  return recordings.filter(isEmptyRecording).map(r => r.id);
}
