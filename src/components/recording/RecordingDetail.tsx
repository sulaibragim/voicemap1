import { useRef, useState, useEffect, useMemo } from 'react';
import { useRecordingAudio } from '../../hooks/useRecordingAudio';
import { condenseTranscript } from '../../lib/api';
import { Loader2, RefreshCw } from 'lucide-react';
import { RecordingDetailHeader } from './RecordingDetailHeader';
import { AppendPanel } from './AppendPanel';
import { AudioPlayer, parseTimestamp } from './AudioPlayer';
import { SummarySection } from './SummarySection';
import { TranscriptSection, SPEAKER_PALETTE } from './TranscriptSection';
import { AppendAudioPlayer } from './AppendAudioPlayer';
import { RecordingMobileTabs } from './RecordingMobileTabs';
import { MobileActionSheet } from './MobileActionSheet';
import { findRelated } from '../../lib/recordingUtils';
import type { Recording } from '../../types';
import { useRecordingExport } from '../../hooks/useRecordingExport';

interface RecordingDetailProps {
  recording: Recording;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: (r: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  allRecordings?: Recording[];
  onOpenRecording?: (id: string) => void;
  onRetranscribe?: () => Promise<void>;
}


export const RecordingDetail = ({ recording, onBack, onDelete, onUpdate, showToast, allRecordings = [], onOpenRecording, onRetranscribe }: RecordingDetailProps) => {
  const { audioRef, isPlaying, setIsPlaying, currentTime, duration, togglePlay, handleSeek } = useRecordingAudio();
  const [activeTab, setActiveTab] = useState<'transcript' | 'keyMoments'>('transcript');
  const [transcriptMode, setTranscriptMode] = useState<'full' | 'condensed'>('full');
  const [isCondensing, setIsCondensing] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<'summary' | 'transcript' | 'audio'>('summary');

  const { showExportMenu, setShowExportMenu, exportMenuRef, handleShare, handleExport, handleCopySummary, handleCopyTranscript, handleExportPDF, handleTelegram } = useRecordingExport({ recording, showToast });
  const touchStartXRef = useRef<number>(0);

  // Редактирование названия
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(recording.title);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setEditTitleValue(recording.title); }, [recording.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Переименование спикеров (мобилка)
  const [editingMobileSpeaker, setEditingMobileSpeaker] = useState<string | null>(null);
  const [editingMobileSpeakerName, setEditingMobileSpeakerName] = useState('');
  const handleMobileRenameSpeaker = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingMobileSpeaker(null);
    if (!trimmed || trimmed === oldName) return;
    const newTranscript = recording.transcript.map(item => item.speaker === oldName ? { ...item, speaker: trimmed } : item);
    const newCondensed = recording.condensedTranscript?.map(item => item.speaker === oldName ? { ...item, speaker: trimmed } : item);
    onUpdate({ ...recording, transcript: newTranscript, condensedTranscript: newCondensed, speakerNames: { ...(recording.speakerNames || {}), [oldName]: trimmed } });
    showToast(`${oldName} → ${trimmed}`, 'success');
  };

  // Редактирование тегов
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const handleTimestampClick = (timestamp: string) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseTimestamp(timestamp);
      if (!isPlaying) { audioRef.current.play(); setIsPlaying(true); }
    }
  };

  const handleTitleSave = () => {
    const trimmed = editTitleValue.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === recording.title) return;
    onUpdate({ ...recording, title: trimmed });
    showToast('Название обновлено', 'success');
  };

  const handleAddTag = () => {
    const trimmed = newTagValue.trim().toLowerCase();
    setIsAddingTag(false);
    setNewTagValue('');
    if (!trimmed || recording.tags.includes(trimmed)) return;
    onUpdate({ ...recording, tags: [...recording.tags, trimmed] });
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate({ ...recording, tags: recording.tags.filter(t => t !== tag) });
  };

  const handleSetReminder = (idx: number, date: string, time: string) => {
    const reminders = { ...(recording.taskReminders ?? {}) };
    reminders[idx] = { date, time, notified: false };
    onUpdate({ ...recording, taskReminders: reminders });
    showToast(`Напоминание установлено на ${date} в ${time}`, 'success');
  };

  const handleCondense = async () => {
    if (recording.condensedTranscript) { setTranscriptMode('condensed'); return; }
    if (recording.transcript.length === 0) return;
    setIsCondensing(true);
    try {
      const result = await condenseTranscript(recording.transcript);
      onUpdate({ ...recording, condensedTranscript: result });
      setTranscriptMode('condensed');
      showToast('Краткий транскрипт готов', 'success');
    } catch {
      showToast('Не удалось сократить транскрипт', 'error');
    } finally {
      setIsCondensing(false);
    }
  };

  // Повторный запуск транскрипции для записей без саммари/транскрипта
  const handleRetranscribe = async () => {
    if (!onRetranscribe) return;
    setIsRetranscribing(true);
    try {
      await onRetranscribe();
    } finally {
      setIsRetranscribing(false);
    }
  };

  // Проверка напоминаний каждые 30 секунд
  useEffect(() => {
    const check = () => {
      const reminders = recording.taskReminders;
      if (!reminders) return;
      const now = new Date();
      let updated = false;
      const next = { ...reminders };
      Object.entries(reminders).forEach(([key, reminder]) => {
        if (reminder.notified) return;
        const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
        if (reminderTime <= now) {
          const idx = Number(key);
          const taskText = recording.actionItems?.[idx] ?? 'Задача';
          showToast(`Напоминание: ${taskText}`, 'info');
          next[idx] = { ...reminder, notified: true };
          updated = true;
        }
      });
      if (updated) onUpdate({ ...recording, taskReminders: next });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  // onUpdate/showToast/recording — намеренно не в депах: только taskReminders/actionItems важны для перезапуска
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.taskReminders, recording.actionItems]);

  // Вычисления для плеера и транскрипта
  const keyMomentMarkers = useMemo(() => {
    if (!recording.keyMoments?.length || !recording.transcript?.length) return [];
    return recording.keyMoments.map(moment => {
      const momentWords = new Set(moment.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      let bestIdx = 0; let bestScore = 0;
      recording.transcript.forEach((item, idx) => {
        const score = item.text.toLowerCase().split(/\s+/).filter(w => momentWords.has(w)).length;
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      });
      return { timestamp: recording.transcript[bestIdx].timestamp, label: moment };
    });
  }, [recording.keyMoments, recording.transcript]);

  const appendBoundaryTimestamp = useMemo(() => {
    const first = recording.transcript.find(t => t.isAppended && t.timestamp !== '--:--');
    return first ? parseTimestamp(first.timestamp) : null;
  }, [recording.transcript]);

  const uniqueSpeakers = useMemo(() =>
    [...new Set(recording.transcript.map(t => t.speaker))],
    [recording.transcript]
  );

  const shouldColorSpeakers = uniqueSpeakers.length >= 2;

  const speakerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 1;
    uniqueSpeakers.forEach(speaker => {
      if (speaker === 'Я' || speaker === 'I' || speaker === 'Me') {
        map[speaker] = SPEAKER_PALETTE[0];
      } else {
        map[speaker] = SPEAKER_PALETTE[idx % SPEAKER_PALETTE.length];
        idx++;
      }
    });
    return map;
  }, [uniqueSpeakers]);

  const relatedRecordings = useMemo(() => findRelated(recording, allRecordings), [recording, allRecordings]);

  return (
    <div className="h-dvh overflow-hidden bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <RecordingDetailHeader
        recording={recording}
        onBack={onBack}
        isEditingTitle={isEditingTitle}
        setIsEditingTitle={setIsEditingTitle}
        editTitleValue={editTitleValue}
        setEditTitleValue={setEditTitleValue}
        handleTitleSave={handleTitleSave}
        isAddingTag={isAddingTag}
        setIsAddingTag={setIsAddingTag}
        newTagValue={newTagValue}
        setNewTagValue={setNewTagValue}
        handleAddTag={handleAddTag}
        handleRemoveTag={handleRemoveTag}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        exportMenuRef={exportMenuRef}
        handleShare={handleShare}
        handleCopySummary={handleCopySummary}
        handleCopyTranscript={handleCopyTranscript}
        handleExportPDF={handleExportPDF}
        handleExport={handleExport}
        handleTelegram={handleTelegram}
        setShowMobileMenu={setShowMobileMenu}
        setShowDeleteConfirm={setShowDeleteConfirm}
      />

      {/* Аудио-элемент — всегда присутствует */}
      {recording.audioUrl && <audio ref={audioRef} src={recording.audioUrl} className="hidden" />}

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-1 lg:items-stretch lg:gap-6 lg:p-8 lg:max-w-[1440px] lg:mx-auto lg:w-full">

        {/* ===== МОБИЛЬНЫЙ LAYOUT (скрыт на lg+) ===== */}
        <RecordingMobileTabs
          recording={recording}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          transcriptMode={transcriptMode}
          setTranscriptMode={setTranscriptMode}
          isCondensing={isCondensing}
          isRetranscribing={isRetranscribing}
          handleCondense={handleCondense}
          handleRetranscribe={handleRetranscribe}
          handleTimestampClick={handleTimestampClick}
          handleSeek={handleSeek}
          togglePlay={togglePlay}
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
          keyMomentMarkers={keyMomentMarkers}
          appendBoundaryTimestamp={appendBoundaryTimestamp}
          touchStartXRef={touchStartXRef}
          audioRef={audioRef}
        />

        {/* ===== ДЕСКТОП: ЛЕВАЯ КОЛОНКА (скрыта на мобилке) ===== */}
        <div className="hidden lg:block lg:col-span-5 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-8">
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
            variant="full"
          />

          {/* Дополненные аудиозаписи */}
          {recording.appendAudios && recording.appendAudios.length > 0 && (
            <div className="space-y-3 max-h-48 overflow-y-auto lg:max-h-none">
              {recording.appendAudios.map((ap, idx) => (
                <AppendAudioPlayer key={idx} url={ap.url} label={ap.label} addedAt={ap.addedAt} />
              ))}
            </div>
          )}

          {/* Баннер: транскрипция не была создана */}
          {!recording.summary && !recording.transcript?.length && recording.audioUrl && (
            <div className="bg-surface-container border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">Транскрипция не была создана</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Аудио сохранено — можно запустить повторно</p>
                </div>
              </div>
              <button
                onClick={handleRetranscribe}
                disabled={isRetranscribing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {isRetranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isRetranscribing ? 'Обработка...' : 'Повторить'}
              </button>
            </div>
          )}

          <SummarySection
            recording={recording}
            onUpdate={onUpdate}
            showToast={showToast}
            relatedRecordings={relatedRecordings}
            onOpenRecording={onOpenRecording}
            uniqueSpeakers={uniqueSpeakers}
            speakerColorMap={speakerColorMap}
            shouldColorSpeakers={shouldColorSpeakers}
            handleSetReminder={handleSetReminder}
          />
        </div>

        {/* ===== ДЕСКТОП: ПРАВАЯ КОЛОНКА (скрыта на мобилке) ===== */}
        <TranscriptSection
          recording={recording}
          currentTime={currentTime}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          transcriptMode={transcriptMode}
          onModeChange={setTranscriptMode}
          onCondense={handleCondense}
          isCondensing={isCondensing}
          speakerColorMap={speakerColorMap}
          shouldColorSpeakers={shouldColorSpeakers}
          onTimestampClick={handleTimestampClick}
        />
      </main>

      {/* Мобильный bottom sheet с действиями */}
      {showMobileMenu && (
        <MobileActionSheet
          onClose={() => setShowMobileMenu(false)}
          onAppend={() => { setIsAppending(true); setShowMobileMenu(false); }}
          onShare={() => { handleShare(); setShowMobileMenu(false); }}
          onCopySummary={() => { handleCopySummary(); setShowMobileMenu(false); }}
          onCopyTranscript={() => { handleCopyTranscript(); setShowMobileMenu(false); }}
          onExportPDF={() => { handleExportPDF(); setShowMobileMenu(false); }}
          onExportTXT={() => { handleExport(); setShowMobileMenu(false); }}
          onTelegram={() => { handleTelegram(); setShowMobileMenu(false); }}
          onDelete={() => { setShowMobileMenu(false); setShowDeleteConfirm(true); }}
        />
      )}

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-container p-6 rounded-2xl border border-white/10 max-w-sm mx-4 w-full">
            <p className="font-headline font-bold text-lg mb-2">Удалить запись?</p>
            <p className="text-sm text-on-surface-variant mb-6">Это действие нельзя отменить.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-surface-container-high rounded-xl text-sm font-bold hover:bg-surface-container-highest transition-colors cursor-pointer">
                Отмена
              </button>
              <button onClick={onDelete} className="flex-1 py-2 bg-error/20 text-error rounded-xl text-sm font-bold hover:bg-error/30 transition-colors cursor-pointer">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Панель дополнения */}
      <AppendPanel
        recording={recording}
        isAppending={isAppending}
        onOpen={() => setIsAppending(true)}
        onClose={() => setIsAppending(false)}
        onUpdate={onUpdate}
        showToast={showToast}
      />
    </div>
  );
};
