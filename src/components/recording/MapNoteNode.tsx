import { motion } from 'motion/react';
import { Lightbulb, CheckSquare, Bell, Check, AlarmClock } from 'lucide-react';
import type { Note, NoteType } from '../../types';

interface MapNoteNodeProps {
  note: Note;
  x: number;
  y: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  delay?: number;
  dimmed?: boolean;
  onComplete?: (note: Note) => void;
  onSnooze?: (note: Note, hours: number) => void;
}

const TYPE_CONFIG: Record<NoteType, { color: string; bg: string; icon: typeof Lightbulb; label: string }> = {
  'Идея':        { color: '#7B61FF', bg: '#7B61FF18', icon: Lightbulb,   label: 'Идея' },
  'Задача':      { color: '#4FC3F7', bg: '#4FC3F718', icon: CheckSquare, label: 'Задача' },
  'Напоминание': { color: '#FFB74D', bg: '#FFB74D18', icon: Bell,        label: 'Напоминание' },
};

const CARD_W = 160;

function getReminderStatus(note: Note) {
  if (!note.dueDate || !note.dueTime) return null;
  const due = new Date(`${note.dueDate}T${note.dueTime}`);
  const diff = due.getTime() - Date.now();
  if (diff < 0) return { text: 'Просрочено', overdue: true };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return { text: `через ${Math.floor(hours / 24)} дн.`, overdue: false };
  if (hours > 0) return { text: `через ${hours}ч ${mins}м`, overdue: false };
  return { text: `через ${mins} мин.`, overdue: true };
}

export const MapNoteNode = ({
  note,
  x,
  y,
  isHovered,
  onHover,
  onClick,
  delay = 0,
  dimmed = false,
  onComplete,
  onSnooze,
}: MapNoteNodeProps) => {
  const cfg = TYPE_CONFIG[note.type] ?? TYPE_CONFIG['Идея'];
  const Icon = cfg.icon;

  const topic = note.content.split(/[.!?]/)[0]?.trim().slice(0, 55) ?? note.content.slice(0, 55);
  const preview = note.content.slice(0, 90);
  const reminder = note.type === 'Напоминание' ? getReminderStatus(note) : null;
  const isOverdue = reminder?.overdue && !note.isCompleted;

  return (
    <motion.div
      className="absolute"
      style={{
        left: x - CARD_W / 2,
        top: y - 40,
        width: CARD_W,
        zIndex: isHovered ? 50 : 10,
      }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: dimmed ? 0.25 : 1, scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 120, delay }}
      onMouseEnter={() => onHover(note.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(note.id)}
    >
      <motion.div
        animate={{ scale: isHovered ? 1.1 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        className="cursor-pointer"
      >
        <div
          className="rounded-2xl border p-3 transition-colors duration-200 overflow-hidden"
          style={{
            background: isHovered ? cfg.bg : 'rgba(28,28,33,0.75)',
            borderColor: isOverdue ? '#FF545970' : isHovered ? `${cfg.color}70` : 'rgba(255,255,255,0.08)',
            boxShadow: isOverdue
              ? `0 0 18px #FF545930`
              : isHovered ? `0 0 28px ${cfg.color}28` : 'none',
          }}
        >
          {/* Top row: type icon + label + completed mark */}
          <div className="flex items-center gap-1.5 mb-2">
            <motion.div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: isHovered ? cfg.color : `${cfg.color}30` }}
              animate={isOverdue ? { opacity: [1, 0.4, 1] } : undefined}
              transition={isOverdue ? { duration: 1.5, repeat: Infinity } : undefined}
            >
              <Icon className="w-2.5 h-2.5" style={{ color: isHovered ? '#fff' : cfg.color }} />
            </motion.div>
            <span className="text-[9px] font-bold tracking-widest uppercase flex-1" style={{ color: isOverdue ? '#FF5459' : cfg.color }}>
              {isOverdue ? 'Просрочено' : cfg.label}
            </span>
            {note.isCompleted && (
              <span className="text-[8px] text-on-surface-variant opacity-60">✓</span>
            )}
          </div>

          {/* Topic */}
          <p className="text-[11px] font-bold text-on-surface leading-snug line-clamp-2 mb-1">
            {topic}{topic.length < note.content.length ? '…' : ''}
          </p>

          {/* Expanded on hover */}
          <motion.div
            initial={false}
            animate={{ height: isHovered ? 'auto' : 0, opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="text-[9px] text-on-surface-variant leading-relaxed mt-1 mb-2 line-clamp-3">
              {preview}{preview.length < note.content.length ? '…' : ''}
            </p>

            <p className="text-[8px] text-on-surface-variant opacity-50 mb-2">{note.date}</p>

            {note.type === 'Задача' && note.priority && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded font-bold mb-2 inline-block"
                style={{
                  background: note.priority === 'high' ? '#FF545918' : note.priority === 'medium' ? '#FFB74D18' : '#81C78418',
                  color: note.priority === 'high' ? '#FF5459' : note.priority === 'medium' ? '#FFB74D' : '#81C784',
                }}
              >
                {note.priority === 'high' ? '↑ Высокий' : note.priority === 'medium' ? '→ Средний' : '↓ Низкий'}
              </span>
            )}

            {reminder && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded font-bold mb-2 inline-block"
                style={{
                  background: reminder.overdue ? '#FF545918' : '#FFB74D18',
                  color: reminder.overdue ? '#FF5459' : '#FFB74D',
                }}
              >
                🔔 {reminder.text}
              </span>
            )}

            {/* Quick actions */}
            {(onComplete || onSnooze) && !note.isCompleted && (
              <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                {onComplete && (note.type === 'Задача' || note.type === 'Напоминание') && (
                  <button
                    onClick={() => onComplete(note)}
                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all"
                    style={{ background: '#4FC3F718', color: '#4FC3F7', border: '1px solid #4FC3F730' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#4FC3F730')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#4FC3F718')}
                  >
                    <Check className="w-2.5 h-2.5" />
                    Готово
                  </button>
                )}
                {onSnooze && note.type === 'Напоминание' && (
                  <button
                    onClick={() => onSnooze(note, 1)}
                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all"
                    style={{ background: '#FFB74D18', color: '#FFB74D', border: '1px solid #FFB74D30' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FFB74D30')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FFB74D18')}
                  >
                    <AlarmClock className="w-2.5 h-2.5" />
                    +1ч
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
