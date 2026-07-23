import { useState, useRef, useEffect, useCallback } from 'react';
import type * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';

interface Reminder {
  date: string;
  time: string;
  notified?: boolean;
}

interface TaskReminderButtonProps {
  taskIndex: number;
  reminder?: Reminder;
  onSave: (taskIndex: number, date: string, time: string) => void;
}

export const TaskReminderButton = ({ taskIndex, reminder, onSave }: TaskReminderButtonProps) => {
  const [open, setOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);

  // Pre-fill + position popup on open
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDate(reminder?.date ?? '');
      setTime(reminder?.time ?? '');
      if (bellButtonRef.current) {
        const rect = bellButtonRef.current.getBoundingClientRect();
        const popupH = 180;
        const top = rect.top - popupH - 8 > 0 ? rect.top - popupH - 8 : rect.bottom + 8;
        setPopupStyle({
          position: 'fixed',
          top,
          right: window.innerWidth - rect.right,
          zIndex: 9999,
        });
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, reminder]);

  const closeAll = useCallback(() => { setOpen(false); setShowDatePicker(false); }, []);

  // Close popup on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popupRef.current && !popupRef.current.contains(target) && !bellButtonRef.current?.contains(target)) {
        closeAll();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeAll]);

  const handleSave = () => {
    if (!date || !time) return;
    onSave(taskIndex, date, time);
    setOpen(false);
  };

  const hasReminder = !!reminder;
  const reminderLabel = hasReminder
    ? `Напоминание: ${reminder!.date} в ${reminder!.time}`
    : 'Установить напоминание';

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        title={reminderLabel}
        className={`p-1 transition-colors cursor-pointer ${
          hasReminder
            ? 'text-yellow-400 hover:text-yellow-300'
            : 'text-on-surface-variant hover:text-yellow-400 opacity-100 md:opacity-0 md:group-hover:opacity-100'
        }`}
      >
        <Bell
          className="w-3.5 h-3.5"
          fill={hasReminder ? 'currentColor' : 'none'}
        />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          ref={popupRef}
          style={popupStyle}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-surface-container-high border border-white/10 rounded-xl p-3 shadow-2xl w-56"
        >
          <p className="text-xs font-bold text-on-surface mb-2">Напоминание</p>
          <button
            ref={dateButtonRef}
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="w-full bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-xs text-left outline-none hover:border-primary/50 transition-colors mb-2 cursor-pointer"
          >
            {date ? new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : <span className="text-on-surface-variant">Выбрать дату</span>}
          </button>
          <AnimatePresence>
            {showDatePicker && (
              <DatePicker
                value={date}
                anchorRef={dateButtonRef}
                onChange={(d) => { setDate(d); setShowDatePicker(false); }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </AnimatePresence>
          <button
            ref={timeButtonRef}
            type="button"
            onClick={() => setShowTimePicker(true)}
            className="w-full bg-surface-container border border-white/10 rounded-lg px-2 py-1.5 text-xs text-left hover:border-primary/50 transition-colors mb-3 cursor-pointer"
          >
            {time ? <span className="text-on-surface font-bold">{time}</span> : <span className="text-on-surface-variant">Выбрать время</span>}
          </button>
          <AnimatePresence>
            {showTimePicker && (
              <TimePicker
                value={time}
                anchorRef={timeButtonRef}
                onChange={(t) => { setTime(t); setShowTimePicker(false); }}
                onClose={() => setShowTimePicker(false)}
              />
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!date || !time}
              className="flex-1 py-1.5 bg-primary text-on-primary-fixed rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              Сохранить
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 bg-surface-container rounded-lg text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
