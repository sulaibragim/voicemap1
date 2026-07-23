import { useCallback, useEffect, useState } from 'react';
import type { Recording } from '../types';

/**
 * Навигация между экранами: текущий вид, стек «откуда пришли» для кнопки Назад
 * и параметры перехода, живущие ровно один переход (таймкод из поиска,
 * предвыбранный тег библиотеки).
 *
 * Эти параметры обязаны сбрасываться при уходе с экрана — иначе применятся
 * повторно при следующем заходе: пользователь откроет библиотеку и увидит
 * фильтр, который не ставил.
 */

interface UseAppNavigationOptions {
  recordings: Recording[];
  /** Пока Firestore грузится, «запись не найдена» ничего не значит */
  dataLoading: boolean;
}

export function useAppNavigation({ recordings, dataLoading }: UseAppNavigationOptions) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [navStack, setNavStack] = useState<Array<{ view: string }>>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  /** Таймкод из результата голосового поиска — RecordingDetail перемотает сюда один раз */
  const [pendingSeek, setPendingSeek] = useState<string | null>(null);
  /** Предвыбранный тег библиотеки — только на время одного перехода из записи */
  const [libraryTag, setLibraryTag] = useState<string | null>(null);

  // Открыта запись, которой нет (удалили в другой вкладке) — уходим на дашборд.
  // Проверяем только после загрузки: до неё список пуст у всех записей.
  useEffect(() => {
    if (currentView === 'recording_detail' && selectedRecordingId && !dataLoading) {
      const found = recordings.find(r => r.id === selectedRecordingId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!found) setCurrentView('dashboard');
    }
  }, [currentView, selectedRecordingId, recordings, dataLoading]);

  // Ушли с экрана записи — забываем таймкод, иначе он применится повторно
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentView !== 'recording_detail' && pendingSeek !== null) setPendingSeek(null);
  }, [currentView, pendingSeek]);

  // Ушли из библиотеки — забываем тег, иначе следующий заход откроется с фильтром
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentView !== 'library' && libraryTag !== null) setLibraryTag(null);
  }, [currentView, libraryTag]);

  /** Открыть запись, запомнив откуда пришли. seekTo — таймкод из голосового поиска. */
  const openRecording = useCallback((id: string, seekTo?: string) => {
    setNavStack(prev => [...prev, { view: currentView }]);
    setSelectedRecordingId(id);
    setPendingSeek(seekTo ?? null);
    setCurrentView('recording_detail');
  }, [currentView]);

  /** Открыть библиотеку, сразу отфильтрованную по тегу (клик по тегу внутри записи) */
  const openLibraryWithTag = useCallback((tag: string) => {
    setNavStack(prev => [...prev, { view: currentView }]);
    setLibraryTag(tag);
    setCurrentView('library');
  }, [currentView]);

  const goBack = useCallback(() => {
    setNavStack(prev => {
      const entry = prev[prev.length - 1];
      setCurrentView(entry ? entry.view : 'dashboard');
      return entry ? prev.slice(0, -1) : prev;
    });
  }, []);

  return {
    currentView, setCurrentView,
    selectedRecordingId, setSelectedRecordingId,
    pendingSeek, libraryTag,
    openRecording, openLibraryWithTag, goBack,
  };
}
