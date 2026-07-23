// Голосовой/текстовый RAG-поиск по собственным записям пользователя.
import { Router, type Request, type Response } from 'express';
import { Type } from '@google/genai';
import { requireAuth, type AuthRequest } from '../../lib/auth';
import { getAI } from '../../lib/gemini';
import { embedTexts } from '../../lib/embeddings';
import { searchChunks, deleteChunksForRecording, type ChunkHit } from '../../lib/vectorStore';
import { resolveLang, langRule, type OutputLang } from '../../lib/lang';

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

export { router as searchRouter };
