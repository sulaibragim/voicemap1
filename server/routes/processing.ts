import { Router, type Request, type Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth, type AuthRequest } from '../lib/auth';
import { isValidRecordingId, resolveExt, uploadBuffer, R2_PUBLIC_URL } from '../lib/r2';
import { getAI, uploadAudioToFileAPI, buildTranscribePayload } from '../lib/gemini';
import { checkQuota, chargeUsage } from '../lib/quotaGuard';
import { parseDurationToSeconds, type UsageSnapshot } from '../lib/usage';
import { chunkTranscript, toTranscriptEntries } from '../lib/chunk';
import { embedTexts } from '../lib/embeddings';
import { indexChunks } from '../lib/vectorStore';

const router = Router();

// POST /api/process-recording
// Загружает аудио в R2, отвечает клиенту сразу, транскрипцию запускает в фоне.
// Сервер сам пишет результат в Firestore через Firebase Admin.
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { recordingId, audioBase64, contentType, metadata } = req.body as {
    recordingId: string;
    audioBase64: string;
    contentType: string;
    metadata: { title: string; date: string; duration: string; knownPeople: string[] };
  };
  const { uid } = req as AuthRequest;

  if (!isValidRecordingId(recordingId)) {
    res.status(400).json({ error: 'Invalid recordingId' });
    return;
  }
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    res.status(400).json({ error: 'audioBase64 is required' });
    return;
  }
  const ext = resolveExt(contentType);
  if (!ext) {
    res.status(400).json({ error: 'Unsupported contentType' });
    return;
  }

  const key = `audio/${uid}/${recordingId}.${ext}`;
  const buffer = Buffer.from(audioBase64, 'base64');

  // Лимит месяца проверяем ДО обращения к Gemini, но ПОСЛЕ загрузки в R2:
  // хранение стоит копейки, а терять аудио пользователя из-за упёршегося
  // лимита нельзя — он расшифрует запись после апгрейда тарифа.
  const clientSeconds = parseDurationToSeconds(metadata?.duration);
  let quotaExceeded: UsageSnapshot | null;
  try {
    quotaExceeded = await checkQuota(uid, clientSeconds);
  } catch (e) {
    console.error('[process-recording] quota check failed:', e);
    res.status(500).json({ error: 'Quota check failed' });
    return;
  }

  try {
    await uploadBuffer(key, buffer, contentType);
  } catch (e) {
    console.error('[process-recording] R2 upload failed:', e);
    res.status(500).json({ error: 'R2 upload failed' });
    return;
  }

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;
  console.log(`[process-recording] R2 OK: ${publicUrl}`);

  if (quotaExceeded) {
    console.log(`[process-recording] Quota exceeded for ${uid}, transcription skipped (${recordingId})`);
    res.json({ publicUrl, r2Key: key, queued: false, quota: quotaExceeded });
    return;
  }

  res.json({ publicUrl, r2Key: key, queued: true });

  setImmediate(async () => {
    const db = getFirestore();
    const docRef = db.collection('users').doc(uid).collection('recordings').doc(recordingId);
    try {
      console.log(`[process-recording] Background transcription for ${recordingId}`);
      const ai = getAI();
      const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, contentType || 'audio/mp4');
      const { prompt, config } = buildTranscribePayload(metadata.knownPeople || []);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ fileData: { fileUri, mimeType: fileMimeType } }, { text: prompt }] }],
        config,
      });
      await chargeUsage(uid, response.usageMetadata, clientSeconds);

      const text = response.text ?? '';
      let parsed: Record<string, unknown> = {};
      try {
        const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(clean);
      } catch { parsed = {}; }

      const richActionItems = ((parsed.richActionItems as Array<{ text: string; assignee?: string; assignees?: string[]; deadline?: string }>) || [])
        .map(item => ({
          text: item.text,
          assignees: Array.isArray(item.assignees) && item.assignees.length > 0
            ? item.assignees
            : item.assignee ? [item.assignee] : [],
          deadline: item.deadline,
        }));

      const finalTitle = (typeof parsed.title === 'string' && parsed.title) || metadata.title || 'Запись';
      const finalSummary = typeof parsed.summary === 'string' ? parsed.summary : '';

      await docRef.update({
        title: finalTitle,
        summary: finalSummary,
        transcript: parsed.transcript || [],
        keyMoments: parsed.keyMoments || [],
        actionItems: parsed.actionItems || [],
        ideas: parsed.ideas || [],
        mentions: parsed.mentions || [],
        tags: parsed.tags || [],
        openQuestions: parsed.openQuestions || [],
        participants: parsed.participants || [],
        richActionItems,
        bigQuestions: parsed.bigQuestions || [],
        aiStatus: 'done',
      });
      console.log(`[process-recording] Firestore updated for ${recordingId}`);

      // RAG-индексация для голосового поиска. Сбой здесь НЕ должен ронять
      // уже сохранённую транскрипцию — только логируем предупреждение.
      try {
        const transcriptEntries = toTranscriptEntries(parsed.transcript);
        const chunks = chunkTranscript(
          transcriptEntries,
          { recordingId, title: finalTitle, date: metadata.date },
          finalSummary,
        );
        if (chunks.length > 0) {
          const vectors = await embedTexts(chunks.map(c => c.text), 'RETRIEVAL_DOCUMENT');
          await indexChunks(uid, chunks, vectors);
          console.log(`[process-recording] Indexed ${chunks.length} chunks for RAG search (${recordingId})`);
        }
      } catch (indexErr) {
        console.warn(`[process-recording] RAG indexing failed for ${recordingId}, transcription still saved:`, indexErr);
      }
    } catch (err) {
      console.error(`[process-recording] Background transcription failed for ${recordingId}:`, err);
      await docRef.update({ aiStatus: 'error' }).catch(() => {});
    }
  });
});

export { router as processingRouter };
