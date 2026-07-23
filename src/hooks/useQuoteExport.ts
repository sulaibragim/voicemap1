import { useCallback } from 'react';
import { useTranscriptSelection } from './useTranscriptSelection';
import { buildQuoteFileName, buildQuoteText } from '../lib/quoteExport';
import type { TranscriptItem } from '../types';

interface UseQuoteExportOptions {
  /** Реплики ровно в том виде, в каком они отрисованы — полные или краткие */
  transcript: TranscriptItem[];
  title: string;
  date: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Выделение куска транскрипта → цитата с таймкодом и спикером в буфер или в файл.
 * Общий хук для десктопа (TranscriptSection) и мобилки (RecordingMobileTranscriptTab),
 * чтобы формат цитаты и поведение не разъехались между версиями.
 */
export function useQuoteExport({ transcript, title, date, showToast }: UseQuoteExportOptions) {
  const { containerRef, selection, clear } = useTranscriptSelection(transcript);

  const handleCopy = useCallback(async () => {
    const text = buildQuoteText(selection.fragments, { title, date });
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Цитата скопирована с таймкодом', 'success');
      clear();
    } catch (e) {
      // Буфер недоступен: небезопасный контекст (http) или запрет в настройках браузера
      console.warn('[useQuoteExport] clipboard write failed:', e);
      showToast('Браузер не дал доступ к буферу обмена. Скачайте цитату файлом.', 'error');
    }
  }, [selection.fragments, title, date, showToast, clear]);

  const handleDownload = useCallback(() => {
    const text = buildQuoteText(selection.fragments, { title, date });
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildQuoteFileName({ title, date });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Цитата сохранена', 'success');
    clear();
  }, [selection.fragments, title, date, showToast, clear]);

  return { containerRef, selection, handleCopy, handleDownload };
}
