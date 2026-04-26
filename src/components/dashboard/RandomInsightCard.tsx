import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, ChevronRight, Loader2, X, Clock } from 'lucide-react';
import { developIdea } from '../../lib/api';
import type { Recording } from '../../types';

interface InsightItem {
  text: string;
  type: 'idea' | 'keyMoment';
  recordingId: string;
  recordingTitle: string;
  daysAgo: number | null;
}

interface RandomInsightCardProps {
  recordings: Recording[];
  onOpenRecording: (id: string) => void;
  embedded?: boolean;
}

// Parse recording date into a Date object
const RU_MONTHS: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};

function parseRecDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // "13.04.2025"
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    return new Date(Number(dotMatch[3]), Number(dotMatch[2]) - 1, Number(dotMatch[1]));
  }
  // "13 апреля, 11:20"
  const ruMatch = dateStr.match(/^(\d{1,2})\s+([а-яё]+)/i);
  if (ruMatch) {
    const day = Number(ruMatch[1]);
    const month = RU_MONTHS[ruMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(new Date().getFullYear(), month, day);
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysAgo(dateStr: string): number | null {
  const d = parseRecDate(dateStr);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / 86400000);
}

function collectInsights(recordings: Recording[]): InsightItem[] {
  const items: InsightItem[] = [];
  recordings.forEach(rec => {
    const daysAgo = getDaysAgo(rec.date);
    (rec.ideas ?? []).forEach(text => {
      if (text.trim()) items.push({ text, type: 'idea', recordingId: rec.id, recordingTitle: rec.title, daysAgo });
    });
    (rec.keyMoments ?? []).forEach(text => {
      if (text.trim()) items.push({ text, type: 'keyMoment', recordingId: rec.id, recordingTitle: rec.title, daysAgo });
    });
  });

  // Sort: forgotten ideas (>7 days) first, then recent
  return items.sort((a, b) => {
    const aForgotten = (a.daysAgo ?? 0) >= 7;
    const bForgotten = (b.daysAgo ?? 0) >= 7;
    if (aForgotten && !bForgotten) return -1;
    if (!aForgotten && bForgotten) return 1;
    return (b.daysAgo ?? 0) - (a.daysAgo ?? 0);
  });
}

function pickRandom<T>(arr: T[], exclude?: number): number {
  if (arr.length <= 1) return 0;
  let idx: number;
  do { idx = Math.floor(Math.random() * arr.length); } while (idx === exclude && arr.length > 1);
  return idx;
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дня назад`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? 'неделю' : weeks < 5 ? 'недели' : 'недель'} назад`;
  }
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'} назад`;
}

export const RandomInsightCard = ({ recordings, onOpenRecording, embedded = false }: RandomInsightCardProps) => {
  const insights = useMemo(() => collectInsights(recordings), [recordings]);
  // Start from a forgotten insight if available
  const [currentIdx, setCurrentIdx] = useState(() => {
    const forgottenIdx = insights.findIndex(i => (i.daysAgo ?? 0) >= 7);
    return forgottenIdx >= 0 ? forgottenIdx : pickRandom(insights);
  });
  const [direction, setDirection] = useState(1);
  const [development, setDevelopment] = useState<string | null>(null);
  const [isDeveloping, setIsDeveloping] = useState(false);

  const current = insights[currentIdx];
  const isForgotten = (current?.daysAgo ?? 0) >= 7;

  const nextInsight = useCallback(() => {
    setDirection(1);
    setDevelopment(null);
    setCurrentIdx(prev => pickRandom(insights, prev));
  }, [insights]);

  const handleDevelop = async () => {
    if (!current || isDeveloping) return;
    setIsDeveloping(true);
    try {
      const result = await developIdea(current.text, current.recordingTitle);
      setDevelopment(result);
    } catch {
      setDevelopment('Не удалось развить идею. Попробуйте ещё раз.');
    } finally {
      setIsDeveloping(false);
    }
  };

  if (insights.length === 0) return null;

  const innerContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-xs font-black tracking-[0.25em] uppercase text-primary">
            {isForgotten ? 'Вспомни об этом' : 'Случайный инсайт'}
          </span>
          {isForgotten && current.daysAgo !== null && (
            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/60 bg-white/5 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {formatDaysAgo(current.daysAgo)}
            </span>
          )}
        </div>
        <button
          onClick={nextInsight}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer group"
        >
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
          <span className="font-bold tracking-wide">Другой</span>
        </button>
      </div>

      {/* Insight text */}
      <div className="flex-1 relative min-h-[80px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIdx}
            custom={direction}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0"
          >
            {/* Forgotten badge */}
            {isForgotten && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20"
              >
                <Clock className="w-3 h-3 text-primary/70" />
                <span className="text-[11px] text-primary/80 font-bold">
                  {current.daysAgo !== null ? `Забытая мысль · ${formatDaysAgo(current.daysAgo)}` : 'Забытая мысль'}
                </span>
              </motion.div>
            )}
            <p className="font-headline text-xl lg:text-2xl font-bold leading-snug text-white mb-4">
              "{current?.text}"
            </p>
            <button
              onClick={() => current && onOpenRecording(current.recordingId)}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer group"
            >
              <span className="line-clamp-1 max-w-[260px]">из «{current?.recordingTitle}»</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Development section */}
      <AnimatePresence>
        {development && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/8 relative">
              <button
                onClick={() => setDevelopment(null)}
                className="absolute top-5 right-0 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-sm text-on-surface-variant leading-relaxed pr-6">{development}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
        <button
          onClick={handleDevelop}
          disabled={isDeveloping}
          className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary rounded-xl text-xs font-bold hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isDeveloping
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />
          }
          {isDeveloping ? 'Развиваю...' : development ? 'Развить ещё' : 'Развить идею'}
        </button>
        <span className="text-[10px] text-on-surface-variant ml-auto font-mono opacity-50">
          {currentIdx + 1} / {insights.length}
        </span>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col">{innerContent}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="col-span-12 lg:col-span-7 relative"
    >
      <div className="bg-surface-container rounded-[32px] border border-white/5 p-6 lg:p-8 h-full flex flex-col overflow-hidden relative">
        {innerContent}
      </div>
    </motion.div>
  );
};
