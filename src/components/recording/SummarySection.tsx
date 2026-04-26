import { useState } from 'react';
import { Brain, Target, HelpCircle, Link2, Users, ChevronRight, Pencil } from 'lucide-react';
import { ActionItemsSection } from './ActionItemsSection';
import type { Recording } from '../../types';

interface SummarySectionProps {
  recording: Recording;
  onUpdate: (r: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  relatedRecordings: Array<{ rec: Recording; reason: string }>;
  onOpenRecording?: (id: string) => void;
  uniqueSpeakers: string[];
  speakerColorMap: Record<string, string>;
  shouldColorSpeakers: boolean;
  handleSetReminder: (idx: number, date: string, time: string) => void;
}

export const SummarySection = ({
  recording,
  onUpdate,
  showToast,
  relatedRecordings,
  onOpenRecording,
  uniqueSpeakers,
  speakerColorMap,
  shouldColorSpeakers,
  handleSetReminder,
}: SummarySectionProps) => {
  // Состояние для переименования спикеров — живёт внутри этой секции
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingSpeakerName, setEditingSpeakerName] = useState('');

  const renameSpeaker = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingSpeaker(null);
    if (!trimmed || trimmed === oldName) return;
    const newTranscript = recording.transcript.map(item =>
      item.speaker === oldName ? { ...item, speaker: trimmed } : item
    );
    const newCondensed = recording.condensedTranscript?.map(item =>
      item.speaker === oldName ? { ...item, speaker: trimmed } : item
    );
    const newSpeakerNames = { ...(recording.speakerNames || {}), [oldName]: trimmed };
    onUpdate({ ...recording, transcript: newTranscript, condensedTranscript: newCondensed, speakerNames: newSpeakerNames });
    showToast(`${oldName} → ${trimmed}`, 'success');
  };

  return (
    <div className="bg-surface-container-high p-4 md:p-8 rounded-2xl md:rounded-[32px] border border-white/5 max-h-[60vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <Brain className="w-5 h-5 md:w-6 md:h-6 text-tertiary" />
        <h2 className="font-headline text-lg md:text-2xl font-bold">AI Саммари</h2>
      </div>

      {/* Настроение */}
      {recording.mood && (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
            <span className="text-xl">✨</span> Настроение
          </h3>
          <div className="inline-block px-4 py-2 bg-surface-container rounded-xl text-sm font-bold text-primary">
            {recording.mood}
          </div>
        </div>
      )}

      {/* Упоминания */}
      {recording.mentions && recording.mentions.length > 0 && (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
            <Target className="w-4 h-4 text-tertiary" /> Упоминания
          </h3>
          <div className="flex flex-wrap gap-2">
            {recording.mentions.map((m, i) => (
              <span key={i} className="px-3 py-1 bg-tertiary/10 text-tertiary rounded-full text-xs font-bold">{m}</span>
            ))}
          </div>
        </div>
      )}

      {/* Краткое содержание */}
      <div className="mb-6">
        <h3 className="font-bold text-sm mb-3 text-on-surface">Краткое содержание</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">{recording.summary}</p>
      </div>

      <div className="space-y-6">
        {/* Идеи и инсайты */}
        {recording.ideas && recording.ideas.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-primary">
              <Brain className="w-4 h-4" /> Идеи и инсайты
            </h3>
            <ul className="space-y-2">
              {recording.ideas.map((idea, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>{idea}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Задачи */}
        <ActionItemsSection
          items={recording.actionItems || []}
          done={recording.actionItemsDone}
          onUpdate={(items) => onUpdate({ ...recording, actionItems: items })}
          onToggleDone={(idx) => {
            const cur = recording.actionItemsDone || new Array(recording.actionItems?.length ?? 0).fill(false);
            const next = [...cur];
            while (next.length < (recording.actionItems?.length ?? 0)) next.push(false);
            next[idx] = !next[idx];
            onUpdate({ ...recording, actionItemsDone: next });
          }}
          showToast={showToast}
          taskReminders={recording.taskReminders}
          onSetReminder={handleSetReminder}
          richItems={recording.richActionItems}
          onUpdateRichItems={(items) => onUpdate({ ...recording, richActionItems: items })}
        />

        {/* Открытые вопросы */}
        {recording.openQuestions && recording.openQuestions.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-amber-400">
              <HelpCircle className="w-4 h-4" /> Открытые вопросы
            </h3>
            <ul className="space-y-2">
              {recording.openQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Большие вопросы */}
        {recording.bigQuestions && recording.bigQuestions.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-bold text-sm mb-3" style={{ color: 'var(--color-tertiary)' }}>
              <Target className="w-4 h-4" /> Большие вопросы
            </h3>
            <ul className="space-y-2">
              {recording.bigQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl border-l-2 border-tertiary/40">
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Похожие записи */}
        {relatedRecordings.length > 0 && onOpenRecording && (
          <div className="pt-4 border-t border-white/5">
            <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
              <Link2 className="w-4 h-4 text-secondary" /> Похожие записи
            </h3>
            <div className="space-y-2">
              {relatedRecordings.map(({ rec, reason }) => (
                <button
                  key={rec.id}
                  onClick={() => onOpenRecording(rec.id)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container hover:bg-surface-container-highest transition-colors cursor-pointer group text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface line-clamp-1">{rec.title}</p>
                    <p className="text-[11px] text-on-surface-variant">{reason} · {rec.date}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Участники — панель переименования (только при 2+ спикерах) */}
        {uniqueSpeakers.length > 1 && (
          <div className="pt-4 border-t border-white/5">
            <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
              <Users className="w-4 h-4 text-secondary" /> Участники
            </h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {uniqueSpeakers.map(speaker => {
                const detected = recording.participants?.find(p => p.speakerLabel === speaker);
                const displayName = detected?.name && !detected.name.startsWith('Участник') && !detected.name.startsWith('Speaker') ? detected.name : speaker;
                return editingSpeaker === speaker ? (
                  <input
                    key={speaker}
                    autoFocus
                    value={editingSpeakerName}
                    onChange={e => setEditingSpeakerName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameSpeaker(speaker, editingSpeakerName);
                      if (e.key === 'Escape') setEditingSpeaker(null);
                    }}
                    onBlur={() => renameSpeaker(speaker, editingSpeakerName)}
                    className="bg-surface-container border border-secondary/50 rounded-lg px-2.5 py-1 text-xs w-28 outline-none text-white"
                  />
                ) : (
                  <button
                    key={speaker}
                    onClick={() => { setEditingSpeaker(speaker); setEditingSpeakerName(displayName); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold hover:bg-surface-container-highest transition-colors cursor-pointer group"
                    style={shouldColorSpeakers ? { color: speakerColorMap[speaker] } : { color: 'var(--color-on-surface-variant)' }}
                  >
                    {displayName}
                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-on-surface-variant/40">Нажмите на имя чтобы переименовать</p>
          </div>
        )}
      </div>
    </div>
  );
};
