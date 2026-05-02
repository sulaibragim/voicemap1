import type * as React from 'react';
import { Loader2, Scissors, AlignLeft } from 'lucide-react';
import { AudioPlayer, parseTimestamp } from './AudioPlayer';
import { SPEAKER_PALETTE } from './TranscriptSection';
import { AppendAudioPlayer } from './AppendAudioPlayer';
import { RecordingMobileSummaryTab } from './RecordingMobileSummaryTab';
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
}: RecordingMobileTabsProps) => {
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
        className="flex-1 min-h-0 overflow-y-auto"
        onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const delta = e.changedTouches[0].clientX - touchStartXRef.current;
          const tabs = ['summary', 'transcript', 'audio'] as const;
          const idx = tabs.indexOf(mobileTab);
          if (delta < -50 && idx < 2) setMobileTab(tabs[idx + 1]);
          if (delta > 50 && idx > 0) setMobileTab(tabs[idx - 1]);
        }}
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
                {(transcriptMode === 'full' ? recording.transcript : (recording.condensedTranscript ?? recording.transcript)).map((item, i) => {
                  const activeIdx = (() => {
                    if (!recording.transcript.length) return -1;
                    for (let j = recording.transcript.length - 1; j >= 0; j--) {
                      if (currentTime >= parseTimestamp(recording.transcript[j].timestamp)) return j;
                    }
                    return 0;
                  })();
                  const isActive = transcriptMode === 'full' && i === activeIdx;
                  const speakerColor = shouldColorSpeakers ? (speakerColorMap[item.speaker] ?? SPEAKER_PALETTE[1]) : undefined;
                  return (
                    <div key={i} className={`transition-colors rounded-xl ${isActive ? 'bg-primary/5 px-3 py-2 -mx-3' : ''}`}>
                      <button onClick={() => item.timestamp !== '--:--' && handleTimestampClick(item.timestamp)} className={`flex items-center gap-2 mb-1 ${item.timestamp !== '--:--' ? 'cursor-pointer' : 'cursor-default'}`}>
                        <span className="font-bold text-xs tracking-wide uppercase" style={speakerColor ? { color: speakerColor } : { color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>{item.speaker}</span>
                        {item.timestamp !== '--:--' && <span className="text-[10px] font-mono text-on-surface-variant/40">{item.timestamp}</span>}
                        {item.isAppended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-bold uppercase">дополнено</span>}
                      </button>
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>{item.text}</p>
                    </div>
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
