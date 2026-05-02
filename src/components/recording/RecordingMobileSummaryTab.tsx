import { Loader2, RefreshCw, Pencil } from 'lucide-react';
import { ActionItemsSection } from './ActionItemsSection';
import type { Recording } from '../../types';

interface RecordingMobileSummaryTabProps {
  recording: Recording;
  isRetranscribing: boolean;
  handleRetranscribe: () => void;
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
}

export const RecordingMobileSummaryTab = ({
  recording,
  isRetranscribing,
  handleRetranscribe,
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
}: RecordingMobileSummaryTabProps) => {
  return (
    <div className="p-4 space-y-4 pb-32">
      {/* Баннер: транскрипция не была создана — мобилка */}
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
      <div>
        <p className="text-xs text-on-surface-variant mb-1.5">
          {recording.date} · {recording.duration}
          {(recording.actionItems?.length ?? 0) > 0 && <> · <span className="text-secondary">{recording.actionItems!.length} задач</span></>}
          {(recording.ideas?.length ?? 0) > 0 && <> · {recording.ideas!.length} идей</>}
        </p>
        {recording.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recording.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}
      </div>
      {recording.mood && (
        <div><p className="text-xs font-bold text-on-surface-variant mb-1">✨ Настроение</p>
          <span className="px-3 py-1 bg-surface-container rounded-xl text-sm font-bold text-primary">{recording.mood}</span>
        </div>
      )}
      {recording.mentions && recording.mentions.length > 0 && (
        <div><p className="text-xs font-bold text-on-surface-variant mb-1">Упоминания</p>
          <div className="flex flex-wrap gap-1.5">{recording.mentions.map((m, i) => <span key={i} className="px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full text-xs font-bold">{m}</span>)}</div>
        </div>
      )}
      <div><p className="text-xs font-bold text-on-surface-variant mb-1">Краткое содержание</p>
        <p className="text-sm text-on-surface-variant leading-relaxed">{recording.summary}</p>
      </div>
      {recording.ideas && recording.ideas.length > 0 && (
        <div><p className="text-xs font-bold text-primary mb-2">💡 Идеи и инсайты</p>
          <ul className="space-y-1.5">{recording.ideas.map((idea, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />{idea}
            </li>
          ))}</ul>
        </div>
      )}
      <ActionItemsSection
        items={recording.actionItems || []}
        richItems={recording.richActionItems}
        onUpdateRichItems={(items) => onUpdate({ ...recording, richActionItems: items })}
        done={recording.actionItemsDone}
        onUpdate={(items) => onUpdate({ ...recording, actionItems: items })}
        onToggleDone={(idx) => {
          const cur = recording.actionItemsDone || new Array(recording.actionItems?.length ?? 0).fill(false);
          const next = [...cur]; while (next.length < (recording.actionItems?.length ?? 0)) next.push(false);
          next[idx] = !next[idx]; onUpdate({ ...recording, actionItemsDone: next });
        }}
        showToast={showToast}
        taskReminders={recording.taskReminders}
        onSetReminder={handleSetReminder}
      />
      {recording.openQuestions && recording.openQuestions.length > 0 && (
        <div><p className="text-xs font-bold text-amber-400 mb-2">❓ Открытые вопросы</p>
          <ul className="space-y-1.5">{recording.openQuestions.map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />{q}
            </li>
          ))}</ul>
        </div>
      )}
      {recording.bigQuestions && recording.bigQuestions.length > 0 && (
        <div><p className="text-xs font-bold mb-2" style={{ color: 'var(--color-tertiary)' }}>🎯 Большие вопросы</p>
          <ul className="space-y-1.5">{recording.bigQuestions.map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl border-l-2 border-tertiary/40">
              {q}
            </li>
          ))}</ul>
        </div>
      )}
      {/* Участники — мобилка */}
      {uniqueSpeakers.length > 1 && (
        <div>
          <p className="text-xs font-bold text-on-surface-variant mb-2">👥 Участники</p>
          <div className="flex flex-wrap gap-2">
            {uniqueSpeakers.map(speaker => {
              const detected = recording.participants?.find(p => p.speakerLabel === speaker);
              const displayName = detected?.name && !detected.name.startsWith('Участник') && !detected.name.startsWith('Speaker') ? detected.name : speaker;
              return editingMobileSpeaker === speaker ? (
                <input
                  key={speaker}
                  autoFocus
                  value={editingMobileSpeakerName}
                  onChange={e => setEditingMobileSpeakerName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleMobileRenameSpeaker(speaker, editingMobileSpeakerName);
                    if (e.key === 'Escape') setEditingMobileSpeaker(null);
                  }}
                  onBlur={() => handleMobileRenameSpeaker(speaker, editingMobileSpeakerName)}
                  className="bg-surface-container border border-secondary/50 rounded-lg px-2.5 py-1 text-xs w-28 outline-none text-white"
                />
              ) : (
                <button
                  key={speaker}
                  onClick={() => { setEditingMobileSpeaker(speaker); setEditingMobileSpeakerName(displayName); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold hover:bg-surface-container-highest transition-colors cursor-pointer"
                  style={shouldColorSpeakers ? { color: speakerColorMap[speaker] } : {}}
                >
                  {displayName}
                  <Pencil className="w-2.5 h-2.5 opacity-40" />
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-on-surface-variant/40 mt-1">Нажмите на имя чтобы переименовать</p>
        </div>
      )}
    </div>
  );
};