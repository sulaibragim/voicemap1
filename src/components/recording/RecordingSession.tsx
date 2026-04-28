import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Pause, Play, Square, ArrowLeft } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { useNativeRecorder } from '../../hooks/useNativeRecorder';

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const durationRef = useRef(0);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const nativeFilePathRef = useRef<string | null>(null);

  const { isAvailable: isNative, startNativeRecording, stopNativeRecording } = useNativeRecorder();

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
        const result = await startNativeRecording();
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
  stopRecordingRef.current = stopRecording;

  const togglePause = () => {
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
      <div className="text-center mb-12">
        <h2 className="font-headline text-4xl font-bold mb-4">Живая сессия</h2>
        <p className="text-on-surface-variant">Запись встречи или интервью</p>
      </div>

      {/* Круг с таймером + анимация */}
      <div className="relative flex items-center justify-center mb-10">
        {isRecording && !isPaused && (
          <>
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute w-64 h-64 rounded-full bg-error/20 blur-xl"
            />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.2 }}
              className="absolute w-64 h-64 rounded-full bg-error/10 blur-2xl"
            />
          </>
        )}
        {isRecording && isPaused && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute w-64 h-64 rounded-full bg-primary/15 blur-xl"
          />
        )}

        <div className="w-48 h-48 rounded-full bg-surface-container-high border-4 border-surface-container flex flex-col items-center justify-center z-10 relative shadow-2xl gap-1">
          <div className="text-4xl font-mono font-bold text-white tracking-wider">
            {formatTime(duration)}
          </div>
          <AnimatePresence mode="wait">
            {isRecording && (
              <motion.div
                key={isPaused ? 'paused' : isMuted ? 'muted' : 'recording'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className={`text-[10px] font-bold tracking-widest uppercase ${
                  isPaused ? 'text-primary' : isMuted ? 'text-yellow-400' : 'text-error'
                }`}
              >
                {isPaused ? '⏸ Пауза' : isMuted ? '🔇 Без звука' : '● Запись'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="flex items-center gap-5 mb-8">
        {!isRecording ? (
          /* Кнопка старта */
          <motion.button
            onClick={startRecording}
            whileTap={{ scale: 0.95 }}
            className="w-20 h-20 rounded-full bg-error text-white flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,84,73,0.4)] cursor-pointer"
          >
            <Mic className="w-8 h-8" fill="currentColor" />
          </motion.button>
        ) : (
          <>
            {/* Мьют */}
            <motion.button
              onClick={toggleMute}
              whileTap={{ scale: 0.92 }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isMuted
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  : 'bg-surface-container-high border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
              }`}
            >
              {isMuted
                ? <MicOff className="w-5 h-5" />
                : <Mic className="w-5 h-5" />
              }
            </motion.button>

            {/* Стоп — центр, большой */}
            <motion.button
              onClick={stopRecording}
              whileTap={{ scale: 0.92 }}
              className="w-20 h-20 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:scale-105 transition-transform border border-error/30 cursor-pointer shadow-[0_0_20px_rgba(255,84,73,0.2)]"
            >
              <Square className="w-6 h-6 fill-error" />
            </motion.button>

            {/* Пауза / Продолжить */}
            <motion.button
              onClick={togglePause}
              whileTap={{ scale: 0.92 }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isPaused
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-surface-container-high border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
              }`}
            >
              {isPaused
                ? <Play className="w-5 h-5 fill-primary" />
                : <Pause className="w-5 h-5" />
              }
            </motion.button>
          </>
        )}
      </div>

      {/* Подсказки под кнопками */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-9 text-[10px] text-on-surface-variant/40 font-bold tracking-wider uppercase"
          >
            <span>Мьют</span>
            <span className="w-8 text-center">Стоп</span>
            <span>{isPaused ? 'Продолжить' : 'Пауза'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
