import { useMemo, useRef, useEffect } from 'react';
import { FileText, AlignLeft, Scissors, Loader2 } from 'lucide-react';
import { parseTimestamp } from './AudioPlayer';
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
  activeTab: 'transcript' | 'keyMoments';
  onTabChange: (tab: 'transcript' | 'keyMoments') => void;
  transcriptMode: 'full' | 'condensed';
  onModeChange: (mode: 'full' | 'condensed') => void;
  onCondense: () => void;
  isCondensing: boolean;
  speakerColorMap: Record<string, string>;
  shouldColorSpeakers: boolean;
  onTimestampClick: (ts: string) => void;
}

export const TranscriptSection = ({
  recording,
  currentTime,
  activeTab,
  onTabChange,
  transcriptMode,
  onModeChange,
  onCondense,
  isCondensing,
  speakerColorMap,
  shouldColorSpeakers,
  onTimestampClick,
}: TranscriptSectionProps) => {
  // Вычисляем активный индекс реплики по текущему времени
  const activeTranscriptIndex = useMemo(() => {
    if (!recording.transcript || recording.transcript.length === 0) return -1;
    for (let i = recording.transcript.length - 1; i >= 0; i--) {
      if (currentTime >= parseTimestamp(recording.transcript[i].timestamp)) return i;
    }
    return 0;
  }, [recording.transcript, currentTime]);

  const displayTranscript = transcriptMode === 'full'
    ? recording.transcript
    : (recording.condensedTranscript ?? recording.transcript);

  // Авто-скролл к активной реплике при воспроизведении / перемотке
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastScrolledIndex = useRef(-1);

  useEffect(() => {
    if (
      transcriptMode !== 'full' ||
      activeTranscriptIndex < 0 ||
      activeTranscriptIndex === lastScrolledIndex.current
    ) return;
    lastScrolledIndex.current = activeTranscriptIndex;
    const el = itemRefs.current[activeTranscriptIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeTranscriptIndex, transcriptMode]);

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
        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:pb-8">
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
          <div className="space-y-5">
            {displayTranscript.map((item, i) => {
              const isActive = transcriptMode === 'full' && i === activeTranscriptIndex;
              const speakerColor = shouldColorSpeakers
                ? (speakerColorMap[item.speaker] ?? SPEAKER_PALETTE[1])
                : undefined;

              return (
                <div
                  key={i}
                  ref={el => { itemRefs.current[i] = el; }}
                  className={`transition-colors rounded-xl ${isActive ? 'bg-primary/5 px-3 py-2 -mx-3' : ''}`}
                >
                  <button
                    onClick={() => item.timestamp !== '--:--' && onTimestampClick(item.timestamp)}
                    className={`flex items-center gap-2 mb-1 group ${item.timestamp !== '--:--' ? 'cursor-pointer' : 'cursor-default'}`}
                    title={item.timestamp !== '--:--' ? 'Воспроизвести с этого момента' : undefined}
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
                    {item.timestamp !== '--:--' && (
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
                  <p className={`text-sm leading-[1.75] ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
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
