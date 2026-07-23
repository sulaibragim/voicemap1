import { useState, useRef } from 'react';
import type * as React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { transcribeChatVoice } from '../../lib/api';

export interface VoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/** Reusable input with an integrated mic button on the right */
export const VoiceInput = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus,
  showToast,
}: VoiceInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const text = await transcribeChatVoice(base64, 'audio/webm');
            if (text.trim()) onChange(text.trim());
            else showToast('Ничего не распознано', 'error');
          } catch {
            showToast('Ошибка распознавания', 'error');
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      showToast('Нет доступа к микрофону', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const toggleMic = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className="relative flex-1">
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isRecording ? 'Говорите...' : placeholder}
        className={`w-full bg-surface-container border rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none transition-colors ${
          isRecording
            ? 'border-error/50 focus:border-error placeholder-error/50'
            : 'border-white/10 focus:border-secondary/50'
        }`}
      />
      <button
        type="button"
        onClick={toggleMic}
        disabled={isTranscribing}
        title={isRecording ? 'Остановить запись' : 'Говорить голосом'}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer disabled:opacity-50 ${
          isRecording
            ? 'text-error animate-pulse'
            : isTranscribing
              ? 'text-secondary'
              : 'text-on-surface-variant hover:text-secondary'
        }`}
      >
        {isTranscribing
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : isRecording
            ? <Square className="w-4 h-4 fill-current" />
            : <Mic className="w-4 h-4" />
        }
      </button>
    </div>
  );
};
