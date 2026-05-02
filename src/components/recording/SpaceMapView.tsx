import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, ArrowLeft, LayoutList, Mic, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recording, Space } from '../../types';
import { MapCluster } from './MapCluster';
import { CreateSpaceModal } from './CreateSpaceModal';
import { circleLayout, spiralLayout } from '../../lib/mapUtils';
import { RecordingMapCard } from './RecordingMapCard';

const CW = 1600;
const CH = 760;
const CX = CW / 2;
const CY = CH / 2;

/* ── Main component ── */
interface SpaceMapViewProps {
  recordings: Recording[];
  spaces: Space[];
  onBack: () => void;
  onOpenDetail: (id: string) => void;
  onCreateSpace: (data: Omit<Space, 'id' | 'createdAt'>) => void;
  onSwitchToList: () => void;
  controlledActiveSpaceId?: string | null;
  onSetActiveSpaceId?: (id: string | null) => void;
  onDeleteSpace?: (id: string) => void;
  onUpdateSpace?: (space: Space) => void;
}

export const SpaceMapView = ({
  recordings, spaces, onBack, onOpenDetail, onCreateSpace, onSwitchToList,
  controlledActiveSpaceId, onSetActiveSpaceId, onDeleteSpace, onUpdateSpace,
}: SpaceMapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [localActiveSpaceId, setLocalActiveSpaceId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpaceName, setEditingSpaceName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Controlled vs uncontrolled active space
  const activeSpaceId = controlledActiveSpaceId !== undefined ? controlledActiveSpaceId : localActiveSpaceId;
  const setActiveSpaceId = (id: string | null) => {
    setLocalActiveSpaceId(id);
    onSetActiveSpaceId?.(id);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / CW, el.clientHeight / CH));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stars = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    left: `${(i * 37 + 11) % 100}%`,
    top: `${(i * 53 + 7) % 100}%`,
    opacity: 0.04 + (i % 8) * 0.03,
    cls: i % 12 === 0 ? 'w-1.5 h-1.5' : i % 4 === 0 ? 'w-1 h-1' : 'w-0.5 h-0.5',
  })), []);

  // Show all spaces including empty ones
  const activeSpaces = useMemo(() => spaces, [spaces]);

  const totalCircles = activeSpaces.length + 1; // +1 for "create"
  const circleR = totalCircles <= 3 ? 200 : totalCircles <= 5 ? 240 : 270;
  const positions = useMemo(() => circleLayout(totalCircles, CX, CY, circleR), [totalCircles, circleR]);

  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const spaceRecordings = useMemo(() =>
    activeSpaceId ? recordings.filter(r => r.spaceId === activeSpaceId) : [],
    [activeSpaceId, recordings]
  );
  const recNodes = useMemo(() => {
    const pos = spiralLayout(spaceRecordings.length, CX, CY);
    return spaceRecordings.map((rec, i) => ({ rec, ...pos[i] }));
  }, [spaceRecordings]);

  return (
    <div className="h-screen w-full bg-background flex flex-col font-body select-none">
      {/* Header */}
      <header className="flex items-center px-6 py-4 border-b border-white/5 bg-surface-container-low flex-shrink-0 gap-4">
        <button
          onClick={activeSpaceId ? () => { setActiveSpaceId(null); setHoveredId(null); } : onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>

        <h1 className="font-headline text-xl font-black tracking-tighter uppercase flex-1 flex items-center flex-wrap gap-2">
          {activeSpace
            ? <><span style={{ color: activeSpace.color }}>{activeSpace.emoji} {activeSpace.name}</span><span className="text-sm text-on-surface-variant font-normal normal-case">— {spaceRecordings.length} записей</span></>
            : <span className="text-primary">Голосовые записи</span>
          }
          {activeSpaceId && activeSpace && (
            <div className="flex items-center gap-2 ml-2">
              {editingSpaceName ? (
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onBlur={() => {
                    if (editNameValue.trim() && onUpdateSpace) {
                      onUpdateSpace({ ...activeSpace, name: editNameValue.trim() });
                    }
                    setEditingSpaceName(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (editNameValue.trim() && onUpdateSpace) onUpdateSpace({ ...activeSpace, name: editNameValue.trim() });
                      setEditingSpaceName(false);
                    }
                    if (e.key === 'Escape') setEditingSpaceName(false);
                  }}
                  className="bg-surface-container border border-white/20 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:border-primary/50 w-36"
                />
              ) : (
                <button
                  onClick={() => { setEditingSpaceName(true); setEditNameValue(activeSpace.name); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
                  title="Переименовать"
                >
                  <Pencil className="w-3 h-3" /> Переименовать
                </button>
              )}
              <button
                onClick={() => {
                  if (onDeleteSpace) {
                    onDeleteSpace(activeSpaceId);
                    setActiveSpaceId(null);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-error/60 hover:text-error hover:bg-error/10 transition-colors cursor-pointer border border-error/20"
                title="Удалить пространство"
              >
                <Trash2 className="w-3 h-3" /> Удалить
              </button>
            </div>
          )}
        </h1>

        <button
          onClick={onSwitchToList}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
        >
          <LayoutList className="w-3.5 h-3.5" />
          Список
        </button>
      </header>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Stars background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]" style={{ background: 'radial-gradient(circle, #7B61FF, transparent)', left: '20%', top: '-10%' }} />
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[100px]" style={{ background: 'radial-gradient(circle, #4FC3F7, transparent)', right: '10%', bottom: '0%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[90px]" style={{ background: 'radial-gradient(circle, #AF9CFF, transparent)', left: '45%', top: '30%' }} />
          {stars.map((s, i) => (
            <div key={i} className={`absolute rounded-full bg-white ${s.cls}`} style={{ left: s.left, top: s.top, opacity: s.opacity }} />
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ width: CW, height: CH, transform: `scale(${scale})`, transformOrigin: 'center center', position: 'relative', flexShrink: 0 }}>
            <AnimatePresence mode="wait">

              {/* Overview: space bubbles */}
              {!activeSpaceId && (
                <motion.div key="overview" className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                >
                  {activeSpaces.map((space, i) => {
                    const pos = positions[i];
                    const count = recordings.filter(r => r.spaceId === space.id).length;
                    const r = Math.max(100, Math.min(160, 85 + count * 12));
                    return pos ? (
                      <MapCluster
                        key={space.id}
                        label={space.name}
                        count={count}
                        x={pos.x}
                        y={pos.y}
                        radius={r}
                        color={space.color}
                        glowColor={space.color}
                        icon={<span style={{ fontSize: r * 0.28, lineHeight: 1 }}>{space.emoji}</span>}
                        onClick={() => setActiveSpaceId(space.id)}
                        delay={i * 0.08}
                      />
                    ) : null;
                  })}

                  {/* Create space bubble */}
                  {(() => {
                    const pos = positions[activeSpaces.length];
                    if (!pos) return null;
                    return (
                      <motion.button
                        className="absolute cursor-pointer"
                        style={{ left: pos.x - 90, top: pos.y - 90, width: 180, height: 180 }}
                        initial={{ opacity: 0, scale: 0.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 70, delay: activeSpaces.length * 0.08 }}
                        whileHover={{ scale: 1.06 }}
                        onClick={() => setShowCreateModal(true)}
                      >
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: '1.5px dashed rgba(255,255,255,0.18)' }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full border border-dashed border-white/20 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-on-surface-variant" />
                          </div>
                          <span className="text-sm font-bold text-on-surface-variant">Создать</span>
                        </div>
                      </motion.button>
                    );
                  })()}

                  {/* Empty state when no spaces */}
                  {activeSpaces.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
                      <p className="font-headline text-2xl font-bold text-on-surface-variant opacity-40">Нет пространств</p>
                      <p className="text-sm text-on-surface-variant opacity-30">Нажми + чтобы создать первое пространство</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Space detail: recording cards */}
              {activeSpaceId && (
                <motion.div key={`detail-${activeSpaceId}`} className="absolute inset-0"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                >
                  {spaceRecordings.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                      <Mic className="w-16 h-16 text-on-surface-variant opacity-20" />
                      <p className="font-headline text-2xl font-bold text-on-surface-variant opacity-40">Пространство пусто</p>
                    </div>
                  ) : (
                    recNodes.map(({ rec, x, y }, i) => (
                      <RecordingMapCard
                        key={rec.id}
                        rec={rec}
                        x={x}
                        y={y}
                        isHovered={hoveredId === rec.id}
                        onHover={setHoveredId}
                        onClick={() => onOpenDetail(rec.id)}
                        delay={i * 0.05}
                        color={activeSpace?.color ?? '#7B61FF'}
                      />
                    ))
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      <CreateSpaceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={onCreateSpace}
      />
    </div>
  );
};
