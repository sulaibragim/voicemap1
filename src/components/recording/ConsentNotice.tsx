import { motion } from 'motion/react';
import { ShieldAlert, Megaphone, Scale } from 'lucide-react';
import { formatConsentStates } from '../../lib/consent';
import { useT, useLang } from '../../i18n';

interface ConsentNoticeProps {
  /** Подтверждение прочтения — родитель сохраняет отметку в настройках */
  onAcknowledge: () => void;
  /** Закрыть, не начиная запись. Не передан — режим просмотра из Настроек */
  onCancel?: () => void;
  /** Повторный показ из Настроек: подтверждать нечего, только закрыть */
  readOnly?: boolean;
}

/**
 * Юридическое предупреждение перед первой записью.
 *
 * В ряде штатов США записывать разговор можно только с согласия всех участников —
 * для продукта про запись встреч это реальный риск, а не формальность.
 * Показывается один раз, дальше на экране записи остаётся ненавязчивая строка.
 */
export const ConsentNotice = ({ onAcknowledge, onCancel, readOnly = false }: ConsentNoticeProps) => {
  const t = useT();
  const lang = useLang();
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      className="w-full max-w-md bg-surface-container-low rounded-3xl border border-white/10 p-6 md:p-8 shadow-xl"
    >
      <div className="w-12 h-12 rounded-2xl bg-warning/15 flex items-center justify-center mb-5">
        <ShieldAlert className="w-6 h-6 text-warning" />
      </div>

      <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-2">
        {t('consent.title')}
      </h2>
      <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
        {t('consent.intro', { states: formatConsentStates(lang) })}
      </p>

      <div className="space-y-4 mb-6">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">{t('consent.sayTitle')}</p>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
              {t('consent.sayBody')}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">{t('consent.legalTitle')}</p>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
              {t('consent.legalBody')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 rounded-2xl text-sm font-bold text-on-surface-variant bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
          >
            {readOnly ? t('common.close') : t('common.back')}
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onAcknowledge}
            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold bg-primary text-on-primary-fixed hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t('consent.acknowledge')}
          </button>
        )}
      </div>
    </motion.div>
  </div>
  );
};
