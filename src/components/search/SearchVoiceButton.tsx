import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface SearchVoiceButtonProps {
  isRecording: boolean;
  isSearching: boolean;
  recordingTime: number;
  onStart: () => void;
  onStop: () => void;
  formatTime: (seconds: number) => string;
}

/**
 * Большая кнопка голосового поиска — три визуальных состояния:
 * простой (микрофон) → слушаю (пульсация + «Стоп») → ищу (спиннер).
 */
export const SearchVoiceButton = ({
  isRecording, isSearching, recordingTime, onStart, onStop, formatTime,
}: SearchVoiceButtonProps) => (
  <div className="flex justify-center mb-5">
    <AnimatePresence mode="wait">
      {isSearching ? (
        <motion.div
          key="searching"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-xs md:max-w-sm h-16 md:h-20 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center gap-3 text-on-surface-variant font-bold text-base md:text-lg"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Ищу...</span>
        </motion.div>
      ) : isRecording ? (
        <motion.div
          key="recording"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-xs md:max-w-sm h-16 md:h-20 rounded-full bg-error/10 border border-error/30 flex items-center gap-3 pl-3 pr-5"
        >
          {/* Пульсирующие кольца — визуальный признак записи */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-error/25"
                style={{ inset: -(i * 10) }}
                animate={{ opacity: [0.6, 0], scale: [1, 1.2] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
              />
            ))}
          </div>
          <button
            onClick={onStop}
            aria-label="Остановить запись"
            className="relative z-10 shrink-0 flex items-center gap-2 h-11 md:h-12 px-4 rounded-full bg-error text-white font-bold text-sm animate-pulse cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" />
            Стоп
          </button>
          <div className="relative z-10 flex-1 min-w-0">
            <p className="text-sm font-bold text-error">Слушаю…</p>
            <p className="text-xs font-mono text-error/70">{formatTime(recordingTime)}</p>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="idle"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={onStart}
          aria-label="Найти голосом"
          className="w-full max-w-xs md:max-w-sm h-16 md:h-20 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center gap-3 font-black text-base md:text-lg cursor-pointer active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 36px rgba(123,97,255,0.45)' }}
        >
          <Mic className="w-6 h-6 md:w-7 md:h-7" />
          Найти голосом
        </motion.button>
      )}
    </AnimatePresence>
  </div>
);
