import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Square, Calendar, Clock, Flag, ArrowRight, RefreshCw, Mic, Type } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import { transcribeAudio, parseReminderTime } from '../../lib/api';
import { formatTime } from '../../lib/utils';
import type { Note, NoteType, Priority, RecurringPattern } from '../../types';

interface QuickNoteModalProps {
  type: NoteType;
  onClose: () => void;
  onSave: (note: Note) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'choice' | 'recording' | 'text_input' | 'processing' | 'details';

const priorityConfig: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: 'Высокий', color: 'text-error', bg: 'bg-error/10 border-error/30' },
  { value: 'medium', label: 'Средний', color: 'text-warning', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { value: 'low', label: 'Низкий', color: 'text-tertiary', bg: 'bg-tertiary/10 border-tertiary/30' },
];

const recurringConfig: { value: RecurringPattern; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
];

export const QuickNoteModal = ({ type, onClose, onSave, showToast }: QuickNoteModalProps) => {
  const [step, setStep] = useState<Step>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [manualText, setManualText] = useState('');

  // Reminder fields
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>('none');
  const [aiDetectedTime, setAiDetectedTime] = useState(false);

  // Task fields
  const [priority, setPriority] = useState<Priority>('medium');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Cleanup на unmount — освобождаем микрофон, если пользователь закрыл модалку во время записи
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStep('recording');
    } catch (err) {
      console.warn("Error accessing microphone:", err);
      showToast("Не удалось получить доступ к микрофону. Введите текст вручную.", 'error');
      setStep('text_input');
    }
  };

  const handleTextSubmit = async () => {
    const text = manualText.trim();
    if (!text) {
      showToast("Введите текст заметки", 'error');
      return;
    }
    setTranscribedText(text);
    if (type === 'Идея') {
      saveNote(text);
      return;
    }
    if (type === 'Напоминание') {
      setStep('processing');
      try {
        const parsed = await parseReminderTime(text);
        if (parsed.hasTime && parsed.date && parsed.time) {
          setDueDate(parsed.date);
          setDueTime(parsed.time);
          setTranscribedText(parsed.summary || text);
          setAiDetectedTime(true);
        } else {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setDueDate(tomorrow.toISOString().split('T')[0]);
          setDueTime('09:00');
          setAiDetectedTime(false);
        }
      } catch {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDueDate(tomorrow.toISOString().split('T')[0]);
        setDueTime('09:00');
        setAiDetectedTime(false);
      }
      setStep('details');
    } else {
      // Задача — manual details
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
      setDueTime('09:00');
      setStep('details');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setStep('processing');
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const prompt = `Please transcribe this short audio note. It is a "${type}". Transcribe the audio EXACTLY in the language it was spoken. If the audio is empty, silent, or contains no speech, return strictly "[Тишина]". Do not invent or hallucinate speech. Return only the transcribed text.`;
      const text = await transcribeAudio(base64Audio, blob.type || 'audio/webm', prompt);
      setTranscribedText(text);

      // For simple types (Идея, Мысль) — save immediately
      if (type === 'Идея') {
        saveNote(text);
      } else if (type === 'Напоминание') {
        // AI parses date/time from the reminder text
        try {
          const parsed = await parseReminderTime(text);
          if (parsed.hasTime && parsed.date && parsed.time) {
            setDueDate(parsed.date);
            setDueTime(parsed.time);
            setTranscribedText(parsed.summary || text);
            setAiDetectedTime(true);
          } else {
            // No time detected — manual input
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setDueDate(tomorrow.toISOString().split('T')[0]);
            setDueTime('09:00');
            setAiDetectedTime(false);
          }
        } catch {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setDueDate(tomorrow.toISOString().split('T')[0]);
          setDueTime('09:00');
          setAiDetectedTime(false);
        }
        setStep('details');
      } else {
        // Задача — manual details
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDueDate(tomorrow.toISOString().split('T')[0]);
        setDueTime('09:00');
        setStep('details');
      }
    } catch (err) {
      console.warn("Error processing audio note:", err);
      showToast("Ошибка ИИ. Заметка сохранена как аудио.", 'error');
      saveNote("[Аудиозапись не распознана из-за ошибки сети или квоты]");
    }
  };

  const saveNote = (content?: string) => {
    const noteContent = content || transcribedText;
    const newNote: Note = {
      id: Date.now().toString(),
      type,
      content: noteContent,
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      ...(type === 'Задача' && {
        priority,
        isCompleted: false,
        kanbanStatus: 'new' as const,
        ...(dueDate && { dueDate }),
        ...(dueTime && { dueTime }),
      }),
      ...(type === 'Напоминание' && {
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        isRecurring,
        recurringPattern: isRecurring ? recurringPattern : 'none' as const,
        notifiedOneHour: false,
        notifiedFiveMin: false,
      }),
    };
    onSave(newNote);
    onClose();
  };

  const needsDetails = type === 'Задача' || type === 'Напоминание';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-high border border-white/10 rounded-[32px] p-6 md:p-8 max-w-md w-full relative"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-on-surface-variant hover:text-white transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {/* Step 0: Choice — voice or text */}
          {step === 'choice' && (
            <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">Новая {type.toLowerCase()}</h3>
                <p className="text-on-surface-variant text-sm">Выберите способ ввода</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={startRecording}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-5 h-5 text-primary" fill="currentColor" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-on-surface">Записать голосом</p>
                    <p className="text-xs text-on-surface-variant">Нужен микрофон</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                </button>
                <button
                  onClick={() => setStep('text_input')}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl bg-surface-container border border-white/10 hover:border-white/20 transition-colors cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                    <Type className="w-5 h-5 text-on-surface-variant" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-on-surface">Ввести текстом</p>
                    <p className="text-xs text-on-surface-variant">Без микрофона</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1a: Text input */}
          {step === 'text_input' && (
            <motion.div key="text_input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-5">
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">Новая {type.toLowerCase()}</h3>
                <p className="text-on-surface-variant text-sm">Напишите вашу мысль</p>
              </div>
              <textarea
                autoFocus
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={type === 'Напоминание' ? 'Например: позвонить маме завтра в 18:00' : 'Введите текст...'}
                rows={4}
                className="w-full bg-surface-container border border-white/10 rounded-2xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setManualText(''); setStep('choice'); }}
                  className="flex-1 py-3.5 bg-surface-container border border-white/10 text-on-surface-variant rounded-xl font-bold text-sm hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                >
                  Назад
                </button>
                <button
                  onClick={handleTextSubmit}
                  disabled={!manualText.trim()}
                  className="flex-1 py-3.5 bg-primary text-on-primary-fixed rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Далее <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Recording */}
          {step === 'recording' && (
            <motion.div key="recording" exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">Новая {type.toLowerCase()}</h3>
                <p className="text-on-surface-variant text-sm">Скажите вашу мысль</p>
              </div>
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="text-4xl font-mono font-light text-primary">
                  {formatTime(duration)}
                </div>
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-surface-container-highest border border-white/10 text-error flex items-center justify-center hover:scale-105 transition-transform cursor-pointer relative"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute w-full h-full rounded-full bg-error/20"
                  />
                  <Square className="w-8 h-8" fill="currentColor" />
                </button>
                <p className="text-xs text-on-surface-variant">
                  Нажмите для остановки{needsDetails ? '' : ' и сохранения'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-on-surface-variant text-sm animate-pulse">Обработка аудио ИИ...</p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Details (for tasks and reminders) */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-5">
                <h3 className="font-headline text-xl font-bold mb-1">
                  {type === 'Напоминание'
                    ? (aiDetectedTime ? 'Подтвердите напоминание' : 'Когда напомнить?')
                    : 'Детали задачи'}
                </h3>
                <p className="text-on-surface-variant text-sm line-clamp-2">«{transcribedText}»</p>
              </div>

              <div className="space-y-4">
                {/* AI-detected time confirmation for reminders */}
                {type === 'Напоминание' && aiDetectedTime && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Дата</p>
                        <p className="text-lg font-bold text-on-surface">
                          {new Date(dueDate + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Время</p>
                        <p className="text-lg font-bold text-on-surface">{dueTime}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAiDetectedTime(false)}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Изменить вручную
                    </button>
                  </div>
                )}

                {/* Manual date picker (for tasks, or reminders without AI detection) */}
                {!(type === 'Напоминание' && aiDetectedTime) && (
                  <>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <Calendar className="w-4 h-4" /> Дата
                      </label>
                      <button
                        ref={dateButtonRef}
                        type="button"
                        onClick={() => setShowDatePicker(true)}
                        className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-sm text-left hover:border-primary/50 focus:outline-none transition-colors cursor-pointer"
                      >
                        {dueDate
                          ? new Date(dueDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                          : <span className="text-on-surface-variant">Выбрать дату</span>}
                      </button>
                      <AnimatePresence>
                        {showDatePicker && (
                          <DatePicker
                            value={dueDate}
                            anchorRef={dateButtonRef}
                            onChange={(d) => { setDueDate(d); setShowDatePicker(false); }}
                            onClose={() => setShowDatePicker(false)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <Clock className="w-4 h-4" /> Время
                      </label>
                      <button
                        ref={timeButtonRef}
                        type="button"
                        onClick={() => setShowTimePicker(true)}
                        className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-sm text-left hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        {dueTime ? <span className="text-on-surface font-bold">{dueTime}</span> : <span className="text-on-surface-variant">Выбрать время</span>}
                      </button>
                      <AnimatePresence>
                        {showTimePicker && (
                          <TimePicker
                            value={dueTime}
                            anchorRef={timeButtonRef}
                            onChange={(t) => { setDueTime(t); setShowTimePicker(false); }}
                            onClose={() => setShowTimePicker(false)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {/* Priority (tasks only) */}
                {type === 'Задача' && (
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      <Flag className="w-4 h-4" /> Приоритет
                    </label>
                    <div className="flex gap-2">
                      {priorityConfig.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPriority(p.value)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                            priority === p.value
                              ? `${p.bg} ${p.color}`
                              : 'bg-surface-container border-white/5 text-on-surface-variant hover:border-white/20'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recurring (reminders only) */}
                {type === 'Напоминание' && (
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                      <RefreshCw className="w-4 h-4" /> Повторение
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {recurringConfig.map(r => (
                        <button
                          key={r.value}
                          onClick={() => {
                            setRecurringPattern(r.value);
                            setIsRecurring(r.value !== 'none');
                          }}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                            recurringPattern === r.value
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-surface-container border-white/5 text-on-surface-variant hover:border-white/20'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notification info for reminders */}
                {type === 'Напоминание' && dueDate && dueTime && (
                  <div className="bg-surface-container rounded-xl p-3 border border-white/5">
                    <p className="text-xs text-on-surface-variant">
                      Уведомления придут за <span className="text-primary font-bold">1 час</span> и за <span className="text-primary font-bold">5 минут</span> до времени
                    </p>
                  </div>
                )}
              </div>

              {/* Save button */}
              <button
                onClick={() => saveNote()}
                className="w-full mt-6 py-3.5 bg-primary text-on-primary-fixed rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform cursor-pointer flex items-center justify-center gap-2"
              >
                {type === 'Напоминание' && aiDetectedTime ? 'Поставить напоминание' : 'Сохранить'} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
