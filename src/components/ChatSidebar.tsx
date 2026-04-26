import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Mic, Loader2, FileAudio, Square, CheckCircle2, StickyNote, Target } from 'lucide-react';
import { chatWithAI, transcribeChatVoice } from '../lib/api';
import { buildAssistantPrompt, ASSISTANT_WELCOME, type AssistantProfile } from '../lib/assistantPrompt';
import Markdown from 'react-markdown';
import type { Recording, Note, Space } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recordingId?: string;
  isAudio?: boolean;
  actionDone?: 'focus' | 'note' | 'ideas';
}

interface AssistantAction {
  text: string;
  action: 'NAVIGATE' | 'OPEN_RECORDING' | 'SET_FOCUS_TASKS' | 'CREATE_NOTE' | 'UPDATE_IDEAS' | 'NONE';
  actionTarget: string | null;
  actionData: Record<string, unknown> | null;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  recordings: Recording[];
  notes?: Note[];
  spaces?: Space[];
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
  { label: 'Настроение', prompt: 'Какое у меня было настроение в последних записях?' },
];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen, onClose, recordings, notes, spaces, profile,
  onOpenRecording, currentView, setCurrentView,
  onSetFocusTasks, onCreateNote, onUpdateRecording, onLearnRule,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: ASSISTANT_WELCOME }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
    };
  }, []);

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
        spaces,
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
        // content может прийти как null/undefined — fallback на сообщение пользователя
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
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant',
        text: result.text || 'Извините, не смог обработать запрос.',
        recordingId: validRecordingId,
        actionDone,
      };

      setMessages(prev => [...prev, newAssistantMsg]);
    } catch (error) {
      console.warn('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Произошла ошибка. Попробуй ещё раз.',
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await processVoiceMessage(base64Audio, mimeType);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processVoiceMessage = async (base64Audio: string, mimeType: string) => {
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
    } catch (error) {
      console.warn('Voice error:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="overflow-y-auto p-4 space-y-4 min-h-0 flex-1">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
