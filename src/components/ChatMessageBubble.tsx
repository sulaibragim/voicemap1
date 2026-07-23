import React from 'react';
import { Mic, FileAudio } from 'lucide-react';
import Markdown from 'react-markdown';
import type { Message } from '../types';

interface ChatMessageBubbleProps {
  msg: Message;
  /** Открыть найденную запись на нужной секунде */
  onOpenRecording: (id: string, seekTo?: string) => void;
  onClose: () => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  msg,
  onOpenRecording,
  onClose,
}) => {
  const sources = msg.sources ?? [];

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

      {/* Источники ответа — клик открывает запись на нужной секунде */}
      {sources.length > 0 && (
        <div className="mt-2 w-full max-w-[92%] space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/70 px-1">
            Источники
          </p>
          {sources.map((src, idx) => (
            <button
              key={`${src.recordingId}-${src.timestamp}-${idx}`}
              type="button"
              onClick={() => { onOpenRecording(src.recordingId, src.timestamp); onClose(); }}
              className="w-full text-left bg-surface-container border border-white/5 rounded-xl p-2.5 flex items-start gap-2.5 hover:bg-surface-container-high hover:border-primary/30 transition-colors cursor-pointer group"
            >
              <div className="w-7 h-7 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <FileAudio className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-xs font-bold text-on-surface truncate">{src.title}</p>
                  <span className="text-[10px] font-mono text-primary shrink-0">{src.timestamp}</span>
                </div>
                <p className="text-[11px] leading-snug text-on-surface-variant line-clamp-2 mt-0.5">
                  {src.snippet}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
