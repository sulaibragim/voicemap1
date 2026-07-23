import { useState } from 'react';
import { X, Sparkles, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { Recording, Space } from '../../types';
import { CreateSpaceModal } from './CreateSpaceModal';

interface SpacePickerModalProps {
  recording: Recording;
  spaces: Space[];
  suggestedSpaceId?: string;
  onAssign: (spaceId: string | null) => void;
  onCreateAndAssign: (space: Omit<Space, 'id' | 'createdAt'>) => string;
}

export const SpacePickerModal = ({ recording, spaces, suggestedSpaceId, onAssign, onCreateAndAssign }: SpacePickerModalProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreate = (data: Omit<Space, 'id' | 'createdAt'>) => {
    const newId = onCreateAndAssign(data);
    onAssign(newId);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="bg-surface-container-high rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Запись готова</p>
            </div>
            <h2 className="font-headline text-xl font-bold leading-snug">Куда положить?</h2>
            <p className="text-sm text-on-surface-variant mt-1 line-clamp-1">{recording.title}</p>
            <button
              onClick={() => onAssign(null)}
              aria-label="Закрыть"
              className="absolute right-5 top-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>

          {/* Spaces list */}
          <div className="px-4 pb-2 space-y-2 max-h-64 overflow-y-auto">
            {spaces.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">Нет пространств — создай первое</p>
            ) : (
              spaces.map(space => {
                const isSuggested = space.id === suggestedSpaceId;
                return (
                  <button
                    key={space.id}
                    onClick={() => onAssign(space.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] border"
                    style={{
                      backgroundColor: isSuggested ? space.color + '18' : 'transparent',
                      borderColor: isSuggested ? space.color + '60' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="text-xl">{space.emoji}</span>
                    <span className="font-semibold text-sm flex-1 text-left">{space.name}</span>
                    {isSuggested && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: space.color + '25', color: space.color }}>
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pb-5 pt-3 space-y-2 border-t border-white/8 mt-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-white/20 text-sm text-on-surface-variant hover:bg-white/8 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Создать новое пространство
            </button>
            <button
              onClick={() => onAssign(null)}
              className="w-full py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              Пропустить
            </button>
          </div>
        </motion.div>
      </motion.div>

      <CreateSpaceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </>
  );
};
