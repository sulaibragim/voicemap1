import React from 'react';
import { Mic, FileAudio, CheckCircle2, StickyNote, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import type { Message, Recording } from '../types';

interface ChatMessageBubbleProps {
  msg: Message;
  recordings: Recording[];
  onOpenRecording: (id: string) => void;
  onClose: () => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  msg,
  recordings,
  onOpenRecording,
  onClose,
}) => {
  return (
    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] p-4 rounded-2xl ${
          msg.role === 'user'
            ? 'bg-primary text-on-primary-fixed rounded-tr-sm'
            : 'bg-surface-container text-on-surface rounded-tl-sm border border-white/5'
        }`}
      >
        {msg.isAudio && <Mic className="w-4 h-4 mb-2 opacity-70" />}
        {msg.role === 'assistant' ? (
          <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
            <Markdown>{msg.text}</Markdown>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{msg.text}</p>
        )}
      </div>

      {/* Бейдж выполненного действия */}
      {msg.actionDone === 'focus' && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-secondary/15 border border-secondary/20 rounded-xl">
          <Target className="w-3.5 h-3.5 text-secondary" />
          <span className="text-xs font-bold text-secondary">Фокус-задачи добавлены</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
        </div>
      )}
      {msg.actionDone === 'note' && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-tertiary/15 border border-tertiary/20 rounded-xl">
          <StickyNote className="w-3.5 h-3.5 text-tertiary" />
          <span className="text-xs font-bold text-tertiary">Заметка создана</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-tertiary" />
        </div>
      )}
      {msg.actionDone === 'ideas' && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-primary/15 border border-primary/20 rounded-xl">
          <span className="text-xs">💡</span>
          <span className="text-xs font-bold text-primary">Идеи обновлены</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      {/* Кнопка открыть запись */}
      {msg.recordingId && (
        <div
          onClick={() => { onOpenRecording(msg.recordingId!); onClose(); }}
          className="mt-2 max-w-[85%] bg-surface-container-high border border-primary/30 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-surface-container-highest transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <FileAudio className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary">Открыть запись</p>
            <p className="text-[10px] text-on-surface-variant truncate">
              {recordings.find(r => r.id === msg.recordingId)?.title ?? 'Запись'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
