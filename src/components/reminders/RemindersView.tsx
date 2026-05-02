import { useState, useRef } from 'react';
import type * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ArrowUpRight, Trash2, ArrowLeft, CheckCircle2, StickyNote } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import type { Recording, Note } from '../../types';
import { type ReminderItem, formatDateShort, buildFlatList, type Section, classifyReminder, sortByDateTime, SECTION_CONFIG } from '../../lib/reminderUtils';

interface RemindersViewProps {
  recordings: Recording[];
  notes?: Note[];
  onUpdateRecording: (updated: Recording) => void;
  onUpdateNote?: (updated: Note) => void;
  onDeleteNote?: (id: string) => void;
  onOpenRecording: (id: string) => void;
  onBack: () => void;
}

function BellIcon({ section }: { section: Section }) {
  if (section === 'overdue') return <Bell className="w-4 h-4 text-error fill-error/80 shrink-0" />;
  if (section === 'today')   return <Bell className="w-4 h-4 text-yellow-400 fill-yellow-400/80 shrink-0" />;
  return <Bell className="w-4 h-4 text-on-surface-variant shrink-0" />;
}

export const RemindersView = ({
  recordings,
  notes = [],
  onUpdateRecording,
  onUpdateNote,
  onDeleteNote,
  onOpenRecording,
  onBack,
}: RemindersViewProps) => {
  const [editing, setEditing] = useState<{ key: string; field: 'date' | 'time' } | null>(null);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const timeAnchorRef = useRef<HTMLButtonElement | null>(null);

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const allItems = buildFlatList(recordings, notes);
  const grouped: Record<Section, ReminderItem[]> = { overdue: [], today: [], upcoming: [], nodatetime: [] };
  for (const item of allItems) {
    grouped[classifyReminder(item, todayISO, currentTime)].push(item);
  }
  for (const section of Object.keys(grouped) as Section[]) {
    grouped[section].sort(sortByDateTime);
  }

  const getRecording = (id: string) => recordings.find(r => r.id === id);
  const getNote = (id: string) => notes.find(n => n.id === id);

  const removeReminderFromRecording = (item: ReminderItem) => {
    const rec = getRecording(item.recordingId!);
    if (!rec) return;
    const updated = { ...rec, taskReminders: { ...rec.taskReminders } };
    delete updated.taskReminders![item.taskIndex!];
    onUpdateRecording(updated);
  };

  const handleDoneRecording = (item: ReminderItem) => removeReminderFromRecording(item);

  const handleDoneNote = (item: ReminderItem) => {
    const note = getNote(item.noteId!);
    if (!note || !onUpdateNote) return;
    onUpdateNote({ ...note, isCompleted: true });
  };

  const handleDeleteNote = (item: ReminderItem) => {
    if (onDeleteNote) onDeleteNote(item.noteId!);
  };

  const handleSnoozeRecording = (item: ReminderItem, minutes: number) => {
    const rec = getRecording(item.recordingId!);
    if (!rec) return;
    const dt = new Date(`${item.date}T${item.time}:00`);
    dt.setMinutes(dt.getMinutes() + minutes);
    const newDate = dt.toISOString().slice(0, 10);
    const newTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const reminders = { ...rec.taskReminders };
    reminders[item.taskIndex!] = { ...reminders[item.taskIndex!], date: newDate, time: newTime, notified: false };
    onUpdateRecording({ ...rec, taskReminders: reminders });
  };

  const handleSnoozeNote = (item: ReminderItem, minutes: number) => {
    const note = getNote(item.noteId!);
    if (!note || !onUpdateNote) return;
    const dt = new Date(`${item.date || todayISO}T${item.time}:00`);
    dt.setMinutes(dt.getMinutes() + minutes);
    onUpdateNote({
      ...note,
      dueDate: dt.toISOString().slice(0, 10),
      dueTime: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
    });
  };

  const handleDateChange = (newDate: string) => {
    if (!editing) return;
    const item = allItems.find(i => i.key === editing.key);
    if (!item) return;

    if (item.kind === 'recording') {
      const rec = getRecording(item.recordingId!);
      if (!rec) return;
      const reminders = { ...rec.taskReminders };
      reminders[item.taskIndex!] = { ...reminders[item.taskIndex!], date: newDate };
      onUpdateRecording({ ...rec, taskReminders: reminders });
    } else {
      const note = getNote(item.noteId!);
      if (!note || !onUpdateNote) return;
      onUpdateNote({ ...note, dueDate: newDate });
    }
    setEditing(null);
  };

  const handleTimeChange = (newTime: string) => {
    if (!editing) return;
    const item = allItems.find(i => i.key === editing.key);
    if (!item) return;

    if (item.kind === 'recording') {
      const rec = getRecording(item.recordingId!);
      if (!rec) return;
      const reminders = { ...rec.taskReminders };
      reminders[item.taskIndex!] = { ...reminders[item.taskIndex!], time: newTime };
      onUpdateRecording({ ...rec, taskReminders: reminders });
    } else {
      const note = getNote(item.noteId!);
      if (!note || !onUpdateNote) return;
      onUpdateNote({ ...note, dueTime: newTime });
    }
    setEditing(null);
  };

  const editingItem = editing ? allItems.find(i => i.key === editing.key) : null;
  const isEmpty = allItems.length === 0;

  return (
    <div className="h-screen bg-background text-on-surface flex flex-col font-body w-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-4 lg:px-8 py-4 border-b border-white/5 bg-surface-container-low flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-6 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase hidden sm:inline">Назад</span>
        </button>
        <Bell className="w-5 h-5 text-primary mr-2" />
        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-primary uppercase font-headline flex-1">Напоминания</h1>
        <span className="text-xs text-on-surface-variant bg-surface-container border border-white/10 px-2.5 py-1 rounded-full font-bold">
          {allItems.length} {allItems.length === 1 ? 'напоминание' : allItems.length < 5 ? 'напоминания' : 'напоминаний'}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto w-full p-4 lg:px-8 lg:pt-6">

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
              <Bell className="w-14 h-14 text-on-surface-variant/20" />
              <p className="font-headline text-xl font-bold text-on-surface mt-2">Нет напоминаний</p>
              <p className="text-on-surface-variant text-sm max-w-xs">
                Создайте заметку типа «Напоминание» или откройте запись и нажмите 🔔 у задачи.
              </p>
            </div>
          )}

          {(['overdue', 'today', 'upcoming', 'nodatetime'] as Section[]).map(section => {
            const items = grouped[section];
            if (items.length === 0) return null;
            const cfg = SECTION_CONFIG[section];
            return (
              <div key={section} className={`${cfg.bgClass} border ${cfg.borderClass} rounded-xl mb-4 overflow-hidden`}>
                <div className="px-4 py-2.5 border-b border-white/5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${cfg.colorClass}`}>{cfg.label}</span>
                </div>
                <div className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {items.map((item, idx) => (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, delay: idx * 0.04 }}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        {/* Иконка источника */}
                        <div className="mt-0.5 shrink-0">
                          {item.kind === 'note'
                            ? <StickyNote className="w-4 h-4 text-primary/60 shrink-0" />
                            : <BellIcon section={section} />}
                        </div>

                        {/* Контент */}
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <span className="text-sm text-on-surface leading-snug">{item.text}</span>

                          {/* Строка действий */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Дата — клик для редактирования */}
                            {item.date && (
                              <button
                                ref={editing?.key === item.key && editing?.field === 'date' ? dateAnchorRef : undefined}
                                onClick={e => { dateAnchorRef.current = e.currentTarget; setEditing({ key: item.key, field: 'date' }); }}
                                className={`px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                                  section === 'overdue' ? 'bg-error/10 border-error/30 text-error hover:border-error/60'
                                  : section === 'today' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400 hover:border-yellow-400/60'
                                  : 'bg-surface-container border-white/10 text-on-surface hover:border-primary/50'}`}
                              >
                                {formatDateShort(item.date)}
                              </button>
                            )}

                            {/* Время */}
                            <button
                              ref={editing?.key === item.key && editing?.field === 'time' ? timeAnchorRef : undefined}
                              onClick={e => { timeAnchorRef.current = e.currentTarget; setEditing({ key: item.key, field: 'time' }); }}
                              className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors shrink-0 ${
                                section === 'overdue' ? 'bg-error/10 border-error/30 text-error hover:border-error/60'
                                : section === 'today' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400 hover:border-yellow-400/60'
                                : 'bg-surface-container border-white/10 text-on-surface hover:border-primary/50'}`}
                            >
                              {item.time}
                            </button>

                            {/* Snooze +1ч */}
                            <button
                              onClick={() => item.kind === 'recording' ? handleSnoozeRecording(item, 60) : handleSnoozeNote(item, 60)}
                              className="px-2 py-1 rounded-lg bg-surface-container border border-white/10 text-xs font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer shrink-0"
                              title="Отложить на 1 час"
                            >+1ч</button>

                            {/* Snooze +1д */}
                            <button
                              onClick={() => item.kind === 'recording' ? handleSnoozeRecording(item, 60 * 24) : handleSnoozeNote(item, 60 * 24)}
                              className="px-2 py-1 rounded-lg bg-surface-container border border-white/10 text-xs font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer shrink-0"
                              title="Отложить на 1 день"
                            >+1д</button>

                            {/* Перейти к записи (только для recording) */}
                            {item.kind === 'recording' && item.recordingId && (
                              <button
                                onClick={() => onOpenRecording(item.recordingId!)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container border border-white/10 text-xs text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors shrink-0 max-w-[130px]"
                                title="Открыть запись"
                              >
                                <span className="truncate">{item.recordingTitle}</span>
                                <ArrowUpRight className="w-3 h-3 shrink-0" />
                              </button>
                            )}

                            {/* Готово */}
                            <button
                              onClick={() => item.kind === 'recording' ? handleDoneRecording(item) : handleDoneNote(item)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/10 border border-secondary/20 text-xs font-bold text-secondary hover:bg-secondary/20 transition-colors cursor-pointer shrink-0 ml-auto"
                              title="Выполнено"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Готово
                            </button>

                            {/* Удалить */}
                            <button
                              onClick={() => item.kind === 'recording' ? removeReminderFromRecording(item) : handleDeleteNote(item)}
                              className="p-1.5 text-on-surface-variant/40 hover:text-error transition-colors cursor-pointer shrink-0"
                              title="Удалить напоминание"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}

          <AnimatePresence>
            {editing?.field === 'date' && editingItem && editingItem.date && (
              <DatePicker
                value={editingItem.date}
                onChange={handleDateChange}
                onClose={() => setEditing(null)}
                anchorRef={dateAnchorRef as React.RefObject<HTMLElement | null>}
              />
            )}
            {editing?.field === 'time' && editingItem && (
              <TimePicker
                value={editingItem.time}
                onChange={handleTimeChange}
                onClose={() => setEditing(null)}
                anchorRef={timeAnchorRef as React.RefObject<HTMLElement | null>}
              />
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>
  );
};
