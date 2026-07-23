import { motion } from 'motion/react';
import { Mic } from 'lucide-react';

interface LiveSessionCardProps {
  onStartRecording: () => void;
}

const WAVE_HEIGHTS = [8, 16, 10, 24, 14, 32, 20, 12, 28, 18, 36, 14, 22, 10, 18, 26, 12, 30, 16, 8];

export const LiveSessionCard = ({ onStartRecording }: LiveSessionCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onStartRecording}
    whileHover={{ scale: 1.015 }}
    transition={{ duration: 0.2 }}
    className="col-span-12 md:col-span-4 lg:col-span-4 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center min-h-[160px] lg:min-h-0 cursor-pointer border border-white/[0.07] group"
    style={{ background: 'linear-gradient(145deg, rgba(123,97,255,0.14) 0%, rgba(18,18,24,1) 65%)' }}
  >
    {/* Ambient glow */}
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-[70px] opacity-25 pointer-events-none"
      style={{ background: 'radial-gradient(circle, #7B61FF 0%, transparent 70%)' }} />

    {/* Pulse rings */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="absolute rounded-full border border-primary/15"
          style={{ width: 76 + i * 34, height: 76 + i * 34 }}
          animate={{ opacity: [0.7, 0], scale: [0.82, 1.28] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.75, ease: 'easeOut' }} />
      ))}
    </div>

    {/* Mic button */}
    <div className="relative z-10 w-[68px] h-[68px] rounded-full flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95"
      style={{
        background: 'linear-gradient(140deg, #9B81FF 0%, #7B61FF 60%, #5B41DF 100%)',
        boxShadow: '0 8px 36px rgba(123,97,255,0.55), 0 0 0 1px rgba(155,129,255,0.25)',
      }}>
      <Mic className="w-7 h-7 text-white" fill="white" />
    </div>

    <span className="relative z-10 mt-3 text-[10px] font-black tracking-[0.2em] uppercase text-on-surface-variant">
      Запись
    </span>

    {/* Decorative waveform at bottom */}
    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[3px] px-6 pb-0 opacity-[0.07] pointer-events-none">
      {WAVE_HEIGHTS.map((h, i) => (
        <div key={i} className="w-[5px] rounded-t-sm flex-shrink-0" style={{ height: h, background: '#7B61FF' }} />
      ))}
    </div>
  </motion.div>
);
