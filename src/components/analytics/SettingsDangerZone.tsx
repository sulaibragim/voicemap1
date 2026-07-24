import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { plural } from '../../lib/plural';
import { Section, Divider } from './SettingsRows';
import type { Note, Recording } from '../../types';

type ClearTarget = 'recordings' | 'notes' | 'all';

interface SettingsDangerZoneProps {
  recordings: Recording[];
  notes: Note[];
  onClearRecordings: () => void;
  onClearNotes: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Необратимые действия. Каждое требует подтверждения прямо в строке — модалку
 * не открываем, чтобы подтверждение нельзя было прокликать не глядя.
 */
export const SettingsDangerZone = ({
  recordings, notes, onClearRecordings, onClearNotes, showToast,
}: SettingsDangerZoneProps) => {
  const [confirming, setConfirming] = useState<ClearTarget | null>(null);

  const labels: Record<ClearTarget, { action: string; question: string; detail: string }> = {
    recordings: {
      action: 'Очистить записи',
      question: 'Удалить все записи?',
      detail: `${recordings.length} ${plural(recordings.length, ['запись', 'записи', 'записей'])} будет удалено`,
    },
    notes: {
      action: 'Очистить заметки',
      question: 'Удалить все заметки?',
      detail: `${notes.length} ${plural(notes.length, ['заметка', 'заметки', 'заметок'])} будет удалено`,
    },
    all: {
      action: 'Удалить всё',
      question: 'Удалить всё?',
      detail: 'Все данные будут удалены без возможности восстановления',
    },
  };

  const handleConfirm = () => {
    if (confirming === 'recordings') {
      onClearRecordings();
      showToast('Записи удалены', 'success');
    } else if (confirming === 'notes') {
      onClearNotes();
      showToast('Заметки удалены', 'success');
    } else if (confirming === 'all') {
      onClearRecordings();
      onClearNotes();
      showToast('Все данные удалены', 'success');
    }
    setConfirming(null);
  };

  return (
    <Section title="Опасная зона" danger>
      {(['recordings', 'notes', 'all'] as const).map((target, i) => (
        <div key={target}>
          {i > 0 && <Divider />}

          {confirming === target ? (
            <div className="flex items-center justify-between p-5 bg-error/5">
              <p className="text-sm text-error font-bold">{labels[target].question}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  className="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-surface-container-high rounded-lg cursor-pointer hover:text-on-surface transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-error rounded-lg cursor-pointer hover:bg-error/80 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(target)}
              className="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-error" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-on-surface">{labels[target].action}</p>
                <p className="text-xs text-on-surface-variant">{labels[target].detail}</p>
              </div>
            </button>
          )}
        </div>
      ))}
    </Section>
  );
};
