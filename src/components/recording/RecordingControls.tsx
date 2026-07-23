import { Mic, MicOff, Pause, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  isMuted: boolean;
  onStart: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

export const RecordingControls = ({
  isRecording,
  isPaused,
  isMuted,
  onStart,
  onStop,
  onTogglePause,
  onToggleMute,
}: RecordingControlsProps) => {
  return (
    <>
      {/* Кнопки управления */}
      <div className="flex items-center gap-5 mb-8">
        {!isRecording ? (
          /* Кнопка старта */
          <motion.button
            onClick={onStart}
            whileTap={{ scale: 0.95 }}
            aria-label="Начать запись"
            className="w-20 h-20 rounded-full bg-error text-white flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,84,73,0.4)] cursor-pointer"
          >
            <Mic className="w-8 h-8" fill="currentColor" />
          </motion.button>
        ) : (
          <>
            {/* Мьют */}
            <motion.button
              onClick={onToggleMute}
              whileTap={{ scale: 0.92 }}
              aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isMuted
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  : 'bg-surface-container-high border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
              }`}
            >
              {isMuted
                ? <MicOff className="w-5 h-5" />
                : <Mic className="w-5 h-5" />
              }
            </motion.button>

            {/* Стоп — центр, большой */}
            <motion.button
              onClick={onStop}
              whileTap={{ scale: 0.92 }}
              aria-label="Остановить запись"
              className="w-20 h-20 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:scale-105 transition-transform border border-error/30 cursor-pointer shadow-[0_0_20px_rgba(255,84,73,0.2)]"
            >
              <Square className="w-6 h-6 fill-error" />
            </motion.button>

            {/* Пауза / Продолжить */}
            <motion.button
              onClick={onTogglePause}
              whileTap={{ scale: 0.92 }}
              aria-label={isPaused ? 'Продолжить запись' : 'Пауза'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                isPaused
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-surface-container-high border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
              }`}
            >
              {isPaused
                ? <Play className="w-5 h-5 fill-primary" />
                : <Pause className="w-5 h-5" />
              }
            </motion.button>
          </>
        )}
      </div>

      {/* Подсказки под кнопками */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-9 text-[10px] text-on-surface-variant/40 font-bold tracking-wider uppercase"
          >
            <span>Мьют</span>
            <span className="w-8 text-center">Стоп</span>
            <span>{isPaused ? 'Продолжить' : 'Пауза'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
