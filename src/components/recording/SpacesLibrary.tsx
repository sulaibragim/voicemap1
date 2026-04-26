import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Search, X, Clock, Trash2, AudioLines, FolderOpen, Pin, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recording, Space } from '../../types';
import { CreateSpaceModal } from './CreateSpaceModal';
import { SpaceMapView } from './SpaceMapView';

interface SpacesLibraryProps {
  recordings: Recording[];
  spaces: Space[];
  onBack: () => void;
  onOpenDetail: (id: string) => void;
  onDeleteRecording: (id: string) => void;
  onUpdateRecording: (r: Recording) => void;
  onCreateSpace: (space: Omit<Space, 'id' | 'createdAt'>) => void;
  onDeleteSpace: (id: string) => void;
  onMoveRecording: (recordingId: string, spaceId: string | null) => void;
  activeSpaceId?: string | null;
  onSetActiveSpaceId?: (id: string | null) => void;
  onUpdateSpace?: (space: Space) => void;
}

function groupByDate(recs: Recording[]): { label: string; items: Recording[] }[] {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, Recording[]> = {};
  recs.forEach(r => {
    const d = new Date(r.date.replace(/\./g, '-') || r.date);
    const key = isNaN(d.getTime()) ? 'Ранее'
      : d.toDateString() === today ? 'Сегодня'
      : d.toDateString() === yesterday ? 'Вчера'
      : r.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export const SpacesLibrary = ({
  recordings, spaces, onBack, onOpenDetail, onDeleteRecording,
  onUpdateRecording, onCreateSpace, onDeleteSpace, onMoveRecording,
  activeSpaceId: controlledSpaceMapId, onSetActiveSpaceId, onUpdateSpace,
}: SpacesLibraryProps) => {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeSpaceId, setActiveSpaceId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hooks MUST be before any conditional return (Rules of Hooks)
  const filtered = useMemo(() => {
    let recs = activeSpaceId === 'all' ? recordings : recordings.filter(r => r.spaceId === activeSpaceId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      recs = recs.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return recs;
  }, [recordings, activeSpaceId, searchQuery]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const activeSpace = spaces.find(s => s.id === activeSpaceId);

  if (viewMode === 'map') {
    return (
      <SpaceMapView
        recordings={recordings}
        spaces={spaces}
        onBack={onBack}
        onOpenDetail={onOpenDetail}
        onCreateSpace={onCreateSpace}
        onSwitchToList={() => setViewMode('list')}
        controlledActiveSpaceId={controlledSpaceMapId}
        onSetActiveSpaceId={onSetActiveSpaceId}
        onDeleteSpace={onDeleteSpace}
        onUpdateSpace={onUpdateSpace}
      />
    );
  }

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setTimeout(() => { onDeleteRecording(id); setDeletingId(null); }, 300);
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-white/8 bg-surface-container/20 h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-lg font-bold leading-tight">Библиотека</h1>
            <p className="text-[11px] text-on-surface-variant">{recordings.length} записей</p>
          </div>
          <button
            onClick={() => setViewMode('map')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
            title="Режим карты"
          >
            <Globe className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 bg-surface-container rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск записей..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-on-surface-variant/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="cursor-pointer">
                <X className="w-3.5 h-3.5 text-on-surface-variant" />
              </button>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
          {/* All recordings */}
          <button
            onClick={() => setActiveSpaceId('all')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all cursor-pointer ${activeSpaceId === 'all' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-white/8 hover:text-on-surface'}`}
          >
            <AudioLines className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Все записи</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeSpaceId === 'all' ? 'bg-primary/20' : 'bg-white/8'}`}>{recordings.length}</span>
          </button>

          {/* Spaces divider */}
          {spaces.length > 0 && (
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">Пространства</p>
            </div>
          )}

          {/* Space items */}
          {spaces.map(space => {
            const count = recordings.filter(r => r.spaceId === space.id).length;
            const isActive = activeSpaceId === space.id;
            return (
              <button
                key={space.id}
                onClick={() => setActiveSpaceId(space.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all cursor-pointer group ${isActive ? 'bg-white/10 text-on-surface' : 'text-on-surface-variant hover:bg-white/8 hover:text-on-surface'}`}
              >
                <span className="text-base flex-shrink-0">{space.emoji}</span>
                <span className="flex-1 text-left truncate">{space.name}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all ${isActive ? 'opacity-100' : 'opacity-60'}`} style={{ backgroundColor: space.color + '22', color: space.color }}>{count}</span>
              </button>
            );
          })}

          {/* Create space button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-on-surface-variant hover:bg-white/8 hover:text-on-surface transition-all cursor-pointer mt-1"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full border border-dashed border-on-surface-variant/40">
              <Plus className="w-3 h-3" />
            </div>
            <span>Создать пространство</span>
          </button>
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Content header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/8 px-8 py-5">
          <div className="flex items-center justify-between">
            {activeSpace ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeSpace.emoji}</span>
                <div>
                  <h2 className="font-headline text-2xl font-bold" style={{ color: activeSpace.color }}>{activeSpace.name}</h2>
                  <p className="text-xs text-on-surface-variant">{filtered.length} записей</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="font-headline text-2xl font-bold">Все записи</h2>
                <p className="text-xs text-on-surface-variant">{filtered.length} записей</p>
              </div>
            )}
          </div>
        </div>

        {/* Recordings */}
        <div className="px-8 py-6 max-w-3xl">
          {filtered.length === 0 ? (
            <EmptyState hasSpaces={spaces.length > 0} isSpace={!!activeSpace} spaceName={activeSpace?.name} onCreateSpace={() => setShowCreateModal(true)} />
          ) : (
            <div className="space-y-8">
              {groups.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">{group.label}</p>
                  <div className="space-y-3">
                    {group.items.map((rec, idx) => (
                      <AnimatePresence key={rec.id}>
                        {deletingId !== rec.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -40, height: 0 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            <RecordingCard
                              rec={rec}
                              spaces={spaces}
                              onOpen={() => onOpenDetail(rec.id)}
                              onDelete={() => handleDelete(rec.id)}
                              onPin={() => onUpdateRecording({ ...rec, pinned: !rec.pinned })}
                              onMove={(spaceId) => onMoveRecording(rec.id, spaceId)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateSpaceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(data) => onCreateSpace(data)}
      />
    </div>
  );
};

/* ── Recording Card ── */
interface RecordingCardProps {
  rec: Recording;
  spaces: Space[];
  onOpen: () => void;
  onDelete: () => void;
  onPin: () => void;
  onMove: (spaceId: string | null) => void;
}

const RecordingCard = ({ rec, spaces, onOpen, onDelete, onPin, onMove }: RecordingCardProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const recSpace = spaces.find(s => s.id === rec.spaceId);

  return (
    <div className="relative group">
      <div
        onClick={onOpen}
        className="flex items-start gap-4 p-5 bg-surface-container rounded-2xl hover:bg-surface-container-high transition-all cursor-pointer border border-white/4 hover:border-white/10"
      >
        {/* Color accent */}
        <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: recSpace?.color ?? (rec.tags[0] ? '#7B61FF' : '#ffffff20') }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm leading-snug line-clamp-1">{rec.title}</h3>
            {rec.pinned && <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />}
          </div>
          {rec.summary && (
            <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">{rec.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
              <Clock className="w-3 h-3" />{rec.duration}
            </span>
            {recSpace && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: recSpace.color + '20', color: recSpace.color }}>
                {recSpace.emoji} {recSpace.name}
              </span>
            )}
            {rec.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[11px] text-on-surface-variant/60">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Context menu button */}
      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container-high hover:bg-white/15 transition-colors cursor-pointer text-on-surface-variant"
        >
          <span className="text-xs font-bold leading-none">···</span>
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              className="absolute right-0 top-9 z-20 bg-surface-container-high rounded-2xl shadow-2xl border border-white/10 py-1.5 min-w-[180px]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => { onPin(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-white/8 transition-colors cursor-pointer flex items-center gap-2">
                <Pin className="w-3.5 h-3.5" /> {rec.pinned ? 'Открепить' : 'Закрепить'}
              </button>
              {spaces.length > 0 && (
                <>
                  <div className="border-t border-white/8 my-1" />
                  <p className="px-4 py-1 text-[10px] text-on-surface-variant/50 uppercase tracking-wider">Переместить в</p>
                  {spaces.map(s => (
                    <button key={s.id} onClick={() => { onMove(s.id); setShowMenu(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/8 transition-colors cursor-pointer flex items-center gap-2 ${rec.spaceId === s.id ? 'text-primary' : ''}`}>
                      <span>{s.emoji}</span> {s.name}
                    </button>
                  ))}
                  <button onClick={() => { onMove(null); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-white/8 transition-colors cursor-pointer text-on-surface-variant">
                    Без пространства
                  </button>
                </>
              )}
              <div className="border-t border-white/8 my-1" />
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Удалить
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ── Empty State ── */
const EmptyState = ({ hasSpaces, isSpace, spaceName, onCreateSpace }: { hasSpaces: boolean; isSpace: boolean; spaceName?: string; onCreateSpace: () => void }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
    <div className="w-24 h-24 rounded-3xl bg-surface-container flex items-center justify-center">
      <FolderOpen className="w-10 h-10 text-on-surface-variant opacity-40" />
    </div>
    {!hasSpaces ? (
      <>
        <div>
          <p className="font-headline text-2xl font-bold mb-2">Создай первое пространство</p>
          <p className="text-sm text-on-surface-variant max-w-xs">Пространства помогают организовать записи по проектам, темам или контексту</p>
        </div>
        <button onClick={onCreateSpace} className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Создать пространство
        </button>
      </>
    ) : isSpace ? (
      <div>
        <p className="font-headline text-xl font-bold mb-2">В «{spaceName}» пока пусто</p>
        <p className="text-sm text-on-surface-variant">Записи появятся здесь после следующей сессии или перемести уже существующие</p>
      </div>
    ) : (
      <div>
        <p className="font-headline text-xl font-bold mb-2">Ничего не найдено</p>
        <p className="text-sm text-on-surface-variant">Попробуй другой запрос</p>
      </div>
    )}
  </div>
);
