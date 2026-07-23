import { motion } from 'motion/react';
import { Lightbulb, Check, Bell, ChevronRight } from 'lucide-react';
import type { NoteType } from '../../types';
import { NOTE_HEX } from '../../lib/noteTheme';
import { noteTypeLabelKey, noteTypeDescriptionKey } from '../../lib/noteTypeLabel';
import { useT } from '../../i18n';

interface QuickNoteCardProps {
  onQuickNote: (type: NoteType) => void;
}

// Цвета берутся из единого источника NOTE_HEX (src/lib/noteTheme.ts).
// type — это идентификатор в Firestore, он остаётся русским; подпись переводится.
const NOTE_TYPES = [
  { type: 'Идея' as NoteType,        icon: Lightbulb, accent: NOTE_HEX['Идея'],        bg: `${NOTE_HEX['Идея']}1F` }, // ~12% альфа
  { type: 'Задача' as NoteType,      icon: Check,     accent: NOTE_HEX['Задача'],      bg: `${NOTE_HEX['Задача']}1F` },
  { type: 'Напоминание' as NoteType, icon: Bell,      accent: NOTE_HEX['Напоминание'], bg: `${NOTE_HEX['Напоминание']}1F` },
];

export const QuickNoteCard = ({ onQuickNote }: QuickNoteCardProps) => {
  const t = useT();
  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className="col-span-12 lg:col-span-4 rounded-3xl overflow-hidden border border-white/[0.06] flex flex-col justify-center min-h-[160px] lg:min-h-0"
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
          <p className="text-sm font-bold text-on-surface leading-none mb-0.5">{t(noteTypeLabelKey(item.type))}</p>
          <p className="text-[10px] text-on-surface-variant/50 leading-none truncate">{t(noteTypeDescriptionKey(item.type))}</p>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/25 group-hover:text-on-surface-variant/60 transition-colors flex-shrink-0" />
      </motion.button>
    ))}
  </motion.div>
);
};
