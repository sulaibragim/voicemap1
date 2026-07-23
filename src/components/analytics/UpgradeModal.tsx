import { motion } from 'motion/react';
import { Check, Zap, X } from 'lucide-react';
import { formatDurationHuman } from '../../lib/usageFormat';
import { useT, useLang } from '../../i18n';
import type { TranscriptionUsage } from '../../lib/api';

interface UpgradeModalProps {
  /** Расход на момент отказа — показываем, во что именно упёрлись */
  usage?: TranscriptionUsage;
  onClose: () => void;
}

// Часы в тарифах. Держим здесь, а не тянем с сервера: это витрина, а не расчёт.
// Должно совпадать с PLAN_*_MINUTES (server/lib/lang.ts → usage.ts).
const PRO_HOURS = 20;
const PRO_PRICE = '$15';

/**
 * Экран Pro: что даст тариф, когда он появится.
 *
 * Кнопки действия здесь НЕТ намеренно. Биллинга нет, а вести на почту
 * бессмысленно — писать пока некому. Это витрина будущего тарифа, а не форма
 * заявки: показать ценность, не имитируя работающую покупку.
 */
export const UpgradeModal = ({ usage, onClose }: UpgradeModalProps) => {
  const t = useT();
  const lang = useLang();

  const benefits: string[] = [
    t('upgrade.benefitHours', { hours: PRO_HOURS }),
    t('upgrade.benefitSearch'),
    t('upgrade.benefitQuotes'),
    t('upgrade.benefitPriority'),
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="w-full max-w-md bg-surface-container-low rounded-3xl border border-white/10 p-6 md:p-8 shadow-xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
          <Zap className="w-6 h-6 text-primary" />
        </div>

        <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-2">
          {t('upgrade.title')}
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
          {/* «Израсходовал весь лимит» — только когда это правда. При заходе из Настроек
              с нетронутым лимитом такой текст откровенно врал. */}
          {usage && usage.remainingSeconds <= 0
            ? t('upgrade.spent', { limit: formatDurationHuman(usage.limitSeconds, lang) })
            : t('upgrade.subtitle')}
        </p>

        <div className="rounded-2xl bg-surface-container p-5 border border-primary/20 mb-5">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-headline text-3xl font-black text-on-surface">{PRO_PRICE}</span>
            <span className="text-sm text-on-surface-variant">{t('upgrade.perMonth')}</span>
          </div>

          <ul className="space-y-2.5">
            {benefits.map(benefit => (
              <li key={benefit} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <span className="text-sm text-on-surface leading-snug">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-on-surface-variant text-center leading-relaxed">
          {t('upgrade.comingSoon')}
        </p>
      </motion.div>
    </div>
  );
};
