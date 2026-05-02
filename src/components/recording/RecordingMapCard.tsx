import { motion } from 'motion/react';
import type { Recording } from '../../types';

export const CARD_W = 160;

interface RecordingMapCardProps {
  rec: Recording;
  x: number;
  y: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  delay?: number;
  color: string;
}

export const RecordingMapCard = ({
  rec, x, y, isHovered, onHover, onClick, delay = 0, color,
}: RecordingMapCardProps) => {
  const moodEmoji = rec.mood?.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u)?.[0] ?? '🎙';
  const title = rec.title.slice(0, 50);
  const summary = rec.summary?.slice(0, 100) ?? '';

  return (
    <motion.div
      className="absolute"
      style={{ left: x - CARD_W / 2, top: y - 40, width: CARD_W, zIndex: isHovered ? 50 : 10 }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 120, delay }}
      onMouseEnter={() => onHover(rec.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <motion.div
        animate={{ scale: isHovered ? 1.12 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        className="cursor-pointer"
      >
        <div
          className="rounded-2xl border p-3 overflow-hidden transition-colors duration-200"
          style={{
            background: isHovered ? color + '18' : 'rgba(28,28,33,0.80)',
            borderColor: isHovered ? color + '70' : 'rgba(255,255,255,0.08)',
            boxShadow: isHovered ? `0 0 28px ${color}28` : 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]"
              style={{ background: isHovered ? color : color + '30' }}
            >
              {moodEmoji}
            </div>
            <span className="text-[9px] font-bold tracking-widest uppercase flex-1" style={{ color }}>
              {rec.duration}
            </span>
          </div>

          <p className="text-[11px] font-bold text-on-surface leading-snug line-clamp-2 mb-1">
            {title}{title.length < rec.title.length ? '…' : ''}
          </p>

          <motion.div
            initial={false}
            animate={{ height: isHovered ? 'auto' : 0, opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {summary && (
              <p className="text-[9px] text-on-surface-variant leading-relaxed mt-1 mb-2 line-clamp-3">
                {summary}{summary.length < (rec.summary?.length ?? 0) ? '…' : ''}
              </p>
            )}
            <p className="text-[8px] text-on-surface-variant opacity-50">{rec.date}</p>
            {rec.tags[0] && (
              <p className="text-[8px] mt-1 font-bold" style={{ color: color + 'aa' }}>{rec.tags[0]}</p>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
