// Бэкфилл поискового индекса — разовая миграция старых записей.
// Живёт отдельно от поиска: это обслуживание, а не работа продукта.
import { Router, type Request, type Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth, type AuthRequest } from '../../lib/auth';
import { embedTexts } from '../../lib/embeddings';
import { deleteChunksForRecording, indexChunks } from '../../lib/vectorStore';
import { chunkTranscript, toTranscriptEntries } from '../../lib/chunk';

const router = Router();

// Бэкфилл поискового индекса: разовая миграция старых записей (созданных до
// появления RAG-поиска), у которых ещё нет чанков в векторном индексе.
const BACKFILL_DEFAULT_LIMIT = 15;
const BACKFILL_MAX_LIMIT = 30;
// Пауза между записями внутри одного вызова — не упереться в rate limit Gemini Embedding API.
const BACKFILL_DELAY_MS = 400;

interface BackfillResponseBody {
  processed: number;
  indexedChunks: number;
  failed: number;
  remaining: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// POST /api/ai/backfill — индексирует пачку ещё не проиндексированных записей пользователя.
// Идемпотентно: повторный вызов пропускает уже помеченные (ragIndexedAt) записи и может
// безопасно продолжать с места, на котором остановился предыдущий вызов (или упавший процесс).
router.post('/backfill', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    const { limit } = req.body as { limit?: unknown };

    let effectiveLimit = BACKFILL_DEFAULT_LIMIT;
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      effectiveLimit = Math.min(Math.max(Math.trunc(limit), 1), BACKFILL_MAX_LIMIT);
    }

    const db = getFirestore();
    const recordingsRef = db.collection('users').doc(uid).collection('recordings');

    // Firestore не умеет запросить "поле отсутствует" напрямую, поэтому читаем
    // все записи пользователя и фильтруем непроиндексированные на сервере —
    // это разовая миграция, объём записей одного пользователя для этого разумен.
    const snapshot = await recordingsRef.get();

    // Заодно лечим записи с ложным статусом ошибки: расшифровка в них есть, а
    // aiStatus остался 'error' из-за сбоя на шаге ПОСЛЕ её сохранения. Пользователь
    // видел «Ошибка обработки» вместо готового саммари. Дёшево и идемпотентно.
    let statusFixed = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const hasTranscript = Array.isArray(data.transcript) && data.transcript.length > 0;
      if (data.aiStatus === 'error' && hasTranscript) {
        await doc.ref.update({ aiStatus: 'done' }).catch(() => {});
        statusFixed += 1;
      }
    }
    if (statusFixed > 0) {
      console.log(`[/ai/backfill] Исправлен ложный статус ошибки у ${statusFixed} записей`);
    }

    const pending = snapshot.docs.filter(doc => doc.data().ragIndexedAt === undefined);
    const batch = pending.slice(0, effectiveLimit);

    let processed = 0;
    let indexedChunks = 0;
    let failed = 0;

    for (const doc of batch) {
      const recordingId = doc.id;
      try {
        const data = doc.data();
        const transcriptEntries = toTranscriptEntries(data.transcript);

        if (transcriptEntries.length === 0) {
          // Индексировать нечего — помечаем как обработанную, чтобы не зацикливаться на ней.
          await doc.ref.update({ ragIndexedAt: FieldValue.serverTimestamp() });
          processed += 1;
        } else {
          const title = typeof data.title === 'string' ? data.title : '';
          const date = typeof data.date === 'string' ? data.date : '';
          const summary = typeof data.summary === 'string' ? data.summary : undefined;

          // Идемпотентность на уровне чанков: сносим то, что могло остаться от
          // предыдущей (например, оборвавшейся) попытки индексации этой же записи.
          await deleteChunksForRecording(uid, recordingId);

          const chunks = chunkTranscript(transcriptEntries, { recordingId, title, date }, summary);
          if (chunks.length > 0) {
            const vectors = await embedTexts(chunks.map(c => c.text), 'RETRIEVAL_DOCUMENT');
            await indexChunks(uid, chunks, vectors);
            indexedChunks += chunks.length;
          }

          await doc.ref.update({ ragIndexedAt: FieldValue.serverTimestamp() });
          processed += 1;
        }
      } catch (err) {
        // Сбой на одной записи не должен ронять весь бэкфилл — она просто
        // останется без ragIndexedAt и будет подхвачена следующим вызовом.
        failed += 1;
        console.warn(`[/ai/backfill] Failed to index recording ${recordingId}:`, err);
      }

      await delay(BACKFILL_DELAY_MS);
    }

    // Успешно обработанные записи (processed) теперь помечены ragIndexedAt,
    // поэтому remaining — это весь исходный pending за вычетом processed
    // (сюда попадают и упавшие failed, и записи за пределами текущего лимита).
    const remaining = pending.length - processed;

    const body: BackfillResponseBody = { processed, indexedChunks, failed, remaining };
    res.json(body);
  } catch (error) {
    console.error('[/ai/backfill]', error);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

export { router as backfillRouter };
