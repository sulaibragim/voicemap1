import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recording, Note, NoteType } from '../../types';
import { parseRecDate } from '../../lib/utils';
import {
  CW, CH, CX, CY,
  NOTE_COLORS, NOTE_TYPES,
  circleLayout, spiralLayout, noteLayout,
  buildTagClusters, buildConnections,
  hasIncompleteTasks, getNoteReminderStatus,
  type View, type DateFilter, type NoteStatusFilter,
  type NoteViewMode, type RecViewMode,
} from '../../lib/mapUtils';
import { MapCluster } from './MapCluster';
import { MapRecordingNode } from './MapRecordingNode';
import { MapNoteNode } from './MapNoteNode';
import { MapConnections } from './MapConnections';
import { LibraryMapHeader } from './LibraryMapHeader';
import { LibraryMapOverview } from './LibraryMapOverview';
import { NoteGridView } from './NoteGridView';
import { NoteTimelineView } from './NoteTimelineView';
import { RecListView } from './RecListView';
import { RecGridView } from './RecGridView';

interface LibraryMapProps {
  recordings: Recording[];
  notes: Note[];
  onOpenDetail: (id: string) => void;
  onBack: () => void;
  onOpenNotes: () => void;
  onUpdateNote?: (note: Note) => void;
}

export const LibraryMap = ({
  recordings,
  notes,
  onOpenDetail,
  onBack,
  onOpenNotes,
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / CW, el.clientHeight / CH));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Reset search/filters when view changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchQuery('');
    setSearchOpen(false);
    setDateFilter('all');
    setNoteStatusFilter('all');
    setNoteViewMode('scatter');
    setGridSort('newest');
    setRecViewMode('scatter');
    /* eslint-enable react-hooks/set-state-in-effect */
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

  // Grid-sorted notes for Ideas/Tasks view
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
      if (q) {
        const matchesSearch =
          rec.title.toLowerCase().includes(q) ||
          (rec.summary ?? '').toLowerCase().includes(q);
        if (!matchesSearch) hide = true;
      }
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

  const totalTasks = useMemo(() =>
    recordings.reduce((sum, r) => sum + (r.actionItems?.length ?? 0), 0),
  [recordings]);

  const incompleteTasks = useMemo(() =>
    notes.filter(n => n.type === 'Задача' && !n.isCompleted).length,
  [notes]);

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

  const handleBack = () => {
    setHoveredId(null);
    if (view === 'rec-nodes') { setView('rec-clusters'); setActiveTag(null); }
    else if (view === 'note-nodes') { setView('note-types'); setActiveNoteType(null); }
    else if (view === 'rec-clusters' || view === 'note-types') setView('overview');
    else onBack();
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col font-body select-none">
      <LibraryMapHeader
        view={view}
        activeTag={activeTag}
        activeNoteType={activeNoteType}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        recViewMode={recViewMode}
        setRecViewMode={setRecViewMode}
        noteStatusFilter={noteStatusFilter}
        setNoteStatusFilter={setNoteStatusFilter}
        noteViewMode={noteViewMode}
        setNoteViewMode={setNoteViewMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        overdueNotesCount={overdueNotesCount}
        onBack={handleBack}
      />

      {/* Map canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">

        {/* Note grid view */}
        <AnimatePresence>
          {view === 'note-nodes' && noteViewMode === 'grid' && (
            <motion.div key="note-nodes-grid" className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <NoteGridView gridNotes={gridNotes} gridSort={gridSort} setGridSort={setGridSort}
                onOpenNotes={onOpenNotes} activeNoteType={activeNoteType} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline view */}
        <AnimatePresence>
          {view === 'note-nodes' && noteViewMode === 'timeline' && (
            <motion.div key="note-nodes-timeline" className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <NoteTimelineView timelineNotes={timelineNotes} onOpenNotes={onOpenNotes}
                onUpdateNote={onUpdateNote} onComplete={handleCompleteNote} onSnooze={handleSnoozeNote} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rec list view */}
        <AnimatePresence>
          {view === 'rec-nodes' && recViewMode === 'list' && (
            <motion.div key="rec-nodes-list" className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <RecListView recordings={listRecordings} onOpenDetail={onOpenDetail} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rec grid view */}
        <AnimatePresence>
          {view === 'rec-nodes' && recViewMode === 'grid' && (
            <motion.div key="rec-nodes-grid" className="absolute inset-0 overflow-y-auto z-10 bg-background"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <RecGridView recordings={listRecordings} onOpenDetail={onOpenDetail} />
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

              {/* Overview: 2 super-clusters */}
              {view === 'overview' && (
                <LibraryMapOverview
                  recordings={recordings}
                  notes={notes}
                  tagPositions={tagPositions}
                  tagClusters={tagClusters}
                  noteTypePositions={noteTypePositions}
                  stars={stars}
                  totalTasks={totalTasks}
                  incompleteTasks={incompleteTasks}
                  scale={scale}
                  onOpenRecClusters={() => setView('rec-clusters')}
                  onOpenNotesTypes={() => setView('note-types')}
                  onOpenNotes={onOpenNotes}
                />
              )}

              {/* Recording tag clusters */}
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

              {/* Note type clusters */}
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

              {/* Recording nodes — spiral time layout */}
              {view === 'rec-nodes' && (
                <motion.div key="rec-nodes" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <MapConnections hoveredId={hoveredId} connections={connections}
                    positions={nodePositions} canvasWidth={CW} canvasHeight={CH} />
                  {recNodes.map(({ rec, x, y }, i) => {
                    const incomplete = hasIncompleteTasks(rec);
                    const isDimmed = combinedRecDimmed.has(rec.id);
                    return (
                      <MapRecordingNode key={rec.id} recording={rec} x={x} y={y}
                        isHovered={hoveredId === rec.id}
                        hasConnections={(connections.get(rec.id)?.length ?? 0) > 0}
                        onHover={setHoveredId} onClick={onOpenDetail} delay={i * 0.045}
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

              {/* Note nodes — scatter */}
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
