import { useEffect, useRef, useState } from 'react';
import { findActiveTranscriptIndex } from '../lib/timestamp';
import type { TranscriptItem } from '../types';

/**
 * Прыжок к моменту из голосового поиска — ядро главной фичи продукта.
 *
 * Пользователь спросил голосом, получил ответ со ссылкой на секунду записи,
 * кликнул — запись открылась и играет с нужного места, а найденная реплика
 * подсвечена, чтобы её было видно в стене текста.
 *
 * Три тонкости, которые легко потерять:
 *   1. Перематываем ровно один раз за монтирование — иначе аудио будет
 *      прыгать назад каждый раз, когда пользователь сам перемотал дальше.
 *   2. Ждём duration > 0: аудио грузится с R2 асинхронно, до loadedmetadata
 *      перемотка молча ничего не делает.
 *   3. Подсветка гаснет сама — по таймеру или как только пошло воспроизведение.
 *      Иначе она висит вечно и превращается в мусор на экране.
 */

/** Сколько подсветка держится, если пользователь ничего не делает */
const HIGHLIGHT_MS = 4000;

interface UseSearchHighlightOptions {
  /** Таймкод из результата поиска: 'MM:SS' или 'H:MM:SS'. Пусто — обычное открытие записи */
  initialSeek?: string;
  transcript: TranscriptItem[];
  /** Длительность аудио; 0 означает, что метаданные ещё не загрузились */
  duration: number;
  isPlaying: boolean;
  parseTimestamp: (timestamp: string) => number;
  onSeek: (seconds: number) => void;
}

export function useSearchHighlight({
  initialSeek, transcript, duration, isPlaying, parseTimestamp, onSeek,
}: UseSearchHighlightOptions): number | null {
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const didSeekRef = useRef(false);

  useEffect(() => {
    if (!initialSeek || didSeekRef.current || duration <= 0) return;

    const seconds = parseTimestamp(initialSeek);
    if (!Number.isFinite(seconds) || seconds < 0) return;

    didSeekRef.current = true;
    // Клампим: модель могла вернуть таймкод за пределами длительности
    const target = Math.min(seconds, Math.max(duration - 1, 0));
    onSeek(target);

    const index = findActiveTranscriptIndex(transcript, target);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (index >= 0) setHighlightIndex(index);
  // onSeek и parseTimestamp пересоздаются каждый рендер — в зависимости не берём,
  // от повторного запуска защищает didSeekRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeek, duration]);

  // Гаснет по таймеру...
  useEffect(() => {
    if (highlightIndex === null) return;
    const timer = setTimeout(() => setHighlightIndex(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightIndex]);

  // ...или сразу, как только пользователь начал слушать
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isPlaying) setHighlightIndex(null);
  }, [isPlaying]);

  return highlightIndex;
}
