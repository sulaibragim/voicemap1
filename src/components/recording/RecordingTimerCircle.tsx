import { motion, AnimatePresence } from 'motion/react';
import { formatTime } from '../../lib/utils';

interface RecordingTimerCircleProps {
  duration: number;
  isRecording: boolean;
  isPaused: boolean;
  isMuted: boolean;
}

export const RecordingTimerCircle = ({ duration, isRecording, isPaused, isMuted }: RecordingTimerCircleProps) => {
  return (
    <div className="relative flex items-center justify-center mb-10">
      {isRecording && !isPaused && (
        <>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute w-64 h-64 rounded-full bg-error/20 blur-xl"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.2 }}
            className="absolute w-64 h-64 rounded-full bg-error/10 blur-2xl"
          />
        </>
      )}
      {isRecording && isPaused && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute w-64 h-64 rounded-full bg-primary/15 blur-xl"
        />
      )}

      <div className="w-48 h-48 rounded-full bg-surface-container-high border-4 border-surface-container flex flex-col items-center justify-center z-10 relative shadow-2xl gap-1">
        <div className="text-4xl font-mono font-bold text-white tracking-wider">
          {formatTime(duration)}
        </div>
        <AnimatePresence mode="wait">
          {isRecording && (
            <motion.div
              key={isPaused ? 'paused' : isMuted ? 'muted' : 'recording'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={`text-[10px] font-bold tracking-widest uppercase ${
                isPaused ? 'text-primary' : isMuted ? 'text-yellow-400' : 'text-error'
              }`}
            >
              {isPaused ? '⏸ Пауза' : isMuted ? '🔇 Без звука' : '● Запись'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
