import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Trophy } from 'lucide-react';
import type { Recording } from '../../types';
import { parseRecDate, toDateKey } from '../../lib/utils';

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;

function cellColor(count: number, max: number): string {
  if (count === 0) return 'rgba(255,255,255,0.05)';
  const t = Math.max(0.18, count / max);
  return `rgba(123,97,255,${t.toFixed(2)})`;
}

interface Props { recordings: Recording[] }

export const ActivityHeatmap = ({ recordings }: Props) => {
  const [hovered, setHovered] = useState<{ date: string; count: number } | null>(null);

  const { weeks, countByDay, maxCount, currentStreak, longestStreak, monthLabels } = useMemo(() => {
    const countByDay: Record<string, number> = {};
    recordings.forEach(r => {
      const d = parseRecDate(r.date);
      if (d) { const k = toDateKey(d); countByDay[k] = (countByDay[k] || 0) + 1; }
    });
    const maxCount = Math.max(1, ...Object.values(countByDay));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - 52 * 7);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // align to Monday

    const weeks: Array<Array<{ date: Date; key: string } | null>> = [];
    const monthLabels: Array<{ label: string; col: number }> = [];
    let prevMonth = -1;
    const cur = new Date(start);

    while (cur <= today) {
      const week: Array<{ date: Date; key: string } | null> = [];
      for (let d = 0; d < 7; d++) {
        week.push(cur <= today ? { date: new Date(cur), key: toDateKey(cur) } : null);
        cur.setDate(cur.getDate() + 1);
      }
      const first = week.find(c => c !== null);
      if (first && first.date.getMonth() !== prevMonth) {
        monthLabels.push({ label: MONTHS[first.date.getMonth()], col: weeks.length });
        prevMonth = first.date.getMonth();
      }
      weeks.push(week);
    }

    let currentStreak = 0;
    const check = new Date(today);
    if (!countByDay[toDateKey(check)]) check.setDate(check.getDate() - 1);
    while (countByDay[toDateKey(check)]) { currentStreak++; check.setDate(check.getDate() - 1); }

    let longestStreak = 0, ls = 0;
    const s = new Date(start);
    while (s <= today) {
      if (countByDay[toDateKey(s)]) {
        ls++;
        longestStreak = Math.max(longestStreak, ls);
      } else {
        ls = 0;
      }
      s.setDate(s.getDate() + 1);
    }

    return { weeks, countByDay, maxCount, currentStreak, longestStreak, monthLabels };
  }, [recordings]);

  return (
    <div>
      {/* Streak badges */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,183,77,0.15)' }}>
            <Flame className="w-4.5 h-4.5" style={{ color: '#FFB74D' }} />
          </div>
          <div>
            <p className="text-3xl font-black text-on-surface leading-none">{currentStreak}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">стрик дней</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(123,97,255,0.15)' }}>
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-black text-on-surface leading-none">{longestStreak}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">рекорд</p>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: weeks.length * STEP }}>
          {/* Month labels */}
          <div className="relative h-5 mb-2">
            {monthLabels.map(({ label, col }, i) => (
              <span key={i} className="absolute text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider"
                style={{ left: col * STEP }}>
                {label}
              </span>
            ))}
          </div>
          {/* Grid */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell, di) => {
                  if (!cell) return <div key={di} style={{ width: CELL, height: CELL }} />;
                  const count = countByDay[cell.key] || 0;
                  return (
                    <motion.div
                      key={di}
                      className="rounded-[2px] cursor-pointer"
                      style={{ width: CELL, height: CELL, background: cellColor(count, maxCount) }}
                      whileHover={{ scale: 1.6, zIndex: 10 }}
                      transition={{ duration: 0.1 }}
                      onHoverStart={() => setHovered({
                        date: cell.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                        count,
                      })}
                      onHoverEnd={() => setHovered(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info + legend */}
      <div className="flex items-center justify-between mt-3">
        <div className="h-5 flex items-center">
          {hovered ? (
            <p className="text-xs text-on-surface-variant">
              <span className="font-bold text-on-surface">{hovered.date}</span>
              <span className="ml-2 text-primary/80">
                {hovered.count === 0 ? 'нет записей' : `${hovered.count} запис${hovered.count === 1 ? 'ь' : hovered.count < 5 ? 'и' : 'ей'}`}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-on-surface-variant/30">Наведи на ячейку</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-on-surface-variant/40">Меньше</span>
          {[0, 0.18, 0.4, 0.65, 1].map((v, i) => (
            <div key={i} className="rounded-[2px]"
              style={{ width: CELL, height: CELL, background: v === 0 ? 'rgba(255,255,255,0.05)' : `rgba(123,97,255,${v})` }} />
          ))}
          <span className="text-[10px] text-on-surface-variant/40">Больше</span>
        </div>
      </div>
    </div>
  );
};
