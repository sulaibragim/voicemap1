import { useState, useRef, useEffect } from 'react';
import { transcribeChatVoice } from '../lib/api';
import type { NoteType } from '../types';

interface UseQuickNoteRecordingOptions {
  noteType: NoteType;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onStarted: () => void;
  onProcessing: () => void;
  onTranscribed: (text: string) => Promise<void>;
  onError: (fallbackContent: string) => void;
  onMicrophoneError: () => void;
}

interface UseQuickNoteRecordingResult {
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useQuickNoteRecording(options: UseQuickNoteRecordingOptions): UseQuickNoteRecordingResult {
  // noteType больше не используется для промпта (промпт теперь фиксирован на сервере), но остаётся в опциях для совместимости вызова
  const { showToast, onStarted, onProcessing, onTranscribed, onError, onMicrophoneError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Таймер — считает секунды во время записи
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Cleanup на unmount — освобождаем микрофон, если пользователь закрыл модалку во время записи
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        onProcessing();

        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const base64Audio = await base64Promise;

          // Промпт для транскрипции теперь фиксирован на сервере (/chat-voice) — клиент не передаёт свой prompt
          const text = await transcribeChatVoice(base64Audio, blob.type || 'audio/webm');

          await onTranscribed(text);
        } catch (err) {
          console.warn('Error processing audio note:', err);
          showToast('Ошибка AI. Заметка сохранена как аудио.', 'error');
          onError('[Аудиозапись не распознана из-за ошибки сети или квоты]');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      onStarted();
    } catch (err) {
      console.warn('Error accessing microphone:', err);
      showToast('Не удалось получить доступ к микрофону. Введи текст вручную.', 'error');
      onMicrophoneError();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return { isRecording, duration, startRecording, stopRecording };
}
