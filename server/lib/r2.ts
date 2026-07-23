import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'voicemap';
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

const RECORDING_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidRecordingId(id: unknown): id is string {
  return typeof id === 'string' && RECORDING_ID_RE.test(id);
}

// Ключ должен иметь вид audio/{uid}/{recordingId}.{ext} — защита от path traversal
export function isOwnedKey(key: unknown, uid: string): key is string {
  if (typeof key !== 'string') return false;
  if (key.includes('..') || key.includes('//')) return false;
  const prefix = `audio/${uid}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return /^[A-Za-z0-9_-]{1,64}\.(webm|ogg|mp4|wav|m4a|mp3|aac|flac)$/.test(rest);
}

// Whitelist форматов: браузерная запись (webm/ogg/mp4) + импорт готовых файлов
// с внешних устройств (mp3 с диктофонов, m4a с умных очков, wav/flac/aac/ogg).
// Ключи в нижнем регистре — resolveExt приводит входящий тип к нему.
const ALLOWED_AUDIO_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/x-ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mp4;codecs=mp4a.40.2': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/x-mp3': 'mp3',
  'audio/x-mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/x-pn-wav': 'wav',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/x-aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

export function resolveExt(contentType: string): string | null {
  if (typeof contentType !== 'string') return null;
  if (ALLOWED_AUDIO_MIME[contentType]) return ALLOWED_AUDIO_MIME[contentType];
  const base = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_AUDIO_MIME[base] ?? null;
}

export async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
