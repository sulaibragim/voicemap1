import { useEffect, useState } from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { fetchTranscriptionUsage, type TranscriptionUsage } from '../../lib/api';
import { formatDurationHuman, isUsageLow, planLabel, usagePercent } from '../../lib/usageFormat';
import { useT, useLang } from '../../i18n';

// Расход минут расшифровки за текущий месяц.
// Данные приходят с сервера (GET /api/ai/usage) — счётчик считает только он,
// клиентская арифметика по длительностям записей врала бы после удалений и повторных расшифровок.
export const UsageCard = () => {
  const t = useT();
  const lang = useLang();
  const [usage, setUsage] = useState<TranscriptionUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTranscriptionUsage().then(result => {
      if (cancelled) return;
      setUsage(result);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-on-surface-variant animate-spin" />
        <p className="text-sm text-on-surface-variant">{t('usage.loading')}</p>
      </div>
    );
  }

  // Сервер недоступен или лимиты не настроены — молча не показываем блок,
  // вместо того чтобы пугать пользователя ошибкой в настройках.
  if (!usage) return null;

  const percent = usagePercent(usage);
  const isExhausted = usage.remainingSeconds <= 0;
  const barColor = isExhausted ? 'bg-error' : isUsageLow(usage) ? 'bg-warning' : 'bg-primary';

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gauge className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface">{t('usage.title')}</p>
          <p className="text-xs text-on-surface-variant">{t('usage.plan', { plan: planLabel(usage.plan, lang) })}</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-bold text-on-surface">{t('usage.used', { used: formatDurationHuman(usage.usedSeconds, lang), limit: formatDurationHuman(usage.limitSeconds, lang) })}</p>
        <p className="text-xs text-on-surface-variant">{percent}%</p>
      </div>

      <p className={`text-xs mt-1.5 ${isExhausted ? 'text-error' : 'text-on-surface-variant'}`}>
        {isExhausted
          ? t('usage.exhausted')
          : t('usage.left', { left: formatDurationHuman(usage.remainingSeconds, lang) })}
      </p>
    </div>
  );
};
