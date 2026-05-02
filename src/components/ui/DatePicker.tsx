import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseISO(iso: string): { year: number; month: number; day: number } | null {
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m - 1, day: d };
}

export const DatePicker = ({ value, onChange, onClose, anchorRef }: DatePickerProps) => {
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const parsed = value ? parseISO(value) : null;
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        if (!anchorRef?.current?.contains(target)) {
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // Positioning relative to anchor
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= 320 ? rect.bottom + 6 : rect.top - 6 - 320;
      setStyle({
        position: 'fixed',
        top: Math.max(8, top),
        left: Math.min(rect.left, window.innerWidth - 296),
        zIndex: 9999,
      });
    } else {
      setStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 });
    }
  }, [anchorRef]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid (Mon-first)
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { iso: string; day: number; current: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ iso: toISO(prevY, prevM, d), day: d, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toISO(viewYear, viewMonth, d), day: d, current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ iso: toISO(nextY, nextM, d), day: d, current: false });
  }

  const handleDay = (iso: string) => {
    onChange(iso);
    onClose();
  };

  return (
    <motion.div
      ref={popoverRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-[230px] bg-surface-container-high border border-white/10 rounded-2xl shadow-2xl p-3 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-on-surface-variant transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-headline text-sm font-semibold text-on-surface">
          {MONTHS_RU[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-on-surface-variant transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="w-7 h-6 flex items-center justify-center text-[9px] font-label font-medium text-on-surface-variant uppercase tracking-wide">
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, idx) => {
          const isSelected = cell.iso === value;
          const isToday = cell.iso === todayISO;
          return (
            <button
              key={idx}
              onClick={() => handleDay(cell.iso)}
              className={[
                'w-7 h-7 flex items-center justify-center rounded-full text-xs font-body transition-colors',
                isSelected
                  ? 'bg-primary text-on-primary font-semibold'
                  : isToday
                  ? 'ring-1 ring-primary/50 text-on-surface hover:bg-white/10'
                  : 'hover:bg-white/10',
                !cell.current && !isSelected ? 'text-on-surface-variant opacity-40' : '',
                cell.current && !isSelected && !isToday ? 'text-on-surface' : '',
              ].join(' ')}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/10 flex justify-center">
        <button
          onClick={() => handleDay(todayISO)}
          className="text-xs font-label font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded-full hover:bg-primary/10"
        >
          Сегодня
        </button>
      </div>
    </motion.div>
  );
};
