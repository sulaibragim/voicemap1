import { useMemo } from 'react';
import { findActiveTranscriptIndex } from '../lib/timestamp';
import type { TranscriptItem } from '../types';

/**
 * Индекс активной реплики транскрипта по текущему времени воспроизведения.
 * Мемоизирован, чтобы не пересчитывать список при каждом тике таймера без надобности.
 */
export function useActiveTranscriptIndex(transcript: TranscriptItem[], currentTime: number): number {
  return useMemo(() => findActiveTranscriptIndex(transcript, currentTime), [transcript, currentTime]);
}
