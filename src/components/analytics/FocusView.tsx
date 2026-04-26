import { useState } from 'react';
import { ArrowLeft, Target, Mic, CheckCircle2, Circle, TrendingUp, ArrowUpDown, StickyNote } from 'lucide-react';
import type { Recording, Note } from '../../types';

interface FocusViewProps {
  recordings: Recording[];
  notes?: Note[];
  onBack: () => void;
  onOpenRecording?: (id: string) => void;
  onToggleDone?: (recordingId: string, taskIdx: number) => void;
  onUpdateNote?: (note: Note) => void;
}

type MobileTab = 'active' | 'done';
type SortOrder = 'newest' | 'oldest';

// Unified task shape used across both recording tasks and note tasks
interface UnifiedTask {
  description: string;
  recordingTitle: string;
  recordingId: string;
  recordingDate: string;
  idx: number;
  done: boolean;
  noteId?: string;
}

export const FocusView = ({ recordings, notes = [], onBack, onOpenRecording, onToggleDone, onUpdateNote }: FocusViewProps) => {
  const [mobileTab, setMobileTab] = useState<MobileTab>('active');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const sortedRecordings = [...recordings].sort((a, b) => {
    const cmp = b.id.localeCompare(a.id, undefined, { numeric: true });
    return sortOrder === 'newest' ? cmp : -cmp;
  });

  const recTasks: UnifiedTask[] = sortedRecordings.flatMap(r =>
    (r.actionItems || []).map((t, idx) => ({
      description: t,
      recordingTitle: r.title,
      recordingId: r.id,
      recordingDate: r.date,
      idx,
      done: r.actionItemsDone?.[idx] === true,
    }))
  );

  const noteTasks: UnifiedTask[] = notes
    .filter(n => n.type === 'Задача')
    .map(n => ({
      description: n.content,
      recordingTitle: 'Быстрая заметка',
      recordingId: `note-${n.id}`,
      recordingDate: n.date,
      idx: 0,
      done: n.isCompleted === true,
      noteId: n.id,
    }));

  const allTasks: UnifiedTask[] = [...recTasks, ...noteTasks];

  const total = allTasks.length;
  const doneCount = allTasks.filter(t => t.done).length;
  const activeCount = total - doneCount;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const activeTasks = allTasks.filter(t => !t.done);
  const doneTasks = allTasks.filter(t => t.done);

  const groupByRecording = (tasks: UnifiedTask[]) => {
    const map = new Map<string, UnifiedTask[]>();
    tasks.forEach(t => {
      if (!map.has(t.recordingId)) map.set(t.recordingId, []);
      map.get(t.recordingId)!.push(t);
    });
    return map;
  };

  const formatDate = (dateStr: string) => dateStr.split(',')[0];

  const handleToggle = (task: UnifiedTask) => {
    if (task.noteId) {
      const note = notes.find(n => n.id === task.noteId);
      if (note) onUpdateNote?.({ ...note, isCompleted: !note.isCompleted });
    } else {
      onToggleDone?.(task.recordingId, task.idx);
    }
  };

  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (progress / 100) * circ;

  const TaskItem = ({ task }: { task: UnifiedTask }) => (
    <div className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${
      task.done ? 'border-white/5 bg-surface-container/40' : 'border-white/10 bg-surface-container hover:bg-surface-container-high'
    }`}>
      <button onClick={() => handleToggle(task)} className="flex-shrink-0 mt-0.5 cursor-pointer">
        {task.done
          ? <CheckCircle2 className="w-5 h-5 text-primary" />
          : <Circle className="w-5 h-5 text-outline-variant hover:text-primary transition-colors" />
        }
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-snug ${task.done ? 'line-through opacity-60' : ''}`}>
          {task.description}
        </p>
        {task.noteId ? (
          <span className="flex items-center gap-1 text-xs text-tertiary mt-0.5">
            <StickyNote className="w-3 h-3" />
            Быстрая заметка
          </span>
        ) : (
          <button onClick={() => onOpenRecording?.(task.recordingId)} className="text-xs text-primary hover:underline mt-0.5 text-left truncate block max-w-full">
            {task.recordingTitle}
          </button>
        )}
      </div>
    </div>
  );

  const KanbanColumn = ({ tasks, label, badge }: { tasks: UnifiedTask[]; label: string; badge: string }) => {
    const groups = groupByRecording(tasks);
    return (
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10 flex-shrink-0">
          <h3 className="font-headline font-bold text-base">{label}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{tasks.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
          {tasks.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-10">
              {label === 'В работе' ? 'Все задачи выполнены 🎉' : 'Ещё ничего не выполнено'}
            </p>
          ) : (
            Array.from(groups.entries()).map(([recId, recTasks]) => (
              <div key={recId}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs text-on-surface-variant truncate flex-1">{recTasks[0].recordingTitle}</p>
                  <span className="text-xs text-on-surface-variant/50 ml-2 flex-shrink-0">{formatDate(recTasks[0].recordingDate)}</span>
                </div>
                <div className="space-y-1.5">
                  {recTasks.map((task, i) => <TaskItem key={i} task={task} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-background text-on-surface flex flex-col font-body w-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-4 lg:px-8 py-4 border-b border-white/5 bg-surface-container-low flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-6 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase hidden sm:inline">Назад</span>
        </button>
        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-primary uppercase font-headline flex-1">Фокус</h1>
        {total > 0 && (
          <button
            onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-xl bg-surface-container border border-white/5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'newest' ? 'Сначала новые' : 'Сначала старые'}
          </button>
        )}
      </header>

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="max-w-[1440px] mx-auto w-full flex-1 min-h-0 flex flex-col p-4 lg:px-8 lg:pt-6 gap-4 overflow-hidden">
        {total === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
            <Target className="w-14 h-14 mb-4 opacity-20" />
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Нет задач</h3>
            <p className="text-sm max-w-xs text-center">Сделай запись — AI автоматически извлечёт из неё задачи</p>
            <button onClick={onBack} className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary-fixed rounded-xl text-sm font-bold hover:scale-105 transition-transform cursor-pointer">
              <Mic className="w-4 h-4" />
              Сделать запись
            </button>
          </div>
        ) : (
          <>
            {/* Stats panel */}
            <div className="bg-surface-container rounded-3xl p-4 md:p-5 flex items-center gap-5 border border-white/5 flex-shrink-0">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5" stroke="currentColor" className="text-surface-container-high" />
                  <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5" stroke="currentColor"
                    strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                    className="text-primary transition-all duration-500" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black">{progress}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-on-surface-variant text-xs mb-1">Прогресс</p>
                <p className="font-headline text-xl md:text-2xl font-bold mb-2">
                  {doneCount} <span className="text-on-surface-variant font-normal text-sm">/ {total} задач</span>
                </p>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="hidden md:flex flex-col items-center flex-shrink-0 gap-0.5">
                <TrendingUp className="w-4 h-4 text-primary mb-1" />
                <span className="text-2xl font-black font-headline">{activeCount}</span>
                <span className="text-xs text-on-surface-variant">активных</span>
              </div>
            </div>

            {/* Mobile tab switcher */}
            <div className="flex md:hidden gap-2 flex-shrink-0">
              {(['active', 'done'] as MobileTab[]).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    mobileTab === tab ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                  {tab === 'active' ? `В работе · ${activeCount}` : `Готово · ${doneCount}`}
                </button>
              ))}
            </div>

            {/* Kanban — flex-1 so it fills remaining height, columns scroll internally */}
            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
              <div className={`flex-1 min-w-0 flex flex-col overflow-hidden ${mobileTab === 'done' ? 'hidden md:flex' : 'flex'}`}>
                <KanbanColumn tasks={activeTasks} label="В работе" badge="bg-primary/20 text-primary" />
              </div>
              <div className="hidden md:block w-px bg-white/5 flex-shrink-0" />
              <div className={`flex-1 min-w-0 flex flex-col overflow-hidden ${mobileTab === 'active' ? 'hidden md:flex' : 'flex'}`}>
                <KanbanColumn tasks={doneTasks} label="Выполнено" badge="bg-green-500/20 text-green-400" />
              </div>
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
};
