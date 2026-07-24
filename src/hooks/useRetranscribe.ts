import { useCallback } from 'react';
import { retranscribeFromUrl, QuotaExceededError } from '../lib/api';
import { guessAudioMimeFromUrl } from '../lib/audioMime';
import { parseDurationToSeconds } from '../lib/recordingUtils';
import { quotaToastMessage } from '../lib/usageFormat';
import type { AppSettings, Recording } from '../types';

/**
 * Повторная расшифровка записи: аудио фетчится сервером с R2 и уходит в Gemini
 * заново. Нужна, когда первая попытка упала или пользователь сменил язык вывода.
 *
 * Стоит столько же, сколько первая расшифровка, поэтому сервер так же проверяет
 * месячный лимит — отсюда передача длительности.
 */

interface UseRetranscribeOptions {
  updateRecordingItem: (recording: Recording) => void;
  getKnownNames: () => string[];
  language: AppSettings['language'];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function useRetranscribe({
  updateRecordingItem, getKnownNames, language, showToast,
}: UseRetranscribeOptions) {
  return useCallback(async (recording: Recording | undefined) => {
    if (!recording?.audioUrl) {
      showToast('Нет аудиофайла для транскрипции', 'error');
      return;
    }

    // mimeType определяем по расширению в URL — там и браузерная запись,
    // и импортированные mp3/wav/flac с внешних устройств
    const mimeType = guessAudioMimeFromUrl(recording.audioUrl);

    try {
      const durationSeconds = parseDurationToSeconds(recording.duration);
      const result = await retranscribeFromUrl(
        recording.audioUrl, mimeType, getKnownNames(), durationSeconds,
      );
      updateRecordingItem({
        ...recording,
        ...result,
        title: result.title || recording.title,
        aiStatus: 'done',
      });
      showToast('Транскрипция готова ✓', 'success');
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        showToast(quotaToastMessage(err.usage, language), 'error');
        return;
      }
      console.error('[useRetranscribe] failed:', err);
      showToast('Ошибка повторной транскрипции', 'error');
    }
  }, [updateRecordingItem, getKnownNames, language, showToast]);
}
