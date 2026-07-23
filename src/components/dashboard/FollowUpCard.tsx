import { motion } from 'motion/react';
import { Circle, AlarmClock, UserRound } from 'lucide-react';
import { collectFollowUps, formatAge, formatDeadline, type FollowUpItem } from '../../lib/followUp';
import { plural } from '../../lib/plural';
import type { Recording } from '../../types';

interface FollowUpCardProps {
  recordings: Recording[];
  onOpenRecording?: (id: string) => void;
  onToggleDone?: (recordingId: string, taskIdx: number) => void;
}

interface FollowUpRowProps {
  item: FollowUpItem;
  onOpenRecording?: (id: string) => void;
  onToggleDone?: (recordingId: string, taskIdx: number) => void;
}

const FollowUpRow = ({ item, onOpenRecording, onToggleDone }: FollowUpRowProps) => (
  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-container border border-white/5 hover:border-white/10 transition-colors">
    <button
      type="button"
      onClick={() => onToggleDone?.(item.recordingId, item.taskIndex)}
      aria-label="Отметить выполненным"
      className="shrink-0 mt-0.5 cursor-pointer"
    >
      <Circle className="w-5 h-5 text-outline-variant hover:text-secondary transition-colors" />
    </button>

    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold leading-snug text-on-surface">{item.text}</p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
        <button
          type="button"
          onClick={() => onOpenRecording?.(item.recordingId)}
          className="text-xs text-primary hover:underline truncate max-w-[220px] cursor-pointer"
        >
          {item.recordingTitle}
        </button>

        <span className="text-xs text-on-surface-variant">{formatAge(item.ageDays)}</span>

        {item.isOverdue && item.deadline && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-error bg-error/10 px-2 py-0.5 rounded-full">
            <AlarmClock className="w-3 h-3" />
            срок был {formatDeadline(item.deadline)}
          </span>
        )}

        {item.assignees.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            <UserRound className="w-3 h-3" />
            {item.assignees.join(', ')}
          </span>
        )}
      </div>
    </div>
  </div>
);

/**
 * «Обещал и не сделал» — задачи из записей, которые уже протухли.
 *
 * Отличие от карточки Фокуса: та про сегодня, эта про долги. Пустой список —
 * карточка не рендерится вовсе: напоминать не о чем, место занимать незачем.
 */
export const FollowUpCard = ({ recordings, onOpenRecording, onToggleDone }: FollowUpCardProps) => {
  const items = collectFollowUps(recordings);
  if (items.length === 0) return null;

  const overdueCount = items.filter(item => item.isOverdue).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="col-span-12 bg-surface-container-low rounded-2xl md:rounded-[32px] p-5 md:p-8 border border-warning/20"
    >
      <div className="flex items-start justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h2 className="font-headline text-xl md:text-3xl font-bold text-on-surface">
            Обещал и не сделал
          </h2>
          <p className="text-xs md:text-sm text-on-surface-variant mt-1">
            {overdueCount > 0
              ? `${overdueCount} ${plural(overdueCount, ['задача', 'задачи', 'задач'])} с прошедшим сроком`
              : 'Висят с прошлых записей'}
          </p>
        </div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-warning/15 flex items-center justify-center shrink-0">
          <AlarmClock className="w-5 h-5 md:w-6 md:h-6 text-warning" />
        </div>
      </div>

      <div className="space-y-2 md:space-y-3">
        {items.map(item => (
          <FollowUpRow
            key={`${item.recordingId}-${item.taskIndex}`}
            item={item}
            onOpenRecording={onOpenRecording}
            onToggleDone={onToggleDone}
          />
        ))}
      </div>
    </motion.section>
  );
};
