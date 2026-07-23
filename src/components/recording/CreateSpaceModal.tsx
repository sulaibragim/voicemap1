import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Space } from '../../types';

const EMOJIS = ['🚀', '💡', '💼', '📋', '🎯', '🧠', '❤️', '🌱', '🎨', '📊', '🔬', '⚡', '🏆', '🌍', '🎵', '💎'];
const COLORS = ['#7B61FF', '#4FC3F7', '#81C784', '#FFB74D', '#F06292', '#FF7043'];

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (space: Omit<Space, 'id' | 'createdAt'>) => void;
}

export const CreateSpaceModal = ({ open, onClose, onCreate }: CreateSpaceModalProps) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [color, setColor] = useState('#7B61FF');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName('');
      setEmoji('🚀');
      setColor('#7B61FF');
      /* eslint-enable react-hooks/set-state-in-effect */
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, emoji, color });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-surface-container-high rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline text-xl font-bold">Новое пространство</h2>
              <button onClick={onClose} aria-label="Закрыть" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-surface-container">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: color + '22', border: `2px solid ${color}44` }}>
                {emoji}
              </div>
              <div>
                <p className="font-bold text-base" style={{ color }}>{name || 'Название...'}</p>
                <p className="text-xs text-on-surface-variant">0 записей</p>
              </div>
            </div>

            {/* Name input */}
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Название пространства"
              maxLength={32}
              className="w-full bg-surface-container rounded-2xl px-4 py-3 text-sm font-medium outline-none border border-white/8 focus:border-primary/60 transition-colors mb-4"
            />

            {/* Emoji picker */}
            <p className="text-xs text-on-surface-variant font-bold mb-2 uppercase tracking-wider">Иконка</p>
            <div className="grid grid-cols-8 gap-1.5 mb-5">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  aria-label={`Выбрать эмодзи ${e}`}
                  aria-pressed={emoji === e}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${emoji === e ? 'scale-110 ring-2 ring-primary' : 'hover:bg-white/10'}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Color picker */}
            <p className="text-xs text-on-surface-variant font-bold mb-2 uppercase tracking-wider">Цвет</p>
            <div className="flex gap-2 mb-6">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Выбрать цвет ${c}`}
                  aria-pressed={color === c}
                  className={`w-8 h-8 rounded-full transition-all cursor-pointer ${color === c ? 'scale-125 ring-2 ring-white/60 ring-offset-2 ring-offset-surface-container-high' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: color, color: '#fff' }}
            >
              Создать пространство
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
