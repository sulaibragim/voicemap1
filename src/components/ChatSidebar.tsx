import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Mic, Loader2, Square } from 'lucide-react';
import { chatWithAI, transcribeChatVoice } from '../lib/api';
import { buildAssistantPrompt, ASSISTANT_WELCOME, type AssistantProfile } from '../lib/assistantPrompt';
import { useChatRecording } from '../hooks/useChatRecording';
import { ChatMessageBubble } from './ChatMessageBubble';
import type { Recording, Note, Message } from '../types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  recordings: Recording[];
  notes?: Note[];
  profile?: AssistantProfile;
  onOpenRecording: (id: string) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  onSetFocusTasks?: (tasks: string[]) => void;
  onCreateNote?: (data: { type: string; content: string; dueDate?: string; dueTime?: string }) => void;
  onUpdateRecording?: (id: string, updates: Partial<Recording>) => void;
  onLearnRule?: (rule: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Мои задачи', prompt: 'Покажи все мои открытые задачи' },
  { label: 'Дайджест недели', prompt: 'Сделай дайджест моих записей за эту неделю' },
  { label: 'Лучшие идеи', prompt: 'Какие у меня самые интересные идеи?' },
];

// Генерация уникального ID для сообщений — вынесена вне компонента
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen, onClose, recordings, notes, profile,
  onOpenRecording, currentView, setCurrentView,
  onSetFocusTasks, onCreateNote, onUpdateRecording, onLearnRule,
}) => {
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

  // Определяем коррекцию пользователя и сохраняем правило
  const detectAndLearnRule = (text: string) => {
    const correctionPatterns = [
      /делай (так|вот так|следующий раз)/i,
      /не делай так/i,
      /запомни[,:]?\s+\S/i,
      /следующий раз\s+(делай|пиши|отвечай|используй)/i,
      /\b(всегда|никогда)\s+(?:не\s+)?(делай|используй|отвечай|пиши|добавляй)/i,
    ];
    for (const pattern of correctionPatterns) {
      if (pattern.test(text)) {
        onLearnRule?.(text.trim());
        break;
      }
    }
  };

  const handleSend = async (text: string, isAudio = false, skipUserMessage = false) => {
    if (!text.trim() && !isAudio) return;

    setShowQuickActions(false);
    detectAndLearnRule(text);

    if (!skipUserMessage) {
      setMessages(prev => [...prev, { id: makeId(), role: 'user', text, isAudio }]);
    }
    setInputValue('');
    setIsProcessing(true);

    try {
      const recentMessages = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));

      const prompt = buildAssistantPrompt(text, {
        recordings,
        notes,
        currentView,
        profile,
        recentMessages,
      });

      const result = await chatWithAI(prompt);

      let actionDone: Message['actionDone'];

      if (result.action === 'NAVIGATE' && result.actionTarget) {
        setCurrentView(result.actionTarget);
      }

      if (result.action === 'SET_FOCUS_TASKS') {
        const tasks = Array.isArray(result.actionData?.tasks)
          ? (result.actionData.tasks as unknown[]).filter((t): t is string => typeof t === 'string')
          : [];
        if (tasks.length > 0) {
          onSetFocusTasks?.(tasks);
          actionDone = 'focus';
        }
      }

      if (result.action === 'CREATE_NOTE' && result.actionData) {
        const d = result.actionData as { type?: unknown; content?: unknown; dueDate?: unknown; dueTime?: unknown };
        const noteType = typeof d.type === 'string' && d.type ? d.type : 'Задача';
        const noteContent = typeof d.content === 'string' && d.content.trim()
          ? d.content.trim()
          : (typeof text === 'string' ? text.replace(/^создай\s+(задачу|идею|напоминание)[:\s]*/i, '').trim() : '');
        if (noteContent) {
          onCreateNote?.({
            type: noteType,
            content: noteContent,
            dueDate: typeof d.dueDate === 'string' && d.dueDate ? d.dueDate : undefined,
            dueTime: typeof d.dueTime === 'string' && d.dueTime ? d.dueTime : undefined,
          });
          actionDone = 'note';
        }
      }

      if (result.action === 'UPDATE_IDEAS' && result.actionData) {
        const d = result.actionData as { recordingId?: unknown; ideas?: unknown };
        const recId = typeof d.recordingId === 'string' ? d.recordingId : null;
        const ideas = Array.isArray(d.ideas) ? (d.ideas as unknown[]).filter((i): i is string => typeof i === 'string') : [];
        const exists = recId ? recordings.some(r => r.id === recId) : false;
        if (exists && recId && ideas.length > 0) {
          onUpdateRecording?.(recId, { ideas });
          actionDone = 'ideas';
        }
      }

      // Валидируем что recordingId реально существует
      const validRecordingId = result.action === 'OPEN_RECORDING' && result.actionTarget
        ? recordings.find(r => r.id === result.actionTarget)?.id
        : undefined;

      const newAssistantMsg: Message = {
        id: makeId(),
        role: 'assistant',
        text: result.text || 'Прости, не смог обработать запрос.',
        recordingId: validRecordingId,
        actionDone,
      };

      setMessages(prev => [...prev, newAssistantMsg]);
    } catch (error) {
      console.warn('Chat error:', error);
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
        text: 'Произошла ошибка. Попробуй ещё раз.',
      }]);
    } finally {
      setIsProcessing(false);
    }
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

  const assistantName = profile?.name ?? 'VoiceMap AI';

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
              <h2 className="font-headline text-lg font-bold text-primary">{assistantName}</h2>
              <p className="text-xs text-on-surface-variant">Твой второй мозг</p>
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
                recordings={recordings}
                onOpenRecording={onOpenRecording}
                onClose={onClose}
              />
            ))}

            {isProcessing && (
              <div className="flex items-start">
                <div className="bg-surface-container p-4 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-on-surface-variant">Думаю...</span>
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
                  aria-label="Записать голосовое сообщение"
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
                    placeholder="Спроси что-нибудь..."
                    className="w-full bg-surface-container border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={!inputValue.trim() || isProcessing}
                    aria-label="Отправить сообщение"
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
