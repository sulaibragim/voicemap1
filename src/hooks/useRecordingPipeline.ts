import { useCallback } from 'react';
import { processRecordingAsync } from '../lib/api';
import { quotaToastMessage } from '../lib/usageFormat';
import type { AppSettings, Recording } from '../types';

/**
 * Конвейер записи: свежее аудио → Firestore → R2 → фоновая расшифровка.
 *
 * Один путь для записи с микрофона и для импорта готового файла: File наследует
 * Blob, поэтому отдельной ветки для импорта не нужно.
 */

interface UseRecordingPipelineOptions {
  addRecording: (recording: Recording) => Promise<void> | void;
  patchRecordingItem: (id: string, patch: Partial<Recording>) => Promise<void> | void;
  addPersonFromRecording: (recording: Recording) => void;
  getKnownNames: () => string[];
  /** Нужен, чтобы не затереть статусом ошибки уже сохранённую сервером расшифровку */
  recordings: Recording[];
  language: AppSettings['language'];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onStart: () => void;
  onPending: (recordingId: string) => void;
  onSettled: () => void;
}

/** Секунды → «05:30». Формат хранится строкой: так его показывает интерфейс. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Пустая запись со статусом «обрабатывается» — её видно сразу, ещё до загрузки */
function createPendingRecording(id: string, date: string, duration: string): Recording {
  return {
    id,
    title: 'Обрабатывается...',
    date,
    duration,
    tags: [],
    summary: '',
    transcript: [],
    keyMoments: [],
    actionItems: [],
    ideas: [],
    mentions: [],
    openQuestions: [],
    participants: [],
    richActionItems: [],
    bigQuestions: [],
    aiStatus: 'processing',
    audioUrl: undefined,
    r2Key: undefined,
  };
}

export function useRecordingPipeline({
  addRecording, patchRecordingItem, addPersonFromRecording, getKnownNames,
  recordings, language, showToast, onStart, onPending, onSettled,
}: UseRecordingPipelineOptions) {
  const handleFinishRecording = useCallback(async (blob: Blob, durationSeconds: number) => {
    onStart();

    const recordingId = Date.now().toString();
    const duration = formatDuration(durationSeconds);
    const date = new Date().toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

    const pendingRecording = createPendingRecording(recordingId, date, duration);

    // Ждём завершения записи в Firestore. Иначе сервер успеет обновить документ
    // расшифровкой РАНЬШЕ, чем клиент его создаст: обновление улетит в
    // несуществующий документ, а клиент потом перезапишет готовое пустышкой.
    await addRecording(pendingRecording);
    addPersonFromRecording(pendingRecording);
    onPending(recordingId);
    onSettled();

    // Дальше — фоном: сервер сам допишет расшифровку в Firestore.
    // Только patch, не полная перезапись: иначе затрём свежие title/summary/transcript,
    // которые сервер мог уже записать.
    try {
      const { publicUrl, r2Key, queued, quota } = await processRecordingAsync(blob, recordingId, {
        title: 'Новая запись',
        date,
        duration,
        knownPeople: getKnownNames(),
      });

      // Лимит месяца исчерпан: аудио в R2 лежит, расшифровки не будет.
      // Отдельный статус, чтобы не выдавать осознанный отказ за сбой.
      if (!queued) {
        await patchRecordingItem(recordingId, {
          audioUrl: publicUrl,
          r2Key,
          title: 'Без расшифровки',
          aiStatus: 'quota',
        });
        showToast(quotaToastMessage(quota, language), 'error');
        return;
      }

      await patchRecordingItem(recordingId, { audioUrl: publicUrl, r2Key });
    } catch (err) {
      console.warn('[useRecordingPipeline] Upload failed:', err);
      showToast('Ошибка загрузки аудио. Попробуй снова.', 'error');
      // Сервер мог успеть расшифровать запись раньше, чем у клиента отвалилась
      // сеть. Безусловный 'error' затирал готовый результат: данные лежали
      // в базе целыми, а пользователь видел «Ошибка обработки».
      const alreadyTranscribed = recordings.find(r => r.id === recordingId)?.transcript?.length;
      if (!alreadyTranscribed) {
        await patchRecordingItem(recordingId, { aiStatus: 'error' });
      }
    }
  }, [
    addRecording, patchRecordingItem, addPersonFromRecording, getKnownNames,
    recordings, language, showToast, onStart, onPending, onSettled,
  ]);

  /**
   * Импорт готового файла — умные очки, диктофон, ручка-рекордер, обычный файл.
   * Идёт через тот же конвейер: R2 → расшифровка → индексация.
   */
  const handleImportAudio = useCallback((file: File, durationSeconds: number) => {
    showToast('Файл загружается, идёт расшифровка', 'info');
    void handleFinishRecording(file, durationSeconds);
  }, [handleFinishRecording, showToast]);

  return { handleFinishRecording, handleImportAudio };
}
