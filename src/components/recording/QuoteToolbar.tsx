import { Copy, Download, Quote } from 'lucide-react';
import { buildQuoteRange } from '../../lib/quoteExport';
import type { QuoteFragment } from '../../lib/quoteExport';
import { useT } from '../../i18n';

interface QuoteToolbarProps {
  fragments: QuoteFragment[];
  /** Прямоугольник выделения (координаты вьюпорта) — для варианта 'floating' */
  rect: DOMRect | null;
  /** 'floating' — рядом с выделением (десктоп), 'bar' — полоса снизу (мобилка) */
  variant: 'floating' | 'bar';
  onCopy: () => void;
  onDownload: () => void;
}

// Отступ плавающей панели над выделением и запас от краёв окна
const GAP = 10;
const EDGE = 12;
const FLOATING_WIDTH = 260;

/**
 * Действия над выделенным куском транскрипта: скопировать цитату с таймкодом
 * и именем спикера или скачать её файлом.
 *
 * Отдельного «режима цитирования» нет намеренно: панель появляется на обычное
 * выделение текста — как в любой статье. Меньше кнопок в покое, меньше экранов.
 */
export const QuoteToolbar = ({ fragments, rect, variant, onCopy, onDownload }: QuoteToolbarProps) => {
  const t = useT();
  if (fragments.length === 0) return null;

  const range = buildQuoteRange(fragments);
  const label = fragments.length > 1 ? t('quote.replicas', { count: fragments.length }) : range || t('quote.label');

  const buttons = (
    <>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary text-on-primary-fixed hover:opacity-90 transition-opacity cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5" />
        {t('quote.copy')}
      </button>
      <button
        type="button"
        onClick={onDownload}
        aria-label={t('quote.download')}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-surface-container-highest text-on-surface hover:text-primary transition-colors cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </>
  );

  if (variant === 'bar') {
    return (
      <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:hidden">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-surface-container-low border border-white/10 shadow-lg">
          <Quote className="w-4 h-4 text-primary shrink-0 ml-1" />
          <span className="text-xs text-on-surface-variant truncate flex-1">{label}</span>
          {buttons}
        </div>
      </div>
    );
  }

  // Позиционируем над выделением, не давая панели вылезти за края окна
  const top = rect ? Math.max(EDGE, rect.top - GAP) : EDGE;
  const rawLeft = rect ? rect.left + rect.width / 2 - FLOATING_WIDTH / 2 : EDGE;
  const left = Math.min(Math.max(EDGE, rawLeft), window.innerWidth - FLOATING_WIDTH - EDGE);

  return (
    <div
      className="fixed z-50 -translate-y-full hidden lg:block"
      style={{ top, left, width: FLOATING_WIDTH }}
    >
      <div className="flex items-center gap-2 p-2 rounded-2xl bg-surface-container-low border border-white/10 shadow-xl">
        <Quote className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-[11px] font-mono text-on-surface-variant truncate flex-1">{label}</span>
        {buttons}
      </div>
    </div>
  );
};
