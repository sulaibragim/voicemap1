import { motion, AnimatePresence } from 'motion/react';
import { TRANSCRIPT_INDEX_ATTR, TRANSCRIPT_TEXT_ATTR } from '../../hooks/useTranscriptSelection';
import type { TranscriptItem } from '../../types';

interface TranscriptEntryProps {
  item: TranscriptItem;
  /** Порядковый номер в отрисованном списке — по нему выделение текста сопоставляется с репликой */
  index: number;
  /** Активна ли реплика прямо сейчас (по текущему времени плеера) */
  isActive: boolean;
  /** Реплика, к которой привёл голосовой поиск — подсвечивается заметнее и ненадолго */
  isSearchHighlight: boolean;
  speakerColor?: string;
  onSelect: (timestamp: string) => void;
  /** Колбэк-реф для авто-скролла — вешается родителем на корневой div */
  registerRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Одна реплика транскрипта — общая для десктопа (TranscriptSection) и мобилки
 * (RecordingMobileTabs), чтобы поведение клика/подсветки не расходилось.
 * Клик перематывает аудио на таймкод реплики и запускает воспроизведение.
 */
export const TranscriptEntry = ({ item, index, isActive, isSearchHighlight, speakerColor, onSelect, registerRef }: TranscriptEntryProps) => {
  const hasTimestamp = item.timestamp !== '--:--';

  return (
    <div
      ref={registerRef}
      {...{ [TRANSCRIPT_INDEX_ATTR]: index }}
      className={`relative rounded-xl transition-colors duration-300 ${isActive ? 'bg-primary/10 border-l-2 border-primary pl-3 pr-3 py-2 -mx-3' : ''}`}
    >
      {/* Кольцо-подсветка момента из голосового поиска — гаснет через несколько секунд или при старте плеера */}
      <AnimatePresence>
        {isSearchHighlight && (
          <motion.div
            className="absolute -inset-1 rounded-xl ring-1 ring-primary/50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => hasTimestamp && onSelect(item.timestamp)}
        disabled={!hasTimestamp}
        aria-label={hasTimestamp ? `Воспроизвести с ${item.timestamp}` : undefined}
        className={`flex items-center gap-2 mb-1 group ${hasTimestamp ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span
          className="font-bold text-xs tracking-wide uppercase"
          style={speakerColor
            ? { color: speakerColor }
            : { color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }
          }
        >
          {item.speaker}
        </span>
        {hasTimestamp && (
          <span className="text-[10px] font-mono text-on-surface-variant/40 group-hover:text-on-surface-variant transition-colors">
            {item.timestamp}
          </span>
        )}
        {item.isAppended && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-bold uppercase tracking-wider">
            дополнено
          </span>
        )}
      </button>
      {/* Маркер текста: выделение цитаты собирается только из этих абзацев,
          чтобы имя спикера и таймкод не попадали внутрь самой цитаты */}
      <p
        {...{ [TRANSCRIPT_TEXT_ATTR]: '' }}
        className={`text-sm leading-[1.75] ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}
      >
        {item.text}
      </p>
    </div>
  );
};
