import { useRef, useState, type ChangeEvent } from 'react';
import { useT } from '../../i18n';
import { FileAudio, Loader2 } from 'lucide-react';
import { AUDIO_ACCEPT, isSupportedAudioMime, resolveAudioMime } from '../../lib/audioMime';

interface ImportAudioButtonProps {
  onImport: (file: File, durationSeconds: number) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  className?: string;
}

// Сервер принимает тело до 100 МБ, а base64 раздувает файл примерно на треть (4/3).
// 72 МБ → ~96 МБ base64 + JSON-обвязка — влезает с запасом. Выше — гарантированный 413.
const MAX_FILE_BYTES = 72 * 1024 * 1024;
// С 40 МБ загрузка уже заметно долгая — предупреждаем, но не блокируем.
const WARN_FILE_BYTES = 40 * 1024 * 1024;
const MAX_FILE_LABEL = '72 МБ';

// Некоторые кодеки не отдают метаданные вообще — не ждём вечно.
const METADATA_TIMEOUT_MS = 10_000;

/**
 * Длительность аудиофайла в секундах. 0 — определить не удалось,
 * конвейер обработки это переживает (длительность потом уточнит транскрипция).
 * ObjectURL освобождается в любом исходе — без утечек.
 */
function readDurationSeconds(file: File): Promise<number> {
  return new Promise<number>(resolve => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      URL.revokeObjectURL(objectUrl);
      resolve(seconds);
    };

    const onLoaded = () => {
      const { duration } = audio;
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0);
    };
    const onError = () => finish(0);

    const timer = setTimeout(() => finish(0), METADATA_TIMEOUT_MS);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.preload = 'metadata';
    audio.src = objectUrl;
  });
}

/**
 * Импорт готового аудиофайла с внешнего устройства (умные очки, диктофон, ручка-рекордер)
 * или из файловой системы. Файл уходит в тот же конвейер, что и обычная запись:
 * загрузка → транскрипция → индексация.
 */
export const ImportAudioButton = ({ onImport, showToast, className }: ImportAudioButtonProps) => {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем сразу — иначе повторный выбор того же файла не вызовет change
    e.target.value = '';
    if (!file) return;

    const mime = resolveAudioMime(file.type, file.name);
    if (!mime) {
      showToast(t('import.notAudio'), 'error');
      return;
    }
    if (!isSupportedAudioMime(mime)) {
      showToast(t('import.badFormat'), 'error');
      return;
    }
    if (file.size === 0) {
      showToast(t('import.empty'), 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast(t('import.tooBig', { limit: MAX_FILE_LABEL }), 'error');
      return;
    }
    if (file.size > WARN_FILE_BYTES) {
      showToast(t('import.slow'), 'info');
    }

    setIsReading(true);
    try {
      const durationSeconds = await readDurationSeconds(file);
      // Приводим тип к каноническому: браузеры отдают audio/x-m4a, audio/mpeg
      // и пустую строку, а сервер и Gemini ждут нормализованный MIME.
      const normalized = file.type === mime
        ? file
        : new File([file], file.name, { type: mime, lastModified: file.lastModified });
      onImport(normalized, durationSeconds);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        disabled={isReading}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-variant transition-colors hover:bg-white/[0.08] hover:text-on-surface active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
      >
        {isReading
          ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          : <FileAudio className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="truncate">{t('import.button')}</span>
      </button>
    </>
  );
};
