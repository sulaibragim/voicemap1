import { useState } from 'react';
import type * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Mic, Square,
  Archive, Loader2,
  Sparkles,
} from 'lucide-react';
import type { Note, KanbanStatus } from '../../types';
import {
  priorityOrder, parseNoteDate, groupByDate, getReminderStatus,
  type FilterTab, type ViewMode, type SortBy,
} from '../../lib/noteUtils';
import { NoteCard } from './NoteCard';
import { NoteDetailModal } from './NoteDetailModal';
import { NotesKanbanView } from './NotesKanbanView';
import { useNoteVoiceSearch } from '../../hooks/useNoteVoiceSearch';
import { NotesGalleryHeader } from './NotesGalleryHeader';

interface NotesGalleryProps {
  notes: Note[];
  onBack: () => void;
  setCurrentView: (view: string) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (note: Note) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}


export const NotesGallery = ({ notes, onBack, setCurrentView: _setCurrentView, onDeleteNote, onUpdateNote, showToast }: NotesGalleryProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { isVoiceSearching, isVoiceProcessing, voiceTime, startVoiceSearch, stopVoiceSearch } =
    useNoteVoiceSearch({ onResult: (text) => setSearchQuery(text), showToast });

  const sortNotes = (arr: Note[]): Note[] => {
    const pinned = arr.filter(n => n.isPinned);
    const unpinned = arr.filter(n => !n.isPinned);

    const sortFn = (a: Note, b: Note): number => {
      if (sortBy === 'oldest') return (parseNoteDate(a.date)?.getTime() ?? 0) - (parseNoteDate(b.date)?.getTime() ?? 0);
      if (sortBy === 'priority') {
        const pa = a.priority ? priorityOrder[a.priority] : 99;
        const pb = b.priority ? priorityOrder[b.priority] : 99;
        return pa - pb;
      }
      // newest
      return (parseNoteDate(b.date)?.getTime() ?? 0) - (parseNoteDate(a.date)?.getTime() ?? 0);
    };

    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
  };

  const filtered = sortNotes(notes.filter(n => {
    if (activeFilter !== 'all' && n.type !== activeFilter) return false;
    if (!showCompleted && n.isCompleted) return false;
    if (showCompleted && !n.isCompleted) return false;
    if (searchQuery) {
      return n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
             n.type.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  }));

  const timelineGroups = groupByDate(filtered);

  const kanbanNotes = notes.filter(n =>
    n.type === 'Задача' && (showCompleted || !n.isCompleted)
  ).filter(n => {
    if (searchQuery) return n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const pinnedCount = notes.filter(n => n.isPinned && !n.isCompleted).length;

  const toggleComplete = (note: Note) => {
    onUpdateNote({
      ...note,
      isCompleted: !note.isCompleted,
      completedAt: !note.isCompleted ? new Date().toISOString() : undefined,
      kanbanStatus: !note.isCompleted ? 'done' : 'new',
    });
  };

  const togglePin = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdateNote({ ...note, isPinned: !note.isPinned });
    showToast(note.isPinned ? 'Откреплено' : 'Закреплено вверху', 'info');
  };

  const moveKanban = (note: Note, newStatus: KanbanStatus) => {
    onUpdateNote({
      ...note,
      kanbanStatus: newStatus,
      isCompleted: newStatus === 'done',
      completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  const snoozeReminder = (note: Note, hours: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const now = new Date();
    const base = (note.dueDate && note.dueTime)
      ? (() => { const d = new Date(`${note.dueDate}T${note.dueTime}`); return d < now ? now : d; })()
      : now;
    base.setTime(base.getTime() + hours * 60 * 60 * 1000);
    onUpdateNote({ ...note, dueDate: base.toISOString().split('T')[0], dueTime: base.toTimeString().slice(0, 5) });
    showToast(`Отложено на ${hours} ч.`, 'info');
  };

  const totalActive = notes.filter(n => !n.isCompleted).length;
  const overdueCount = notes.filter(n => n.type === 'Напоминание' && !n.isCompleted && getReminderStatus(n)?.overdue).length;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body" onClick={() => setShowSortMenu(false)}>
      <NotesGalleryHeader
        notes={notes}
        onBack={onBack}
        totalActive={totalActive}
        pinnedCount={pinnedCount}
        overdueCount={overdueCount}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showSortMenu={showSortMenu}
        setShowSortMenu={setShowSortMenu}
      />

      {/* Поиск */}
      <div className="px-4 md:px-8 mb-5">
        <div className="relative flex items-center gap-3 rounded-2xl border overflow-hidden bg-surface-container border-white/6">
          <div className="flex items-center gap-3 px-4 py-3 w-full">
            <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по архиву мыслей..."
              className="bg-transparent border-none outline-none flex-1 text-on-surface placeholder:text-on-surface-variant text-sm"
            />
            {isVoiceProcessing ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            ) : isVoiceSearching ? (
              <button onClick={stopVoiceSearch} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/20 text-error cursor-pointer">
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Square className="w-3 h-3" fill="currentColor" />
                </motion.div>
                <span className="text-xs font-mono">{String(Math.floor(voiceTime / 60)).padStart(2, '0')}:{String(voiceTime % 60).padStart(2, '0')}</span>
              </button>
            ) : (
              <button onClick={startVoiceSearch} className="p-1.5 rounded-full hover:bg-white/8 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Архив-баннер */}
      <AnimatePresence>
        {showCompleted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 md:px-8 mb-4 overflow-hidden"
          >
            <div className="px-4 py-3 bg-surface-container rounded-xl border border-white/8 flex items-center gap-2.5">
              <Archive className="w-4 h-4 text-on-surface-variant" />
              <span className="text-sm text-on-surface-variant">Показаны завершённые задачи</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Контент */}
      <div className="px-4 md:px-8 pb-24">
        <AnimatePresence mode="popLayout">
          {viewMode === 'timeline' ? (
            filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-5"
              >
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-3xl bg-surface-container-high border border-white/8 flex items-center justify-center"
                >
                  <Sparkles className="w-9 h-9 text-primary/50" />
                </motion.div>
                <div className="text-center">
                  <p className="text-base font-bold text-on-surface mb-1">
                    {showCompleted ? 'Нет завершённых задач' : searchQuery ? 'Ничего не найдено' : 'Здесь пока пусто'}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {searchQuery ? 'Попробуй другой запрос' : 'Создай быструю заметку с дашборда'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div key="timeline" className="space-y-8">
                {timelineGroups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/8" />
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-3 py-1 rounded-full bg-surface-container border border-white/6">
                        {group.label}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/8" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.notes.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onSelect={setSelectedNote}
                          onToggleComplete={toggleComplete}
                          onTogglePin={togglePin}
                          onDelete={onDeleteNote}
                          onSnooze={snoozeReminder}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <NotesKanbanView
              key="kanban"
              kanbanNotes={kanbanNotes}
              onSelectNote={setSelectedNote}
              onToggleComplete={toggleComplete}
              onTogglePin={togglePin}
              onDelete={onDeleteNote}
              onSnooze={snoozeReminder}
              onMoveKanban={moveKanban}
            />
          )}
        </AnimatePresence>
      </div>

      <NoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onUpdate={(updated) => { onUpdateNote(updated); setSelectedNote(updated); }}
        onToggleComplete={toggleComplete}
        onTogglePin={togglePin}
        onDelete={onDeleteNote}
        onSnooze={snoozeReminder}
        showToast={showToast}
      />
    </div>
  );
};
