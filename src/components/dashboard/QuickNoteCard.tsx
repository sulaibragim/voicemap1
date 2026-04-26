import { motion } from 'motion/react';
import { Lightbulb, Check, Bell, ChevronRight } from 'lucide-react';
import type { NoteType } from '../../types';

interface QuickNoteCardProps {
  onQuickNote: (type: NoteType) => void;
}

const NOTE_TYPES = [
  {
    type: 'Идея' as NoteType,
    icon: Lightbulb,
    label: 'Идея',
    desc: 'Творческая мысль или инсайт',
    accent: '#7B61FF',
    bg: 'rgba(123,97,255,0.12)',
  },
  {
    type: 'Задача' as NoteType,
    icon: Check,
    label: 'Задача',
    desc: 'Что нужно сделать',
    accent: '#4FC3F7',
    bg: 'rgba(79,195,247,0.12)',
  },
  {
    type: 'Напоминание' as NoteType,
    icon: Bell,
    label: 'Напоминание',
    desc: 'Напомнит в нужное время',
    accent: '#FFB74D',
    bg: 'rgba(255,183,77,0.12)',
  },
];

export const QuickNoteCard = ({ onQuickNote }: QuickNoteCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className="col-span-12 md:col-span-6 lg:col-span-6 rounded-3xl overflow-hidden border border-white/[0.06] flex flex-col justify-center min-h-[160px] lg:min-h-0"
    style={{ background: 'rgba(22,22,28,0.95)' }}
  >
    {NOTE_TYPES.map((item, i) => (
      <motion.button
        key={item.type}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.12 + i * 0.07 }}
        onClick={() => onQuickNote(item.type)}
        className="flex items-center gap-3 px-4 py-3 md:px-5 md:py-3.5 transition-colors cursor-pointer group relative text-left w-full"
        style={{
          borderBottom: i < NOTE_TYPES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
        }}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      >
        {/* Hover accent line */}
        <motion.div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
          style={{ background: item.accent }}
          initial={{ opacity: 0, scaleY: 0 }}
          whileHover={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.15 }}
        />

        {/* Icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: item.bg }}>
          <item.icon className="w-4 h-4" style={{ color: item.accent }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface leading-none mb-0.5">{item.label}</p>
          <p className="text-[10px] text-on-surface-variant/50 leading-none truncate">{item.desc}</p>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/25 group-hover:text-on-surface-variant/60 transition-colors flex-shrink-0" />
      </motion.button>
    ))}
  </motion.div>
);
