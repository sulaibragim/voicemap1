import type * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Flag, RefreshCw, ArrowRight } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import type { NoteType, Priority, RecurringPattern } from '../../types';

// Приоритет: high = error, medium = warning, low = on-surface-variant (см. index.css)
const priorityConfig: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'high', label: 'Высокий', color: 'text-error', bg: 'bg-error/10 border-error/30' },
  { value: 'medium', label: 'Средний', color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
  { value: 'low', label: 'Низкий', color: 'text-on-surface-variant', bg: 'bg-on-surface-variant/10 border-on-surface-variant/30' },
];

const recurringConfig: { value: RecurringPattern; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
];

interface QuickNoteDetailsStepProps {
  type: NoteType;
  transcribedText: string;
  aiDetectedTime: boolean;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  recurringPattern: RecurringPattern;
  setAiDetectedTime: (v: boolean) => void;
  setDueDate: (v: string) => void;
  setDueTime: (v: string) => void;
  setPriority: (v: Priority) => void;
  setRecurringPattern: (v: RecurringPattern) => void;
  setIsRecurring: (v: boolean) => void;
  onSave: () => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (v: boolean) => void;
  dateButtonRef: React.RefObject<HTMLButtonElement | null>;
  timeButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export const QuickNoteDetailsStep = ({
  type,
  transcribedText,
  aiDetectedTime,
  dueDate,
  dueTime,
  priority,
  recurringPattern,
  setAiDetectedTime,
  setDueDate,
  setDueTime,
  setPriority,
  setRecurringPattern,
  setIsRecurring,
  onSave,
  showDatePicker,
  setShowDatePicker,
  showTimePicker,
  setShowTimePicker,
  dateButtonRef,
  timeButtonRef,
}: QuickNoteDetailsStepProps) => {
  return (
    <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5">
        <h3 className="font-headline text-xl font-bold mb-1">
          {type === 'Напоминание'
            ? (aiDetectedTime ? 'Подтверди напоминание' : 'Когда напомнить?')
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
        onClick={onSave}
        className="w-full mt-6 py-3.5 bg-primary text-on-primary-fixed rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform cursor-pointer flex items-center justify-center gap-2"
      >
        {type === 'Напоминание' && aiDetectedTime ? 'Поставить напоминание' : 'Сохранить'} <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
