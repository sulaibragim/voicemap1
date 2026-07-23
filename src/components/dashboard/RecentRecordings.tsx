import { motion } from 'motion/react';
import { AudioLines, PlayCircle } from 'lucide-react';
import type { Recording } from '../../types';

interface RecentRecordingsProps {
  recordings: Recording[];
  onOpenLibrary: () => void;
  onOpenDetail: (id: string) => void;
}

export const RecentRecordings = ({ recordings, onOpenLibrary, onOpenDetail }: RecentRecordingsProps) => {
  const recent = recordings.slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mb-8 lg:mb-20"
    >
      <div className="flex items-end justify-between mb-6 lg:mb-10">
        <h2 className="font-headline text-3xl lg:text-5xl font-black tracking-tighter">Недавнее</h2>
        <div className="flex gap-4 items-center">
          <button onClick={onOpenLibrary} className="ml-4 text-primary font-bold text-sm hover:underline">Все записи</button>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center border border-white/5">
          <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto mb-6 text-on-surface-variant">
            <AudioLines className="w-10 h-10" />
          </div>
          <h3 className="font-headline text-2xl font-bold mb-2">Нет записей</h3>
          <p className="text-on-surface-variant">Нажми на кнопку микрофона, чтобы начать первую запись.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-8">
          {recent[0] && (
            <div className="col-span-12 lg:col-span-8 group cursor-pointer" onClick={() => onOpenDetail(recent[0].id)}>
              <div className="relative rounded-[40px] overflow-hidden aspect-[16/9] mb-6 bg-surface-container-high border border-white/5 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-tertiary/20 opacity-50 group-hover:opacity-80 transition-opacity duration-700"></div>
                <AudioLines className="w-32 h-32 text-primary/30 group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                  <div>
                    <span className="bg-primary text-on-primary-fixed px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">Последняя</span>
                    <h3 className="font-headline text-4xl font-bold text-white">{recent[0].title}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-white">
                    <PlayCircle className="w-10 h-10" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {recent[0].aiStatus === 'processing' ? (
                  <>
                    <span className="vm-shimmer h-6 w-24 rounded-lg flex-shrink-0" />
                    <span className="vm-shimmer h-6 w-16 rounded-lg flex-shrink-0" />
                    <span className="vm-shimmer h-6 w-20 rounded-lg flex-shrink-0" />
                  </>
                ) : recent[0].aiStatus === 'error' ? (
                  <span className="px-3 py-1 bg-error/20 rounded-lg text-xs font-medium text-error whitespace-nowrap flex-shrink-0">Ошибка обработки</span>
                ) : recent[0].aiStatus === 'quota' ? (
                  <span className="px-3 py-1 bg-warning/20 rounded-lg text-xs font-medium text-warning whitespace-nowrap flex-shrink-0">Лимит исчерпан — без расшифровки</span>
                ) : (
                  (recent[0].tags || []).map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-container-highest rounded-lg text-xs font-medium text-on-surface-variant whitespace-nowrap flex-shrink-0">{tag}</span>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="col-span-12 lg:col-span-4 space-y-8">
            {recent.slice(1).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.9 + i * 0.08 }}
                whileHover={{ y: -3 }}
                onClick={() => onOpenDetail(item.id)}
                className="flex gap-3 lg:gap-6 group cursor-pointer bg-surface-container p-3 lg:p-4 rounded-2xl border border-transparent hover:border-white/10 transition-colors"
              >
                <div className="w-16 h-16 lg:w-24 lg:h-24 flex-shrink-0 rounded-2xl overflow-hidden bg-surface-container-highest flex items-center justify-center">
                  <AudioLines className="w-10 h-10 text-on-surface-variant group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-label font-bold text-primary tracking-widest uppercase mb-1">{item.date}</p>
                  <h4 className="font-headline text-lg font-bold group-hover:text-primary transition-colors leading-tight truncate">{item.title}</h4>
                  {item.aiStatus === 'processing' ? (
                    <div className="mt-2 space-y-1.5">
                      <span className="vm-shimmer block h-3 w-full rounded" />
                      <span className="vm-shimmer block h-3 w-3/5 rounded" />
                    </div>
                  ) : item.aiStatus === 'error' ? (
                    <p className="text-sm text-error mt-2">Ошибка обработки</p>
                  ) : item.aiStatus === 'quota' ? (
                    <p className="text-sm text-warning mt-2">Лимит исчерпан — без расшифровки</p>
                  ) : (
                    <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{item.summary}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
};
