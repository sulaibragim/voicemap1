import { useState, useMemo } from 'react';
import { EmptyRecordingsBanner } from './EmptyRecordingsBanner';
import type * as React from 'react';
import { Search, ArrowLeft, Calendar, Clock, Trash2, ChevronRight, AudioLines, X, Pin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { plural } from '../../lib/plural';
import type { Recording } from '../../types';
import { SwipeCard } from './SwipeCard';
import { getCoverForId } from '../../lib/coverTheme';
import { getTagColor, getTagTextColor, sortItems, groupByDate, type SortMode } from '../../lib/recordingUtils';

interface RecordingsLibraryProps {
  recordings: Recording[];
  onBack: () => void;
  onOpenDetail: (id: string) => void;
  onDeleteRecording: (id: string) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onUpdateRecording?: (updated: Recording) => void;
  /** Тег, по которому библиотека открывается сразу отфильтрованной (клик по тегу в записи) */
  initialTag?: string;
}

const SORT_LABELS: Record<SortMode, string> = {
  date: 'По дате',
  duration: 'По длительности',
  tasks: 'По задачам',
};

export const RecordingsLibrary = ({
  recordings,
  onBack,
  onOpenDetail,
  onDeleteRecording,
  onUpdateRecording,
  showToast,
  initialTag,
}: RecordingsLibraryProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(initialTag ?? null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recordings.forEach(r => r.tags.forEach(t => set.add(t)));
    return Array.from(set);
  }, [recordings]);

  // IDs matched via transcript search
  const transcriptMatchIds = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return new Set<string>();
    const ids = new Set<string>();
    recordings.forEach(r => {
      const inTitle = r.title.toLowerCase().includes(q);
      const inSummary = r.summary.toLowerCase().includes(q);
      const inTags = r.tags.some(t => t.toLowerCase().includes(q));
      if (!inTitle && !inSummary && !inTags) {
        const inTranscript = r.transcript?.some(item => item.text.toLowerCase().includes(q));
        if (inTranscript) ids.add(r.id);
      }
    });
    return ids;
  }, [recordings, searchQuery]);

  const filtered = useMemo(() => {
    return recordings.filter(r => {
      const matchTag = !activeTag || r.tags.includes(activeTag);
      const q = searchQuery.toLowerCase();
      const matchSearch = !q
        || r.title.toLowerCase().includes(q)
        || r.summary.toLowerCase().includes(q)
        || r.tags.some(t => t.toLowerCase().includes(q))
        || r.transcript?.some(item => item.text.toLowerCase().includes(q));
      return matchTag && matchSearch;
    });
  }, [recordings, activeTag, searchQuery]);

  // Separate pinned from unpinned
  const pinnedItems = useMemo(() => filtered.filter(r => r.pinned), [filtered]);
  const unpinnedItems = useMemo(() => filtered.filter(r => !r.pinned), [filtered]);

  const groups = useMemo(() => {
    const dateGroups = groupByDate(unpinnedItems);
    return dateGroups.map(g => ({ ...g, items: sortItems(g.items, sortMode) }));
  }, [unpinnedItems, sortMode]);

  const confirmDelete = (id: string) => {
    onDeleteRecording(id);
    setDeletingId(null);
  };

  const togglePin = (rec: Recording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateRecording) {
      onUpdateRecording({ ...rec, pinned: !rec.pinned });
    }
  };

  const renderCard = (rec: Recording, idx: number) => (
    <motion.div
      key={rec.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      {deletingId === rec.id ? (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-error">Удалить «{rec.title}»?</p>
          <div className="flex gap-2">
            <button onClick={() => confirmDelete(rec.id)} className="px-3 py-1.5 bg-error text-white rounded-xl text-xs font-bold cursor-pointer">Удалить</button>
            <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 bg-surface-container rounded-xl text-xs font-bold cursor-pointer">Отмена</button>
          </div>
        </div>
      ) : (
        <SwipeCard onSwipeDelete={() => setDeletingId(rec.id)}>
          <div
            onClick={() => onOpenDetail(rec.id)}
            className="bg-surface-container rounded-2xl flex items-stretch overflow-hidden cursor-pointer hover:bg-surface-container-high active:scale-[0.98] transition-all group"
          >
            {/* Spine */}
            <div className={`w-1 flex-shrink-0 ${getTagColor(rec.tags)}`} />
            {/* Обложка постоянна для записи — выбирается по хешу id, см. lib/coverTheme */}
            <div className="w-14 md:w-20 flex-shrink-0 overflow-hidden bg-surface-container-highest">
              <img
                src={getCoverForId(rec.id)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            {/* Content */}
            <div className="flex-1 p-4 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">{rec.title}</h3>
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {onUpdateRecording && (
                    <button
                      onClick={e => togglePin(rec, e)}
                      className="p-1 rounded-lg transition-colors cursor-pointer"
                      title={rec.pinned ? 'Открепить' : 'Закрепить'}
                    >
                      <Pin
                        className={`w-3.5 h-3.5 transition-colors ${rec.pinned ? 'fill-current text-[#7B61FF]' : 'text-on-surface-variant/40 hover:text-[#7B61FF]'}`}
                      />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              {rec.summary && (
                <p className="text-xs text-on-surface-variant/70 line-clamp-2 leading-relaxed mb-2">
                  {rec.summary}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mb-2">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{rec.date}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rec.duration}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap items-center">
                  {rec.tags.slice(0, 2).map(tag => (
                    <span key={tag} className={`text-[10px] font-bold ${getTagTextColor(rec.tags)}`}>{tag}</span>
                  ))}
                  {(rec.actionItems?.length ?? 0) > 0 && rec.actionItems!.some((_, i) => !(rec.actionItemsDone?.[i])) && (
                    <span className="text-[10px] font-bold text-secondary flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block" />
                      задачи
                    </span>
                  )}
                  {transcriptMatchIds.has(rec.id) && (
                    <span className="text-[10px] font-bold text-on-surface-variant/50 bg-surface-container-high px-1.5 py-0.5 rounded-full">
                      в транскрипте
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeletingId(rec.id); }}
                  className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </SwipeCard>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body w-full">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-3 px-4 md:px-12 py-4">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
          <AnimatePresence mode="wait">
            {searchOpen ? (
              <motion.div key="search" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '100%' }} exit={{ opacity: 0 }} className="flex-1 flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по записям..." className="flex-1 bg-transparent text-sm outline-none" />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="cursor-pointer"><X className="w-4 h-4 text-on-surface-variant" /></button>
              </motion.div>
            ) : (
              <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
                <h1 className="font-headline text-xl font-bold">Библиотека</h1>
                <p className="text-[11px] text-on-surface-variant">{recordings.length} {plural(recordings.length, ['запись', 'записи', 'записей'])}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!searchOpen && (
            <button onClick={() => setSearchOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-white/10 transition-colors cursor-pointer">
              <Search className="w-4 h-4 text-on-surface-variant" />
            </button>
          )}
        </div>

        {/* Tag filter chips + sort */}
        <div className="flex items-center gap-2 pl-4 md:pl-12 pr-4 md:pr-12 pb-3">
          <div className="flex gap-2 flex-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTag(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${!activeTag ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant hover:text-white'}`}
            >
              Все
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${activeTag === tag ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant hover:text-white'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          {/* Sort select */}
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="flex-shrink-0 bg-surface-container text-on-surface-variant text-[11px] font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer border-none"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
              <option key={mode} value={mode}>{SORT_LABELS[mode]}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-4 pb-28 md:pb-4 max-w-3xl mx-auto w-full">
        {/* Предложение убрать записи без речи — считаем по всему архиву, а не по фильтру */}
        {showToast && (
          <EmptyRecordingsBanner
            recordings={recordings}
            onDelete={onDeleteRecording}
            showToast={showToast}
          />
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
            <AudioLines className="w-12 h-12 opacity-30" />
            <p className="font-bold text-lg">Записей не найдено</p>
            <p className="text-sm opacity-60 text-center">Попробуй другой тег или поисковый запрос</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned section */}
            {pinnedItems.length > 0 && (
              <div>
                <p className="text-[11px] font-black tracking-[0.15em] uppercase text-[#7B61FF]/70 mb-2 px-1 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 fill-current" />
                  Закреплённые
                </p>
                <div className="space-y-2">
                  {sortItems(pinnedItems, sortMode).map((rec, idx) => renderCard(rec, idx))}
                </div>
              </div>
            )}

            {/* Date groups */}
            {groups.map(({ label, items }) => (
              <div key={label}>
                <p className="text-[11px] font-black tracking-[0.15em] uppercase text-on-surface-variant/50 mb-2 px-1">{label}</p>
                <div className="space-y-2">
                  {items.map((rec, idx) => renderCard(rec, idx))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
