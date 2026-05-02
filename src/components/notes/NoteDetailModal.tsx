import { useState, useRef, useEffect } from 'react';
import type * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, Trash2, Flag, Calendar, Check,
  AlarmClock, X, Pin, PinOff, Edit3, Save, Pencil, Bell,
} from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import type { Note } from '../../types';
import { typeConfig, priorityConfig, priorityLabels, getReminderStatus } from '../../lib/noteUtils';

interface NoteDetailModalProps {
  note: Note | null;
  onClose: () => void;
  onUpdate: (note: Note) => void;
  onToggleComplete: (note: Note) => void;
  onTogglePin: (note: Note, e?: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onSnooze: (note: Note, hours: number) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Сегодня';
  if (d.getTime() === tomorrow.getTime()) return 'Завтра';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const NoteDetailModal = ({
  note: initialNote,
  onClose,
  onUpdate,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onSnooze,
  showToast,
}: NoteDetailModalProps) => {
  // Локальная копия заметки для немедленного отражения обновлений (дата/время)
  const [note, setNote] = useState<Note | null>(initialNote);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editingDT, setEditingDT] = useState<'date' | 'time' | null>(null);
  const dateEditRef = useRef<HTMLButtonElement | null>(null);
  const timeEditRef = useRef<HTMLButtonElement | null>(null);

  // Синхронизация при смене заметки — intentional setState in effect для сброса локального стейта
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setNote(initialNote);
    setIsEditing(false);
    setEditContent('');
    setEditingDT(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // initialNote.id — намеренно только id как триггер, не весь объект (избегаем лишних сбросов)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNote?.id]);

  if (!note) return null;

  const config = typeConfig[note.type];
  const Icon = config.icon;
  const reminder = note.type === 'Напоминание' ? getReminderStatus(note) : null;

  const saveEdit = () => {
    if (!editContent.trim()) return;
    const updated = { ...note, content: editContent.trim() };
    onUpdate(updated);
    setNote(updated);
    setIsEditing(false);
    showToast('Заметка обновлена', 'success');
  };

  const handleDueDateChange = (newDate: string) => {
    const updated = { ...note, dueDate: newDate };
    onUpdate(updated);
    setNote(updated);
    setEditingDT(null);
    showToast('Дата изменена', 'success');
  };

  const handleDueTimeChange = (newTime: string) => {
    const updated = { ...note, dueTime: newTime };
    onUpdate(updated);
    setNote(updated);
    setEditingDT(null);
    showToast('Время изменено', 'success');
  };

  return (
    <AnimatePresence>
      <>
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        />

        <motion.div
          key="sheet"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="fixed z-50 left-0 right-0 bottom-0 md:left-1/2 md:top-1/2 md:right-auto md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] bg-surface-container-high rounded-t-3xl md:rounded-3xl overflow-hidden"
          style={{ maxHeight: '85vh' }}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className={`h-[3px] w-full ${config.stripe} hidden md:block`} />

          {/* Шапка */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
            <div className={`flex items-center gap-2.5 ${config.color}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.bg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">{note.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => onTogglePin(note, e)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${note.isPinned ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-white/8'}`}
                title={note.isPinned ? 'Открепить' : 'Закрепить'}
              >
                {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              {!isEditing && (
                <button
                  onClick={() => { setIsEditing(true); setEditContent(note.content); }}
                  className="p-2 rounded-xl hover:bg-white/8 text-on-surface-variant transition-colors cursor-pointer"
                  title="Редактировать"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/8 text-on-surface-variant transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Контент */}
          <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            {isEditing ? (
              <div className="mb-6">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  autoFocus
                  rows={5}
                  className="w-full bg-surface-container border border-white/10 rounded-2xl px-4 py-3 text-base text-on-surface leading-relaxed resize-none outline-none focus:border-primary/40 transition-colors"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/8 transition-all cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-base leading-relaxed text-on-surface mb-6">{note.content}</p>
            )}

            {/* Детали */}
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{note.date}</span>
              </div>

              {note.priority && (
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${priorityConfig[note.priority].bg} ${priorityConfig[note.priority].text}`}>
                  <Flag className="w-3.5 h-3.5" />
                  {priorityLabels[note.priority]} приоритет
                </div>
              )}

              {note.type === 'Напоминание' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-surface-container border border-white/8">
                  <Calendar className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />
                  <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    <button
                      ref={dateEditRef}
                      onClick={() => setEditingDT('date')}
                      className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        note.dueDate
                          ? 'bg-primary/10 border-primary/30 text-primary hover:border-primary/60'
                          : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20'
                      }`}
                    >
                      {note.dueDate ? formatDueDate(note.dueDate) : 'Добавить дату'}
                    </button>
                    <button
                      ref={timeEditRef}
                      onClick={() => setEditingDT('time')}
                      className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        note.dueTime
                          ? 'bg-primary/10 border-primary/30 text-primary hover:border-primary/60'
                          : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20'
                      }`}
                    >
                      {note.dueTime ?? '09:00'}
                    </button>
                    <span className="text-[10px] text-on-surface-variant/50 ml-auto flex items-center gap-1">
                      <Pencil className="w-2.5 h-2.5" /> нажмите чтобы изменить
                    </span>
                  </div>
                </div>
              )}

              {reminder && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${reminder.urgent ? 'bg-error/15 text-error' : 'bg-surface-container text-on-surface-variant'}`}>
                  <Bell className="w-4 h-4 flex-shrink-0" />
                  {reminder.text}
                </div>
              )}
            </div>

            {/* Действия */}
            <div className="flex gap-2.5 flex-wrap">
              {note.type === 'Задача' && (
                <button
                  onClick={() => { onToggleComplete(note); onClose(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    note.isCompleted
                      ? 'bg-surface-container text-on-surface-variant hover:bg-white/8'
                      : 'bg-secondary/15 text-secondary hover:bg-secondary/25'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {note.isCompleted ? 'Отменить' : 'Выполнено'}
                </button>
              )}

              {note.type === 'Напоминание' && !note.isCompleted && (
                <>
                  <button
                    onClick={() => { onToggleComplete(note); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-secondary/15 text-secondary hover:bg-secondary/25 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Выполнено
                  </button>
                  <button
                    onClick={() => { onSnooze(note, 1); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <AlarmClock className="w-4 h-4" />
                    +1 час
                  </button>
                  <button
                    onClick={() => { onSnooze(note, 24); onClose(); }}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/10 transition-all cursor-pointer"
                  >
                    +1 день
                  </button>
                </>
              )}

              <button
                onClick={() => { onDelete(note.id); onClose(); }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-error/10 text-error hover:bg-error/20 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* DatePicker — anchorRef.current проверяется при рендере чтобы не показывать без якоря */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {editingDT === 'date' && dateEditRef.current && (
          <DatePicker
            value={note.dueDate ?? new Date().toISOString().slice(0, 10)}
            onChange={handleDueDateChange}
            onClose={() => setEditingDT(null)}
            anchorRef={dateEditRef as React.RefObject<HTMLElement | null>}
          />
        )}
        {/* TimePicker */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {editingDT === 'time' && timeEditRef.current && (
          <TimePicker
            value={note.dueTime ?? '09:00'}
            onChange={handleDueTimeChange}
            onClose={() => setEditingDT(null)}
            anchorRef={timeEditRef as React.RefObject<HTMLElement | null>}
          />
        )}
      </>
    </AnimatePresence>
  );
};
