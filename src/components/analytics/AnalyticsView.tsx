import { useMemo } from 'react';
import { ArrowLeft, Mic, Lightbulb, CheckSquare, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import type { Recording } from '../../types';
import { parseRecDate, toDateKey } from '../../lib/utils';
import { ActivityHeatmap } from './ActivityHeatmap';

interface Props { recordings: Recording[]; onBack: () => void }

const TIME_SEGMENTS = [
  { key: 'morning', label: 'Утро',  sub: '05–12', color: '#FFB74D' },
  { key: 'day',     label: 'День',  sub: '12–17', color: '#4FC3F7' },
  { key: 'evening', label: 'Вечер', sub: '17–22', color: '#7B61FF' },
  { key: 'night',   label: 'Ночь',  sub: '22–05', color: '#90A4AE' },
] as const;

const TAG_COLORS = ['#7B61FF','#4FC3F7','#81C784','#FFB74D','#F06292','#90A4AE'];

function parseHour(dateStr: string): number | null {
  const m = dateStr.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

export const AnalyticsView = ({ recordings, onBack }: Props) => {
  const stats = useMemo(() => {
    const totalSec = recordings.reduce((acc, r) => {
      if (!r.duration) return acc;
      const [m, s] = r.duration.split(':').map(Number);
      return acc + m * 60 + (s || 0);
    }, 0);
    return {
      totalHours: (totalSec / 3600).toFixed(1),
      totalIdeas: recordings.reduce((a, r) => a + (r.ideas?.length || 0), 0),
      totalTasks: recordings.reduce((a, r) => a + (r.actionItems?.length || 0), 0),
    };
  }, [recordings]);

  const activityData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byDay: Record<string, number> = {};
    recordings.forEach(r => {
      const d = parseRecDate(r.date);
      if (!d || !r.duration) return;
      const [m] = r.duration.split(':').map(Number);
      const k = toDateKey(d);
      byDay[k] = (byDay[k] || 0) + m;
    });
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (29 - i));
      return { name: i % 5 === 0 || i === 29 ? `${d.getDate()}` : '', value: Math.round(byDay[toDateKey(d)] || 0), date: d };
    });
  }, [recordings]);

  const maxBar = Math.max(...activityData.map(d => d.value), 1);

  const timeOfDay = useMemo(() => {
    const c = { morning: 0, day: 0, evening: 0, night: 0 };
    recordings.forEach(r => {
      const h = parseHour(r.date);
      if (h === null) return;
      if (h >= 5 && h < 12) c.morning++;
      else if (h >= 12 && h < 17) c.day++;
      else if (h >= 17 && h < 22) c.evening++;
      else c.night++;
    });
    return c;
  }, [recordings]);

  const totalTimed = Object.values(timeOfDay).reduce((a, b) => a + b, 0) || 1;

  const topTags = useMemo(() => {
    const cnt: Record<string, number> = {};
    recordings.forEach(r => r.tags.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [recordings]);
  const maxTag = Math.max(...topTags.map(t => t[1]), 1);

  const statCards = [
    { label: 'Записей',  value: recordings.length, icon: Mic,         color: '#7B61FF', bg: 'rgba(123,97,255,0.12)' },
    { label: 'Часов',    value: stats.totalHours,   icon: Clock,       color: '#4FC3F7', bg: 'rgba(79,195,247,0.12)' },
    { label: 'Идей',     value: stats.totalIdeas,   icon: Lightbulb,   color: '#FFB74D', bg: 'rgba(255,183,77,0.12)' },
    { label: 'Задач',    value: stats.totalTasks,   icon: CheckSquare, color: '#81C784', bg: 'rgba(129,199,132,0.12)' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body w-full">
      <header className="flex items-center px-6 md:px-12 py-6 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Аналитика</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4"
              style={{ background: 'rgba(28,28,33,0.9)', boxShadow: `0 0 20px ${color}08` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-black text-on-surface leading-none">{value}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Heatmap hero */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-3xl border border-white/[0.06] p-6 md:p-8"
          style={{ background: 'rgba(28,28,33,0.9)', boxShadow: '0 0 60px rgba(123,97,255,0.06)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline text-xl font-bold">Активность за год</h3>
            <span className="text-xs text-on-surface-variant/50">{recordings.length} записей · {stats.totalHours} ч</span>
          </div>
          <ActivityHeatmap recordings={recordings} />
        </motion.div>

        {/* Bar chart + Time of day */}
        <div className="grid grid-cols-12 gap-4">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            className="col-span-12 lg:col-span-7 rounded-3xl border border-white/[0.06] p-6 md:p-8"
            style={{ background: 'rgba(28,28,33,0.9)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline text-lg font-bold">Активность</h3>
              <span className="text-[11px] text-on-surface-variant/50">последние 30 дней</span>
            </div>
            <div className="h-44 min-h-[176px]">
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <BarChart data={activityData} barCategoryGap="18%">
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700 }} dy={8} interval={0} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                    itemStyle={{ color: '#AF9CFF', fontWeight: 700 }}
                    formatter={(v: number) => [`${v} мин`, '']}
                    labelFormatter={(_: unknown, payload: readonly { payload?: { date?: Date } }[]) => {
                      const d = payload?.[0]?.payload?.date;
                      return d instanceof Date ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
                    }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {activityData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= maxBar * 0.7 ? '#7B61FF' : entry.value > 0 ? 'rgba(123,97,255,0.32)' : 'rgba(255,255,255,0.04)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
            className="col-span-12 lg:col-span-5 rounded-3xl border border-white/[0.06] p-6 md:p-8"
            style={{ background: 'rgba(28,28,33,0.9)' }}>
            <h3 className="font-headline text-lg font-bold mb-6">Время суток</h3>
            <div className="space-y-5">
              {TIME_SEGMENTS.map(({ key, label, sub, color }) => {
                const count = timeOfDay[key];
                const pct = Math.round((count / totalTimed) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-sm font-bold text-on-surface">{label}</span>
                        <span className="text-[10px] text-on-surface-variant/50">{sub}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color }}>{count} зап.</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <motion.div className="h-full rounded-full" style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.55, duration: 0.7, ease: 'easeOut' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Top tags */}
        {topTags.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
            className="rounded-3xl border border-white/[0.06] p-6 md:p-8"
            style={{ background: 'rgba(28,28,33,0.9)' }}>
            <h3 className="font-headline text-lg font-bold mb-6">Топ тем</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
              {topTags.map(([tag, count], i) => (
                <div key={tag}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-on-surface">{tag}</span>
                    <span className="text-xs font-bold text-on-surface-variant/60">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((count / maxTag) * 100)}%` }}
                      transition={{ delay: 0.62 + i * 0.05, duration: 0.6, ease: 'easeOut' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
};
