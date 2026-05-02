import { motion } from 'motion/react';
import type { Note, NoteType } from '../../types';
import { NOTE_COLORS } from '../../lib/mapUtils';

type GridSort = 'newest' | 'oldest' | 'alpha';

interface NoteGridViewProps {
  gridNotes: Note[];
  gridSort: GridSort;
  setGridSort: (s: GridSort) => void;
  onOpenNotes: () => void;
  activeNoteType: NoteType | null;
}

export const NoteGridView = ({ gridNotes, gridSort, setGridSort, onOpenNotes, activeNoteType }: NoteGridViewProps) => {
  return (
    <>
      <div className="flex items-center gap-2 px-8 pt-6 pb-3">
        <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">Сортировка:</span>
        {([['newest', 'Новые'], ['oldest', 'Старые'], ['alpha', 'А–Я']] as [GridSort, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setGridSort(val)}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer"
            style={{
              background: gridSort === val ? 'rgba(123,97,255,0.22)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${gridSort === val ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: gridSort === val ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
            }}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-on-surface-variant/40">{gridNotes.length} заметок</span>
      </div>
      {gridNotes.length === 0 ? (
        <p className="text-center text-on-surface-variant mt-20">Заметок нет</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-8 pb-8">
          {gridNotes.map((note, i) => {
            const noteColor = activeNoteType ? NOTE_COLORS[activeNoteType] : NOTE_COLORS[note.type];
            const dateStr = new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl border p-4 cursor-pointer transition-colors"
                style={{
                  background: 'rgba(28,28,33,0.75)',
                  borderColor: note.isCompleted ? 'rgba(255,255,255,0.05)' : `${noteColor}22`,
                  borderLeftWidth: 3,
                  borderLeftColor: noteColor,
                  opacity: note.isCompleted ? 0.45 : 1,
                }}
                onClick={onOpenNotes}
              >
                <p className={`text-sm font-bold leading-snug line-clamp-4 mb-3 ${note.isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                  {note.content}
                </p>
                <p className="text-[10px] text-on-surface-variant/45">{dateStr}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
};
