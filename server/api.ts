import express, { type Request, type Response, type NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config();

// Инициализируем Firebase Admin (для верификации токенов)
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  } else {
    // В dev-режиме без сервисного аккаунта — пропускаем верификацию
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0179752723' });
  }
}

// ── Cloudflare R2 (S3-совместимый) ──────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'voicemap';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

const app = express();

// CORS — разрешаем только наш домен
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

// Rate limit — 60 AI запросов в час на IP
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/ai', aiLimiter);

const PORT = process.env.API_PORT || 3001;

// Middleware: проверяем Firebase ID Token
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);

  // Если есть сервисный аккаунт — полная верификация
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      (req as Request & { uid: string }).uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
    return;
  }

  // Dev-режим: декодируем JWT без верификации подписи (достаточно для разработки)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Bad JWT structure');
    // base64url → base64 (совместимо со всеми версиями Node)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    if (!payload.sub && !payload.user_id) throw new Error('No uid in token');
    (req as Request & { uid: string }).uid = payload.sub || payload.user_id;
    next();
  } catch (e) {
    console.error('[requireAuth dev] token decode failed:', e);
    res.status(401).json({ error: 'Invalid token format' });
  }
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  return new GoogleGenAI({ apiKey });
}

// POST /api/ai/tip — daily tip generation
app.post('/api/ai/tip', requireAuth, async (req, res) => {
  try {
    const { context } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following recent recordings context, generate a short, personalized daily advice for the user to improve their productivity, communication, or well-being. Return JSON with 'title' (short uppercase category like 'ПРОДУКТИВНОСТЬ') and 'text' (the advice itself, 1-2 sentences).\n\nIMPORTANT: Write BOTH 'title' and 'text' in Russian language only. No English.\n\nContext:\n${context}`,
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
    console.error('Error in /api/ai/tip:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/transcribe — audio transcription + analysis
app.post('/api/ai/transcribe', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType, prompt } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } },
        prompt,
      ],
      config: req.body.config,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/transcribe:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/chat — chat with recording context
app.post('/api/ai/chat', requireAuth, async (req, res) => {
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
            text: { type: Type.STRING },
            action: { type: Type.STRING, enum: ['NAVIGATE', 'OPEN_RECORDING', 'SET_FOCUS_TASKS', 'CREATE_NOTE', 'UPDATE_IDEAS', 'NONE'] },
            actionTarget: { type: Type.STRING, nullable: true },
            actionData: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                // CREATE_NOTE
                type: { type: Type.STRING, nullable: true },
                content: { type: Type.STRING, nullable: true },
                dueDate: { type: Type.STRING, nullable: true },
                dueTime: { type: Type.STRING, nullable: true },
                // SET_FOCUS_TASKS
                tasks: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                // UPDATE_IDEAS
                recordingId: { type: Type.STRING, nullable: true },
                ideas: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              },
              required: ['type', 'content'],
            },
          },
          required: ['text', 'action', 'actionTarget', 'actionData'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/chat:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/chat-voice — transcribe voice for chat
app.post('/api/ai/chat-voice', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          {
            text: 'Transcribe this voice message in Russian. If the audio is empty, silent, or contains no speech, return strictly "[Тишина]". Do not invent or hallucinate speech.',
          },
        ],
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/chat-voice:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/append — append thought to recording
app.post('/api/ai/append', requireAuth, async (req, res) => {
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
    console.error('Error in /api/ai/append:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/parse-reminder — extract date/time from reminder text
app.post('/api/ai/parse-reminder', requireAuth, async (req, res) => {
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
    console.error('Error in /api/ai/parse-reminder:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/develop-idea — expand an idea into deeper analysis
app.post('/api/ai/develop-idea', requireAuth, async (req, res) => {
  try {
    const { idea, recordingTitle } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sharp, insightful thinking partner. The user had this idea/insight from a voice recording titled "${recordingTitle}":

"${idea}"

Develop this idea in 3-5 sentences. Be specific, practical, and thought-provoking. Connect it to real applications or deeper implications. Write in Russian. Don't start with "This idea..." or "Эта идея..." — dive straight into the substance.`,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/develop-idea:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/condense-transcript — condense full transcript to essence only
app.post('/api/ai/condense-transcript', requireAuth, async (req, res) => {
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
    console.error('Error in /api/ai/condense-transcript:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/parse-tasks — parse voice text into clean task list
app.post('/api/ai/parse-tasks', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract a list of action items / tasks from the following spoken text. Each task should be short (5-10 words), clear, and actionable. Remove filler words. If multiple tasks are mentioned, return each as a separate item. Write tasks in the same language as the input (Russian or English).\n\nSpoken text: "${text}"\n\nReturn a JSON array of strings.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/parse-tasks:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/weekly-review — AI reflective questions based on week's recordings
app.post('/api/ai/weekly-review', requireAuth, async (req, res) => {
  try {
    const { recordings } = req.body as {
      recordings: Array<{
        title: string;
        summary: string;
        ideas?: string[];
        actionItems?: string[];
        mood?: string;
        tags?: string[];
      }>;
    };
    const ai = getAI();

    const context = recordings.map(r =>
      `— ${r.title}: ${r.summary}${r.ideas?.length ? `. Идеи: ${r.ideas.join(', ')}` : ''}${r.actionItems?.length ? `. Задачи: ${r.actionItems.join(', ')}` : ''}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Ты персональный AI-ассистент. Пользователь делал голосовые записи на этой неделе:\n\n${context}\n\nПроанализируй и верни:\n1. mainTheme — главная тема недели (2-5 слов, например "Планирование квартала" или "Продуктовые решения")\n2. themeSummary — что объединяет все записи недели, какие идеи повторяются (2-3 предложения, по-русски, тепло)\n3. insight — один конкретный вывод о паттерне мышления или продуктивности пользователя (1 предложение)`,
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
    console.error('Error in /api/ai/weekly-review:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// ── R2 Audio Storage ─────────────────────────────────────────────────────────

// POST /api/r2/presign — получить presigned URL для прямой загрузки аудио из браузера
app.post('/api/r2/presign', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { recordingId, contentType } = req.body as { recordingId: string; contentType: string };

    if (!recordingId || !contentType) {
      res.status(400).json({ error: 'recordingId and contentType are required' });
      return;
    }

    const ext = contentType.includes('webm') ? 'webm' : contentType.includes('ogg') ? 'ogg' : 'mp4';
    const key = `audio/${uid}/${recordingId}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    res.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    console.error('Error in /api/r2/presign:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// DELETE /api/r2/delete — удалить аудиофайл при удалении записи
app.delete('/api/r2/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.body as { key: string };
    if (!key) {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.json({ ok: true });
  } catch (error) {
    console.error('Error in /api/r2/delete:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ── Продакшн: отдаём собранный фронт ────────────────────────────────────────
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  // SPA fallback — все не-API маршруты отдают index.html
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
