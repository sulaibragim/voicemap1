import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Mic, Loader2, Square } from 'lucide-react';
import { searchRecordings, transcribeChatVoice } from '../lib/api';
import { ASSISTANT_WELCOME } from '../lib/assistantPrompt';
import { useChatRecording } from '../hooks/useChatRecording';
import { ChatMessageBubble } from './ChatMessageBubble';
import type { Message } from '../types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Открыть найденную запись, опционально сразу перемотав на таймкод источника */
  onOpenRecording: (id: string, seekTo?: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Про запуск', prompt: 'Что я говорил про запуск?' },
  { label: 'Мои обещания', prompt: 'Какие задачи я обещал?' },
  { label: 'Про инвестора', prompt: 'Найди про инвестора' },
];

// Генерация уникального ID для сообщений — вынесена вне компонента
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onClose, onOpenRecording }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: ASSISTANT_WELCOME }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Единая точка входа для текста и распознанного голоса — всё идёт в поиск по записям
  const handleSend = async (text: string, isAudio = false, skipUserMessage = false) => {
    if (!text.trim() && !isAudio) return;

    setShowQuickActions(false);

    if (!skipUserMessage) {
      setMessages(prev => [...prev, { id: makeId(), role: 'user', text, isAudio }]);
    }
    setInputValue('');
    setIsProcessing(true);

    // searchRecordings не бросает — при ошибке вернёт понятный fallback-ответ
    const result = await searchRecordings(text);

    setMessages(prev => [...prev, {
      id: makeId(),
      role: 'assistant',
      text: result.answer,
      sources: result.sources.length > 0 ? result.sources : undefined,
    }]);
    setIsProcessing(false);
  };

  const { isRecording, recordingTime, startRecording, stopRecording, formatTime } = useChatRecording({
    onAudioReady: async (base64Audio, mimeType) => {
      setIsProcessing(true);
      const tempId = makeId();
      setMessages(prev => [...prev, { id: tempId, role: 'user', text: 'Голосовое сообщение...', isAudio: true }]);
      try {
        const transcript = await transcribeChatVoice(base64Audio, mimeType);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: transcript } : m));
        if (!transcript || transcript.trim() === '[Тишина]') {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setIsProcessing(false);
          return;
        }
        await handleSend(transcript, true, true);
      } catch {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setIsProcessing(false);
      }
    },
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ transformOrigin: 'bottom right' }}
          className="fixed bottom-24 md:bottom-32 right-4 md:right-8 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[75vh] bg-surface-bright border border-white/10 rounded-2xl z-[301] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Шапка */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-container-low shrink-0">
            <div>
              <h2 className="font-headline text-lg font-bold text-primary">Поиск по записям</h2>
              <p className="text-xs text-on-surface-variant">Спроси голосом или текстом</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="overflow-y-auto p-4 space-y-4 min-h-0 flex-1">
            {messages.map(msg => (
              <ChatMessageBubble
                key={msg.id}
                msg={msg}
                onOpenRecording={onOpenRecording}
                onClose={onClose}
              />
            ))}

            {isProcessing && (
              <div className="flex items-start">
                <div className="bg-surface-container p-4 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-on-surface-variant">Ищу...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Быстрые действия */}
          <AnimatePresence>
            {showQuickActions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0"
              >
                {QUICK_ACTIONS.map(qa => (
                  <button
                    key={qa.label}
                    onClick={() => handleSend(qa.prompt)}
                    disabled={isProcessing}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-surface-container-high border border-white/8 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {qa.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ввод */}
          <div className="p-4 border-t border-white/5 bg-surface-container-low shrink-0">
            {isRecording ? (
              <div className="flex items-center gap-4 bg-error/10 border border-error/30 rounded-full p-2 pr-4">
                <button
                  onClick={stopRecording}
                  aria-label="Остановить запись голосового сообщения"
                  className="w-10 h-10 rounded-full bg-error text-white flex items-center justify-center hover:scale-105 transition-transform animate-pulse"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                </button>
                <div className="flex-1">
                  <p className="text-xs font-bold text-error">Запись...</p>
                  <p className="text-xs text-error/70 font-mono">{formatTime(recordingTime)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={startRecording}
                  disabled={isProcessing}
                  aria-label="Найти голосом"
                  className="p-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleSend(inputValue)}
                    placeholder="Найти в записях..."
                    className="w-full bg-surface-container border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={!inputValue.trim() || isProcessing}
                    aria-label="Искать"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-primary text-on-primary-fixed disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
