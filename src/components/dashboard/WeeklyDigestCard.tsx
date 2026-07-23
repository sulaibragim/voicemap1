import { useState, useEffect } from 'react';
import { useT, useLang } from '../../i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, TrendingDown, Calendar, RefreshCw,
  Loader2, Sparkles,
} from 'lucide-react';
import { weeklyReview, type DigestAIResult } from '../../lib/api';
import type { Recording } from '../../types';
import { parseRecDate, getWeekKey } from '../../lib/dashboardUtils';
import { pluralWithNumber } from '../../lib/plural';

interface WeeklyDigestCardProps {
  recordings: Recording[];
  setCurrentView: (view: string) => void;
}

const CACHE_KEY = `voicemap_digest_${getWeekKey()}`;

interface TrendInfo {
  icon: typeof TrendingUp;
  color: string;
  label: string;
}

function trend(now: number, prev: number): TrendInfo | null {
  if (now > prev) return { icon: TrendingUp, color: 'text-tertiary', label: `+${now - prev}` };
  if (now < prev) return { icon: TrendingDown, color: 'text-error', label: `-${prev - now}` };
  return null;
}

export const WeeklyDigestCard = ({ recordings, setCurrentView }: WeeklyDigestCardProps) => {
  const t = useT();
  const lang = useLang();
  const [digest, setDigest] = useState<DigestAIResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  // Вычислить границы недель
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - 6);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(now.getDate() - 13);

  const thisWeek = recordings.filter(r => {
    const d = parseRecDate(r.date);
    return d !== null && d >= thisWeekStart;
  });
  const prevWeek = recordings.filter(r => {
    const d = parseRecDate(r.date);
    return d !== null && d >= prevWeekStart && d < thisWeekStart;
  });

  const stats = {
    recordings: { now: thisWeek.length, prev: prevWeek.length },
    tasks: {
      now: thisWeek.reduce((a, r) => a + (r.actionItems?.length ?? 0), 0),
      prev: prevWeek.reduce((a, r) => a + (r.actionItems?.length ?? 0), 0),
    },
    ideas: {
      now: thisWeek.reduce((a, r) => a + (r.ideas?.length ?? 0), 0),
      prev: prevWeek.reduce((a, r) => a + (r.ideas?.length ?? 0), 0),
    },
  };

  const tasksDone = thisWeek.reduce((a, r) =>
    a + (r.actionItems ?? []).filter((_, i) => r.actionItemsDone?.[i] === true).length, 0
  );
  const tasksTotal = stats.tasks.now;
  const tasksPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const loadDigest = async (force = false) => {
    if (thisWeek.length === 0) return;
    if (!force) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          setDigest(JSON.parse(cached) as DigestAIResult);
          return;
        } catch {
          // кеш повреждён — перегенерируем
        }
      }
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
    setIsLoading(true);
    setError(false);
    try {
      const payload = thisWeek.slice(0, 10).map(r => ({
        title: r.title,
        summary: r.summary,
        ideas: r.ideas,
        actionItems: r.actionItems,
        tags: r.tags,
      }));
      const result = await weeklyReview(payload);
      setDigest(result);
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Автозапуск при монтировании если есть записи
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDigest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statItems = [
    { label: t('digest.statRecordings'), value: stats.recordings.now, prev: stats.recordings.prev, color: 'text-primary' },
    { label: t('digest.statTasks'), value: stats.tasks.now, prev: stats.tasks.prev, color: 'text-secondary' },
    { label: t('digest.statIdeas'), value: stats.ideas.now, prev: stats.ideas.prev, color: 'text-tertiary' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="col-span-12 lg:col-span-8 bg-surface-bright p-1 rounded-3xl overflow-hidden shadow-2xl lg:h-[480px]"
    >
      <div className="bg-surface-container p-4 md:p-8 rounded-[22px] h-full flex flex-col gap-6 overflow-y-auto">

        {/* Заголовок */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-headline text-xl md:text-3xl font-black leading-none">{t('digest.title')}</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {t('digest.period', { count: lang === 'en' ? `${thisWeek.length} ${thisWeek.length === 1 ? 'recording' : 'recordings'}` : pluralWithNumber(thisWeek.length, ['запись', 'записи', 'записей']) })}
            </p>
          </div>
          {digest && !isLoading && (
            <button
              onClick={() => void loadDigest(true)}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              title={t('digest.refresh')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {thisWeek.length === 0 ? (
          /* Пустое состояние */
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Calendar className="w-10 h-10 text-on-surface-variant opacity-40" />
            <p className="text-on-surface-variant font-semibold text-sm">{t('digest.empty')}</p>
            <p className="text-xs text-on-surface-variant opacity-60">
              {t('digest.emptyHint')}
            </p>
            <button
              onClick={() => setCurrentView('recording_session')}
              className="mt-2 px-4 py-2 bg-primary/15 text-primary rounded-xl text-xs font-bold hover:bg-primary/25 transition-colors cursor-pointer"
            >
              {t('digest.startRecording')}
            </button>
          </div>
        ) : (
          <>
            {/* Секция 1 — Статистика с трендом */}
            <div className="grid grid-cols-3 gap-3">
              {statItems.map((s) => {
                const t = trend(s.value, s.prev);
                const TrendIcon = t?.icon;
                return (
                  <div
                    key={s.label}
                    className="bg-surface-container-low rounded-2xl p-3 md:p-4 flex flex-col gap-1"
                  >
                    <span className={`text-2xl md:text-3xl font-headline font-black ${s.color}`}>
                      {s.value}
                    </span>
                    <span className="text-[11px] text-on-surface-variant leading-tight">{s.label}</span>
                    {t && TrendIcon && (
                      <div className={`flex items-center gap-0.5 text-[11px] font-bold ${t.color}`}>
                        <TrendIcon className="w-3 h-3" />
                        <span>{t.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Секция 2 — Прогресс задач */}
            {tasksTotal > 0 && (
              <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black tracking-[0.15em] uppercase text-on-surface-variant">{t('digest.weekTasks')}</span>
                  <span className="font-black text-secondary">{tasksDone} / {tasksTotal}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${tasksPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {tasksDone === 0
                    ? t('digest.noneDone')
                    : tasksDone === tasksTotal
                      ? t('digest.allDone')
                      : t('digest.partlyDone', { percent: tasksPct, left: tasksTotal - tasksDone })}
                </p>
              </div>
            )}

            {/* Секция 3 — Главная тема (AI) */}
            <div className="bg-surface-container-low rounded-2xl p-4 md:p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-[10px] font-black tracking-[0.18em] uppercase text-primary">
                  {t('digest.mainTheme')}
                </span>
              </div>

              {isLoading ? (
                /* Скелетон */
                <div className="space-y-2 animate-pulse">
                  <div className="h-7 w-2/3 bg-surface-container rounded-lg" />
                  <div className="h-4 w-full bg-surface-container rounded-lg" />
                  <div className="h-4 w-5/6 bg-surface-container rounded-lg" />
                  <div className="h-px w-full bg-white/5 my-1" />
                  <div className="h-3 w-3/4 bg-surface-container rounded-lg" />
                </div>
              ) : digest ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="digest"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-3"
                  >
                    <p className="font-headline text-lg md:text-2xl font-black text-on-surface leading-tight">
                      {digest.mainTheme}
                    </p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {digest.themeSummary}
                    </p>
                    <div className="h-px bg-white/8" />
                    <p className="text-xs text-on-surface-variant italic leading-relaxed opacity-80">
                      {digest.insight}
                    </p>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  {error ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-xs text-error">{t('digest.error')}</p>
                      <button
                        onClick={() => void loadDigest(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary rounded-lg text-xs font-bold hover:bg-primary/25 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('digest.retry')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => void loadDigest(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary rounded-xl text-xs font-bold hover:bg-primary/25 transition-colors cursor-pointer"
                    >
                      <Loader2 className="w-3.5 h-3.5" />
                      {t('digest.loading')}
                    </button>
                  )}
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </motion.div>
  );
};
