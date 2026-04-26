import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, CheckSquare, Lightbulb, Smile, Bell, ChevronRight, ChevronDown } from 'lucide-react';
import type { Recording, Note } from '../../types';

interface BrainStatsCardProps {
  recordings: Recording[];
  notes: Note[];
  onNavigate: (view: string) => void;
  onUpdateNote?: (note: Note) => void;
  onUpdateRecording?: (rec: Recording) => void;
  onOpenRecording?: (id: string) => void;
}

interface StatRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
  onClick?: () => void;
  expandIcon?: React.ReactNode;
}

// Парсит "MM:SS" → секунды
function parseDuration(d: string): number {
  const [m, s] = d.split(':').map(n => parseInt(n, 10) || 0);
  return m * 60 + s;
}

// Секунды → "Xч Yм" или "X мин"
function formatTotalTime(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}ч ${rem}м` : `${h}ч`;
}

// Самое частое mood среди записей или null
function getMostFrequentMood(recordings: Recording[]): string | null {
  const counts: Record<string, number> = {};
  for (const r of recordings) {
    if (r.mood) counts[r.mood] = (counts[r.mood] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// Строка статистики с иконкой в цветном круге
const StatRow = ({ icon, iconBg, iconColor, children, onClick, expandIcon }: StatRowProps) => {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 py-3 lg:py-4 rounded-xl px-2 -mx-2 hover:bg-white/5 transition-colors cursor-pointer group"
      >
        <div className={`w-7 h-7 rounded-full ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex items-center flex-wrap gap-x-0.5 min-w-0 flex-1">{children}</div>
        {expandIcon ?? (
          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/30 group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 lg:py-4">
      <div className={`w-7 h-7 rounded-full ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex items-center flex-wrap gap-x-0.5 min-w-0">{children}</div>
    </div>
  );
};

const Divider = () => <div className="border-t border-white/5" />;

function snoozeNote(note: Note, hours: number): Note {
  const base = note.dueDate && note.dueTime
    ? new Date(`${note.dueDate}T${note.dueTime}`)
    : new Date();
  if (base < new Date()) base.setTime(new Date().getTime());
  base.setTime(base.getTime() + hours * 3600000);
  return { ...note, dueDate: base.toISOString().split('T')[0], dueTime: base.toTimeString().slice(0, 5) };
}

export const BrainStatsCard = ({ recordings, notes, onNavigate, onUpdateNote, onUpdateRecording, onOpenRecording }: BrainStatsCardProps) => {
  const [remindersExpanded, setRemindersExpanded] = useState(false);

  const totalSeconds = recordings.reduce((a, r) => a + parseDuration(r.duration), 0);

  let openTasks = 0;
  let doneTasks = 0;
  for (const r of recordings) {
    const count = r.actionItems?.length ?? 0;
    const done = r.actionItemsDone ?? [];
    for (let i = 0; i < count; i++) {
      if (done[i] === true) doneTasks++;
      else openTasks++;
    }
  }

  const totalIdeas = recordings.reduce((a, r) => a + (r.ideas?.length ?? 0), 0);
  const topMood = getMostFrequentMood(recordings);

  const now = new Date();
  const pendingNoteReminders = notes
    .filter(n => n.type === 'Напоминание' && !n.isCompleted)
    .map(n => ({
      note: n,
      text: n.content,
      date: n.dueDate ?? null,
      time: n.dueTime ?? null,
      source: 'note' as const,
      recordingTitle: undefined as string | undefined,
      isOverdue: n.dueDate && n.dueTime ? new Date(`${n.dueDate}T${n.dueTime}`) < now : false,
    }));

  const pendingTaskReminders = recordings.flatMap(r =>
    Object.entries(r.taskReminders ?? {})
      .filter(([, rem]) => !rem.notified)
      .map(([idx, rem]) => ({
        text: r.actionItems?.[Number(idx)] ?? 'Задача',
        date: rem.date,
        time: rem.time,
        source: 'task' as const,
        recordingTitle: r.title,
        recordingId: r.id,
        taskIndex: Number(idx),
      }))
  );

  const snoozeTask = (recordingId: string, taskIndex: number, minutes: number) => {
    const rec = recordings.find(r => r.id === recordingId);
    if (!rec || !onUpdateRecording) return;
    const rem = rec.taskReminders?.[taskIndex];
    if (!rem) return;
    const dt = new Date(`${rem.date}T${rem.time}:00`);
    dt.setMinutes(dt.getMinutes() + minutes);
    const newDate = dt.toISOString().slice(0, 10);
    const newTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const reminders = { ...rec.taskReminders, [taskIndex]: { ...rem, date: newDate, time: newTime, notified: false } };
    onUpdateRecording({ ...rec, taskReminders: reminders });
  };

  const doneTask = (recordingId: string, taskIndex: number) => {
    const rec = recordings.find(r => r.id === recordingId);
    if (!rec || !onUpdateRecording) return;
    const reminders = { ...rec.taskReminders };
    delete reminders[taskIndex];
    onUpdateRecording({ ...rec, taskReminders: reminders });
  };

  const allPendingReminders = [...pendingNoteReminders, ...pendingTaskReminders];
  const totalReminders = allPendingReminders.length;

  const isEmpty = recordings.length === 0;

  // Склонения
  const recWord = recordings.length === 1 ? 'запись' : recordings.length < 5 ? 'записи' : 'записей';
  const ideaWord = totalIdeas === 1 ? 'идея' : totalIdeas < 5 ? 'идеи' : 'идей';
  const remWord = totalReminders === 1 ? 'напоминание ждёт' : totalReminders < 5 ? 'напоминания ждут' : 'напоминаний ждут';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="col-span-12 lg:col-span-4 space-y-8 lg:h-[480px]"
    >
      <div className="bg-surface-container-high p-4 lg:p-8 rounded-3xl border border-white/5 h-full overflow-y-auto">
        <div className="mb-4 lg:mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-base font-bold font-headline">✦</span>
            <h3 className="font-headline text-xl font-bold">Твой мозг</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">в цифрах</p>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Mic className="w-8 h-8 text-on-surface-variant/30" />
            <p className="text-sm text-on-surface-variant/60 leading-relaxed">
              Начни запись — и здесь появится<br />твоя личная статистика
            </p>
          </div>
        ) : (
          <div>
            <StatRow
              icon={<Mic className="w-3.5 h-3.5" />}
              iconBg="bg-primary/15"
              iconColor="text-primary"
              onClick={() => onNavigate('library')}
            >
              <span className="text-xl font-bold text-primary">{recordings.length}</span>
              <span className="text-sm text-on-surface-variant ml-1">{recWord}</span>
              <span className="text-xs text-on-surface-variant/50 ml-2">· {formatTotalTime(totalSeconds)}</span>
            </StatRow>

            <Divider />

            <StatRow
              icon={<CheckSquare className="w-3.5 h-3.5" />}
              iconBg="bg-secondary/15"
              iconColor="text-secondary"
              onClick={() => onNavigate('focus')}
            >
              <span className="text-xl font-bold text-secondary">{openTasks}</span>
              <span className="text-xs text-on-surface-variant ml-1">открытых</span>
              <span className="text-on-surface-variant/30 mx-2">/</span>
              <span className="text-xl font-bold text-on-surface-variant/70">{doneTasks}</span>
              <span className="text-xs text-on-surface-variant ml-1">закрытых</span>
            </StatRow>

            <Divider />

            <StatRow
              icon={<Lightbulb className="w-3.5 h-3.5" />}
              iconBg="bg-tertiary/15"
              iconColor="text-tertiary"
              onClick={() => onNavigate('library')}
            >
              <span className="text-xl font-bold text-tertiary">{totalIdeas}</span>
              <span className="text-sm text-on-surface-variant ml-1">{ideaWord}</span>
            </StatRow>

            {topMood && (
              <>
                <Divider />
                <StatRow
                  icon={<Smile className="w-3.5 h-3.5" />}
                  iconBg="bg-amber-400/15"
                  iconColor="text-amber-400"
                >
                  <span className="text-xl font-bold text-amber-400 capitalize">{topMood}</span>
                  <span className="text-xs text-on-surface-variant ml-1.5">чаще всего</span>
                </StatRow>
              </>
            )}

            <Divider />

            <StatRow
              icon={<Bell className="w-3.5 h-3.5" />}
              iconBg={totalReminders > 0 ? 'bg-orange-500/15' : 'bg-on-surface-variant/10'}
              iconColor={totalReminders > 0 ? 'text-orange-400' : 'text-on-surface-variant/40'}
              onClick={totalReminders > 0 ? () => setRemindersExpanded(prev => !prev) : undefined}
              expandIcon={
                totalReminders > 0
                  ? remindersExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/30 group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/30 group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
                  : undefined
              }
            >
              {totalReminders > 0 ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-xl font-bold text-orange-400">{totalReminders}</span>
                  </span>
                  <span className="text-sm text-orange-400/80 ml-1">{remWord}</span>
                </>
              ) : (
                <span className="text-sm text-on-surface-variant/40">Нет напоминаний</span>
              )}
            </StatRow>

            <AnimatePresence>
              {remindersExpanded && totalReminders > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="pl-10 pb-2 space-y-1.5 overflow-y-auto pr-1"
                    style={{ maxHeight: 272 }}
                  >
                    {allPendingReminders.map((rem, i) => {
                      const overdue = 'isOverdue' in rem ? rem.isOverdue : false;
                      const isNote = rem.source === 'note' && 'note' in rem;
                      const dateStr = rem.date
                        ? new Date(`${rem.date}T${rem.time ?? '00:00'}`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + (rem.time ? ` · ${rem.time}` : '')
                        : null;
                      return (
                        <div
                          key={i}
                          className="rounded-xl px-3 py-2.5 border-l-2"
                          style={{
                            background: overdue ? 'rgba(255,84,89,0.06)' : 'rgba(255,183,77,0.06)',
                            borderLeftColor: overdue ? '#FF5459' : '#FFB74D',
                          }}
                        >
                          <p className="text-xs font-bold text-on-surface line-clamp-2 leading-snug mb-1.5">{rem.text}</p>
                          <div className="flex items-center gap-2">
                            {dateStr && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                style={{
                                  background: overdue ? 'rgba(255,84,89,0.15)' : 'rgba(255,183,77,0.12)',
                                  color: overdue ? '#FF5459' : '#FFB74D',
                                }}
                              >
                                {overdue ? '⚠ ' : ''}{dateStr}
                              </span>
                            )}
                            <div className="flex gap-1 ml-auto flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {isNote && onUpdateNote && (
                                <>
                                  <button
                                    onClick={() => onUpdateNote({ ...(rem as typeof rem & { note: Note }).note, isCompleted: true, completedAt: new Date().toISOString(), kanbanStatus: 'done' })}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                    style={{ background: 'rgba(79,195,247,0.12)', color: '#4FC3F7' }}
                                    title="Выполнено"
                                  >✓</button>
                                  <button
                                    onClick={() => onUpdateNote(snoozeNote((rem as typeof rem & { note: Note }).note, 1))}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                    style={{ background: 'rgba(255,183,77,0.12)', color: '#FFB74D' }}
                                    title="Отложить на 1 час"
                                  >+1ч</button>
                                </>
                              )}
                              {!isNote && onUpdateRecording && (
                                <>
                                  {'recordingId' in rem && onOpenRecording && (
                                    <button
                                      onClick={() => onOpenRecording((rem as typeof rem & { recordingId: string }).recordingId)}
                                      className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                      style={{ background: 'rgba(123,97,255,0.12)', color: '#AF9CFF' }}
                                      title="Открыть запись"
                                    >→</button>
                                  )}
                                  <button
                                    onClick={() => snoozeTask((rem as typeof rem & { recordingId: string }).recordingId, (rem as typeof rem & { taskIndex: number }).taskIndex, 60)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                    style={{ background: 'rgba(255,183,77,0.12)', color: '#FFB74D' }}
                                    title="Отложить на 1 час"
                                  >+1ч</button>
                                  <button
                                    onClick={() => snoozeTask((rem as typeof rem & { recordingId: string }).recordingId, (rem as typeof rem & { taskIndex: number }).taskIndex, 60 * 24)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                    style={{ background: 'rgba(255,183,77,0.08)', color: '#FFB74D' }}
                                    title="Отложить на 1 день"
                                  >+1д</button>
                                  <button
                                    onClick={() => doneTask((rem as typeof rem & { recordingId: string }).recordingId, (rem as typeof rem & { taskIndex: number }).taskIndex)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                    style={{ background: 'rgba(79,195,247,0.12)', color: '#4FC3F7' }}
                                    title="Готово — убрать напоминание"
                                  >✓</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};
