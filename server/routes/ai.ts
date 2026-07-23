import { Router, type Request, type Response } from 'express';
import { Type } from '@google/genai';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth, type AuthRequest } from '../lib/auth';
import { getAI, uploadAudioToFileAPI, buildTranscribePayload, sanitizeKnownPeople } from '../lib/gemini';
import { checkQuota, chargeUsage, sendQuotaExceeded } from '../lib/quotaGuard';
import { getUsage, parseDurationToSeconds } from '../lib/usage';
import { resolveLang, langRule, silencePlaceholder, type OutputLang } from '../lib/lang';
import { embedTexts } from '../lib/embeddings';
import { searchChunks, deleteChunksForRecording, indexChunks, type ChunkHit } from '../lib/vectorStore';
import { chunkTranscript, toTranscriptEntries } from '../lib/chunk';

const router = Router();

// Голосовой поиск (RAG) обычно ограничен здравым числом источников,
// даже если клиент попросит больше — сколько бы Firestore ни нашёл.
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_SEARCH_LIMIT = 30;
const MAX_QUERY_LENGTH = 500;

interface SearchSource {
  recordingId: string;
  title: string;
  timestamp: string;
  snippet: string;
}

interface SearchResponseBody {
  answer: string;
  sources: SearchSource[];
}

// Строит текстовый контекст из найденных чанков для передачи модели.
function buildSearchContext(hits: ChunkHit[]): string {
  return hits
    .map((hit, idx) => (
      `[Chunk ${idx + 1}] recordingId="${hit.recordingId}" title="${hit.title}" timestamp="${hit.startTimestamp}"\n${hit.text}`
    ))
    .join('\n\n---\n\n');
}

function buildSearchPrompt(query: string, context: string, lang: OutputLang): string {
  return `You are the AI assistant of VoiceMap, a voice notebook. The user asked a question; below are the relevant fragments (chunks) from their own voice recordings, found by vector search.

STRICT RULES:
1. Answer ONLY from the fragments below. Never invent facts that are not there.
2. If the answer is not in the fragments, say honestly that you found nothing on this question.
3. ${langRule(lang)} Keep the answer short and to the point.
4. In "sources" list ONLY the chunks (recordingId, title, timestamp) you actually relied on, each with a short snippet — a quote or a one-sentence paraphrase.

User question: "${query}"

Found fragments:
${context}`;
}

// GET /api/ai/usage — сколько минут расшифровки израсходовано в этом месяце и каков лимит тарифа.
// Только чтение; счётчик пишет исключительно сервер при фактических расшифровках.
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    res.json(await getUsage(uid));
  } catch (error) {
    console.error('[/ai/usage]', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

router.post('/tip', requireAuth, async (req, res) => {
  try {
    const { context, lang } = req.body;
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following recent recordings context, generate a short, personalized daily advice for the user to improve their productivity, communication, or well-being. Return JSON with 'title' (a short uppercase category word, e.g. 'PRODUCTIVITY') and 'text' (the advice itself, 1-2 sentences).\n\nIMPORTANT: ${langRule(outputLang)}\n\nContext:\n${context}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            text: { type: Type.STRING },
          },
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/tip]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    // Клиент передаёт ТОЛЬКО audio/mimeType/knownPeople/durationSeconds — prompt и config строятся
    // исключительно на сервере, чтобы исключить возможность превратить эндпоинт в открытый
    // LLM-прокси с произвольным промптом.
    const { audio, mimeType, knownPeople, durationSeconds, lang } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }

    // Лимит месяца. Заявленная клиентом длительность нужна только для предпроверки —
    // списываем потом по фактическим токенам (см. chargeUsage).
    const { uid } = req as AuthRequest;
    const clientSeconds = parseDurationToSeconds(durationSeconds);
    const exceeded = await checkQuota(uid, clientSeconds);
    if (exceeded) {
      sendQuotaExceeded(res, exceeded);
      return;
    }

    const ai = getAI();

    let audioPart: Record<string, unknown>;
    if (audio.length > 20_000_000) {
      console.log(`[/ai/transcribe] Large audio (${Math.round(audio.length / 1_000_000)}MB), using File API`);
      const buffer = Buffer.from(audio, 'base64');
      const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, mimeType || 'audio/webm');
      audioPart = { fileData: { fileUri, mimeType: fileMimeType } };
    } else {
      audioPart = { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } };
    }

    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople), resolveLang(lang));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [audioPart, prompt],
      config,
    });
    await chargeUsage(uid, response.usageMetadata, clientSeconds);
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/transcribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/retranscribe', requireAuth, async (req, res) => {
  try {
    // Аналогично /transcribe: prompt/config клиент передать не может, только audioUrl/mimeType/knownPeople.
    const { audioUrl, mimeType, knownPeople, durationSeconds, lang } = req.body as {
      audioUrl: string; mimeType: string; knownPeople?: unknown; durationSeconds?: unknown; lang?: unknown;
    };
    if (!audioUrl || typeof audioUrl !== 'string') {
      res.status(400).json({ error: 'audioUrl is required' });
      return;
    }

    // Повтор расшифровки стоит столько же, сколько первая — лимит применяется и здесь.
    const { uid } = req as AuthRequest;
    const clientSeconds = parseDurationToSeconds(durationSeconds);
    const exceeded = await checkQuota(uid, clientSeconds);
    if (exceeded) {
      sendQuotaExceeded(res, exceeded);
      return;
    }

    console.log('[/ai/retranscribe] Fetching:', audioUrl);
    const fetchRes = await fetch(audioUrl);
    if (!fetchRes.ok) {
      res.status(502).json({ error: `Failed to fetch audio: ${fetchRes.status}` });
      return;
    }
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[/ai/retranscribe] ${Math.round(buffer.length / 1_000_000)}MB, uploading to File API`);

    const ai = getAI();
    const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, mimeType || 'audio/mp4');
    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople), resolveLang(lang));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ fileData: { fileUri, mimeType: fileMimeType } }, prompt],
      config,
    });
    await chargeUsage(uid, response.usageMetadata, clientSeconds);
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/retranscribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Роут /chat удалён вместе с ассистентом-«действиями»: он принимал произвольный
// промпт от клиента (открытый LLM-прокси). Поиск по записям живёт в /search,
// где промпт строится на сервере.

router.post('/chat-voice', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType, lang } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    // Голосовой ввод НЕ переводим — расшифровка идёт на языке речи.
    // Локализуется только заглушка тишины: она показывается пользователю как есть.
    const silence = silencePlaceholder(resolveLang(lang));
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          { text: `Transcribe this voice message EXACTLY in the language spoken (auto-detect). Do not translate. If the audio is empty, silent, or contains no speech, return strictly "${silence}". Do not invent or hallucinate speech.` },
        ],
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/chat-voice]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/append', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            ideas: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'ideas', 'actionItems'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/append]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/parse-reminder', requireAuth, async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a date/time parser for a reminder app.

Current date/time context:
${currentDate}

CRITICAL: Use the ISO dates above for all calculations.
- "сегодня" / "today" → TODAY_ISO
- "завтра" / "tomorrow" → TOMORROW_ISO
- "послезавтра" → TODAY_ISO + 2 days
- "через N дней" → TODAY_ISO + N days
- "через час" / "через 30 минут" → TODAY_ISO + that duration from CURRENT_TIME
- Next weekday (e.g. "в пятницу") → find next occurrence of that weekday after TODAY_ISO

The user recorded this reminder: "${text}"

Extract the desired reminder date and time. Return JSON:
- "hasTime": boolean — whether the user specified when to be reminded
- "date": string in YYYY-MM-DD format based on TODAY_ISO/TOMORROW_ISO (null if hasTime is false)
- "time": string in HH:MM format (null if hasTime is false)
- "summary": short clean reminder text without time references (e.g. "купить молоко")`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasTime: { type: Type.BOOLEAN },
            date: { type: Type.STRING, nullable: true },
            time: { type: Type.STRING, nullable: true },
            summary: { type: Type.STRING },
          },
          required: ['hasTime', 'summary'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/parse-reminder]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/develop-idea', requireAuth, async (req, res) => {
  try {
    const { idea, recordingTitle, lang } = req.body;
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sharp, insightful thinking partner. The user had this idea/insight from a voice recording titled "${recordingTitle}":

"${idea}"

Develop this idea in 3-5 sentences. Be specific, practical, and thought-provoking. Connect it to real applications or deeper implications. ${langRule(outputLang)} Don't open with "This idea..." — dive straight into the substance.`,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/develop-idea]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/condense-transcript', requireAuth, async (req, res) => {
  try {
    const { transcript } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert editor. Below is a raw voice transcript with filler words, repetitions, and off-topic talk.

Your task: rewrite it into a condensed version that keeps ONLY the meaningful content.
Rules:
- Remove filler words (ну, типа, вот, короче, как бы, э-э, мм, ладно, да-да, etc.)
- Remove repetitions and false starts
- Remove off-topic small talk
- Keep all important ideas, decisions, and facts
- Keep the original speaker names and approximate timestamps
- Keep the same language (Russian or English)
- If a speaker's paragraph has nothing meaningful, omit it entirely
- Each resulting item should be a complete, clean sentence

Return JSON array with same structure: [{speaker, timestamp, text}]

Transcript:
${JSON.stringify(transcript)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              text: { type: Type.STRING },
            },
            required: ['speaker', 'timestamp', 'text'],
          },
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/condense-transcript]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/parse-tasks', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract a list of action items / tasks from the following spoken text. Each task should be short (5-10 words), clear, and actionable. Remove filler words. If multiple tasks are mentioned, return each as a separate item. Write tasks in the same language as the input (Russian or English).\n\nSpoken text: "${text}"\n\nReturn a JSON array of strings.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/parse-tasks]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/weekly-review', requireAuth, async (req, res) => {
  try {
    const { recordings, lang } = req.body as {
      recordings: Array<{ title: string; summary: string; ideas?: string[]; actionItems?: string[]; tags?: string[] }>;
      lang?: unknown;
    };
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const context = recordings.map(r =>
      `— ${r.title}: ${r.summary}${r.ideas?.length ? `. Ideas: ${r.ideas.join(', ')}` : ''}${r.actionItems?.length ? `. Tasks: ${r.actionItems.join(', ')}` : ''}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a personal AI assistant. Here are the user's voice recordings from this week:\n\n${context}\n\nAnalyse them and return:\n1. mainTheme — the main theme of the week (2-5 words)\n2. themeSummary — what ties the week's recordings together (2-3 sentences)\n3. insight — one concrete observation about their thinking or productivity pattern (1 sentence)\n\n${langRule(outputLang)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mainTheme: { type: Type.STRING },
            themeSummary: { type: Type.STRING },
            insight: { type: Type.STRING },
          },
          required: ['mainTheme', 'themeSummary', 'insight'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/weekly-review]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/search — голосовой/текстовый RAG-поиск по собственным записям пользователя.
// Промпт и структура ответа строятся ТОЛЬКО на сервере — клиент передаёт лишь query/limit.
router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    const { query, limit, lang } = req.body as { query?: unknown; limit?: unknown; lang?: unknown };
    const outputLang = resolveLang(lang);

    if (typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required and must be a non-empty string' });
      return;
    }
    const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH);

    let effectiveLimit = DEFAULT_SEARCH_LIMIT;
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      effectiveLimit = Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT);
    }

    const [queryVector] = await embedTexts([cleanQuery], 'RETRIEVAL_QUERY');
    const hits = await searchChunks(uid, queryVector, effectiveLimit);

    if (hits.length === 0) {
      const empty: SearchResponseBody = {
        answer: outputLang === 'en' ? 'Nothing found for this query.' : 'Ничего не нашёл по этому запросу.',
        sources: [],
      };
      res.json(empty);
      return;
    }

    const context = buildSearchContext(hits);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildSearchPrompt(cleanQuery, context, outputLang),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  recordingId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                },
                required: ['recordingId', 'title', 'timestamp', 'snippet'],
              },
            },
          },
          required: ['answer', 'sources'],
        },
      },
    });

    const rawText = response.text ?? '';
    let parsed: SearchResponseBody;
    try {
      const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const candidate = JSON.parse(clean) as Partial<SearchResponseBody>;
      parsed = {
        answer: typeof candidate.answer === 'string' ? candidate.answer : '',
        sources: Array.isArray(candidate.sources) ? candidate.sources : [],
      };
    } catch {
      // Fallback: модель не вернула валидный JSON — отдаём сырой текст без источников,
      // чтобы пользователь не остался совсем без ответа.
      parsed = { answer: rawText, sources: [] };
    }

    res.json(parsed);
  } catch (error) {
    console.error('[/ai/search]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

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

// Удаление поисковых чанков записи. Вызывается клиентом при удалении записи —
// иначе поиск продолжит находить уже удалённые записи, а чанки будут копиться.
router.post('/chunks/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as AuthRequest).uid;
    const { recordingId } = req.body as { recordingId?: unknown };
    if (!recordingId || typeof recordingId !== 'string') {
      return res.status(400).json({ error: 'recordingId is required' });
    }
    await deleteChunksForRecording(uid, recordingId);
    res.json({ ok: true });
  } catch (error) {
    console.error('[/ai/chunks/delete]', error);
    res.status(500).json({ error: 'Failed to delete chunks' });
  }
});

export { router as aiRouter, buildTranscribePayload };
