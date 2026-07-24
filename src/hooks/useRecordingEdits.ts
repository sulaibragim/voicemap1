import { useCallback } from 'react';
import type { Recording, TranscriptItem } from '../types';

/**
 * Правки записи прямо из её экрана: название, теги, имена спикеров, напоминания.
 *
 * Все идут одним путём — собрать новый объект и отдать наверх. Здесь нет
 * оптимистичных обновлений: Firestore-подписка вернёт изменение сама, а свой
 * локальный слепок разъезжался бы с сервером при параллельной правке.
 */

interface UseRecordingEditsOptions {
  recording: Recording;
  onUpdate: (recording: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function useRecordingEdits({ recording, onUpdate, showToast }: UseRecordingEditsOptions) {
  const saveTitle = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === recording.title) return;
    onUpdate({ ...recording, title: trimmed });
    showToast('Название обновлено', 'success');
  }, [recording, onUpdate, showToast]);

  const addTag = useCallback((value: string) => {
    // Теги в нижнем регистре: иначе «Митинг» и «митинг» станут разными
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || recording.tags.includes(trimmed)) return;
    onUpdate({ ...recording, tags: [...recording.tags, trimmed] });
  }, [recording, onUpdate]);

  const removeTag = useCallback((tag: string) => {
    onUpdate({ ...recording, tags: recording.tags.filter(t => t !== tag) });
  }, [recording, onUpdate]);

  const setReminder = useCallback((taskIndex: number, date: string, time: string) => {
    const reminders = { ...(recording.taskReminders ?? {}) };
    reminders[taskIndex] = { date, time, notified: false };
    onUpdate({ ...recording, taskReminders: reminders });
    showToast(`Напоминание установлено на ${date} в ${time}`, 'success');
  }, [recording, onUpdate, showToast]);

  /**
   * Переименование спикера. Меняем во всех репликах разом — и в полном
   * транскрипте, и в кратком, иначе после переключения режима вернётся
   * старое имя. speakerNames хранит соответствие для будущих записей.
   */
  const renameSpeaker = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    const rename = (item: TranscriptItem): TranscriptItem =>
      item.speaker === oldName ? { ...item, speaker: trimmed } : item;

    onUpdate({
      ...recording,
      transcript: recording.transcript.map(rename),
      condensedTranscript: recording.condensedTranscript?.map(rename),
      speakerNames: { ...(recording.speakerNames || {}), [oldName]: trimmed },
    });
    showToast(`${oldName} → ${trimmed}`, 'success');
  }, [recording, onUpdate, showToast]);

  return { saveTitle, addTag, removeTag, setReminder, renameSpeaker };
}
