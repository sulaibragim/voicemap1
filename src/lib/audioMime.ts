// Нормализация MIME-типов аудио для импорта готовых файлов с внешних устройств
// (умные очки, диктофоны, ручки-рекордеры, обычные файлы).
// Браузеры и ОС отдают разные алиасы одного формата (audio/x-m4a, audio/mpeg, audio/wave),
// а whitelist сервера и Gemini File API ждут канонические значения.

// Расширение файла → канонический MIME
const EXT_TO_MIME: Record<string, string> = {
  mp3: 'audio/mp3',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
};

// Алиасы MIME → канонический MIME
const MIME_ALIASES: Record<string, string> = {
  'audio/mpeg': 'audio/mp3',
  'audio/x-mp3': 'audio/mp3',
  'audio/x-mpeg': 'audio/mp3',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-pn-wav': 'audio/wav',
  'audio/x-flac': 'audio/flac',
  'audio/x-aac': 'audio/aac',
  'audio/x-ogg': 'audio/ogg',
  'audio/opus': 'audio/ogg',
};

// Форматы, которые принимает сервер (см. server/lib/r2.ts → resolveExt)
const SUPPORTED_MIME = new Set([
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
]);

// Расширения для атрибута accept — некоторые ОС прячут файлы при голом audio/*
export const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.mp4,.aac,.wav,.ogg,.oga,.opus,.webm,.flac';

/** Расширение файла в нижнем регистре без точки. Пустая строка, если расширения нет. */
export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Канонический MIME по типу от браузера и имени файла.
 * `null` — файл не аудио (или формат не распознан).
 * Браузер часто отдаёт пустой type для .m4a с диктофонов — тогда идём по расширению.
 */
export function resolveAudioMime(rawType: string, fileName: string): string | null {
  const base = rawType.split(';')[0].trim().toLowerCase();
  const byExt = EXT_TO_MIME[getFileExtension(fileName)] ?? null;

  if (base) {
    // Явно не аудио (video/*, application/* и т.п.) — отклоняем
    if (!base.startsWith('audio/')) return null;
    return MIME_ALIASES[base] ?? byExt ?? base;
  }

  return byExt;
}

/** Поддерживает ли сервер этот канонический MIME. */
export function isSupportedAudioMime(mime: string): boolean {
  return SUPPORTED_MIME.has(mime);
}

/** MIME по URL/ключу R2 — для повторной транскрипции уже загруженного файла. */
export function guessAudioMimeFromUrl(url: string): string {
  const withoutQuery = url.split('?')[0];
  return EXT_TO_MIME[getFileExtension(withoutQuery)] ?? 'audio/mp4';
}
