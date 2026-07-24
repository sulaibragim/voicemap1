import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Square, ArrowRight, Mic, Type } from 'lucide-react';
import { parseReminderTime } from '../../lib/api';
import { formatTime } from '../../lib/utils';
import { useQuickNoteRecording } from '../../hooks/useQuickNoteRecording';
import { QuickNoteDetailsStep } from './QuickNoteDetailsStep';
import type { Note, NoteType, Priority, RecurringPattern } from '../../types';
import { buildNote, defaultReminderTime } from '../../lib/noteBuilder';

interface QuickNoteModalProps {
  type: NoteType;
  onClose: () => void;
  onSave: (note: Note) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type Step = 'choice' | 'recording' | 'text_input' | 'processing' | 'details';

// Заголовок «Новая…» с правильным артиклем по роду типа заметки
const NEW_NOTE_TITLE: Record<NoteType, string> = {
  'Идея': 'Новая идея',
  'Задача': 'Новая задача',
  'Напоминание': 'Новое напоминание',
};

export const QuickNoteModal = ({ type, onClose, onSave, showToast }: QuickNoteModalProps) => {
  const newNoteTitle = NEW_NOTE_TITLE[type];
  const [step, setStep] = useState<Step>('choice');
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

  /** Ставит «завтра в 9 утра», когда AI не распознал срок из речи */
  const applyDefaultReminderTime = () => {
    const { date, time } = defaultReminderTime();
    setDueDate(date);
    setDueTime(time);
    setAiDetectedTime(false);
  };

  const saveNote = (content?: string) => {
    onSave(buildNote({
      type,
      content: content || transcribedText,
      dueDate,
      dueTime,
      priority,
      isRecurring,
      recurringPattern,
    }));
    onClose();
  };

  const { isRecording: _isRecording, duration, startRecording, stopRecording } = useQuickNoteRecording({
    noteType: type,
    showToast,
    onStarted: () => setStep('recording'),
    onProcessing: () => setStep('processing'),
    onTranscribed: async (text) => {
      setTranscribedText(text);
      if (type === 'Идея') {
        saveNote(text);
      } else if (type === 'Напоминание') {
        try {
          const parsed = await parseReminderTime(text);
          if (parsed.hasTime && parsed.date && parsed.time) {
            setDueDate(parsed.date);
            setDueTime(parsed.time);
            setTranscribedText(parsed.summary || text);
            setAiDetectedTime(true);
          } else {
            applyDefaultReminderTime();
          }
        } catch {
          // AI не разобрал срок — не бросаем пользователя без времени вовсе
          applyDefaultReminderTime();
        }
        setStep('details');
      } else {
        applyDefaultReminderTime();
        setStep('details');
      }
    },
    onError: (fallbackContent) => saveNote(fallbackContent),
    onMicrophoneError: () => setStep('text_input'),
  });

  const handleTextSubmit = async () => {
    const text = manualText.trim();
    if (!text) {
      showToast('Введи текст заметки', 'error');
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

  const needsDetails = type === 'Задача' || type === 'Напоминание';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-high border border-white/10 rounded-[32px] p-6 md:p-8 max-w-md w-full relative"
      >
        <button onClick={onClose} aria-label="Закрыть" className="absolute top-5 right-5 text-on-surface-variant hover:text-white transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {/* Step 0: Choice — voice or text */}
          {step === 'choice' && (
            <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">{newNoteTitle}</h3>
                <p className="text-on-surface-variant text-sm">Выбери способ ввода</p>
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
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">{newNoteTitle}</h3>
                <p className="text-on-surface-variant text-sm">Напиши свою мысль</p>
              </div>
              <textarea
                autoFocus
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={type === 'Напоминание' ? 'Например: позвонить маме завтра в 18:00' : 'Введи текст...'}
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

          {/* Step 1b: Recording */}
          {step === 'recording' && (
            <motion.div key="recording" exit={{ opacity: 0, y: -10 }}>
              <div className="text-center mb-6">
                <h3 className="font-headline text-xl md:text-2xl font-bold mb-2">{newNoteTitle}</h3>
                <p className="text-on-surface-variant text-sm">Скажи свою мысль</p>
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
                  Нажми для остановки{needsDetails ? '' : ' и сохранения'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-on-surface-variant text-sm animate-pulse">Обработка аудио AI...</p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Details (for tasks and reminders) */}
          {step === 'details' && (
            <QuickNoteDetailsStep
              type={type}
              transcribedText={transcribedText}
              aiDetectedTime={aiDetectedTime}
              dueDate={dueDate}
              dueTime={dueTime}
              priority={priority}
              recurringPattern={recurringPattern}
              setAiDetectedTime={setAiDetectedTime}
              setDueDate={setDueDate}
              setDueTime={setDueTime}
              setPriority={setPriority}
              setRecurringPattern={setRecurringPattern}
              setIsRecurring={setIsRecurring}
              onSave={saveNote}
              showDatePicker={showDatePicker}
              setShowDatePicker={setShowDatePicker}
              showTimePicker={showTimePicker}
              setShowTimePicker={setShowTimePicker}
              dateButtonRef={dateButtonRef}
              timeButtonRef={timeButtonRef}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
