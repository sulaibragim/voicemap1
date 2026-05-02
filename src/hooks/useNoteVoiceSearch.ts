import { useState, useRef, useEffect } from 'react';
import { transcribeChatVoice } from '../lib/api';

interface UseNoteVoiceSearchOptions {
  onResult: (text: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function useNoteVoiceSearch({ onResult, showToast }: UseNoteVoiceSearchOptions) {
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startVoiceSearch = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsVoiceSearching(false);
        setIsVoiceProcessing(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const text = await transcribeChatVoice(base64, mimeType);
            if (text && text !== '[Тишина]') onResult(text);
          } catch {
            showToast('Ошибка распознавания речи', 'error');
          } finally {
            setIsVoiceProcessing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsVoiceSearching(true);
      setVoiceTime(0);
      timerRef.current = window.setInterval(() => setVoiceTime(v => v + 1), 1000);
    } catch {
      showToast('Не удалось получить доступ к микрофону', 'error');
    }
  };

  const stopVoiceSearch = () => {
    if (mediaRecorderRef.current && isVoiceSearching) mediaRecorderRef.current.stop();
  };

  return { isVoiceSearching, isVoiceProcessing, voiceTime, startVoiceSearch, stopVoiceSearch };
}
