import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Mic, FileText, Search, X } from 'lucide-react';
import type { Recording, Note, NoteType } from '../../types';
import { parseRecDate } from '../../lib/utils';
import { MapCluster } from './MapCluster';
import { MapRecordingNode } from './MapRecordingNode';
import { MapNoteNode } from './MapNoteNode';
import { MapConnections } from './MapConnections';

const CW = 1600;
const CH = 760;
const CX = CW / 2;
const CY = CH / 2;

const NOTE_COLORS: Record<NoteType, string> = {
  'Идея':        '#7B61FF',
  'Задача':      '#4FC3F7',
  'Напоминание': '#FFB74D',
};
const NOTE_TYPES: NoteType[] = ['Идея', 'Задача', 'Напоминание'];

// Mood emoji → color mapping
const MOOD_COLORS: Record<string, string> = {
  '😊': '#81C784',
  '😃': '#4FC3F7',
  '🤔': '#FFB74D',
  '😤': '#F06292',
  '😴': '#90A4AE',
  '🔥': '#FF7043',
  '💡': '#7B61FF',
  '🎯': '#AB47BC',
};

// Spiral layout: newest at center, older further out
function spiralLayout(n: number, cx: number, cy: number) {
  if (n === 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];

  const positions: { x: number; y: number }[] = [];
  const minR = 90;
  const maxR = Math.min(320, minR + n * 28);

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 = newest (center), 1 = oldest (outer)
    const r = minR + t * (maxR - minR);
    // Distribute angle with golden ratio to avoid overlap
    const angle = i * 2.399963 - Math.PI / 2;
    positions.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return positions;
}

// Circle layout for clusters
function circleLayout(n: number, cx: number, cy: number, r: number) {
  if (n === 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

// Note layout: by priority/status — incomplete important in center
function noteLayout(notes: Note[], cx: number, cy: number) {
  const sorted = [...notes].sort((a, b) => {
    const aScore = (a.isCompleted ? 10 : 0) + (a.priority === 'high' ? -3 : a.priority === 'medium' ? -1 : 0);
    const bScore = (b.isCompleted ? 10 : 0) + (b.priority === 'high' ? -3 : b.priority === 'medium' ? -1 : 0);
    return aScore - bScore;
  });
  return spiralLayout(sorted.length, cx, cy).map((pos, i) => ({ note: sorted[i], ...pos }));
}

function buildTagClusters(recordings: Recording[]): Map<string, Recording[]> {
  const map = new Map<string, Recording[]>();
  recordings.forEach(rec => {
    const tag = rec.tags[0] ?? '#Без тега';
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag)!.push(rec);
  });
  return map;
}

function buildConnections(recordings: Recording[]) {
  const result = new Map<string, Array<{ targetId: string; word: string }>>();
  recordings.forEach(rec => {
    const words = new Set([
      ...rec.tags.map(t => t.replace(/^#/, '').toLowerCase()),
      ...(rec.keyMoments ?? []).flatMap(km => km.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())),
      ...(rec.mentions ?? []).map(m => m.toLowerCase()),
      ...(rec.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 5).map(w => w.toLowerCase())),
    ]);
    const conns: Array<{ targetId: string; word: string }> = [];
    recordings.forEach(other => {
      if (other.id === rec.id) return;
      const otherWords = [
        ...other.tags.map(t => t.replace(/^#/, '').toLowerCase()),
        ...(other.keyMoments ?? []).flatMap(km => km.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())),
        ...(other.mentions ?? []).map(m => m.toLowerCase()),
        ...(other.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 5).map(w => w.toLowerCase())),
      ];
      const shared = otherWords.find(w => words.has(w));
      if (shared) conns.push({ targetId: other.id, word: shared });
    });
    result.set(rec.id, conns);
  });
  return result;
}

// Get first emoji from mood string
function extractMoodEmoji(mood: string | undefined): string | null {
  if (!mood) return null;
  const match = mood.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u);
  return match ? match[0] : null;
}

// Returns true if recording has at least one incomplete action item
function hasIncompleteTasks(rec: Recording): boolean {
  if (!rec.actionItems || rec.actionItems.length === 0) return false;
  return rec.actionItems.some((_, i) => !rec.actionItemsDone?.[i]);
}

type View = 'overview' | 'rec-clusters' | 'note-types' | 'rec-nodes' | 'note-nodes';
type DateFilter = 'all' | 'week' | 'month';
type NoteStatusFilter = 'all' | 'active' | 'overdue';
type NoteViewMode = 'scatter' | 'timeline' | 'grid';
type RecViewMode = 'scatter' | 'list' | 'grid';

interface LibraryMapProps {
  recordings: Recording[];
  notes: Note[];
  onOpenDetail: (id: string) => void;
  onBack: () => void;
  onOpenNotes: () => void;
  onOpenSpaces: () => void;
  onUpdateNote?: (note: Note) => void;
}

function getNoteReminderStatus(note: Note) {
  if (!note.dueDate || !note.dueTime) return null;
  const due = new Date(`${note.dueDate}T${note.dueTime}`);
  return due.getTime() < Date.now() ? 'overdue' : 'active';
}

export const LibraryMap = ({
  recordings,
  notes,
  onOpenDetail,
  onBack,
  onOpenNotes,
  onOpenSpaces,
  onUpdateNote,
}: LibraryMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<View>('overview');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeNoteType, setActiveNoteType] = useState<NoteType | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [noteStatusFilter, setNoteStatusFilter] = useState<NoteStatusFilter>('all');
  const [noteViewMode, setNoteViewMode] = useState<NoteViewMode>('scatter');
  const [gridSort, setGridSort] = useState<'newest' | 'oldest' | 'alpha'>('newest');
  const [recViewMode, setRecViewMode] = useState<RecViewMode>('scatter');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / CW, el.clientHeight / CH));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Reset search/filters when view changes
  useEffect(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setDateFilter('all');
    setNoteStatusFilter('all');
    setNoteViewMode('scatter');
    setGridSort('newest');
    setRecViewMode('scatter');
  }, [view]);

  const tagClusters = useMemo(() => buildTagClusters(recordings), [recordings]);
  const connections = useMemo(() => buildConnections(recordings), [recordings]);
  const tagList = useMemo(() => Array.from(tagClusters.keys()), [tagClusters]);

  const tagPositions = useMemo(() => {
    const r = tagList.length <= 3 ? 220 : tagList.length <= 6 ? 270 : 310;
    return circleLayout(tagList.length, CX, CY, r).map((pos, i) => ({ tag: tagList[i], ...pos }));
  }, [tagList]);

  const noteTypePositions = useMemo(() => {
    return circleLayout(NOTE_TYPES.length, CX, CY, 200).map((pos, i) => ({ type: NOTE_TYPES[i], ...pos }));
  }, []);

  // Recording nodes — spiral by date (sort by id desc = newest first = center)
  const recNodes = useMemo(() => {
    if (!activeTag) return [];
    const recs = tagClusters.get(activeTag) ?? [];
    const sorted = [...recs].sort((a, b) => b.id.localeCompare(a.id));
    const positions = spiralLayout(sorted.length, CX, CY);
    return sorted.map((rec, i) => ({ rec, ...positions[i] }));
  }, [activeTag, tagClusters]);

  // Note nodes — filtered by status, then by priority
  const noteNodes = useMemo(() => {
    if (!activeNoteType) return [];
    let filtered = notes.filter(n => n.type === activeNoteType);
    if (noteStatusFilter === 'active') filtered = filtered.filter(n => !n.isCompleted);
    if (noteStatusFilter === 'overdue') filtered = filtered.filter(n => {
      if (n.isCompleted) return false;
      const s = getNoteReminderStatus(n);
      return s === 'overdue' || (!n.dueDate && !n.isCompleted);
    });
    return noteLayout(filtered, CX, CY);
  }, [activeNoteType, notes, noteStatusFilter]);

  // Grid-sorted notes for Ideas/Tasks/Thoughts view
  const gridNotes = useMemo(() => {
    if (!activeNoteType) return [] as Note[];
    let filtered = notes.filter(n => n.type === activeNoteType);
    if (noteStatusFilter === 'active') filtered = filtered.filter(n => !n.isCompleted);
    if (searchQuery) filtered = filtered.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return [...filtered].sort((a, b) => {
      if (gridSort === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (gridSort === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.content.localeCompare(b.content, 'ru');
    });
  }, [activeNoteType, notes, noteStatusFilter, searchQuery, gridSort]);

  // List/grid sorted recordings for rec-nodes list+grid views
  const listRecordings = useMemo(() => {
    if (!activeTag) return [] as Recording[];
    const recs = tagClusters.get(activeTag) ?? [];
    let filtered = [...recs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(r => {
        const d = parseRecDate(r.date);
        if (!d) return true;
        const msAgo = now.getTime() - d.getTime();
        const dayMs = 86400000;
        if (dateFilter === 'week') return msAgo <= 7 * dayMs;
        if (dateFilter === 'month') return msAgo <= 30 * dayMs;
        return true;
      });
    }
    return filtered.sort((a, b) => b.id.localeCompare(a.id));
  }, [activeTag, tagClusters, searchQuery, dateFilter]);

  // Timeline-sorted notes for reminder view
  const timelineNotes = useMemo(() => {
    if (!activeNoteType) return [] as Note[];
    let filtered = notes.filter(n => n.type === activeNoteType);
    if (noteStatusFilter === 'active') filtered = filtered.filter(n => !n.isCompleted);
    if (noteStatusFilter === 'overdue') filtered = filtered.filter(n => {
      if (n.isCompleted) return false;
      return getNoteReminderStatus(n) === 'overdue';
    });
    if (searchQuery) filtered = filtered.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.sort((a, b) => {
      const da = a.dueDate && a.dueTime ? new Date(`${a.dueDate}T${a.dueTime}`).getTime() : Infinity;
      const db = b.dueDate && b.dueTime ? new Date(`${b.dueDate}T${b.dueTime}`).getTime() : Infinity;
      return da - db;
    });
  }, [activeNoteType, notes, noteStatusFilter, searchQuery]);

  const nodePositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    recNodes.forEach(({ rec, x, y }) => m.set(rec.id, { x, y }));
    return m;
  }, [recNodes]);

  // Compute dimmed sets for rec-nodes based on search + date filter
  const recDimmedSet = useMemo(() => {
    if (view !== 'rec-nodes') return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();
    const dimmed = new Set<string>();

    recNodes.forEach(({ rec }) => {
      let hide = false;

      // Search filter
      if (q) {
        const matchesSearch =
          rec.title.toLowerCase().includes(q) ||
          (rec.summary ?? '').toLowerCase().includes(q);
        if (!matchesSearch) hide = true;
      }

      // Date filter
      if (!hide && dateFilter !== 'all') {
        const d = parseRecDate(rec.date);
        if (d) {
          const msAgo = now.getTime() - d.getTime();
          const dayMs = 86400000;
          if (dateFilter === 'week' && msAgo > 7 * dayMs) hide = true;
          if (dateFilter === 'month' && msAgo > 30 * dayMs) hide = true;
        }
      }

      if (hide) dimmed.add(rec.id);
    });

    return dimmed;
  }, [view, recNodes, searchQuery, dateFilter]);

  // Compute dimmed set for note-nodes based on search
  const noteDimmedSet = useMemo(() => {
    if (view !== 'note-nodes') return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return new Set<string>();
    const dimmed = new Set<string>();
    noteNodes.forEach(({ note }) => {
      if (!note.content.toLowerCase().includes(q)) dimmed.add(note.id);
    });
    return dimmed;
  }, [view, noteNodes, searchQuery]);

  const overdueNotesCount = useMemo(() =>
    notes.filter(n => n.type === activeNoteType && !n.isCompleted && getNoteReminderStatus(n) === 'overdue').length,
  [notes, activeNoteType]);

  const handleCompleteNote = (note: Note) => {
    onUpdateNote?.({
      ...note,
      isCompleted: !note.isCompleted,
      completedAt: !note.isCompleted ? new Date().toISOString() : undefined,
      kanbanStatus: !note.isCompleted ? 'done' : 'new',
    });
  };

  const handleSnoozeNote = (note: Note, hours: number) => {
    const now = new Date();
    const base = (note.dueDate && note.dueTime)
      ? (() => { const d = new Date(`${note.dueDate}T${note.dueTime}`); return d < now ? now : d; })()
      : now;
    base.setTime(base.getTime() + hours * 3600000);
    onUpdateNote?.({ ...note, dueDate: base.toISOString().split('T')[0], dueTime: base.toTimeString().slice(0, 5) });
  };

  // Hover-based dimming: nodes not connected to hoveredId
  const hoverDimmedSet = useMemo(() => {
    if (!hoveredId || view !== 'rec-nodes') return new Set<string>();
    const connected = new Set<string>();
    connected.add(hoveredId);
    const conns = connections.get(hoveredId) ?? [];
    conns.forEach(c => connected.add(c.targetId));
    const dimmed = new Set<string>();
    recNodes.forEach(({ rec }) => {
      if (!connected.has(rec.id)) dimmed.add(rec.id);
    });
    return dimmed;
  }, [hoveredId, view, recNodes, connections]);

  // Combined dimmed: union of filter-dimmed and hover-dimmed
  const combinedRecDimmed = useMemo(() => {
    const result = new Set<string>(recDimmedSet);
    hoverDimmedSet.forEach(id => result.add(id));
    return result;
  }, [recDimmedSet, hoverDimmedSet]);

  // Overview stats
  const totalTasks = useMemo(() =>
    recordings.reduce((sum, r) => sum + (r.actionItems?.length ?? 0), 0),
  [recordings]);

  const incompleteTasks = useMemo(() =>
    notes.filter(n => n.type === 'Задача' && !n.isCompleted).length,
  [notes]);

  const handleBack = () => {
    setHoveredId(null);
    if (view === 'rec-nodes') { setView('rec-clusters'); setActiveTag(null); }
    else if (view === 'note-nodes') { setView('note-types'); setActiveNoteType(null); }
    else if (view === 'rec-clusters' || view === 'note-types') setView('overview');
    else onBack();
  };

  const titles: Record<View, string> = {
    'overview':    'Карта записей',
    'rec-clusters':'Голосовые записи',
    'note-types':  'Быстрые заметки',
    'rec-nodes':   activeTag ?? '',
    'note-nodes':  activeNoteType ?? '',
  };

  const subtitle: Partial<Record<View, string>> = {
    'overview':    'Кликните на кластер чтобы войти',
    'rec-nodes':   recNodes.length > 0 ? `${recNodes.length} запис${recNodes.length === 1 ? 'ь' : recNodes.length < 5 ? 'и' : 'ей'} · новые в центре` : '',
    'note-nodes':  noteNodes.length > 0 ? `${noteNodes.length} заметк${noteNodes.length === 1 ? 'а' : noteNodes.length < 5 ? 'и' : ''}` : '',
  };

  const stars = useMemo(
    () => Array.from({ length: 80 }, (_, i) => ({
      left: `${(i * 37 + 11) % 100}%`,
      top: `${(i * 53 + 7) % 100}%`,
      opacity: 0.04 + (i % 8) * 0.03,
      size: i % 12 === 0 ? 'w-1.5 h-1.5' : i % 4 === 0 ? 'w-1 h-1' : 'w-0.5 h-0.5',
      twinkle: i % 5 === 0,
    })),
    []
  );

  const showSearch = view === 'rec-nodes' || view === 'note-nodes';
  const showDateFilter = view === 'rec-nodes';
  const showNoteFilters = view === 'note-nodes';
  const showTimelineToggle = view === 'note-nodes' && activeNoteType === 'Напоминание';
  const showGridToggle = view === 'note-nodes' && activeNoteType !== 'Напоминание' && activeNoteType !== null;
  const showRecViewToggle = view === 'rec-nodes';

  return (
    <div className="h-screen w-full bg-background flex flex-col font-body select-none">
      {/* Header */}
      <header className="flex items-center px-6 md:px-10 py-4 border-b border-white/5 bg-surface-container-low flex-shrink-0 gap-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors flex-shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>

        <h1 className="text-xl font-black tracking-tighter text-primary uppercase font-headline flex-shrink-0">
          {titles[view]}
        </h1>

        {subtitle[view] && (
          <span className="text-sm text-on-surface-variant hidden md:inline flex-shrink-0">
            — {subtitle[view]}
          </span>
        )}

        {/* Date filter chips — only in rec-nodes */}
        {showDateFilter && (
          <div className="flex items-center gap-2 ml-2">
            {(['all', 'week', 'month'] as DateFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer"
                style={{
                  background: dateFilter === f ? 'rgba(123,97,255,0.22)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${dateFilter === f ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: dateFilter === f ? '#AF9CFF' : 'rgba(255,255,255,0.45)',
                }}
              >
                {f === 'all' ? 'Всё время' : f === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
        )}

        {/* Rec view mode toggle — only in rec-nodes */}
        {showRecViewToggle && (
          <div
            className="flex items-center rounded-full overflow-hidden ml-2"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {(['scatter', 'list', 'grid'] as RecViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setRecViewMode(m)}
                className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
                style={{
                  background: recViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                  color: recViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                }}
              >
                {m === 'scatter' ? '⬡ Карта' : m === 'list' ? '≡ Список' : '▦ Сетка'}
              </button>
            ))}
          </div>
        )}

        {/* Note status filter chips */}
        {showNoteFilters && (
          <div className="flex items-center gap-2 ml-2">
            {(['all', 'active', 'overdue'] as NoteStatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setNoteStatusFilter(f)}
                className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  background: noteStatusFilter === f ? 'rgba(123,97,255,0.22)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${noteStatusFilter === f ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: noteStatusFilter === f ? '#AF9CFF' : 'rgba(255,255,255,0.45)',
                }}
              >
                {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : (
                  <>
                    Просрочено
                    {overdueNotesCount > 0 && (
                      <span style={{ background: '#FF545930', color: '#FF5459', borderRadius: 9, padding: '0 5px', fontSize: 9, fontWeight: 900 }}>
                        {overdueNotesCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}

            {/* scatter / timeline toggle — only for Напоминание */}
            {showTimelineToggle && (
              <div
                className="flex items-center rounded-full overflow-hidden ml-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {(['scatter', 'timeline'] as NoteViewMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setNoteViewMode(m)}
                    className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
                    style={{
                      background: noteViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                      color: noteViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {m === 'scatter' ? '⬡ Карта' : '≡ Лента'}
                  </button>
                ))}
              </div>
            )}

            {/* scatter / grid toggle — for Ideas, Tasks, Thoughts */}
            {showGridToggle && (
              <div
                className="flex items-center rounded-full overflow-hidden ml-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {(['scatter', 'grid'] as NoteViewMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setNoteViewMode(m)}
                    className="text-[11px] font-bold px-3 py-1 transition-all cursor-pointer"
                    style={{
                      background: noteViewMode === m ? 'rgba(123,97,255,0.28)' : 'transparent',
                      color: noteViewMode === m ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {m === 'scatter' ? '⬡ Карта' : '▦ Сетка'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search icon + expandable input */}
        {showSearch && (
          <div className="flex items-center gap-2 ml-auto">
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  key="search-input"
                  className="overflow-hidden"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Поиск по названию..."
                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {searchOpen ? (
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="p-1.5 rounded-full hover:bg-white/8 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-full hover:bg-white/8 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Map canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Grid view — outside scale transform, full native pixels */}
        <AnimatePresence>
          {view === 'note-nodes' && noteViewMode === 'grid' && (
            <motion.div
              key="note-nodes-grid"
              className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Sort controls */}
              <div className="flex items-center gap-2 px-8 pt-6 pb-3">
                <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">Сортировка:</span>
                {([['newest', 'Новые'], ['oldest', 'Старые'], ['alpha', 'А–Я']] as [typeof gridSort, string][]).map(([val, label]) => (
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
                    const noteColor = NOTE_COLORS[note.type];
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline view — outside scale transform */}
        <AnimatePresence>
          {view === 'note-nodes' && noteViewMode === 'timeline' && (
            <motion.div
              key="note-nodes-timeline"
              className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="max-w-xl mx-auto py-10 px-4 space-y-3">
                {timelineNotes.length === 0 ? (
                  <p className="text-center text-on-surface-variant mt-20">Напоминаний нет</p>
                ) : timelineNotes.map((note, i) => {
                  const status = getNoteReminderStatus(note);
                  const isOverdue = status === 'overdue' && !note.isCompleted;
                  const dueStr = note.dueDate && note.dueTime
                    ? new Date(`${note.dueDate}T${note.dueTime}`).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : note.date;
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex gap-4 items-start group cursor-pointer"
                      onClick={onOpenNotes}
                    >
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1.5 flex-shrink-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            background: note.isCompleted ? '#4FC3F7' : isOverdue ? '#FF5459' : '#FFB74D',
                            boxShadow: isOverdue && !note.isCompleted ? '0 0 8px #FF545960' : 'none',
                          }}
                        />
                        {i < timelineNotes.length - 1 && (
                          <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.06)', minHeight: 32 }} />
                        )}
                      </div>

                      {/* Card */}
                      <div
                        className="flex-1 rounded-2xl p-3.5 border transition-colors mb-2"
                        style={{
                          background: isOverdue ? 'rgba(255,84,89,0.07)' : note.isCompleted ? 'rgba(255,255,255,0.03)' : 'rgba(255,183,77,0.06)',
                          borderColor: isOverdue ? 'rgba(255,84,89,0.25)' : note.isCompleted ? 'rgba(255,255,255,0.06)' : 'rgba(255,183,77,0.18)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-sm font-bold leading-snug ${note.isCompleted ? 'line-through opacity-40' : 'text-on-surface'}`}>
                            {note.content}
                          </p>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: isOverdue ? '#FF545920' : '#FFB74D15',
                              color: isOverdue ? '#FF5459' : '#FFB74D',
                            }}
                          >
                            {isOverdue ? '⚠ Просрочено' : dueStr}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant/50">{dueStr}</p>

                        {/* Quick actions */}
                        {!note.isCompleted && onUpdateNote && (
                          <div className="flex gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleCompleteNote(note)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                              style={{ background: '#4FC3F715', color: '#4FC3F7', border: '1px solid #4FC3F725' }}
                            >
                              ✓ Готово
                            </button>
                            <button
                              onClick={() => handleSnoozeNote(note, 1)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                              style={{ background: '#FFB74D15', color: '#FFB74D', border: '1px solid #FFB74D25' }}
                            >
                              ⏰ +1ч
                            </button>
                            <button
                              onClick={() => handleSnoozeNote(note, 24)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              +1 день
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rec list view — outside scale transform */}
        <AnimatePresence>
          {view === 'rec-nodes' && recViewMode === 'list' && (
            <motion.div
              key="rec-nodes-list"
              className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="max-w-2xl mx-auto py-6 px-4 md:px-8 space-y-2">
                {listRecordings.length === 0 ? (
                  <p className="text-center text-on-surface-variant mt-20">Записей нет</p>
                ) : listRecordings.map((rec, i) => {
                  const moodEmoji = extractMoodEmoji(rec.mood);
                  const moodColor = moodEmoji ? MOOD_COLORS[moodEmoji] : undefined;
                  const incomplete = hasIncompleteTasks(rec);
                  const dateStr = new Date(rec.date.replace(/\./g, '-')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  const durationStr = rec.duration ?? '';
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="flex items-start gap-3 p-4 rounded-2xl border cursor-pointer group transition-all"
                      style={{ background: 'rgba(28,28,33,0.75)', borderColor: 'rgba(123,97,255,0.12)' }}
                      onClick={() => onOpenDetail(rec.id)}
                    >
                      {/* Mood indicator */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg mt-0.5"
                        style={{ background: moodColor ? `${moodColor}18` : 'rgba(123,97,255,0.1)' }}
                      >
                        {moodEmoji ?? '🎙'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-on-surface leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                            {rec.title}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {incomplete && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#4FC3F715', color: '#4FC3F7' }}>
                                задачи
                              </span>
                            )}
                            <span className="text-[11px] text-on-surface-variant/50">{durationStr}</span>
                          </div>
                        </div>
                        {rec.summary && (
                          <p className="text-[12px] text-on-surface-variant/60 line-clamp-2 mt-0.5">{rec.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-on-surface-variant/40">{dateStr}</span>
                          {rec.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,97,255,0.1)', color: '#AF9CFF' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rec grid view — outside scale transform */}
        <AnimatePresence>
          {view === 'rec-nodes' && recViewMode === 'grid' && (
            <motion.div
              key="rec-nodes-grid"
              className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-8 py-6 pb-8">
                {listRecordings.length === 0 ? (
                  <p className="col-span-full text-center text-on-surface-variant mt-20">Записей нет</p>
                ) : listRecordings.map((rec, i) => {
                  const moodEmoji = extractMoodEmoji(rec.mood);
                  const moodColor = moodEmoji ? MOOD_COLORS[moodEmoji] : undefined;
                  const incomplete = hasIncompleteTasks(rec);
                  const dateStr = new Date(rec.date.replace(/\./g, '-')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-2xl border p-4 cursor-pointer group transition-all hover:border-primary/30"
                      style={{ background: 'rgba(28,28,33,0.75)', borderColor: moodColor ? `${moodColor}20` : 'rgba(123,97,255,0.12)' }}
                      onClick={() => onOpenDetail(rec.id)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{moodEmoji ?? '🎙'}</span>
                        {incomplete && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: '#4FC3F715', color: '#4FC3F7' }}>
                            задачи
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                        {rec.title}
                      </h3>
                      {rec.summary && (
                        <p className="text-[11px] text-on-surface-variant/55 line-clamp-3 mb-2">{rec.summary}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        <span className="text-[10px] text-on-surface-variant/40">{dateStr}</span>
                        {rec.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(123,97,255,0.1)', color: '#AF9CFF' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deep space background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.055]"
            style={{ background: 'radial-gradient(circle, #7B61FF, transparent)', left: '20%', top: '-10%' }} />
          <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, #4FC3F7, transparent)', right: '10%', bottom: '0%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-[90px] opacity-[0.035]"
            style={{ background: 'radial-gradient(circle, #AF9CFF, transparent)', left: '45%', top: '30%' }} />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(rgba(123,97,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(123,97,255,0.5) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          {stars.map((s, i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full bg-white ${s.size}`}
              style={{ left: s.left, top: s.top, opacity: s.opacity }}
              animate={s.twinkle ? { opacity: [s.opacity, s.opacity * 4, s.opacity] } : undefined}
              transition={s.twinkle ? { duration: 2 + (i % 4), repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 } : undefined}
            />
          ))}
        </div>

        {/* Virtual canvas */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ width: CW, height: CH, transform: `scale(${scale})`, transformOrigin: 'center center', position: 'relative', flexShrink: 0 }}>
            <AnimatePresence mode="wait">

              {/* ── Overview: 2 super-clusters ── */}
              {view === 'overview' && (
                <motion.div key="overview" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1={430} y1={CY} x2={1170} y2={CY} stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" strokeDasharray="8 12" />
                  </svg>

                  <MapCluster label="Голосовые записи" count={recordings.length} x={430} y={CY} radius={172}
                    color="#7B61FF" glowColor="#7B61FF"
                    icon={<Mic className="w-9 h-9" style={{ color: '#7B61FF' }} />}
                    onClick={onOpenSpaces} delay={0} />

                  {/* Stats under recordings cluster */}
                  <div
                    className="absolute text-center pointer-events-none"
                    style={{ left: 430 - 120, top: CY + 172 + 20, width: 240 }}
                  >
                    <p className="text-[11px] text-on-surface-variant/60">
                      {recordings.length} записей · {totalTasks} задач
                    </p>
                  </div>

                  <MapCluster label="Быстрые заметки" count={notes.length} x={1170} y={CY} radius={172}
                    color="#4FC3F7" glowColor="#4FC3F7"
                    icon={<FileText className="w-9 h-9" style={{ color: '#4FC3F7' }} />}
                    onClick={() => setView('note-types')} delay={0.1} unit="заметка" />

                  {/* Stats under notes cluster */}
                  <div
                    className="absolute text-center pointer-events-none"
                    style={{ left: 1170 - 120, top: CY + 172 + 20, width: 240 }}
                  >
                    <p className="text-[11px] text-on-surface-variant/60">
                      {notes.length} заметок · {incompleteTasks} активных
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Recording tag clusters ── */}
              {view === 'rec-clusters' && (
                <motion.div key="rec-clusters" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {tagPositions.map(({ tag, x, y }, i) => {
                    const count = tagClusters.get(tag)?.length ?? 0;
                    const r = Math.min(115, 68 + count * 10);
                    return (
                      <MapCluster key={tag} label={tag} count={count} x={x} y={y} radius={r}
                        color="#7B61FF" glowColor="#7B61FF"
                        onClick={() => { setActiveTag(tag); setView('rec-nodes'); }}
                        delay={i * 0.06} />
                    );
                  })}
                </motion.div>
              )}

              {/* ── Note type clusters ── */}
              {view === 'note-types' && (
                <motion.div key="note-types" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {noteTypePositions.map(({ type, x, y }, i) => {
                    const count = notes.filter(n => n.type === type).length;
                    const color = NOTE_COLORS[type];
                    return (
                      <MapCluster key={type} label={type} count={count} x={x} y={y} radius={105}
                        color={color} glowColor={color}
                        onClick={() => { setActiveNoteType(type); setView('note-nodes'); }}
                        delay={i * 0.07} unit="заметка" />
                    );
                  })}
                </motion.div>
              )}

              {/* ── Recording nodes — spiral time layout ── */}
              {view === 'rec-nodes' && (
                <motion.div key="rec-nodes" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <MapConnections hoveredId={hoveredId} connections={connections}
                    positions={nodePositions} canvasWidth={CW} canvasHeight={CH} />
                  {recNodes.map(({ rec, x, y }, i) => {
                    const moodEmoji = extractMoodEmoji(rec.mood);
                    const moodColor = moodEmoji ? MOOD_COLORS[moodEmoji] : undefined;
                    const incomplete = hasIncompleteTasks(rec);
                    const isDimmed = combinedRecDimmed.has(rec.id);
                    return (
                      <MapRecordingNode key={rec.id} recording={rec} x={x} y={y}
                        isHovered={hoveredId === rec.id}
                        hasConnections={(connections.get(rec.id)?.length ?? 0) > 0}
                        onHover={setHoveredId} onClick={onOpenDetail} delay={i * 0.045}
                        moodColor={moodColor}
                        hasIncompleteTasks={incomplete}
                        dimmed={isDimmed} />
                    );
                  })}
                  {recNodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-on-surface-variant text-lg">Записей в этом кластере нет</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Note nodes — scatter or timeline ── */}
              {view === 'note-nodes' && noteViewMode === 'scatter' && (
                <motion.div key="note-nodes-scatter" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {noteNodes.map(({ note, x, y }, i) => (
                    <MapNoteNode key={note.id} note={note} x={x} y={y}
                      isHovered={hoveredId === note.id}
                      onHover={setHoveredId}
                      onClick={() => onOpenNotes()}
                      delay={i * 0.045}
                      dimmed={noteDimmedSet.has(note.id)}
                      onComplete={onUpdateNote ? handleCompleteNote : undefined}
                      onSnooze={onUpdateNote ? handleSnoozeNote : undefined} />
                  ))}
                  {noteNodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-on-surface-variant text-lg">Заметок нет</p>
                    </div>
                  )}
                </motion.div>
              )}


            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
