import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function parse(v: string) {
  const [h, m] = (v || '00:00').split(':').map(Number);
  return { h: isNaN(h) ? 0 : Math.min(23, h), m: isNaN(m) ? 0 : Math.min(59, m) };
}

function Drum({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const wrap = (n: number) => ((n % (max + 1)) + (max + 1)) % (max + 1);
  const items = [-2, -1, 0, 1, 2].map(offset => wrap(value + offset));
  const drumRef = useRef<HTMLDivElement>(null);

  // Non-passive wheel listener so preventDefault() actually stops page scroll
  useEffect(() => {
    const el = drumRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(wrap(value + (e.deltaY > 0 ? 1 : -1)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [value, onChange, wrap]);

  const opacities = [0.2, 0.45, 1, 0.45, 0.2];
  const scales   = [0.7,  0.85, 1, 0.85, 0.7];

  return (
    <div
      ref={drumRef}
      className="relative flex flex-col items-center select-none"
      style={{ userSelect: 'none' }}
    >
      {/* Selection highlight */}
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-12 rounded-xl bg-primary/15 border border-primary/30 pointer-events-none" />

      {/* Drum items */}
      <div className="flex flex-col items-center gap-0.5 py-1">
        {items.map((num, i) => (
          <motion.button
            key={`${i}-${num}`}
            onClick={() => i !== 2 && onChange(wrap(value + (i - 2)))}
            animate={{ opacity: opacities[i], scale: scales[i] }}
            transition={{ duration: 0.15 }}
            className={`w-14 h-11 flex items-center justify-center font-headline font-bold transition-colors cursor-pointer rounded-lg
              ${i === 2 ? 'text-on-surface text-3xl' : 'text-on-surface-variant text-xl hover:text-on-surface/80'}`}
          >
            {pad(num)}
          </motion.button>
        ))}
      </div>

      {/* Up / Down buttons */}
      <button
        onClick={() => onChange(wrap(value - 1))}
        className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center text-on-surface-variant/30 hover:text-primary transition-colors cursor-pointer"
        style={{ top: '-24px' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
      </button>
      <button
        onClick={() => onChange(wrap(value + 1))}
        className="absolute left-0 right-0 flex items-center justify-center text-on-surface-variant/30 hover:text-primary transition-colors cursor-pointer"
        style={{ bottom: '-24px' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );
}

export const TimePicker = ({ value, onChange, onClose, anchorRef }: TimePickerProps) => {
  const { h: initH, m: initM } = parse(value);
  const [hours, setHours] = useState(initH);
  const [minutes, setMinutes] = useState(initM);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>(
    { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999 }
  );

  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const h = 220;
      const top = window.innerHeight - rect.bottom >= h + 8 ? rect.bottom + 6 : rect.top - h - 8;
      setStyle({ position: 'fixed', top: Math.max(8, top), left: Math.min(rect.left, window.innerWidth - 200), zIndex: 9999 });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (anchorRef?.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  const handleConfirm = () => {
    onChange(`${pad(hours)}:${pad(minutes)}`);
    onClose();
  };

  const setNow = () => {
    const now = new Date();
    setHours(now.getHours());
    setMinutes(now.getMinutes());
  };

  return (
    <motion.div
      ref={popoverRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-48 bg-surface-container-high border border-white/10 rounded-2xl shadow-2xl p-4 select-none"
    >
      {/* Header */}
      <p className="text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">Время</p>

      {/* Drums */}
      <div className="flex items-center justify-center gap-1 mt-6 mb-6">
        <Drum value={hours} max={23} onChange={setHours} />
        <span className="text-2xl font-headline font-bold text-primary/60 mb-0.5">:</span>
        <Drum value={minutes} max={59} onChange={setMinutes} />
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
        <button
          onClick={setNow}
          className="flex-1 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
        >
          Сейчас
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
        >
          OK
        </button>
      </div>
    </motion.div>
  );
};
