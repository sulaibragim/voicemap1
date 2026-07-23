import { useState } from 'react';
import type * as React from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { parseTimestamp } from '../../lib/timestamp';
import type { TranscriptItem } from '../../types';

// Парсер таймкода вынесен в src/lib/timestamp.ts (переиспользуется TranscriptSection,
// RecordingMobileTabs, RecordingDetail) — здесь оставляем ре-экспорт для обратной совместимости импортов.
// eslint-disable-next-line react-refresh/only-export-components
export { parseTimestamp };

interface AudioPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  recordingDuration: string;
  hasAudioUrl: boolean;
  transcript: TranscriptItem[];
  keyMomentMarkers: { timestamp: string; label: string }[];
  appendBoundaryTimestamp: number | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onTimestampClick: (ts: string) => void;
  variant: 'compact' | 'full';
}

// Парсинг строки "MM:SS" или "HH:MM:SS" в секунды — fallback когда audio.duration = NaN/Infinity
function parseDurationString(s: string): number {
  const parts = s.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export const AudioPlayer = ({
  isPlaying,
  currentTime,
  duration,
  recordingDuration,
  hasAudioUrl,
  transcript,
  keyMomentMarkers,
  appendBoundaryTimestamp,
  onTogglePlay,
  onSeek,
  onTimestampClick,
  variant,
}: AudioPlayerProps) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Если audio.duration = NaN/Infinity — берём длину из строки метаданных записи
  const metaDuration = parseDurationString(recordingDuration);
  const validDuration = (isFinite(duration) && duration > 0)
    ? duration
    : (metaDuration > 0 ? metaDuration : 0);
  const validCurrentTime = isFinite(currentTime) ? currentTime : 0;
  const progressPercent = validDuration > 0 ? (validCurrentTime / validDuration) * 100 : 0;

  const displayDuration = (hasAudioUrl && validDuration > 0)
    ? formatTime(validDuration)
    : recordingDuration;

  const filteredTranscript = transcript.filter(t => t.timestamp !== '--:--');

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value));
  };

  const handleRangeHover = (e: React.MouseEvent<HTMLInputElement>) => {
    if (validDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * validDuration);
  };

  // Общий блок слайдера — нативный range поверх кастомного бара
  const renderSlider = (barHeight: string) => (
    <div className="relative w-full" style={{ paddingTop: 6, paddingBottom: 6 }}>
      {/* Визуальный бар (только отображение, не интерактивный) */}
      <div className={`${barHeight} w-full bg-surface-container-highest rounded-full relative pointer-events-none`}>
        {/* Прогресс */}
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Точки реплик */}
        {validDuration > 0 && filteredTranscript.map((t, i) => {
          const left = (parseTimestamp(t.timestamp) / validDuration) * 100;
          return (
            <div
              key={i}
              className="absolute top-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                left: `${left}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: t.isAppended ? '#f59e0b' : 'rgba(255,255,255,0.55)',
              }}
            />
          );
        })}

        {/* Маркеры ключевых моментов */}
        {validDuration > 0 && keyMomentMarkers.map((km, i) => {
          const left = (parseTimestamp(km.timestamp) / validDuration) * 100;
          return (
            <div
              key={`km-${i}`}
              className="absolute top-1/2 w-2.5 h-2.5 rounded-full border border-black/20"
              style={{
                left: `${left}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#f59e0b',
                zIndex: 2,
              }}
            />
          );
        })}

        {/* Граница дополнения */}
        {validDuration > 0 && appendBoundaryTimestamp !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80"
            style={{ left: `${(appendBoundaryTimestamp / validDuration) * 100}%` }}
          />
        )}
      </div>

      {/* Нативный range input — прозрачный, поверх всего, обрабатывает drag/click/touch */}
      <input
        type="range"
        min={0}
        max={validDuration || 100}
        step={0.05}
        value={validCurrentTime}
        onChange={handleRangeChange}
        onMouseMove={handleRangeHover}
        onMouseLeave={() => setHoverTime(null)}
        onClick={(e) => {
          // Клик по маркерам — находим ближайшую реплику
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const clickTime = pct * validDuration;
          // Ищем реплику рядом с кликом (±3% от длины)
          const threshold = validDuration * 0.03;
          const near = filteredTranscript.find(t => Math.abs(parseTimestamp(t.timestamp) - clickTime) < threshold);
          if (near) onTimestampClick(near.timestamp);
        }}
        aria-label="Перемотка аудио"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ margin: 0, padding: 0 }}
        disabled={validDuration <= 0}
      />

      {/* Tooltip при наведении */}
      {hoverTime !== null && validDuration > 0 && (
        <div
          className="absolute -top-7 pointer-events-none z-10"
          style={{ left: `${(hoverTime / validDuration) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="bg-surface-container-highest border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-mono text-white shadow-lg whitespace-nowrap">
            {formatTime(hoverTime)}
          </div>
        </div>
      )}
    </div>
  );

  const legend = (
    <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mt-1">
      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white/60" /><span>Реплика</span></div>
      {keyMomentMarkers.length > 0 && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span>Ключевой момент</span></div>}
      {appendBoundaryTimestamp !== null && <div className="flex items-center gap-1"><div className="w-0.5 h-3 bg-amber-400/80" /><span>Дополнение</span></div>}
    </div>
  );

  // ===== COMPACT =====
  if (variant === 'compact') {
    return (
      <div className="px-4 pt-3 pb-2 shrink-0 bg-surface-container border-b border-white/5">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            className="w-10 h-10 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(175,162,255,0.3)] cursor-pointer shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
          </button>
          <p className="font-bold text-sm tabular-nums">{formatTime(validCurrentTime)} / {displayDuration}</p>
        </div>
        {renderSlider('h-2')}
        {(keyMomentMarkers.length > 0 || appendBoundaryTimestamp !== null) && legend}
      </div>
    );
  }

  // ===== FULL =====
  return (
    <div className="bg-surface-container p-4 md:p-8 rounded-2xl md:rounded-[32px] border border-white/5">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(175,162,255,0.3)] cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" /> : <Play className="w-5 h-5 md:w-6 md:h-6 ml-0.5 md:ml-1" fill="currentColor" />}
          </button>
          <div>
            <p className="font-bold text-sm md:text-lg tabular-nums">{formatTime(validCurrentTime)} / {displayDuration}</p>
            <p className="text-xs text-on-surface-variant">Оригинальная аудиозапись</p>
          </div>
        </div>
        <Volume2 className="text-on-surface-variant w-5 h-5" />
      </div>

      {renderSlider('h-3')}

      {(keyMomentMarkers.length > 0 || appendBoundaryTimestamp !== null) && legend}

      <div className="flex justify-between text-[10px] text-on-surface-variant font-mono mt-1">
        <span>{formatTime(validCurrentTime)}</span>
        <span>{displayDuration}</span>
      </div>
    </div>
  );
};
