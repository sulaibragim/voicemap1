import { motion } from 'motion/react';
import { Mic, Clock, Zap, Users } from 'lucide-react';
import type { Recording } from '../../types';

interface MapRecordingNodeProps {
  recording: Recording;
  x: number;
  y: number;
  isHovered: boolean;
  hasConnections: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  delay?: number;
  moodColor?: string;
  hasIncompleteTasks?: boolean;
  dimmed?: boolean;
}

const CARD_W = 160;

export const MapRecordingNode = ({
  recording,
  x,
  y,
  isHovered,
  hasConnections,
  onHover,
  onClick,
  delay = 0,
  moodColor,
  hasIncompleteTasks = false,
  dimmed = false,
}: MapRecordingNodeProps) => {
  // Extract participants from transcript speakers (unique, skip "Я")
  const participants = Array.from(
    new Set((recording.transcript ?? []).map(t => t.speaker).filter(s => s && s !== 'Я'))
  ).slice(0, 3);

  // Short summary — first sentence or 70 chars
  const shortSummary = recording.summary
    ? recording.summary.split(/[.!?]/)[0]?.trim().slice(0, 70) ?? recording.summary.slice(0, 70)
    : null;

  // Active accent color: moodColor overrides the default purple
  const accentColor = moodColor ?? '#7B61FF';

  return (
    <motion.div
      className="absolute"
      style={{
        left: x - CARD_W / 2,
        top: y - 42,
        width: CARD_W,
        zIndex: isHovered ? 50 : 10,
        opacity: dimmed ? 0.25 : 1,
        transition: 'opacity 0.2s ease',
      }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: dimmed ? 0.25 : 1, scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 120, delay }}
      onMouseEnter={() => onHover(recording.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(recording.id)}
    >
      <motion.div
        animate={{ scale: isHovered ? 1.12 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        className="cursor-pointer relative"
      >
        {/* ── Pulsing orange ring for incomplete tasks ── */}
        {hasIncompleteTasks && (
          <motion.div
            className="absolute border-2 border-orange-400/60 rounded-2xl"
            style={{ inset: -3 }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div
          className="rounded-2xl border p-3 transition-colors duration-200 overflow-hidden"
          style={{
            background: isHovered
              ? `${accentColor}1a`
              : 'rgba(28,28,33,0.78)',
            borderColor: isHovered
              ? `${accentColor}99`
              : moodColor
                ? `${moodColor}30`
                : 'rgba(255,255,255,0.08)',
            boxShadow: isHovered
              ? `0 0 28px ${accentColor}40`
              : moodColor
                ? `0 0 12px ${moodColor}18`
                : 'none',
          }}
        >
          {/* Top row: mic icon + duration + connection indicator */}
          <div className="flex items-center gap-1.5 mb-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: isHovered ? accentColor : `${accentColor}30` }}
            >
              <Mic className="w-2.5 h-2.5" style={{ color: isHovered ? '#fff' : accentColor }} />
            </div>
            <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5 font-mono flex-1">
              <Clock className="w-2 h-2" />
              {recording.duration}
            </span>
            {hasConnections && (
              <Zap className="w-2.5 h-2.5 flex-shrink-0 transition-colors"
                style={{ color: isHovered ? accentColor : `${accentColor}40` }} />
            )}
          </div>

          {/* Title */}
          <p className="text-[11px] font-bold text-on-surface leading-snug line-clamp-2">
            {recording.title}
          </p>

          {/* Expanded content on hover */}
          <motion.div
            initial={false}
            animate={{ height: isHovered ? 'auto' : 0, opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {/* Short summary */}
            {shortSummary && (
              <p className="text-[9px] text-on-surface-variant mt-2 leading-relaxed line-clamp-3">
                {shortSummary}{shortSummary.length < (recording.summary?.length ?? 0) ? '…' : ''}
              </p>
            )}

            {/* Participants */}
            {participants.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Users className="w-2 h-2 text-on-surface-variant opacity-60 flex-shrink-0" />
                <span className="text-[8px] text-on-surface-variant opacity-70">
                  {participants.join(', ')}
                </span>
              </div>
            )}

            {/* Mood */}
            {recording.mood && (
              <p className="text-[8px] text-on-surface-variant opacity-60 mt-1">
                {recording.mood}
              </p>
            )}

            {/* Tags */}
            {recording.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {recording.tags.slice(0, 3).map(tag => (
                  <span key={tag}
                    className="text-[8px] px-1.5 py-0.5 rounded font-bold leading-none"
                    style={{ background: `${accentColor}26`, color: `${accentColor}e6` }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
