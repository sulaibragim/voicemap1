import { useMemo } from 'react';
import { SPEAKER_PALETTE } from '../components/recording/TranscriptSection';
import { findRelated } from '../lib/recordingUtils';
import type { Recording } from '../types';

/**
 * Производные данные для экрана записи: цвета спикеров, метки ключевых
 * моментов на дорожке плеера, граница дополнений, похожие записи.
 *
 * Всё считается из самой записи, ничего не хранит. Вынесено, чтобы вычисления
 * не мешались с разметкой и не пересчитывались на каждый чих UI-состояния.
 */

/** Собственная речь всегда одного цвета — её взгляд ищет чаще прочих */
const SELF_LABELS = new Set(['Я', 'I', 'Me']);

interface UseTranscriptViewOptions {
  recording: Recording;
  allRecordings: Recording[];
  parseTimestamp: (timestamp: string) => number;
}

export function useTranscriptView({
  recording, allRecordings, parseTimestamp,
}: UseTranscriptViewOptions) {
  /**
   * Ключевой момент — это фраза от AI без таймкода. Привязываем её к реплике
   * с наибольшим пересечением слов: точной привязки модель не даёт, а метка на
   * дорожке нужна хотя бы примерно в нужном месте.
   */
  const keyMomentMarkers = useMemo(() => {
    if (!recording.keyMoments?.length || !recording.transcript?.length) return [];

    return recording.keyMoments.map(moment => {
      // Короткие слова выбрасываем: предлоги совпадают везде и портят счёт
      const momentWords = new Set(
        moment.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      );

      let bestIndex = 0;
      let bestScore = 0;
      recording.transcript.forEach((item, index) => {
        const score = item.text.toLowerCase().split(/\s+/)
          .filter(word => momentWords.has(word)).length;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      return { timestamp: recording.transcript[bestIndex].timestamp, label: moment };
    });
  }, [recording.keyMoments, recording.transcript]);

  /** С какой секунды начинаются дописанные позже куски — плеер рисует там границу */
  const appendBoundaryTimestamp = useMemo(() => {
    const first = recording.transcript.find(t => t.isAppended && t.timestamp !== '--:--');
    return first ? parseTimestamp(first.timestamp) : null;
    // parseTimestamp стабилен по смыслу (чистая функция), в зависимости не берём
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.transcript]);

  const uniqueSpeakers = useMemo(
    () => [...new Set(recording.transcript.map(t => t.speaker))],
    [recording.transcript],
  );

  /** Один голос — красить нечего, цвет только мешал бы */
  const shouldColorSpeakers = uniqueSpeakers.length >= 2;

  const speakerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let paletteIndex = 1;

    uniqueSpeakers.forEach(speaker => {
      if (SELF_LABELS.has(speaker)) {
        map[speaker] = SPEAKER_PALETTE[0];
      } else {
        map[speaker] = SPEAKER_PALETTE[paletteIndex % SPEAKER_PALETTE.length];
        paletteIndex++;
      }
    });

    return map;
  }, [uniqueSpeakers]);

  const relatedRecordings = useMemo(
    () => findRelated(recording, allRecordings),
    [recording, allRecordings],
  );

  return {
    keyMomentMarkers,
    appendBoundaryTimestamp,
    uniqueSpeakers,
    shouldColorSpeakers,
    speakerColorMap,
    relatedRecordings,
  };
}
