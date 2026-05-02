import type * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, CheckCircle2, Bell, ArrowLeft, Pin,
  LayoutGrid, Columns3, Archive, SortAsc,
} from 'lucide-react';
import type { Note } from '../../types';
import { type FilterTab, type ViewMode, type SortBy } from '../../lib/noteUtils';

// Константы уровня модуля (перенесены из тела NotesGallery)
const filterTabs: { key: FilterTab; label: string; icon: typeof Lightbulb; activeColor: string; activeBg: string }[] = [
  { key: 'all',         label: 'Все',         icon: LayoutGrid,   activeColor: 'text-white',     activeBg: 'bg-white/12 border-white/25' },
  { key: 'Идея',        label: 'Идеи',        icon: Lightbulb,    activeColor: 'text-primary',   activeBg: 'bg-primary/15 border-primary/50' },
  { key: 'Задача',      label: 'Задачи',      icon: CheckCircle2, activeColor: 'text-secondary', activeBg: 'bg-secondary/15 border-secondary/50' },
  { key: 'Напоминание', label: 'Напоминания', icon: Bell,         activeColor: 'text-error',     activeBg: 'bg-error/15 border-error/50' },
];

const sortLabels: Record<SortBy, string> = {
  newest: 'Сначала новые',
  oldest: 'Сначала старые',
  priority: 'По приоритету',
};

interface NotesGalleryHeaderProps {
  notes: Note[];
  onBack: () => void;
  totalActive: number;
  pinnedCount: number;
  overdueCount: number;
  showCompleted: boolean;
  setShowCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  activeFilter: FilterTab;
  setActiveFilter: (v: FilterTab) => void;
  sortBy: SortBy;
  setSortBy: React.Dispatch<React.SetStateAction<SortBy>>;
  showSortMenu: boolean;
  setShowSortMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

export const NotesGalleryHeader = ({
  notes,
  onBack,
  totalActive,
  pinnedCount,
  overdueCount,
  showCompleted,
  setShowCompleted,
  viewMode,
  setViewMode,
  activeFilter,
  setActiveFilter,
  sortBy,
  setSortBy,
  showSortMenu,
  setShowSortMenu,
}: NotesGalleryHeaderProps) => {
  return (
    <header className="px-4 md:px-8 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high border border-white/5 transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-headline text-2xl md:text-4xl font-black tracking-tight leading-none">
              Архив{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}>
                мыслей
              </span>
            </h1>
            {!showCompleted && (
              <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-2">
                <span>{totalActive} {totalActive === 1 ? 'заметка' : totalActive < 5 ? 'заметки' : 'заметок'}</span>
                {pinnedCount > 0 && (
                  <span className="flex items-center gap-0.5 text-primary/70"><Pin className="w-2.5 h-2.5" />{pinnedCount} закреплено</span>
                )}
                {overdueCount > 0 && (
                  <span className="flex items-center gap-0.5 text-error animate-pulse"><Bell className="w-2.5 h-2.5" />{overdueCount} просрочено</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Сортировка */}
          <div className="relative hidden md:block">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSortMenu(v => !v); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border bg-surface-container border-white/5 text-on-surface-variant hover:border-white/15 hover:text-on-surface transition-all cursor-pointer"
            >
              <SortAsc className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{sortLabels[sortBy]}</span>
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-50 bg-surface-container-high border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[160px]"
                  onClick={e => e.stopPropagation()}
                >
                  {(['newest', 'oldest', 'priority'] as SortBy[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                        sortBy === s ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                      }`}
                    >
                      {sortLabels[s]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex bg-surface-container border border-white/5 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'timeline' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Лента
            </button>
            <button
              onClick={() => { setViewMode('kanban'); setActiveFilter('Задача'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>

          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showCompleted
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-surface-container text-on-surface-variant border-white/5 hover:border-white/15'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Архив</span>
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {filterTabs.map((tab) => {
            const count = tab.key === 'all'
              ? notes.filter(n => showCompleted ? n.isCompleted : !n.isCompleted).length
              : notes.filter(n => n.type === tab.key && (showCompleted ? n.isCompleted : !n.isCompleted)).length;
            const isActive = activeFilter === tab.key;
            const hasOverdue = tab.key === 'Напоминание' && overdueCount > 0 && !showCompleted;

            return (
              <motion.button
                key={tab.key}
                onClick={() => {
                  setActiveFilter(tab.key);
                  if (tab.key !== 'Задача' && viewMode === 'kanban') setViewMode('timeline');
                }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex-shrink-0 ${
                  isActive ? `${tab.activeBg} ${tab.activeColor}` : 'bg-surface-container border-white/5 text-on-surface-variant hover:border-white/15 hover:text-on-surface'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${isActive ? 'bg-white/15' : 'bg-white/5'}`}>
                  {count}
                </span>
                {hasOverdue && (
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
