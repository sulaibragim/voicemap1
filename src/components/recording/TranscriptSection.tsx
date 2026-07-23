import { FileText, AlignLeft, Scissors, Loader2 } from 'lucide-react';
import { TranscriptEntry } from './TranscriptEntry';
import { QuoteToolbar } from './QuoteToolbar';
import { useActiveTranscriptIndex } from '../../hooks/useActiveTranscriptIndex';
import { useTranscriptAutoScroll } from '../../hooks/useTranscriptAutoScroll';
import { useQuoteExport } from '../../hooks/useQuoteExport';
import type { Recording } from '../../types';

// Палитра цветов спикеров — используется также в RecordingDetail
// eslint-disable-next-line react-refresh/only-export-components
export const SPEAKER_PALETTE = [
  '#7B61FF', // primary — всегда для "Я"
  '#4FC3F7', // голубой
  '#81C784', // зелёный
  '#FFB74D', // янтарный
  '#F06292', // розовый
  '#4DB6AC', // бирюзовый
  '#CE93D8', // лиловый
  '#FF8A65', // коралловый
];

interface TranscriptSectionProps {
  recording: Recording;
  currentTime: number;
  isPlaying: boolean;
  activeTab: 'transcript' | 'keyMoments';
  onTabChange: (tab: 'transcript' | 'keyMoments') => void;
  transcriptMode: 'full' | 'condensed';
  onModeChange: (mode: 'full' | 'condensed') => void;
  onCondense: () => void;
  isCondensing: boolean;
  speakerColorMap: Record<string, string>;
  shouldColorSpeakers: boolean;
  onTimestampClick: (ts: string) => void;
  /** Индекс реплики, к которой привёл голосовой поиск — подсвечивается заметнее обычной активной */
  highlightIndex?: number | null;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TranscriptSection = ({
  recording,
  currentTime,
  isPlaying,
  activeTab,
  onTabChange,
  transcriptMode,
  onModeChange,
  onCondense,
  isCondensing,
  speakerColorMap,
  shouldColorSpeakers,
  onTimestampClick,
  highlightIndex,
  showToast,
}: TranscriptSectionProps) => {
  // Вычисляем активный индекс реплики по текущему времени
  const activeTranscriptIndex = useActiveTranscriptIndex(recording.transcript, currentTime);

  const displayTranscript = transcriptMode === 'full'
    ? recording.transcript
    : (recording.condensedTranscript ?? recording.transcript);

  // Цитаты собираются из ОТРИСОВАННОГО списка: в кратком режиме индексы
  // выделения относятся к condensedTranscript, а не к полному транскрипту.
  const {
    containerRef: quoteContainerRef,
    selection: quoteSelection,
    handleCopy: handleCopyQuote,
    handleDownload: handleDownloadQuote,
  } = useQuoteExport({
    transcript: displayTranscript,
    title: recording.title,
    date: recording.date,
    showToast,
  });

  // Авто-скролл к активной реплике при воспроизведении + прокрутка к реплике из поиска.
  // Список активен только в полном режиме транскрипта и на самой вкладке "Текст".
  const { containerRef, registerItemRef, handleContainerScroll } = useTranscriptAutoScroll({
    activeIndex: activeTranscriptIndex,
    highlightIndex,
    isPlaying,
    enabled: transcriptMode === 'full' && activeTab === 'transcript',
  });

  return (
    <div className="hidden lg:flex lg:col-span-7 bg-surface-container p-4 md:p-6 rounded-2xl md:rounded-[32px] border border-white/5 flex-col lg:h-full">
      {/* Заголовок с переключателями */}
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <h2 className="font-headline text-lg md:text-2xl font-bold">Транскрипт</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Переключатель полный/краткий — только на табе транскрипта */}
          {activeTab === 'transcript' && (
            <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold">
              <button
                onClick={() => onModeChange('full')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${transcriptMode === 'full' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}
              >
                <AlignLeft className="w-3 h-3" />
                Полная
              </button>
              <button
                onClick={onCondense}
                disabled={isCondensing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors disabled:opacity-60 ${transcriptMode === 'condensed' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}
              >
                {isCondensing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                Краткая
              </button>
            </div>
          )}
          {/* Переключатель текст/моменты */}
          <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold">
            <button
              onClick={() => onTabChange('transcript')}
              className={`px-4 py-1.5 rounded transition-colors ${activeTab === 'transcript' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}
            >
              Текст
            </button>
            <button
              onClick={() => onTabChange('keyMoments')}
              className={`px-4 py-1.5 rounded transition-colors ${activeTab === 'keyMoments' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}
            >
              Ключевые моменты
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'transcript' ? (
        <div ref={containerRef} onScroll={handleContainerScroll} className="lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:pb-8">
          {/* Бейдж краткого режима */}
          {transcriptMode === 'condensed' && (
            <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-secondary/10 border border-secondary/20 rounded-xl text-xs text-secondary font-bold">
              <Scissors className="w-3.5 h-3.5" />
              Краткая версия — вода и повторы убраны, только суть
              {recording.condensedTranscript && (
                <span className="ml-auto text-on-surface-variant font-normal">
                  {recording.transcript.length} → {recording.condensedTranscript.length} реплик
                </span>
              )}
            </div>
          )}
          <div ref={quoteContainerRef} className="space-y-5">
            {displayTranscript.map((item, i) => {
              const isActive = transcriptMode === 'full' && i === activeTranscriptIndex;
              const speakerColor = shouldColorSpeakers
                ? (speakerColorMap[item.speaker] ?? SPEAKER_PALETTE[1])
                : undefined;

              return (
                <TranscriptEntry
                  key={i}
                  item={item}
                  index={i}
                  isActive={isActive}
                  isSearchHighlight={transcriptMode === 'full' && i === highlightIndex}
                  speakerColor={speakerColor}
                  onSelect={onTimestampClick}
                  registerRef={registerItemRef(i)}
                />
              );
            })}
          </div>
          <QuoteToolbar
            fragments={quoteSelection.fragments}
            rect={quoteSelection.rect}
            variant="floating"
            onCopy={handleCopyQuote}
            onDownload={handleDownloadQuote}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-4 pb-8 space-y-4">
          {recording.keyMoments && recording.keyMoments.length > 0 ? (
            <ul className="space-y-4">
              {recording.keyMoments.map((moment, i) => (
                <li key={i} className="flex items-start gap-3 text-sm md:text-base text-on-surface-variant bg-surface-container-high p-3 md:p-4 rounded-2xl border border-white/5">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="leading-relaxed">{moment}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-20 text-on-surface-variant">
              <p>Ключевые моменты не найдены.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
