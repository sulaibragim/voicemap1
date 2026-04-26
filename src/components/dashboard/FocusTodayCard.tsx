import { motion } from 'motion/react';
import { Square, CheckSquare, Sparkles, StickyNote } from 'lucide-react';
import type { Recording, Note } from '../../types';
import { parseRecDate } from '../../lib/utils';

interface AssistantTask {
  id: string;
  task: string;
  done: boolean;
}

interface FocusTodayCardProps {
  recordings: Recording[];
  notes?: Note[];
  assistantTasks?: AssistantTask[];
  onOpenRecording?: (id: string) => void;
  onToggleDone?: (recordingId: string, taskIdx: number) => void;
  onToggleAssistantTask?: (id: string) => void;
  onToggleNoteTask?: (noteId: string) => void;
}

export const FocusTodayCard = ({ recordings, notes = [], assistantTasks = [], onOpenRecording, onToggleDone, onToggleAssistantTask, onToggleNoteTask }: FocusTodayCardProps) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const recentTasks = recordings
    .filter(r => {
      const date = parseRecDate(r.date);
      return date && date >= yesterday;
    })
    .flatMap(r => (r.actionItems || []).map((task, idx) => ({
      task, title: r.title, id: r.id, idx,
      done: r.actionItemsDone?.[idx] === true,
    })));

  const allRecTasks = recentTasks.length > 0
    ? recentTasks
    : recordings.flatMap(r => (r.actionItems || []).map((task, idx) => ({
        task, title: r.title, id: r.id, idx,
        done: r.actionItemsDone?.[idx] === true,
      })));

  const sortedRecTasks = [
    ...allRecTasks.filter(t => !t.done),
    ...allRecTasks.filter(t => t.done),
  ].slice(0, assistantTasks.length > 0 ? 3 : 5);

  const sortedAssistantTasks = [
    ...assistantTasks.filter(t => !t.done),
    ...assistantTasks.filter(t => t.done),
  ].slice(0, 5);

  const noteTasks = notes.filter(n => n.type === 'Задача' && n.isCompleted !== true);
  const sortedNoteTasks = noteTasks.slice(0, 4);

  const doneCount = allRecTasks.filter(t => t.done).length + assistantTasks.filter(t => t.done).length;
  const totalCount = allRecTasks.length + assistantTasks.length + noteTasks.length;

  const isEmpty = sortedRecTasks.length === 0 && sortedAssistantTasks.length === 0 && sortedNoteTasks.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="col-span-12 md:col-span-4 bg-surface-container-low p-4 lg:p-8 rounded-3xl border border-outline-variant/10 md:h-[380px] flex flex-col"
    >
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h3 className="font-label text-on-surface-variant text-[10px] font-black tracking-[0.2em] uppercase">Фокус на сегодня</h3>
        {totalCount > 0 && (
          <span className="text-[10px] text-on-surface-variant/50 font-bold">
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      <div className="space-y-4 lg:space-y-5 flex-1 overflow-y-auto pr-1">
        {isEmpty ? (
          <div className="text-on-surface-variant text-sm">Нет задач на сегодня.</div>
        ) : (
          <>
            {/* Задачи от ассистента */}
            {sortedAssistantTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-primary">От ассистента</span>
                </div>
                {sortedAssistantTasks.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleAssistantTask?.(item.id)}
                      className={`flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
                        item.done ? 'text-primary' : 'text-on-surface-variant/30 hover:text-on-surface-variant/60'
                      }`}
                      title={item.done ? 'Отметить невыполненной' : 'Отметить выполненной'}
                    >
                      {item.done
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                    <h4 className={`font-headline text-sm lg:text-base leading-tight transition-all ${
                      item.done ? 'line-through text-on-surface/30' : ''
                    }`}>
                      {item.task}
                    </h4>
                  </div>
                ))}
              </div>
            )}

            {/* Задачи из заметок */}
            {sortedNoteTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <StickyNote className="w-3 h-3 text-tertiary" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-tertiary">Из заметок</span>
                </div>
                {sortedNoteTasks.map((note) => (
                  <div key={note.id} className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleNoteTask?.(note.id)}
                      className="flex-shrink-0 mt-0.5 transition-colors cursor-pointer text-on-surface-variant/30 hover:text-on-surface-variant/60"
                      title="Отметить выполненной"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                    <h4 className="font-headline text-sm lg:text-base leading-tight">
                      {note.content}
                    </h4>
                  </div>
                ))}
              </div>
            )}

            {/* Задачи из записей */}
            {sortedRecTasks.length > 0 && (
              <div className="space-y-4">
                {(sortedAssistantTasks.length > 0 || sortedNoteTasks.length > 0) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-widest uppercase text-on-surface-variant/50">Из записей</span>
                  </div>
                )}
                {sortedRecTasks.map((item, i) => (
                  <div key={`${item.id}-${item.idx}`} className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleDone?.(item.id, item.idx)}
                      className={`flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
                        item.done
                          ? 'text-secondary'
                          : 'text-on-surface-variant/30 hover:text-on-surface-variant/60'
                      } ${!onToggleDone ? 'pointer-events-none' : ''}`}
                      title={item.done ? 'Отметить невыполненной' : 'Отметить выполненной'}
                    >
                      {item.done
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                    <div className="min-w-0">
                      <h4 className={`font-headline text-sm lg:text-base leading-tight transition-all ${
                        item.done
                          ? 'line-through text-on-surface/30'
                          : i === 0 ? '' : 'text-on-surface/60'
                      }`}>
                        {item.task}
                      </h4>
                      {onOpenRecording ? (
                        <button
                          onClick={() => onOpenRecording(item.id)}
                          className="text-[10px] text-on-surface-variant hover:text-primary transition-colors mt-0.5 text-left cursor-pointer"
                        >
                          из «{item.title}»
                        </button>
                      ) : (
                        <p className="text-[10px] text-on-surface-variant mt-0.5">из «{item.title}»</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
