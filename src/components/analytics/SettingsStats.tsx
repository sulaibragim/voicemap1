import { Database, FileText, Mic } from 'lucide-react';
import type { Note, Recording } from '../../types';

interface SettingsStatsProps {
  recordings: Recording[];
  notes: Note[];
}

/** «12:34» → минуты. Битую длительность считаем нулём, а не ломаем весь блок. */
function durationToMinutes(duration: string | undefined): number {
  if (!duration) return 0;
  const [minutes, seconds] = duration.split(':').map(Number);
  return (minutes || 0) + (seconds || 0) / 60;
}

/** Сводка по накопленному: записи, заметки, минуты, задачи, идеи. */
export const SettingsStats = ({ recordings, notes }: SettingsStatsProps) => {
  const totalMinutes = recordings.reduce((acc, r) => acc + durationToMinutes(r.duration), 0);
  const totalTasks = recordings.reduce((acc, r) => acc + (r.actionItems?.length || 0), 0);
  const totalIdeas = recordings.reduce((acc, r) => acc + (r.ideas?.length || 0), 0);
  const completedNotes = notes.filter(n => n.isCompleted).length;

  const tiles = [
    { icon: Mic, label: 'Записей', value: recordings.length },
    { icon: FileText, label: 'Заметок', value: notes.length },
    { icon: Database, label: 'Минут', value: Math.round(totalMinutes) },
    { icon: Database, label: 'Задач', value: totalTasks },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
        Статистика
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-surface-container rounded-2xl p-4 border border-white/5 text-center">
            <Icon className="w-4 h-4 text-primary mx-auto mb-2 opacity-70" />
            <p className="text-2xl font-black text-on-surface">{value}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">Идей найдено AI</p>
          <p className="text-xl font-black text-primary">{totalIdeas}</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">Задач выполнено</p>
          <p className="text-xl font-black text-secondary">{completedNotes}</p>
        </div>
      </div>
    </section>
  );
};
