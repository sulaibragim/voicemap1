// Загрузка аудио в Cloudflare R2 и постановка записи в обработку.
import {
  getAuthHeader, API_ROOT, getApiLanguage, isTranscriptionUsage,
  UPLOAD_MAX_ATTEMPTS, UPLOAD_RETRY_BASE_MS,
  type TranscriptionUsage,
} from './client';

// ── Cloudflare R2 Audio Upload ────────────────────────────────────────────────

/**
 * Загружает аудио blob в Cloudflare R2 через наш сервер.
 * Сервер делает прямой S3 PUT — нет CORS проблем ни на Android, ни в браузере.
 */
export async function uploadAudioToR2(
  blob: Blob,
  recordingId: string,
): Promise<{ publicUrl: string; r2Key: string }> {
  const authHeader = await getAuthHeader();
  const contentType = blob.type || 'audio/mp4';
  console.log('[R2] Starting server-side upload. Size:', blob.size, '| type:', contentType);

  // Конвертируем blob в base64 для передачи на сервер
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // убираем "data:...;base64," префикс
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Загрузка с ретраями: сетевые ошибки и 5xx повторяем (до 3 попыток с backoff),
  // 4xx (например, истёкший токен) не ретраим — это не транзиентная ошибка.
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(`${API_ROOT}/api/r2/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ recordingId, contentType, audioBase64: base64 }),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error';
    }

    if (res) {
      if (res.ok) {
        const { publicUrl, key } = await res.json() as { publicUrl: string; key: string };
        console.log('[R2] Upload SUCCESS →', publicUrl, attempt > 1 ? `(попытка ${attempt})` : '');
        return { publicUrl, r2Key: key };
      }
      lastErr = `${res.status} — ${await res.text()}`;
      if (res.status < 500) break; // клиентская ошибка — ретрай не поможет
    }

    if (attempt < UPLOAD_MAX_ATTEMPTS) {
      console.warn(`[R2] Upload attempt ${attempt} failed (${lastErr}), retrying...`);
      await new Promise(r => setTimeout(r, attempt * UPLOAD_RETRY_BASE_MS));
    }
  }

  throw new Error(`R2 server upload failed after ${UPLOAD_MAX_ATTEMPTS} attempts: ${lastErr}`);
}

/**
 * Отправляет аудио на сервер: R2 upload + фоновая транскрипция в одном запросе.
 * Сервер сразу возвращает publicUrl/r2Key, транскрипцию пишет в Firestore сам.
 */
export async function processRecordingAsync(
  blob: Blob,
  recordingId: string,
  metadata: { title: string; date: string; duration: string; knownPeople: string[] }
): Promise<{ publicUrl: string; r2Key: string; queued: boolean; quota?: TranscriptionUsage }> {
  const authHeader = await getAuthHeader();
  const contentType = blob.type || 'audio/mp4';
  console.log('[processRecordingAsync] blob size:', blob.size, 'type:', contentType);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Ретраи как в uploadAudioToR2: запись существует только в памяти, и уронить её
  // из-за моргнувшего вайфая нельзя — пользователь потеряет часовую встречу без
  // возможности восстановить. Транзиентные сбои (сеть, 5xx) повторяем,
  // 4xx — нет: истёкший токен или исчерпанный лимит от повтора не исправятся.
  const payload = JSON.stringify({
    recordingId, audioBase64: base64, contentType,
    metadata: { ...metadata, lang: getApiLanguage() },
  });

  let res: Response | null = null;
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    res = null;
    try {
      res = await fetch(`${API_ROOT}/api/process-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: payload,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error';
    }

    if (res) {
      if (res.ok) break;
      lastErr = `${res.status} — ${await res.text()}`;
      if (res.status < 500) break;   // клиентская ошибка — ретрай не поможет
    }

    if (attempt < UPLOAD_MAX_ATTEMPTS) {
      console.warn(`[processRecordingAsync] Попытка ${attempt} не удалась (${lastErr}), повтор...`);
      await new Promise(r => setTimeout(r, attempt * UPLOAD_RETRY_BASE_MS));
    }
  }

  if (!res) {
    throw new Error(`process-recording failed after ${UPLOAD_MAX_ATTEMPTS} attempts: ${lastErr}`);
  }
  if (!res.ok) {
    throw new Error(`process-recording failed: ${lastErr}`);
  }

  // queued: false означает, что аудио сохранено, но расшифровка пропущена из-за
  // исчерпанного месячного лимита — запись можно расшифровать после апгрейда.
  const body = await res.json() as { publicUrl: string; r2Key: string; queued?: boolean; quota?: unknown };
  return {
    publicUrl: body.publicUrl,
    r2Key: body.r2Key,
    queued: body.queued !== false,
    quota: isTranscriptionUsage(body.quota) ? body.quota : undefined,
  };
}

/**
 * Удаляет аудиофайл из R2 при удалении записи.
 */
export async function deleteAudioFromR2(r2Key: string): Promise<void> {
  const authHeader = await getAuthHeader();
  await fetch(`${API_ROOT}/api/r2/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ key: r2Key }),
  });
}
