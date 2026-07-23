import { useCallback, useEffect, useRef } from 'react';

interface UseTranscriptAutoScrollOptions {
  /** Индекс реплики, активной по текущему времени плеера */
  activeIndex: number;
  /** Индекс реплики, к которой привёл голосовой поиск (подсвечивается отдельно) */
  highlightIndex?: number | null;
  /** Автоскролл во время воспроизведения включаем только пока идёт play */
  isPlaying: boolean;
  /** Список активен (полный режим транскрипта, нужный таб открыт) — иначе скролл не трогаем */
  enabled: boolean;
}

// Сколько мс после ручного скролла пользователя не перебиваем его автоскроллом
const USER_SCROLL_GUARD_MS = 5000;
// Длительность нашего программного скролла — на это время игнорируем событие scroll как "не наше"
const AUTO_SCROLL_SETTLE_MS = 700;

/**
 * Общая логика автоскролла к активной реплике транскрипта (десктоп + мобилка).
 * Защита от перебивания: если пользователь сам скроллил список недавно — не дёргаем его.
 * Различаем "наш" программный скролл и ручной пользовательский флагом isAutoScrollingRef,
 * чтобы наш же scrollIntoView не засчитался как "пользователь скроллил".
 */
export function useTranscriptAutoScroll({ activeIndex, highlightIndex, isPlaying, enabled }: UseTranscriptAutoScrollOptions) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const lastUserScrollAt = useRef(0);
  const lastScrolledIndex = useRef(-1);
  const lastHighlightScrolled = useRef<number | null>(null);
  // Кэш колбэков-рефов по индексу — стабильная ссылка на функцию,
  // чтобы React не дёргал ref (null → элемент) на каждый ре-рендер списка
  const refCallbacksCache = useRef<Map<number, (el: HTMLDivElement | null) => void>>(new Map());

  // Колбэк-реф для конкретного индекса реплики — сохраняем DOM-узел в массив
  const registerItemRef = useCallback((index: number) => {
    let cb = refCallbacksCache.current.get(index);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => { itemRefs.current[index] = el; };
      refCallbacksCache.current.set(index, cb);
    }
    return cb;
  }, []);

  const handleContainerScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return; // это наш собственный скролл — не считаем ручным
    lastUserScrollAt.current = Date.now();
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const el = itemRefs.current[index];
    if (!el) return;
    isAutoScrollingRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => { isAutoScrollingRef.current = false; }, AUTO_SCROLL_SETTLE_MS);
  }, []);

  // Автоскролл к активной реплике во время воспроизведения
  useEffect(() => {
    if (!enabled || !isPlaying || activeIndex < 0 || activeIndex === lastScrolledIndex.current) return;
    lastScrolledIndex.current = activeIndex;
    if (Date.now() - lastUserScrollAt.current < USER_SCROLL_GUARD_MS) return; // пользователь недавно скроллил — не мешаем
    scrollToIndex(activeIndex);
  }, [activeIndex, isPlaying, enabled, scrollToIndex]);

  // Прокрутка к реплике, на которую привёл голосовой поиск — один раз при открытии
  useEffect(() => {
    if (highlightIndex == null || highlightIndex === lastHighlightScrolled.current) return;
    lastHighlightScrolled.current = highlightIndex;
    scrollToIndex(highlightIndex);
  }, [highlightIndex, scrollToIndex]);

  return { itemRefs, containerRef, registerItemRef, handleContainerScroll };
}
