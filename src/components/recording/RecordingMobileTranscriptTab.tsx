import { Scissors, AlignLeft, Loader2 } from 'lucide-react';
import { SPEAKER_PALETTE } from './TranscriptSection';
import { TranscriptEntry } from './TranscriptEntry';
import type { Recording } from '../../types';

interface RecordingMobileTranscriptTabProps {
  recording: Recording;
  activeTab: 'transcript' | 'keyMoments';
  setActiveTab: (tab: 'transcript' | 'keyMoments') => void;
  transcriptMode: 'full' | 'condensed';
  setTranscriptMode: (mode: 'full' | 'condensed') => void;
  isCondensing: boolean;
  handleCondense: () => void;
  handleTimestampClick: (ts: string) => void;
  speakerColorMap: Record<string, string>;
  shouldColorSpeakers: boolean;
  activeTranscriptIndex: number;
  /** Индекс реплики, к которой привёл голосовой поиск — подсвечивается заметнее обычной активной */
  highlightIndex?: number | null;
  registerItemRef: (index: number) => (el: HTMLDivElement | null) => void;
}

// Вкладка "Транскрипт" мобильного просмотра записи — вынесена из RecordingMobileTabs,
// чтобы не раздувать родительский файл (лимит 200 строк на компонент)
export const RecordingMobileTranscriptTab = ({
  recording,
  activeTab,
  setActiveTab,
  transcriptMode,
  setTranscriptMode,
  isCondensing,
  handleCondense,
  handleTimestampClick,
  speakerColorMap,
  shouldColorSpeakers,
  activeTranscriptIndex,
  highlightIndex,
  registerItemRef,
}: RecordingMobileTranscriptTabProps) => {
  const displayTranscript = transcriptMode === 'full' ? recording.transcript : (recording.condensedTranscript ?? recording.transcript);

  return (
    <div className="p-4 pb-32">
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold">
          <button onClick={() => setTranscriptMode('full')} className={`px-3 py-1.5 rounded transition-colors ${transcriptMode === 'full' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}><AlignLeft className="w-3 h-3 inline mr-1" />Полная</button>
          <button onClick={handleCondense} disabled={isCondensing} className={`px-3 py-1.5 rounded transition-colors disabled:opacity-60 ${transcriptMode === 'condensed' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>{isCondensing ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : <Scissors className="w-3 h-3 inline mr-1" />}Краткая</button>
        </div>
        <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold ml-auto">
          <button onClick={() => setActiveTab('transcript')} className={`px-3 py-1.5 rounded transition-colors ${activeTab === 'transcript' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>Текст</button>
          <button onClick={() => setActiveTab('keyMoments')} className={`px-3 py-1.5 rounded transition-colors ${activeTab === 'keyMoments' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>Моменты</button>
        </div>
      </div>
      {activeTab === 'transcript' ? (
        <div className="space-y-4">
          {displayTranscript.map((item, i) => {
            const isActive = transcriptMode === 'full' && i === activeTranscriptIndex;
            const speakerColor = shouldColorSpeakers ? (speakerColorMap[item.speaker] ?? SPEAKER_PALETTE[1]) : undefined;
            return (
              <TranscriptEntry
                key={i}
                item={item}
                isActive={isActive}
                isSearchHighlight={transcriptMode === 'full' && i === highlightIndex}
                speakerColor={speakerColor}
                onSelect={handleTimestampClick}
                registerRef={registerItemRef(i)}
              />
            );
          })}
        </div>
      ) : (
        <ul className="space-y-3">{(recording.keyMoments || []).map((moment, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />{moment}
          </li>
        ))}</ul>
      )}
    </div>
  );
};
