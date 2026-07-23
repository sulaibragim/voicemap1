import { motion } from 'motion/react';
import type { Recording } from '../../types';
import { hasIncompleteTasks } from '../../lib/mapUtils';
import { getCoverForId } from '../../lib/coverTheme';

interface RecListViewProps {
  recordings: Recording[];
  onOpenDetail: (id: string) => void;
}

export const RecListView = ({ recordings, onOpenDetail }: RecListViewProps) => {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 md:px-8 space-y-2">
      {recordings.length === 0 ? (
        <p className="text-center text-on-surface-variant mt-20">Записей нет</p>
      ) : recordings.map((rec, i) => {
        const incomplete = hasIncompleteTasks(rec);
        const dateStr = new Date(rec.date.replace(/\./g, '-')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            className="flex items-start gap-3 p-4 rounded-2xl border cursor-pointer group transition-all"
            style={{ background: 'rgba(28,28,33,0.75)', borderColor: 'rgba(123,97,255,0.12)' }}
            onClick={() => onOpenDetail(rec.id)}
          >
            {/* Обложка постоянна для записи — выбирается по хешу id, см. lib/coverTheme */}
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 mt-0.5 bg-surface-container-highest">
              <img
                src={getCoverForId(rec.id)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-on-surface leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                  {rec.title}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {incomplete && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#4FC3F715', color: '#4FC3F7' }}>
                      задачи
                    </span>
                  )}
                  <span className="text-[11px] text-on-surface-variant/50">{rec.duration ?? ''}</span>
                </div>
              </div>
              {rec.summary && (
                <p className="text-[12px] text-on-surface-variant/60 line-clamp-2 mt-0.5">{rec.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-on-surface-variant/40">{dateStr}</span>
                {rec.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,97,255,0.1)', color: '#AF9CFF' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
