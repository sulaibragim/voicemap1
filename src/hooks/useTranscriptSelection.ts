import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuoteFragment } from '../lib/quoteExport';
import type { TranscriptItem } from '../types';

// Атрибуты, по которым выделение мышью сопоставляется с репликами.
// Ставятся в TranscriptEntry: индекс на корне реплики, маркер — на абзаце с текстом.
export const TRANSCRIPT_INDEX_ATTR = 'data-transcript-index';
export const TRANSCRIPT_TEXT_ATTR = 'data-transcript-text';

export interface TranscriptSelection {
  fragments: QuoteFragment[];
  /** Прямоугольник выделения в координатах вьюпорта — по нему позиционируется плавающая кнопка */
  rect: DOMRect | null;
}

const EMPTY: TranscriptSelection = { fragments: [], rect: null };

/**
 * Пересечение выделения с содержимым элемента → выделенный кусок его текста.
 * Нужно, когда выделена только часть реплики: в цитату должен попасть именно
 * выделенный фрагмент, а не вся реплика целиком.
 */
function intersectText(selectionRange: Range, element: Element): string {
  const elementRange = document.createRange();
  elementRange.selectNodeContents(element);

  // Обрезаем диапазон элемента границами выделения с обеих сторон
  if (selectionRange.compareBoundaryPoints(Range.START_TO_START, elementRange) > 0) {
    elementRange.setStart(selectionRange.startContainer, selectionRange.startOffset);
  }
  if (selectionRange.compareBoundaryPoints(Range.END_TO_END, elementRange) < 0) {
    elementRange.setEnd(selectionRange.endContainer, selectionRange.endOffset);
  }

  return elementRange.toString();
}

/**
 * Следит за выделением текста внутри контейнера транскрипта и переводит его
 * в список реплик с таймкодами и спикерами.
 *
 * Выделение — родное браузерное: никакого отдельного «режима цитирования».
 * Пользователь выделяет текст ровно так же, как в любой статье, а мы
 * восстанавливаем, каким репликам этот текст принадлежит.
 */
export function useTranscriptSelection(transcript: TranscriptItem[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<TranscriptSelection>(EMPTY);

  const clear = useCallback(() => {
    setSelection(EMPTY);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const container = containerRef.current;
      const nativeSelection = window.getSelection();

      if (!container || !nativeSelection || nativeSelection.isCollapsed || nativeSelection.rangeCount === 0) {
        setSelection(current => (current.fragments.length === 0 ? current : EMPTY));
        return;
      }

      const range = nativeSelection.getRangeAt(0);
      // Выделение целиком снаружи транскрипта (саммари, задачи) нас не касается
      if (!container.contains(range.commonAncestorContainer)
          && !range.intersectsNode(container)) {
        setSelection(current => (current.fragments.length === 0 ? current : EMPTY));
        return;
      }

      const fragments: QuoteFragment[] = [];
      container.querySelectorAll(`[${TRANSCRIPT_INDEX_ATTR}]`).forEach(entryEl => {
        const textEl = entryEl.querySelector(`[${TRANSCRIPT_TEXT_ATTR}]`);
        if (!textEl || !range.intersectsNode(textEl)) return;

        const text = intersectText(range, textEl);
        if (!text.trim()) return;

        const index = Number(entryEl.getAttribute(TRANSCRIPT_INDEX_ATTR));
        const item = transcript[index];
        if (!item) return;

        fragments.push({ speaker: item.speaker, timestamp: item.timestamp, text });
      });

      if (fragments.length === 0) {
        setSelection(current => (current.fragments.length === 0 ? current : EMPTY));
        return;
      }

      setSelection({ fragments, rect: range.getBoundingClientRect() });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
    // Транскрипт в зависимостях: обработчик читает реплики по индексу, и после
    // переименования спикера или дополнения записи он должен видеть новый список.
    // Переподписка дешёвая — список меняется редко.
  }, [transcript]);

  return { containerRef, selection, clear };
}
