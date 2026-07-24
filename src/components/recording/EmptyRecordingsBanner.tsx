import { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, X } from 'lucide-react';
import { countEmptyRecordings, emptyRecordingIds } from '../../lib/emptyRecording';
import { plural } from '../../lib/plural';
import type { Recording } from '../../types';

interface EmptyRecordingsBannerProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Предложение убрать записи, из которых ничего не вышло: включил микрофон,
 * но ничего не сказал. Они копятся от случайных нажатий и проверок «работает ли»,
 * лежат вперемешку с настоящими и занимают место в хранилище.
 *
 * Плашка появляется только когда мусора набралось заметно — иначе она сама
 * становится шумом. Удаление требует подтверждения: оно необратимо.
 */

/** Ниже этого порога мусор ещё не мешает, а плашка уже раздражает */
const MIN_TO_SUGGEST = 2;

export const EmptyRecordingsBanner = ({ recordings, onDelete, showToast }: EmptyRecordingsBannerProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const count = countEmptyRecordings(recordings);
  if (isDismissed || count < MIN_TO_SUGGEST) return null;

  const handleDelete = () => {
    const ids = emptyRecordingIds(recordings);
    ids.forEach(onDelete);
    setIsConfirming(false);
    showToast(
      `Удалено ${ids.length} ${plural(ids.length, ['пустая запись', 'пустые записи', 'пустых записей'])}`,
      'success',
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl bg-surface-container border border-white/5"
    >
      <div className="w-8 h-8 rounded-xl bg-on-surface-variant/10 flex items-center justify-center shrink-0">
        <Trash2 className="w-4 h-4 text-on-surface-variant" />
      </div>

      <p className="text-xs text-on-surface-variant flex-1 leading-snug">
        {isConfirming
          ? `Удалить ${count} ${plural(count, ['пустую запись', 'пустые записи', 'пустых записей'])}? Отменить будет нельзя.`
          : `${count} ${plural(count, ['запись', 'записи', 'записей'])} без речи — их можно убрать`}
      </p>

      {isConfirming ? (
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-surface-container-high rounded-lg hover:text-on-surface transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs font-bold text-white bg-error rounded-lg hover:bg-error/80 transition-colors cursor-pointer"
          >
            Удалить
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container-high rounded-lg hover:text-error transition-colors cursor-pointer"
          >
            Убрать
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Скрыть подсказку"
            className="w-7 h-7 flex items-center justify-center text-on-surface-variant/50 hover:text-on-surface-variant transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
};
