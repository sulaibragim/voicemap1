import { motion } from 'motion/react';
import type { Note } from '../../types';
import { getNoteReminderStatus } from '../../lib/mapUtils';

interface NoteTimelineViewProps {
  timelineNotes: Note[];
  onOpenNotes: () => void;
  onUpdateNote?: (note: Note) => void;
  onComplete: (note: Note) => void;
  onSnooze: (note: Note, hours: number) => void;
}

export const NoteTimelineView = ({
  timelineNotes,
  onOpenNotes,
  onUpdateNote,
  onComplete,
  onSnooze,
}: NoteTimelineViewProps) => {
  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-3">
      {timelineNotes.length === 0 ? (
        <p className="text-center text-on-surface-variant mt-20">Напоминаний нет</p>
      ) : timelineNotes.map((note, i) => {
        const status = getNoteReminderStatus(note);
        const isOverdue = status === 'overdue' && !note.isCompleted;
        const dueStr = note.dueDate && note.dueTime
          ? new Date(`${note.dueDate}T${note.dueTime}`).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : note.date;
        return (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex gap-4 items-start group cursor-pointer"
            onClick={onOpenNotes}
          >
            <div className="flex flex-col items-center pt-1.5 flex-shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  background: note.isCompleted ? '#4af8e3' : isOverdue ? '#FF5459' : '#FFB74D',
                  boxShadow: isOverdue && !note.isCompleted ? '0 0 8px #FF545960' : 'none',
                }}
              />
              {i < timelineNotes.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.06)', minHeight: 32 }} />
              )}
            </div>
            <div
              className="flex-1 rounded-2xl p-3.5 border transition-colors mb-2"
              style={{
                background: isOverdue ? 'rgba(255,84,89,0.07)' : note.isCompleted ? 'rgba(255,255,255,0.03)' : 'rgba(255,183,77,0.06)',
                borderColor: isOverdue ? 'rgba(255,84,89,0.25)' : note.isCompleted ? 'rgba(255,255,255,0.06)' : 'rgba(255,183,77,0.18)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className={`text-sm font-bold leading-snug ${note.isCompleted ? 'line-through opacity-40' : 'text-on-surface'}`}>
                  {note.content}
                </p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: isOverdue ? '#FF545920' : '#FFB74D15',
                    color: isOverdue ? '#FF5459' : '#FFB74D',
                  }}
                >
                  {isOverdue ? '⚠ Просрочено' : dueStr}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant/50">{dueStr}</p>
              {!note.isCompleted && onUpdateNote && (
                <div className="flex gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onComplete(note)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                    style={{ background: '#4af8e315', color: '#4af8e3', border: '1px solid #4af8e325' }}
                  >
                    ✓ Готово
                  </button>
                  <button
                    onClick={() => onSnooze(note, 1)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                    style={{ background: '#FFB74D15', color: '#FFB74D', border: '1px solid #FFB74D25' }}
                  >
                    ⏰ +1ч
                  </button>
                  <button
                    onClick={() => onSnooze(note, 24)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    +1 день
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
