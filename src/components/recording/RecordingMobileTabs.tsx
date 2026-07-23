import type * as React from 'react';
import { AudioPlayer } from './AudioPlayer';
import { AppendAudioPlayer } from './AppendAudioPlayer';
import { RecordingMobileSummaryTab } from './RecordingMobileSummaryTab';
import { RecordingMobileTranscriptTab } from './RecordingMobileTranscriptTab';
import { useActiveTranscriptIndex } from '../../hooks/useActiveTranscriptIndex';
import { useTranscriptAutoScroll } from '../../hooks/useTranscriptAutoScroll';
import type { Recording } from '../../types';

interface RecordingMobileTabsProps {
  recording: Recording;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  mobileTab: 'summary' | 'transcript' | 'audio';
  setMobileTab: (tab: 'summary' | 'transcript' | 'audio') => void;
  activeTab: 'transcript' | 'keyMoments';
  setActiveTab: (tab: 'transcript' | 'keyMoments') => void;
  transcriptMode: 'full' | 'condensed';
  setTranscriptMode: (mode: 'full' | 'condensed') => void;
  isCondensing: boolean;
  isRetranscribing: boolean;
  handleCondense: () => void;
  handleRetranscribe: () => void;
  handleTimestampClick: (ts: string) => void;
  handleSeek: (time: number) => void;
  togglePlay: () => void;
  uniqueSpeakers: string[];
  speakerColorMap: Record<string, string>;
  shouldColorSpeakers: boolean;
  editingMobileSpeaker: string | null;
  editingMobileSpeakerName: string;
  setEditingMobileSpeaker: (s: string | null) => void;
  setEditingMobileSpeakerName: (s: string) => void;
  handleMobileRenameSpeaker: (oldName: string, newName: string) => void;
  onUpdate: (r: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  handleSetReminder: (idx: number, date: string, time: string) => void;
  keyMomentMarkers: { timestamp: string; label: string }[];
  appendBoundaryTimestamp: number | null;
  touchStartXRef: React.RefObject<number>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Индекс реплики, к которой привёл голосовой поиск — подсвечивается заметнее обычной активной */
  highlightIndex?: number | null;
}

export const RecordingMobileTabs = ({
  recording,
  currentTime,
  duration,
  isPlaying,
  mobileTab,
  setMobileTab,
  activeTab,
  setActiveTab,
  transcriptMode,
  setTranscriptMode,
  isCondensing,
  isRetranscribing,
  handleCondense,
  handleRetranscribe,
  handleTimestampClick,
  handleSeek,
  togglePlay,
  uniqueSpeakers,
  speakerColorMap,
  shouldColorSpeakers,
  editingMobileSpeaker,
  editingMobileSpeakerName,
  setEditingMobileSpeaker,
  setEditingMobileSpeakerName,
  handleMobileRenameSpeaker,
  onUpdate,
  showToast,
  handleSetReminder,
  keyMomentMarkers,
  appendBoundaryTimestamp,
  touchStartXRef,
  audioRef,
  highlightIndex,
}: RecordingMobileTabsProps) => {
  // Активная реплика + автоскролл — та же логика, что и на десктопе (общий хук)
  const activeTranscriptIndex = useActiveTranscriptIndex(recording.transcript, currentTime);
  const { containerRef, registerItemRef, handleContainerScroll } = useTranscriptAutoScroll({
    activeIndex: activeTranscriptIndex,
    highlightIndex,
    isPlaying,
    enabled: transcriptMode === 'full' && activeTab === 'transcript' && mobileTab === 'transcript',
  });

  return (
    <div className="lg:hidden flex flex-col flex-1 min-h-0">

      {/* Компактный плеер — всегда виден */}
      <AudioPlayer
        audioRef={audioRef}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        recordingDuration={recording.duration}
        hasAudioUrl={!!recording.audioUrl}
        transcript={recording.transcript}
        keyMomentMarkers={keyMomentMarkers}
        appendBoundaryTimestamp={appendBoundaryTimestamp}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        onTimestampClick={handleTimestampClick}
        variant="compact"
      />

      {/* Таб-бар */}
      <div className="flex border-b border-white/5 shrink-0 bg-surface-container-low">
        {(['summary', 'transcript', 'audio'] as const).map((tab, i) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${mobileTab === tab ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'}`}
          >
            {['Саммари', 'Транскрипт', 'Аудио'][i]}
          </button>
        ))}
      </div>

      {/* Содержимое со свайпом */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const delta = e.changedTouches[0].clientX - touchStartXRef.current;
          const tabs = ['summary', 'transcript', 'audio'] as const;
          const idx = tabs.indexOf(mobileTab);
          if (delta < -50 && idx < 2) setMobileTab(tabs[idx + 1]);
          if (delta > 50 && idx > 0) setMobileTab(tabs[idx - 1]);
        }}
        onScroll={handleContainerScroll}
      >
        {/* Таб: Саммари */}
        {mobileTab === 'summary' && (
          <RecordingMobileSummaryTab
            recording={recording}
            isRetranscribing={isRetranscribing}
            handleRetranscribe={handleRetranscribe}
            uniqueSpeakers={uniqueSpeakers}
            speakerColorMap={speakerColorMap}
            shouldColorSpeakers={shouldColorSpeakers}
            editingMobileSpeaker={editingMobileSpeaker}
            editingMobileSpeakerName={editingMobileSpeakerName}
            setEditingMobileSpeaker={setEditingMobileSpeaker}
            setEditingMobileSpeakerName={setEditingMobileSpeakerName}
            handleMobileRenameSpeaker={handleMobileRenameSpeaker}
            onUpdate={onUpdate}
            showToast={showToast}
            handleSetReminder={handleSetReminder}
          />
        )}

        {/* Таб: Транскрипт */}
        {mobileTab === 'transcript' && (
          <RecordingMobileTranscriptTab
            recording={recording}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            transcriptMode={transcriptMode}
            setTranscriptMode={setTranscriptMode}
            isCondensing={isCondensing}
            handleCondense={handleCondense}
            handleTimestampClick={handleTimestampClick}
            speakerColorMap={speakerColorMap}
            shouldColorSpeakers={shouldColorSpeakers}
            activeTranscriptIndex={activeTranscriptIndex}
            highlightIndex={highlightIndex}
            registerItemRef={registerItemRef}
          />
        )}

        {/* Таб: Аудио */}
        {mobileTab === 'audio' && (
          <div className="p-4 space-y-3 pb-32">
            {recording.appendAudios && recording.appendAudios.length > 0 ? (
              recording.appendAudios.map((ap, idx) => <AppendAudioPlayer key={idx} url={ap.url} label={ap.label} addedAt={ap.addedAt} />)
            ) : (
              <div className="text-center py-20 text-on-surface-variant">
                <p className="text-sm">Дополнительных аудио нет</p>
                <p className="text-xs mt-1 opacity-60">Нажми «Дополнить → Аудио» чтобы добавить</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
