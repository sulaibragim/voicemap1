import { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatTime } from '../../lib/utils';

interface AppendAudioPlayerProps {
  url: string;
  label: string;
  addedAt: string;
}

export const AppendAudioPlayer = ({ url, label, addedAt }: AppendAudioPlayerProps) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Blob URL протухает после перезагрузки страницы — показываем плейсхолдер
  const isBlobUrl = url?.startsWith('blob:');

  useEffect(() => {
    const el = ref.current;
    if (!el || isBlobUrl) return;
    const onTime = () => setCurrent(el.currentTime);
    const onDur = () => setDur(el.duration);
    const onEnd = () => setPlaying(false);
    const onError = () => setLoadError(true);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
    };
  }, [isBlobUrl]);

  const toggle = () => {
    if (!ref.current || loadError) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().catch(() => setLoadError(true)); setPlaying(true); }
  };

  // Аудио недоступно (blob URL протух после перезагрузки или ошибка загрузки)
  if (isBlobUrl || loadError) {
    return (
      <div className="bg-surface-container/50 px-3 py-2 rounded-xl flex items-center gap-2">
        <span className="text-xs font-bold text-amber-400/70 truncate">{label}</span>
        <span className="text-[10px] text-on-surface-variant shrink-0">{addedAt}</span>
      </div>
    );
  }

  return (
    <div className="bg-surface-container p-3 md:p-4 rounded-2xl border border-amber-400/20 flex items-center gap-3">
      <audio ref={ref} src={url} className="hidden" />
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center hover:bg-amber-400/30 transition-colors shrink-0">
        {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-amber-400 truncate">{label}</span>
          <span className="text-[10px] text-on-surface-variant ml-2 shrink-0">{addedAt} · {formatTime(current)}/{dur > 0 ? formatTime(dur) : '--:--'}</span>
        </div>
        <div className="h-1.5 w-full bg-surface-container-highest rounded-full cursor-pointer" onClick={(e) => {
          if (ref.current && dur > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            ref.current.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
          }
        }}>
          <div className="h-full bg-amber-400 rounded-full transition-all duration-100" style={{ width: `${dur > 0 ? (current / dur) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
};
