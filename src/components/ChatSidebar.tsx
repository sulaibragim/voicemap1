import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mic, Loader2, FileAudio, Square } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import Markdown from 'react-markdown';
import { Recording } from '../App';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recordingId?: string;
  isAudio?: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  recordings: Recording[];
  onOpenRecording: (id: string) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onClose, recordings, onOpenRecording, currentView, setCurrentView }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: 'Привет! Чем могу помочь? Я могу найти нужную запись, идею или задачу.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (text: string, isAudio = false) => {
    if (!text.trim() && !isAudio) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      isAudio
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare context about recordings
      const recordingsContext = recordings.map(r => ({
        id: r.id,
        title: r.title,
        date: r.date,
        tags: r.tags,
        summary: r.summary,
        ideas: r.ideas,
        actionItems: r.actionItems
      }));

      const prompt = `
        You are a helpful AI assistant for a personal voice notepad app.
        The user has the following recordings:
        ${JSON.stringify(recordingsContext)}
        
        Current view of the app: ${currentView}
        Available views: dashboard, library, analytics, focus, gallery
        
        The user says: "${text}"
        
        Analyze the user's request. You can perform the following actions:
        - NAVIGATE: If the user wants to open a specific section of the app (e.g., "открой аналитику", "перейди в библиотеку").
        - OPEN_RECORDING: If the user is looking for a specific recording, idea, or task, find the best matching recording ID.
        - DIGEST: If the user asks for a digest, summary, or advice based on their recordings, provide a comprehensive markdown response in the "text" field.
        - NONE: Just a conversational reply.
        
        Respond in JSON format with these fields:
        1. "text": Your conversational reply in Russian. Be helpful, concise, and friendly. If it's a digest, use Markdown.
        2. "action": One of "NAVIGATE", "OPEN_RECORDING", "DIGEST", "NONE".
        3. "actionTarget": The view name if action is NAVIGATE, or the recording ID if action is OPEN_RECORDING. Otherwise null.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              action: { type: Type.STRING },
              actionTarget: { type: Type.STRING, nullable: true }
            },
            required: ['text', 'action']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      const newAssistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: result.text || 'Извините, я не смог обработать запрос.',
        recordingId: result.action === 'OPEN_RECORDING' ? result.actionTarget : undefined
      };

      setMessages(prev => [...prev, newAssistantMsg]);
      
      if (result.action === 'NAVIGATE' && result.actionTarget) {
        setCurrentView(result.actionTarget);
      }
    } catch (error) {
      console.error('Error processing chat:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Произошла ошибка при обращении к ИИ. Попробуйте еще раз.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        // Convert to base64
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
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const processVoiceMessage = async (base64Audio: string, mimeType: string) => {
    setIsProcessing(true);
    // Add a temporary user message
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', text: 'Голосовое сообщение...', isAudio: true }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Audio, mimeType: mimeType } },
            { text: 'Transcribe this voice message in Russian.' }
          ]
        }
      });

      const transcript = response.text || '';
      
      // Update the temporary message with transcript
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: transcript } : m));
      
      // Now handle it as a normal text message
      await handleSend(transcript, true);
    } catch (error) {
      console.error('Error processing voice message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-surface-bright border-l border-white/5 z-[301] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface-container-low">
              <div>
                <h2 className="font-headline text-xl font-bold text-primary">AI Ассистент</h2>
                <p className="text-xs text-on-surface-variant">Поиск и анализ ваших записей</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  
                  {msg.recordingId && (
                    <div 
                      onClick={() => {
                        onOpenRecording(msg.recordingId!);
                        onClose();
                      }}
                      className="mt-2 max-w-[85%] bg-surface-container-high border border-primary/30 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-surface-container-highest transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <FileAudio className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-primary">Открыть запись</p>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {recordings.find(r => r.id === msg.recordingId)?.title || 'Запись'}
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

            <div className="p-4 border-t border-white/5 bg-surface-container-low">
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
                    className="p-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-primary"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <div className="flex-1 relative">
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
                      placeholder="Спросите что-нибудь..."
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
        </>
      )}
    </AnimatePresence>
  );
};
