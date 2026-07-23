import { useState } from 'react';
import { Pin, Clock, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recording, Space } from '../../types';

interface SpaceRecordingCardProps {
  rec: Recording;
  spaces: Space[];
  onOpen: () => void;
  onDelete: () => void;
  onPin: () => void;
  onMove: (spaceId: string | null) => void;
}

export const SpaceRecordingCard = ({ rec, spaces, onOpen, onDelete, onPin, onMove }: SpaceRecordingCardProps) => {
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
      <div className="absolute right-4 top-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          aria-label="Действия"
          aria-haspopup="true"
          aria-expanded={showMenu}
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
