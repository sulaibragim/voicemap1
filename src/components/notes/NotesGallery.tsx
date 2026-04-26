import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, CheckCircle2, Bell, Search, ArrowLeft,
  Clock, Trash2, Mic, Square, Flag, Calendar, Check,
  LayoutGrid, Columns3, Archive, Loader2, RefreshCw,
  Sparkles, ArrowRight, ListTodo, StickyNote, X,
  Pin, PinOff, Edit3, AlarmClock, SortAsc, Save, Pencil
} from 'lucide-react';
import { transcribeChatVoice } from '../../lib/api';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import type { Note, NoteType, KanbanStatus } from '../../types';

interface NotesGalleryProps {
  notes: Note[];
  onBack: () => void;
  setCurrentView: (view: string) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (note: Note) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type FilterTab = 'all' | NoteType;
type ViewMode = 'timeline' | 'kanban';
type SortBy = 'newest' | 'oldest' | 'priority';

const typeConfig: Record<NoteType, {
  icon: typeof Lightbulb;
  color: string;
  bg: string;
  stripe: string;
  borderActive: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
}> = {
  'Идея':        { icon: Lightbulb,    color: 'text-primary',   bg: 'bg-primary/10',   stripe: 'bg-primary',   borderActive: 'border-primary',   gradientFrom: 'from-primary/8',   gradientTo: 'to-primary/3',   glowColor: 'shadow-primary/10' },
  'Задача':      { icon: CheckCircle2, color: 'text-secondary', bg: 'bg-secondary/10', stripe: 'bg-secondary', borderActive: 'border-secondary', gradientFrom: 'from-secondary/8', gradientTo: 'to-secondary/3', glowColor: 'shadow-secondary/10' },
  'Напоминание': { icon: Bell,         color: 'text-error',     bg: 'bg-error/10',     stripe: 'bg-error',     borderActive: 'border-error',     gradientFrom: 'from-error/8',     gradientTo: 'to-error/3',     glowColor: 'shadow-error/10' },
};

const priorityConfig: Record<string, { bg: string; text: string; dot: string }> = {
  high:   { bg: 'bg-error/15',      text: 'text-error',      dot: 'bg-error' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  low:    { bg: 'bg-tertiary/15',   text: 'text-tertiary',   dot: 'bg-tertiary' },
};

const priorityLabels: Record<string, string> = {
  high: 'Высокий', medium: 'Средний', low: 'Низкий',
};

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const kanbanColumns: { status: KanbanStatus; label: string; accent: string; icon: typeof ListTodo; headerBg: string }[] = [
  { status: 'new',         label: 'Новые',    accent: 'border-t-primary/60',    icon: StickyNote,   headerBg: 'bg-primary/8' },
  { status: 'in_progress', label: 'В работе', accent: 'border-t-yellow-500/60', icon: RefreshCw,    headerBg: 'bg-yellow-500/8' },
  { status: 'done',        label: 'Готово',   accent: 'border-t-secondary/60',  icon: CheckCircle2, headerBg: 'bg-secondary/8' },
];

const MONTH_MAP: Record<string, number> = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};
const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function parseNoteDate(dateStr: string): Date | null {
  const withYear = dateStr.match(/(\d+)\s+([а-яё]+)\s+(\d{4})/i);
  if (withYear) {
    const d = new Date(parseInt(withYear[3]), MONTH_MAP[withYear[2]] ?? 0, parseInt(withYear[1]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const withTime = dateStr.match(/(\d+)\s+([а-яё]+)[,\s]/i);
  if (withTime && MONTH_MAP[withTime[2]] !== undefined) {
    const d = new Date(new Date().getFullYear(), MONTH_MAP[withTime[2]], parseInt(withTime[1]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function groupByDate(notes: Note[]): { label: string; notes: Note[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const groupMap = new Map<string, { notes: Note[]; priority: number }>();

  for (const note of notes) {
    const noteDate = parseNoteDate(note.date);
    let label: string;
    let priority: number;

    if (!noteDate) {
      label = note.date; priority = 999;
    } else if (noteDate.getTime() === today.getTime()) {
      label = 'Сегодня'; priority = 0;
    } else if (noteDate.getTime() === yesterday.getTime()) {
      label = 'Вчера'; priority = 1;
    } else if (noteDate >= weekAgo) {
      label = 'На этой неделе'; priority = 2;
    } else {
      label = `${noteDate.getDate()} ${MONTH_NAMES[noteDate.getMonth()]}`;
      priority = 1000 + (today.getTime() - noteDate.getTime());
    }

    if (!groupMap.has(label)) groupMap.set(label, { notes: [], priority });
    groupMap.get(label)!.notes.push(note);
  }

  return Array.from(groupMap.entries())
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([label, { notes }]) => ({ label, notes }));
}

export const NotesGallery = ({ notes, onBack, setCurrentView, onDeleteNote, onUpdateNote, showToast }: NotesGalleryProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editingDT, setEditingDT] = useState<'date' | 'time' | null>(null);

  const dateEditRef = useRef<HTMLButtonElement | null>(null);
  const timeEditRef = useRef<HTMLButtonElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Reset edit state when modal closes
  useEffect(() => {
    if (!selectedNote) { setIsEditing(false); setEditContent(''); setEditingDT(null); }
  }, [selectedNote]);

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

  const saveEdit = () => {
    if (!selectedNote || !editContent.trim()) return;
    const updated = { ...selectedNote, content: editContent.trim() };
    onUpdateNote(updated);
    setSelectedNote(updated);
    setIsEditing(false);
    showToast('Заметка обновлена', 'success');
  };

  const startVoiceSearch = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsVoiceSearching(false);
        setIsVoiceProcessing(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const text = await transcribeChatVoice(base64, mimeType);
            if (text && text !== '[Тишина]') setSearchQuery(text);
          } catch { showToast('Ошибка распознавания речи', 'error'); }
          finally { setIsVoiceProcessing(false); }
        };
      };

      mediaRecorder.start();
      setIsVoiceSearching(true);
      setVoiceTime(0);
      timerRef.current = window.setInterval(() => setVoiceTime(v => v + 1), 1000);
    } catch { showToast('Не удалось получить доступ к микрофону', 'error'); }
  };

  const stopVoiceSearch = () => {
    if (mediaRecorderRef.current && isVoiceSearching) mediaRecorderRef.current.stop();
  };

  const formatDueDate = (iso: string): string => {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.getTime() === today.getTime()) return 'Сегодня';
    if (d.getTime() === tomorrow.getTime()) return 'Завтра';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleDueDateChange = (newDate: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, dueDate: newDate };
    onUpdateNote(updated);
    setSelectedNote(updated);
    setEditingDT(null);
    showToast('Дата изменена', 'success');
  };

  const handleDueTimeChange = (newTime: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, dueTime: newTime };
    onUpdateNote(updated);
    setSelectedNote(updated);
    setEditingDT(null);
    showToast('Время изменено', 'success');
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

  const getReminderStatus = (note: Note) => {
    if (!note.dueDate || !note.dueTime) return null;
    const due = new Date(`${note.dueDate}T${note.dueTime}`);
    const diff = due.getTime() - Date.now();
    if (diff < 0) return { text: 'Просрочено', urgent: true, overdue: true };
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return { text: `через ${Math.floor(hours / 24)} дн.`, urgent: false, overdue: false };
    if (hours > 0) return { text: `через ${hours} ч. ${mins} мин.`, urgent: false, overdue: false };
    return { text: `через ${mins} мин.`, urgent: true, overdue: false };
  };

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

  const totalActive = notes.filter(n => !n.isCompleted).length;
  const overdueCount = notes.filter(n => n.type === 'Напоминание' && !n.isCompleted && getReminderStatus(n)?.overdue).length;

  const renderNoteCard = (note: Note) => {
    const config = typeConfig[note.type];
    const Icon = config.icon;
    const reminder = note.type === 'Напоминание' ? getReminderStatus(note) : null;
    const isOverdue = reminder?.overdue;

    return (
      <motion.div
        key={note.id}
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.18 }}
        onClick={() => setSelectedNote(note)}
        className={`relative bg-surface-container-high rounded-2xl overflow-hidden cursor-pointer group border transition-colors ${
          isOverdue
            ? 'border-error/40 shadow-[0_0_12px_rgba(var(--color-error-rgb,239,68,68),0.15)]'
            : note.isPinned
            ? 'border-primary/25 hover:border-primary/40'
            : 'border-white/5 hover:border-white/12'
        } ${note.isCompleted ? 'opacity-50' : ''}`}
      >
        {/* Цветная полоска слева */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${config.stripe} ${isOverdue ? 'animate-pulse' : ''}`} />

        {/* Pin indicator */}
        {note.isPinned && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <Pin className="w-2.5 h-2.5 text-primary" />
          </div>
        )}

        <div className="pl-5 pr-4 py-4">
          {/* Тип + действия */}
          <div className="flex items-center justify-between mb-2.5">
            <div className={`flex items-center gap-1.5 ${config.color}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{note.type}</span>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
              {/* Snooze на карточке напоминания */}
              {note.type === 'Напоминание' && !note.isCompleted && (
                <button
                  onClick={(e) => snoozeReminder(note, 1, e)}
                  className="p-1.5 rounded-lg hover:bg-yellow-500/15 hover:text-yellow-400 text-on-surface-variant transition-all cursor-pointer"
                  title="Отложить на 1 час"
                >
                  <AlarmClock className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Быстрое выполнение задачи */}
              {note.type === 'Задача' && !note.isCompleted && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleComplete(note); }}
                  className="p-1.5 rounded-lg hover:bg-secondary/15 hover:text-secondary text-on-surface-variant transition-all cursor-pointer"
                  title="Отметить выполненной"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Pin */}
              <button
                onClick={(e) => togglePin(note, e)}
                className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-all cursor-pointer"
                title={note.isPinned ? 'Открепить' : 'Закрепить'}
              >
                {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
              {/* Удалить */}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Контент */}
          <p className={`text-sm leading-relaxed line-clamp-3 ${note.isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
            {note.content}
          </p>

          {/* Приоритет (задача) */}
          {note.type === 'Задача' && note.priority && (
            <div className="mt-2.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityConfig[note.priority].bg} ${priorityConfig[note.priority].text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[note.priority].dot}`} />
                {priorityLabels[note.priority]}
              </span>
            </div>
          )}

          {/* Футер */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-on-surface-variant/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {note.date}
            </span>

            {reminder && (
              <span className={`ml-auto text-[10px] font-bold flex items-center gap-1 ${reminder.urgent ? 'text-error' : 'text-on-surface-variant'} ${isOverdue ? 'animate-pulse' : ''}`}>
                <Bell className="w-3 h-3" />
                {reminder.text}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body" onClick={() => setShowSortMenu(false)}>
      {/* Header */}
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
                    {searchQuery ? 'Попробуйте другой запрос' : 'Создайте быструю заметку с дашборда'}
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
                      {group.notes.map(note => renderNoteCard(note))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div key="kanban" className="hidden md:grid grid-cols-3 gap-4">
              {kanbanColumns.map(col => {
                const colNotes = kanbanNotes.filter(n => (n.kanbanStatus || 'new') === col.status);
                const ColIcon = col.icon;
                return (
                  <div key={col.status} className={`bg-surface-container rounded-2xl border-t-2 ${col.accent} border border-white/5 min-h-[320px] overflow-hidden`}>
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
                            onClick={() => setSelectedNote(note)}
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
                                    onClick={(e) => { e.stopPropagation(); moveKanban(note, c.status); }}
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
          )}
        </AnimatePresence>

        {viewMode === 'kanban' && (
          <div className="md:hidden space-y-3">
            {kanbanNotes.length === 0 ? (
              <div className="text-center py-20 text-on-surface-variant text-sm">Нет задач</div>
            ) : (
              kanbanNotes.map(note => renderNoteCard(note))
            )}
          </div>
        )}
      </div>

      {/* ── MODAL / BOTTOM SHEET ── */}
      <AnimatePresence>
        {selectedNote && (() => {
          const note = selectedNote;
          const config = typeConfig[note.type];
          const Icon = config.icon;
          const reminder = note.type === 'Напоминание' ? getReminderStatus(note) : null;

          return (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedNote(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />

              <motion.div
                key="sheet"
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className="fixed z-50 left-0 right-0 bottom-0 md:left-1/2 md:top-1/2 md:right-auto md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] bg-surface-container-high rounded-t-3xl md:rounded-3xl overflow-hidden"
                style={{ maxHeight: '85vh' }}
              >
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                <div className={`h-[3px] w-full ${config.stripe} hidden md:block`} />

                {/* Шапка */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                  <div className={`flex items-center gap-2.5 ${config.color}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">{note.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Pin в модале */}
                    <button
                      onClick={(e) => togglePin(note, e)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${note.isPinned ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-white/8'}`}
                      title={note.isPinned ? 'Открепить' : 'Закрепить'}
                    >
                      {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    {/* Редактировать */}
                    {!isEditing && (
                      <button
                        onClick={() => { setIsEditing(true); setEditContent(note.content); }}
                        className="p-2 rounded-xl hover:bg-white/8 text-on-surface-variant transition-colors cursor-pointer"
                        title="Редактировать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedNote(null)}
                      className="p-2 rounded-xl hover:bg-white/8 text-on-surface-variant transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Контент */}
                <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                  {isEditing ? (
                    <div className="mb-6">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        autoFocus
                        rows={5}
                        className="w-full bg-surface-container border border-white/10 rounded-2xl px-4 py-3 text-base text-on-surface leading-relaxed resize-none outline-none focus:border-primary/40 transition-colors"
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveEdit}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-all cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          Сохранить
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/8 transition-all cursor-pointer"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-base leading-relaxed text-on-surface mb-6">{note.content}</p>
                  )}

                  {/* Детали */}
                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{note.date}</span>
                    </div>

                    {note.priority && (
                      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${priorityConfig[note.priority].bg} ${priorityConfig[note.priority].text}`}>
                        <Flag className="w-3.5 h-3.5" />
                        {priorityLabels[note.priority]} приоритет
                      </div>
                    )}

                    {note.type === 'Напоминание' && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-surface-container border border-white/8">
                        <Calendar className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />
                        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                          {/* Дата — кликабельно */}
                          <button
                            ref={dateEditRef}
                            onClick={() => setEditingDT('date')}
                            className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                              note.dueDate
                                ? 'bg-primary/10 border-primary/30 text-primary hover:border-primary/60'
                                : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20'
                            }`}
                          >
                            {note.dueDate ? formatDueDate(note.dueDate) : 'Добавить дату'}
                          </button>
                          {/* Время — кликабельно */}
                          <button
                            ref={timeEditRef}
                            onClick={() => setEditingDT('time')}
                            className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                              note.dueTime
                                ? 'bg-primary/10 border-primary/30 text-primary hover:border-primary/60'
                                : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20'
                            }`}
                          >
                            {note.dueTime ?? '09:00'}
                          </button>
                          <span className="text-[10px] text-on-surface-variant/50 ml-auto flex items-center gap-1">
                            <Pencil className="w-2.5 h-2.5" /> нажмите чтобы изменить
                          </span>
                        </div>
                      </div>
                    )}

                    {reminder && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${reminder.urgent ? 'bg-error/15 text-error' : 'bg-surface-container text-on-surface-variant'}`}>
                        <Bell className="w-4 h-4 flex-shrink-0" />
                        {reminder.text}
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <div className="flex gap-2.5 flex-wrap">
                    {note.type === 'Задача' && (
                      <button
                        onClick={() => { toggleComplete(note); setSelectedNote(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                          note.isCompleted
                            ? 'bg-surface-container text-on-surface-variant hover:bg-white/8'
                            : 'bg-secondary/15 text-secondary hover:bg-secondary/25'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        {note.isCompleted ? 'Отменить' : 'Выполнено'}
                      </button>
                    )}

                    {note.type === 'Напоминание' && !note.isCompleted && (
                      <>
                        <button
                          onClick={() => { toggleComplete(note); setSelectedNote(null); }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-secondary/15 text-secondary hover:bg-secondary/25 transition-all cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Выполнено
                        </button>
                        <button
                          onClick={() => { snoozeReminder(note, 1); setSelectedNote(null); }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <AlarmClock className="w-4 h-4" />
                          +1 час
                        </button>
                        <button
                          onClick={() => { snoozeReminder(note, 24); setSelectedNote(null); }}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-surface-container text-on-surface-variant hover:bg-white/10 transition-all cursor-pointer"
                        >
                          +1 день
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => { onDeleteNote(note.id); setSelectedNote(null); }}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-error/10 text-error hover:bg-error/20 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* DatePicker для редактирования даты напоминания */}
              {editingDT === 'date' && dateEditRef.current && (
                <DatePicker
                  value={note.dueDate ?? new Date().toISOString().slice(0, 10)}
                  onChange={handleDueDateChange}
                  onClose={() => setEditingDT(null)}
                  anchorRef={dateEditRef as React.RefObject<HTMLElement | null>}
                />
              )}
              {/* TimePicker для редактирования времени */}
              {editingDT === 'time' && timeEditRef.current && (
                <TimePicker
                  value={note.dueTime ?? '09:00'}
                  onChange={handleDueTimeChange}
                  onClose={() => setEditingDT(null)}
                  anchorRef={timeEditRef as React.RefObject<HTMLElement | null>}
                />
              )}
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
