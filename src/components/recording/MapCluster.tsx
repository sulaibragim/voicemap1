import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface MapClusterProps {
  label: string;
  count: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  icon?: ReactNode;
  onClick: () => void;
  delay?: number;
  unit?: string;
}

function pluralize(n: number, unit: string): string {
  // Supported units: 'запись', 'заметка'
  if (unit === 'заметка') {
    if (n === 1) return 'заметка';
    if (n >= 2 && n <= 4) return 'заметки';
    return 'заметок';
  }
  // default: 'запись'
  if (n === 1) return 'запись';
  if (n >= 2 && n <= 4) return 'записи';
  return 'записей';
}

export const MapCluster = ({
  label,
  count,
  x,
  y,
  radius,
  color,
  glowColor,
  icon,
  onClick,
  delay = 0,
  unit = 'запись',
}: MapClusterProps) => {
  const fontSize = Math.max(14, Math.min(22, radius / 7));

  return (
    <motion.button
      className="absolute"
      style={{
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
      initial={{ opacity: 0, scale: 0.1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 70, delay }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      {/* ── Far glow — massive ambient bloom ── */}
      <div
        className="absolute inset-[-40%] rounded-full blur-[80px] opacity-20 transition-opacity duration-700 group-hover:opacity-40"
        style={{ backgroundColor: glowColor }}
      />

      {/* ── Outermost ring — slow rotating dashed ── */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1.5px dashed ${color}22`,
          transformOrigin: 'center',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── Pulse ring 1 ── */}
      <motion.div
        className="absolute inset-[6%] rounded-full"
        style={{ border: `1px solid ${color}` }}
        animate={{ opacity: [0.08, 0.22, 0.08], scale: [0.94, 1.0, 0.94] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Pulse ring 2 — offset timing ── */}
      <motion.div
        className="absolute inset-[14%] rounded-full"
        style={{ border: `1px solid ${color}` }}
        animate={{ opacity: [0.18, 0.05, 0.18], scale: [1.0, 0.96, 1.0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
      />

      {/* ── Gradient fill circle ── */}
      <div
        className="absolute inset-[8%] rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 36%, ${color}28 0%, ${color}10 45%, transparent 75%)`,
          boxShadow: `inset 0 0 60px ${color}12`,
        }}
      />

      {/* ── Inner glow ring on hover ── */}
      <motion.div
        className="absolute inset-[8%] rounded-full"
        style={{ border: `1.5px solid ${color}` }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.45 }}
        transition={{ duration: 0.25 }}
      />

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 select-none pointer-events-none">
        {icon && (
          <motion.div
            className="mb-4 flex items-center justify-center"
            style={{
              filter: `drop-shadow(0 0 12px ${color}80)`,
            }}
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {icon}
          </motion.div>
        )}

        <p
          className="font-headline font-black text-white tracking-tight text-center leading-tight mb-2"
          style={{
            fontSize,
            textShadow: `0 0 24px ${color}60`,
          }}
        >
          {label}
        </p>

        <p
          className="font-bold text-center"
          style={{
            fontSize: fontSize * 0.58,
            color: `${color}cc`,
            letterSpacing: '0.08em',
          }}
        >
          {count} {pluralize(count, unit)}
        </p>
      </div>
    </motion.button>
  );
};
