import { useRef, useState, useEffect } from 'react';

export function useRecordingAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // MediaRecorder блобы не содержат длину в заголовках — duration приходит как Infinity/NaN.
    // Хак: прыгаем в конец файла, браузер вычисляет реальную длину, потом возвращаемся на 0.
    const handleLoadedMetadata = () => {
      if (!isFinite(audio.duration)) {
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      } else {
        setDuration(audio.duration);
      }
    };

    const handleSeeked = () => {
      if (!isFinite(audio.duration)) return; // ещё не вычислил
      setDuration(audio.duration);
      // Сбрасываем только если это был наш трюк (currentTime очень большое)
      if (audio.currentTime > 1e9) audio.currentTime = 0;
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    // Если аудио уже загружено (повторный рендер)
    if (audio.readyState >= 1) handleLoadedMetadata();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  return { audioRef, isPlaying, setIsPlaying, currentTime, duration, togglePlay, handleSeek };
}
