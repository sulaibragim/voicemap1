import { motion, AnimatePresence } from 'motion/react';
import { useT } from '../../i18n';
import { FileAudio, X } from 'lucide-react';
import type { SearchResult } from '../../lib/api';

interface SearchResultPanelProps {
  result: SearchResult | null;
  /** Открыть источник ответа на нужной секунде записи */
  onOpenSource: (recordingId: string, timestamp: string) => void;
  onClear: () => void;
}

/** Ответ поиска + источники прямо в блоке SearchHero, без модалки */
export const SearchResultPanel = ({ result, onOpenSource, onClear }: SearchResultPanelProps) => {
  const t = useT();
  return (
  <AnimatePresence>
    {result && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="mt-6 pt-6 border-t border-white/8 flex flex-col gap-4">
          <p className="text-base md:text-xl leading-relaxed text-on-surface font-medium">
            {result.answer}
          </p>

          {result.sources.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-on-surface-variant/70 mb-2">
                {t('search.sources')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.sources.map((src, idx) => (
                  <button
                    key={`${src.recordingId}-${src.timestamp}-${idx}`}
                    type="button"
                    onClick={() => onOpenSource(src.recordingId, src.timestamp)}
                    className="text-left bg-surface-container-high border border-white/5 rounded-xl p-3 flex items-start gap-3 hover:bg-surface-container-highest hover:border-primary/30 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <FileAudio className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xs font-bold text-on-surface truncate">{src.title}</p>
                        <span className="text-[11px] font-mono text-primary shrink-0">{src.timestamp}</span>
                      </div>
                      <p className="text-[11px] leading-snug text-on-surface-variant line-clamp-2 mt-1">
                        {src.snippet}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClear}
            className="self-start flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors text-xs font-bold cursor-pointer"
          >
            <X className="w-3 h-3" />
            {t('search.clear')}
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
};
