import { useState, useRef, useEffect } from 'react';
import { fetchDailyTip } from '../lib/api';
import type { Recording } from '../types';

interface DailyTip {
  title: string;
  text: string;
}

export function useDailyTip(recordings: Recording[]) {
  const [dailyTip, setDailyTip] = useState<DailyTip | null>(null);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  // Ref-флаг: предотвращает двойной вызов в React StrictMode и при пересчёте эффекта
  const tipFetchingRef = useRef(false);

  useEffect(() => {
    if (dailyTip || tipFetchingRef.current || recordings.length === 0) return;
    tipFetchingRef.current = true;
    setIsGeneratingTip(true);
    const context = recordings.slice(0, 3).map(r => `Title: ${r.title}\nSummary: ${r.summary}`).join('\n\n');
    fetchDailyTip(context)
      .then(result => {
        if (result.title && result.text) {
          setDailyTip(result);
        } else {
          setDailyTip({ title: 'ПРОДУКТИВНОСТЬ', text: 'Регулярно просматривайте свои записи, чтобы не упустить важные детали.' });
        }
      })
      .catch(() => {
        setDailyTip({ title: 'СОВЕТ ДНЯ', text: 'Используйте быстрые заметки, чтобы моментально фиксировать идеи и задачи.' });
      })
      .finally(() => {
        setIsGeneratingTip(false);
      });
  // recordings.length — намеренно только триггер, не весь массив
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);

  return { dailyTip, isGeneratingTip };
}
