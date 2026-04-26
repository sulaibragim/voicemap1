import { useRef, useState, useEffect } from 'react';

interface UseAppendAudioReturn {
  isRecordingAppend: boolean;
  appendRecordDuration: number;
  startAppendRecording: (onStop: (blob: Blob) => void) => Promise<void>;
  stopAppendRecording: () => void;
}

// Хук для управления записью аудио в панели дополнения
export function useAppendAudio(
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
): UseAppendAudioReturn {
  const [isRecordingAppend, setIsRecordingAppend] = useState(false);
  const [appendRecordDuration, setAppendRecordDuration] = useState(0);
  const appendMediaRef = useRef<MediaRecorder | null>(null);
  const appendChunksRef = useRef<BlobPart[]>([]);
  const appendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAppendRecording = async (onStop: (blob: Blob) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      appendMediaRef.current = mr;
      appendChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) appendChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(appendChunksRef.current, { type: 'audio/webm' });
        onStop(blob);
      };
      mr.start();
      setIsRecordingAppend(true);
      setAppendRecordDuration(0);
      appendTimerRef.current = setInterval(() => setAppendRecordDuration(d => d + 1), 1000);
    } catch {
      showToast('Нет доступа к микрофону', 'error');
    }
  };

  const stopAppendRecording = () => {
    // Проверяем состояние перед вызовом stop() чтобы не получить InvalidStateError
    const mr = appendMediaRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    // Очищаем ref чтобы предотвратить повторный stop() при handleClose
    appendMediaRef.current = null;
    setIsRecordingAppend(false);
    if (appendTimerRef.current) {
      clearInterval(appendTimerRef.current);
      appendTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (appendTimerRef.current) clearInterval(appendTimerRef.current);
      const mr = appendMediaRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    };
  }, []);

  return { isRecordingAppend, appendRecordDuration, startAppendRecording, stopAppendRecording };
}
