import { motion } from 'motion/react';
import type { Recording } from '../../types';
import { MOOD_COLORS, extractMoodEmoji, hasIncompleteTasks } from '../../lib/mapUtils';

interface RecGridViewProps {
  recordings: Recording[];
  onOpenDetail: (id: string) => void;
}

export const RecGridView = ({ recordings, onOpenDetail }: RecGridViewProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-8 py-6 pb-8">
      {recordings.length === 0 ? (
        <p className="col-span-full text-center text-on-surface-variant mt-20">Записей нет</p>
      ) : recordings.map((rec, i) => {
        const moodEmoji = extractMoodEmoji(rec.mood);
        const moodColor = moodEmoji ? MOOD_COLORS[moodEmoji] : undefined;
        const incomplete = hasIncompleteTasks(rec);
        const dateStr = new Date(rec.date.replace(/\./g, '-')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-2xl border p-4 cursor-pointer group transition-all hover:border-primary/30"
            style={{
              background: 'rgba(28,28,33,0.75)',
              borderColor: moodColor ? `${moodColor}20` : 'rgba(123,97,255,0.12)',
            }}
            onClick={() => onOpenDetail(rec.id)}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{moodEmoji ?? '🎙'}</span>
              {incomplete && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: '#4FC3F715', color: '#4FC3F7' }}>
                  задачи
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
              {rec.title}
            </h3>
            {rec.summary && (
              <p className="text-[11px] text-on-surface-variant/55 line-clamp-3 mb-2">{rec.summary}</p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-auto">
              <span className="text-[10px] text-on-surface-variant/40">{dateStr}</span>
              {rec.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,97,255,0.1)', color: '#AF9CFF' }}>
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
