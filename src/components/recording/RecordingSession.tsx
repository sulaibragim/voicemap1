import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Volume2 } from 'lucide-react';
import { useNativeRecorder, type AudioMode } from '../../hooks/useNativeRecorder';
import { RecordingTimerCircle } from './RecordingTimerCircle';
import { RecordingControls } from './RecordingControls';

interface RecordingSessionProps {
  onFinish: (blob: Blob, duration: number) => void;
  onCancel: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  autoStopMinutes?: number | null;
}

export const RecordingSession = ({ onFinish, onCancel, showToast, autoStopMinutes }: RecordingSessionProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioMode, setAudioMode] = useState<AudioMode>('mic');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const durationRef = useRef(0);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const nativeFilePathRef = useRef<string | null>(null);

  const { isAvailable: isNative, startNativeRecording, pauseNativeRecording, resumeNativeRecording, stopNativeRecording } = useNativeRecorder();

  // Таймер — останавливается на паузе, автостоп по лимиту
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
        if (autoStopMinutes && durationRef.current >= autoStopMinutes * 60) {
          showToast(`Автостоп: достигнут лимит ${autoStopMinutes} мин`, 'info');
          stopRecordingRef.current?.();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused, autoStopMinutes, showToast]);

  // Cleanup на unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    durationRef.current = 0;
    setDuration(0);
    setIsPaused(false);
    setIsMuted(false);

    // На Android — нативный Foreground Service (запись при заблокированном экране)
    if (isNative) {
      try {
        const result = await startNativeRecording(audioMode);
        if (result) {
          nativeFilePathRef.current = result.filePath;
          setIsRecording(true);
          return;
        }
      } catch (err) {
        console.warn('[NativeRecorder] Falling back to web recorder:', err);
      }
    }

    // Веб-fallback — обычный MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        onFinish(blob, durationRef.current);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast('Не удалось получить доступ к микрофону.', 'error');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsPaused(false);

    // Нативная остановка — читаем файл и передаём как Blob
    if (isNative && nativeFilePathRef.current) {
      await stopNativeRecording();
      // stopNativeRecording уже ждёт 800ms — файл должен быть готов
      try {
        const cap = (window as unknown as { Capacitor?: { convertFileSrc: (p: string) => string } }).Capacitor;
        const fileUrl = cap?.convertFileSrc(nativeFilePathRef.current) ?? `file://${nativeFilePathRef.current}`;
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`File fetch failed: ${response.status}`);
        const blob = await response.blob();
        if (blob.size < 100) throw new Error('File too small — likely empty');
        const audioBlob = new Blob([blob], { type: 'audio/mp4' });
        nativeFilePathRef.current = null;
        onFinish(audioBlob, durationRef.current);
      } catch (e) {
        console.error('[NativeRecorder] Failed to read file, fallback to web chunks:', e);
        // Fallback — если нативный файл не читается, сохраняем что есть в chunksRef
        nativeFilePathRef.current = null;
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          onFinish(blob, durationRef.current);
        } else {
          showToast('Не удалось сохранить запись', 'error');
        }
      }
      return;
    }

    // Веб
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Обновляем ref после каждого рендера чтобы таймер всегда вызывал актуальную версию
  // eslint-disable-next-line react-hooks/refs
  stopRecordingRef.current = stopRecording;

  const togglePause = async () => {
    if (isNative) {
      // Нативный режим — отправляем команду в Android-сервис
      if (!isPaused) {
        await pauseNativeRecording();
        setIsPaused(true);
      } else {
        await resumeNativeRecording();
        setIsPaused(false);
      }
      return;
    }
    // Веб-режим
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === 'recording') {
      mr.pause();
      setIsPaused(true);
    } else if (mr.state === 'paused') {
      mr.resume();
      setIsPaused(false);
    }
  };

  const toggleMute = () => {
    if (isNative) {
      // В нативном режиме мьют не поддерживается — сообщаем пользователю
      showToast('Используй паузу для остановки записи', 'info');
      return;
    }
    const tracks = streamRef.current?.getAudioTracks();
    if (!tracks?.length) return;
    const newMuted = !isMuted;
    tracks.forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
    showToast(newMuted ? 'Микрофон выключен' : 'Микрофон включён', 'info');
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    onCancel();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center font-body selection:bg-primary/30 w-full relative">

      {/* Кнопка назад */}
      <div className="absolute top-8 left-8">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Отмена</span>
        </button>
      </div>

      {/* Заголовок */}
      <div className="text-center mb-8">
        <h2 className="font-headline text-4xl font-bold mb-4">Живая сессия</h2>
        <p className="text-on-surface-variant">Запись встречи или интервью</p>
      </div>

      {/* Переключатель источника звука — только на Android, только до старта */}
      {isNative && !isRecording && (
        <div className="flex gap-2 mb-8 bg-surface-container rounded-2xl p-1">
          {([
            { mode: 'mic'     as AudioMode, label: 'Микрофон', icon: '🎙' },
            { mode: 'both'    as AudioMode, label: 'Оба',      icon: '🎙+🔊' },
            { mode: 'speaker' as AudioMode, label: 'Динамик',  icon: '🔊' },
          ] as const).map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setAudioMode(mode)}
              className={`flex flex-col items-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                audioMode === mode
                  ? 'bg-primary text-on-primary shadow-lg scale-105'
                  : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <span className="text-lg mb-0.5">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
      {/* Показываем активный режим во время записи */}
      {isNative && isRecording && (
        <div className="mb-6 flex items-center gap-2 text-xs text-on-surface-variant">
          <Volume2 className="w-3 h-3" />
          <span>{audioMode === 'mic' ? 'Микрофон' : audioMode === 'both' ? 'Микрофон + Динамик' : 'Динамик'}</span>
        </div>
      )}

      <RecordingTimerCircle
        duration={duration}
        isRecording={isRecording}
        isPaused={isPaused}
        isMuted={isMuted}
      />
      <RecordingControls
        isRecording={isRecording}
        isPaused={isPaused}
        isMuted={isMuted}
        onStart={startRecording}
        onStop={stopRecording}
        onTogglePause={togglePause}
        onToggleMute={toggleMute}
      />
    </div>
  );
};
