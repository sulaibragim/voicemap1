import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Note, KanbanStatus } from '../../types';
import { kanbanColumns, priorityConfig, priorityLabels } from '../../lib/noteUtils';
import { NoteCard } from './NoteCard';

interface NotesKanbanViewProps {
  kanbanNotes: Note[];
  onSelectNote: (note: Note) => void;
  onToggleComplete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (id: string) => void;
  onSnooze: (note: Note, hours: number) => void;
  onMoveKanban: (note: Note, newStatus: KanbanStatus) => void;
}

export const NotesKanbanView = ({
  kanbanNotes,
  onSelectNote,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onSnooze,
  onMoveKanban,
}: NotesKanbanViewProps) => {
  return (
    <>
      {/* Десктоп: сетка 3 колонки */}
      <div className="hidden md:grid grid-cols-3 gap-4">
        {kanbanColumns.map(col => {
          const colNotes = kanbanNotes.filter(n => (n.kanbanStatus || 'new') === col.status);
          const ColIcon = col.icon;
          return (
            <div
              key={col.status}
              className={`bg-surface-container rounded-2xl border-t-2 ${col.accent} border border-white/5 min-h-[320px] overflow-hidden`}
            >
              <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between border-b border-white/5`}>
                <div className="flex items-center gap-2">
                  <ColIcon className="w-4 h-4 text-on-surface-variant" />
                  <span className="text-sm font-bold">{col.label}</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/8 text-on-surface-variant">
                  {colNotes.length}
                </span>
              </div>
              <div className="p-3 space-y-3">
                <AnimatePresence>
                  {colNotes.map(note => (
                    <motion.div
                      key={note.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-surface-container-high rounded-xl p-4 border border-white/5 group cursor-pointer"
                      onClick={() => onSelectNote(note)}
                    >
                      <p className="text-sm text-on-surface mb-3 line-clamp-3 leading-relaxed">{note.content}</p>
                      {note.priority && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-3 ${priorityConfig[note.priority].bg} ${priorityConfig[note.priority].text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[note.priority].dot}`} />
                          {priorityLabels[note.priority]}
                        </span>
                      )}
                      <div className="flex gap-1.5 flex-wrap">
                        {kanbanColumns
                          .filter(c => c.status !== (note.kanbanStatus || 'new'))
                          .map(c => (
                            <button
                              key={c.status}
                              onClick={(e) => { e.stopPropagation(); onMoveKanban(note, c.status); }}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer border border-white/5"
                            >
                              <ArrowRight className="w-2.5 h-2.5" />
                              {c.label}
                            </button>
                          ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {colNotes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-on-surface-variant/40">
                    <ColIcon className="w-6 h-6" />
                    <span className="text-xs">Нет задач</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Мобильный фолбэк: обычный список */}
      <div className="md:hidden space-y-3">
        {kanbanNotes.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant text-sm">Нет задач</div>
        ) : (
          kanbanNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onSelect={onSelectNote}
              onToggleComplete={onToggleComplete}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onSnooze={onSnooze}
            />
          ))
        )}
      </div>
    </>
  );
};
