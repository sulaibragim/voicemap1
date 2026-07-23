import type * as React from 'react';
import { motion } from 'motion/react';
import { Bell, Clock, Check, AlarmClock, Pin, PinOff, Trash2 } from 'lucide-react';
import type { Note } from '../../types';
import { typeConfig, priorityConfig, priorityLabels, getReminderStatus } from '../../lib/noteUtils';

interface NoteCardProps {
  note: Note;
  onSelect: (note: Note) => void;
  onToggleComplete: (note: Note) => void;
  onTogglePin: (note: Note, e?: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onSnooze: (note: Note, hours: number, e?: React.MouseEvent) => void;
}

export const NoteCard = ({ note, onSelect, onToggleComplete, onTogglePin, onDelete, onSnooze }: NoteCardProps) => {
  const config = typeConfig[note.type];
  const Icon = config.icon;
  const reminder = note.type === 'Напоминание' ? getReminderStatus(note) : null;
  const isOverdue = reminder?.overdue;

  return (
    <motion.div
      key={note.id}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect(note)}
      className={`relative bg-surface-container-high rounded-2xl overflow-hidden cursor-pointer group border transition-colors ${
        isOverdue
          ? 'border-error/40 shadow-[0_0_12px_rgba(var(--color-error-rgb,239,68,68),0.15)]'
          : note.isPinned
          ? 'border-primary/25 hover:border-primary/40'
          : 'border-white/5 hover:border-white/12'
      } ${note.isCompleted ? 'opacity-50' : ''}`}
    >
      {/* Цветная полоска слева */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${config.stripe} ${isOverdue ? 'animate-pulse' : ''}`} />

      {/* Pin indicator */}
      {note.isPinned && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
          <Pin className="w-2.5 h-2.5 text-primary" />
        </div>
      )}

      <div className="pl-5 pr-4 py-4">
        {/* Тип + действия */}
        <div className="flex items-center justify-between mb-2.5">
          <div className={`flex items-center gap-1.5 ${config.color}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{note.type}</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
            {/* Snooze на карточке напоминания */}
            {note.type === 'Напоминание' && !note.isCompleted && (
              <button
                onClick={(e) => onSnooze(note, 1, e)}
                className="p-1.5 rounded-lg hover:bg-yellow-500/15 hover:text-yellow-400 text-on-surface-variant transition-all cursor-pointer"
                title="Отложить на 1 час"
                aria-label="Отложить на 1 час"
              >
                <AlarmClock className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Быстрое выполнение задачи */}
            {note.type === 'Задача' && !note.isCompleted && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleComplete(note); }}
                className="p-1.5 rounded-lg hover:bg-secondary/15 hover:text-secondary text-on-surface-variant transition-all cursor-pointer"
                title="Отметить выполненной"
                aria-label="Отметить выполненной"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Pin */}
            <button
              onClick={(e) => onTogglePin(note, e)}
              className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-all cursor-pointer"
              title={note.isPinned ? 'Открепить' : 'Закрепить'}
              aria-label={note.isPinned ? 'Открепить' : 'Закрепить'}
            >
              {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            {/* Удалить */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
              className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-all cursor-pointer"
              aria-label="Удалить заметку"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Контент */}
        <p className={`text-sm leading-relaxed line-clamp-3 ${note.isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
          {note.content}
        </p>

        {/* Приоритет (задача) */}
        {note.type === 'Задача' && note.priority && (
          <div className="mt-2.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityConfig[note.priority].bg} ${priorityConfig[note.priority].text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[note.priority].dot}`} />
              {priorityLabels[note.priority]}
            </span>
          </div>
        )}

        {/* Футер */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-on-surface-variant/60 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {note.date}
          </span>
          {reminder && (
            <span className={`ml-auto text-[10px] font-bold flex items-center gap-1 ${reminder.urgent ? 'text-error' : 'text-on-surface-variant'} ${isOverdue ? 'animate-pulse' : ''}`}>
              <Bell className="w-3 h-3" />
              {reminder.text}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
