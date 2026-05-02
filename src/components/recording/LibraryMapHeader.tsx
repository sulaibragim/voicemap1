import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, X } from 'lucide-react';
import type {
  View,
  DateFilter,
  NoteStatusFilter,
  NoteViewMode,
  RecViewMode,
} from '../../lib/mapUtils';
import type { NoteType } from '../../types';

interface LibraryMapHeaderProps {
  view: View;
  activeTag: string | null;
  activeNoteType: NoteType | null;
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  recViewMode: RecViewMode;
  setRecViewMode: (m: RecViewMode) => void;
  noteStatusFilter: NoteStatusFilter;
  setNoteStatusFilter: (f: NoteStatusFilter) => void;
  noteViewMode: NoteViewMode;
  setNoteViewMode: (m: NoteViewMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  overdueNotesCount: number;
  onBack: () => void;
}

export const LibraryMapHeader = ({
  view,
  activeTag,
  activeNoteType,
  dateFilter,
  setDateFilter,
  recViewMode,
  setRecViewMode,
  noteStatusFilter,
  setNoteStatusFilter,
  noteViewMode,
  setNoteViewMode,
  searchQuery,
  setSearchQuery,
  searchOpen,
  setSearchOpen,
  overdueNotesCount,
  onBack,
}: LibraryMapHeaderProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const titles: Record<View, string> = {
    'overview':    'Карта записей',
    'rec-clusters':'Голосовые записи',
    'note-types':  'Быстрые заметки',
    'rec-nodes':   activeTag ?? '',
    'note-nodes':  activeNoteType ?? '',
  };

  const subtitleMap: Partial<Record<View, string>> = {
    'overview': 'Кликните на кластер чтобы войти',
  };

  const showSearch = view === 'rec-nodes' || view === 'note-nodes';
  const showDateFilter = view === 'rec-nodes';
  const showNoteFilters = view === 'note-nodes';
  const showTimelineToggle = view === 'note-nodes' && activeNoteType === 'Напоминание';
  const showGridToggle = view === 'note-nodes' && activeNoteType !== 'Напоминание' && activeNoteType !== null;
  const showRecViewToggle = view === 'rec-nodes';

  return (
    <header className="flex items-center px-6 md:px-10 py-4 border-b border-white/5 bg-surface-container-low flex-shrink-0 gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors flex-shrink-0 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
      </button>

      <h1 className="text-xl font-black tracking-tighter text-primary uppercase font-headline flex-shrink-0">
        {titles[view]}
      </h1>

      {subtitleMap[view] && (
        <span className="text-sm text-on-surface-variant hidden md:inline flex-shrink-0">
          — {subtitleMap[view]}
        </span>
      )}

      {/* Date filter chips — only in rec-nodes */}
      {showDateFilter && (
        <div className="flex items-center gap-2 ml-2">
          {(['all', 'week', 'month'] as DateFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer"
              style={{
                background: dateFilter === f ? 'rgba(123,97,255,0.22)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${dateFilter === f ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: dateFilter === f ? '#AF9CFF' : 'rgba(255,255,255,0.45)',
              }}
            >
              {f === 'all' ? 'Всё время' : f === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      )}

      {/* Rec view mode toggle — only in rec-nodes */}
      {showRecViewToggle && (
        <div
          className="flex items-center rounded-full overflow-hidden ml-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['scatter', 'list', 'grid'] as RecViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setRecViewMode(m)}
              className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
              style={{
                background: recViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                color: recViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
              }}
            >
              {m === 'scatter' ? '⬡ Карта' : m === 'list' ? '≡ Список' : '▦ Сетка'}
            </button>
          ))}
        </div>
      )}

      {/* Note status filter chips */}
      {showNoteFilters && (
        <div className="flex items-center gap-2 ml-2">
          {(['all', 'active', 'overdue'] as NoteStatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setNoteStatusFilter(f)}
              className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
              style={{
                background: noteStatusFilter === f ? 'rgba(123,97,255,0.22)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${noteStatusFilter === f ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: noteStatusFilter === f ? '#AF9CFF' : 'rgba(255,255,255,0.45)',
              }}
            >
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : (
                <>
                  Просрочено
                  {overdueNotesCount > 0 && (
                    <span style={{ background: '#FF545930', color: '#FF5459', borderRadius: 9, padding: '0 5px', fontSize: 9, fontWeight: 900 }}>
                      {overdueNotesCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}

          {/* scatter / timeline toggle — only for Напоминание */}
          {showTimelineToggle && (
            <div
              className="flex items-center rounded-full overflow-hidden ml-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {(['scatter', 'timeline'] as NoteViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setNoteViewMode(m)}
                  className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
                  style={{
                    background: noteViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                    color: noteViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {m === 'scatter' ? '⬡ Карта' : '≡ Лента'}
                </button>
              ))}
            </div>
          )}

          {/* scatter / grid toggle — for Ideas, Tasks, Thoughts */}
          {showGridToggle && (
            <div
              className="flex items-center rounded-full overflow-hidden ml-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {(['scatter', 'grid'] as NoteViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setNoteViewMode(m)}
                  className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
                  style={{
                    background: noteViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                    color: noteViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {m === 'scatter' ? '⬡ Карта' : '▦ Сетка'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search icon + expandable input */}
      {showSearch && (
        <div className="flex items-center gap-2 ml-auto">
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                key="search-input"
                className="overflow-hidden"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию..."
                  className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {searchOpen ? (
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="p-1.5 rounded-full hover:bg-white/8 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-full hover:bg-white/8 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </header>
  );
};
