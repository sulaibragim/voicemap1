import express, { type Request, type Response, type NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Инициализируем Firebase Admin (для верификации токенов)
// В продакшене сервисный аккаунт ОБЯЗАТЕЛЕН — иначе сервер падает на старте.
// В dev-режиме допускается работа без него (JWT декодируется без проверки подписи — см. requireAuth).
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasServiceAccount = !!serviceAccount && serviceAccount.includes('"private_key"');

  if (IS_PRODUCTION && !hasServiceAccount) {
    console.error('[Firebase] FATAL: FIREBASE_SERVICE_ACCOUNT_JSON is required in production');
    console.error('[Firebase] Without it, the server cannot verify Firebase ID tokens — auth bypass risk.');
    process.exit(1);
  }

  try {
    if (hasServiceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount!)) });
      console.log('[Firebase] Initialized with service account (full token verification)');
    } else {
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0179752723' });
      console.warn('[Firebase] ⚠ Initialized WITHOUT service account — DEV MODE ONLY, do not deploy.');
    }
  } catch (e) {
    if (IS_PRODUCTION) {
      console.error('[Firebase] FATAL: Init failed in production:', e);
      process.exit(1);
    }
    console.warn('[Firebase] Init failed, continuing without auth (dev only):', e);
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

// CORS — разрешаем только указанные origin строго (без startsWith — иначе
// "https://localhost" пропустит "https://localhost.evil.com").
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin запросы (без Origin) — пропускаем (например, native HTTP клиенты, серверные тесты).
    // Браузерные fetch к API всегда шлют Origin.
    if (!origin) {
      cb(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.has(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// 100mb достаточно для 60-минутного аудио в base64 (60 МБ → 80 МБ в base64).
// Раньше было 200mb — лишний DoS-вектор.
app.use(express.json({ limit: '100mb' }));

// Rate limit — 60 AI запросов в час на IP
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/ai', aiLimiter);

// Rate limit для R2 загрузок и process-recording — 30 запросов / час на IP.
// Защита от DoS через массовые загрузки больших аудио (бьёт по R2 квоте и Gemini File API).
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests, try again later' },
});
app.use('/api/r2', uploadLimiter);
app.use('/api/process-recording', uploadLimiter);

const PORT = process.env.API_PORT || 3001;

// Middleware: проверяем Firebase ID Token
// В production: только полная верификация подписи через Firebase Admin.
// В development: допускается декодирование без проверки подписи (если service account отсутствует).
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);

  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // Production: service account обязателен (сервер не должен был стартануть без него,
  // но добавляем явный guard на случай рантайм-конфигурации).
  if (IS_PRODUCTION) {
    if (!hasServiceAccount) {
      console.error('[requireAuth] FATAL: no service account in production');
      res.status(500).json({ error: 'Server misconfigured' });
      return;
    }
    try {
      const decoded = await getAuth().verifyIdToken(token);
      (req as Request & { uid: string }).uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
    return;
  }

  // Development с service account — также полная верификация
  if (hasServiceAccount) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      (req as Request & { uid: string }).uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
    return;
  }

  // Development без service account — декодируем JWT без проверки подписи.
  // ВНИМАНИЕ: только для локальной разработки. Эта ветка недостижима в production.
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Bad JWT structure');
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

// Вспомогательная функция: загружает аудио-буфер в Gemini File API и возвращает fileUri
async function uploadAudioToFileAPI(
  ai: GoogleGenAI,
  buffer: Buffer,
  mimeType: string
): Promise<{ fileUri: string; fileMimeType: string }> {
  const fileBlob = new Blob([buffer], { type: mimeType });
  const uploadedFile = await ai.files.upload({
    file: fileBlob,
    config: { mimeType, displayName: 'recording' },
  });
  return {
    fileUri: uploadedFile.uri ?? '',
    fileMimeType: uploadedFile.mimeType ?? mimeType,
  };
}

// Общий билдер payload для транскрипции
function buildTranscribePayload(knownPeople: string[] = []): { prompt: string; config: Record<string, unknown> } {
  const knownPeoplePrefix = knownPeople.length > 0
    ? `Known participants from previous recordings: ${knownPeople.join(', ')}. Use these names when identifying speakers. `
    : '';

  const prompt = knownPeoplePrefix +
    'Please analyze this personal audio note or voice journal. ' +
    'CRITICAL: If the audio is empty, silent, or contains no speech, return JSON with title \'[Тишина]\' and empty fields. ' +
    'LANGUAGE RULE: transcript.text must be in the EXACT language spoken. ALL other fields MUST be in Russian. ' +
    '1. Transcribe ALL speech verbatim, grouped by speaker turns. ' +
    'SPEAKER DIARIZATION: Listen for voice changes. Label as "Участник 1", "Участник 2" etc. Replace with actual name if heard. ' +
    'Each speaker change = new transcript item. Solo = "Я". ' +
    '2. Short Russian summary. 3. 3-5 key moments in Russian. 4. ALL action items in Russian. ' +
    '5. Mood in Russian. 6. Creative ideas in Russian. 7. Mentions (names, tools, places). ' +
    '8. Open questions. 9. Map names to speaker labels. 10. Rich action items with assignee/deadline. ' +
    '11. Big strategic questions. Return JSON.';

  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
        keyMoments: { type: 'ARRAY', items: { type: 'STRING' } },
        actionItems: { type: 'ARRAY', items: { type: 'STRING' } },
        mood: { type: 'STRING' },
        ideas: { type: 'ARRAY', items: { type: 'STRING' } },
        mentions: { type: 'ARRAY', items: { type: 'STRING' } },
        transcript: { type: 'ARRAY', items: { type: 'OBJECT', properties: { speaker: { type: 'STRING' }, timestamp: { type: 'STRING' }, text: { type: 'STRING' } } } },
        tags: { type: 'ARRAY', items: { type: 'STRING' } },
        openQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
        participants: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, speakerLabel: { type: 'STRING' }, role: { type: 'STRING' } } } },
        richActionItems: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, assignee: { type: 'STRING' }, deadline: { type: 'STRING' } } } },
        bigQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['title', 'summary', 'transcript', 'actionItems', 'ideas', 'keyMoments', 'mood', 'tags'],
    },
  };

  return { prompt, config };
}

// POST /api/ai/transcribe — audio transcription + analysis
// Если base64 аудио > 15 МБ (строка > 20 000 000 символов) — используем Gemini File API
app.post('/api/ai/transcribe', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType, prompt } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    const ai = getAI();

    let audioPart: Record<string, unknown>;

    if (audio.length > 20_000_000) {
      // Большой файл — загружаем через File API
      console.log(`[transcribe] Large audio (${Math.round(audio.length / 1_000_000)}MB base64), using File API`);
      const buffer = Buffer.from(audio, 'base64');
      const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, mimeType || 'audio/webm');
      audioPart = { fileData: { fileUri, mimeType: fileMimeType } };
    } else {
      // Маленький файл — используем inlineData
      audioPart = { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [audioPart, prompt],
      config: req.body.config,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/transcribe:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/retranscribe — повторная транскрипция по URL из R2
// Фетчит аудио с публичного URL, загружает в Gemini File API, возвращает результат
app.post('/api/ai/retranscribe', requireAuth, async (req, res) => {
  try {
    const { audioUrl, mimeType, prompt, config } = req.body as {
      audioUrl: string;
      mimeType: string;
      prompt: string;
      config: Record<string, unknown>;
    };

    if (!audioUrl || typeof audioUrl !== 'string') {
      res.status(400).json({ error: 'audioUrl is required' });
      return;
    }

    // Загружаем аудио с R2 на стороне сервера
    console.log('[retranscribe] Fetching audio from:', audioUrl);
    const fetchRes = await fetch(audioUrl);
    if (!fetchRes.ok) {
      res.status(502).json({ error: `Failed to fetch audio: ${fetchRes.status}` });
      return;
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[retranscribe] Fetched ${Math.round(buffer.length / 1_000_000)}MB, uploading to File API`);

    const ai = getAI();
    const resolvedMime = mimeType || 'audio/mp4';
    const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, resolvedMime);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { fileData: { fileUri, mimeType: fileMimeType } },
        prompt,
      ],
      config,
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/ai/retranscribe:', error);
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

// Валидация recordingId — только алфанум + дефис/подчёркивание, до 64 символов.
// Защищает от path traversal в R2 ключах (../, /, etc.)
const RECORDING_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isValidRecordingId(id: unknown): id is string {
  return typeof id === 'string' && RECORDING_ID_RE.test(id);
}

// Проверяет, что R2 ключ принадлежит текущему пользователю.
// Формат: audio/{uid}/{recordingId}.{ext}
function isOwnedKey(key: unknown, uid: string): key is string {
  if (typeof key !== 'string') return false;
  if (key.includes('..') || key.includes('//')) return false;
  const prefix = `audio/${uid}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length); // {recordingId}.{ext}
  // Должно быть ровно одна точка перед расширением
  const m = rest.match(/^([A-Za-z0-9_-]{1,64})\.(webm|ogg|mp4|wav|m4a)$/);
  return !!m;
}

// Допустимые MIME-типы аудио (whitelist) → расширение
const ALLOWED_AUDIO_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mp4;codecs=mp4a.40.2': 'mp4',
  'audio/mpeg': 'mp4',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
};

function resolveExt(contentType: string): string | null {
  if (typeof contentType !== 'string') return null;
  // Прямое совпадение
  if (ALLOWED_AUDIO_MIME[contentType]) return ALLOWED_AUDIO_MIME[contentType];
  // Совпадение по подстроке (для составных MIME с codecs)
  const base = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_AUDIO_MIME[base] ?? null;
}

// POST /api/r2/presign — получить presigned URL для прямой загрузки аудио из браузера
app.post('/api/r2/presign', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { recordingId, contentType } = req.body as { recordingId: string; contentType: string };

    if (!isValidRecordingId(recordingId)) {
      res.status(400).json({ error: 'Invalid recordingId' });
      return;
    }
    const ext = resolveExt(contentType);
    if (!ext) {
      res.status(400).json({ error: 'Unsupported contentType' });
      return;
    }

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

// POST /api/r2/upload — загрузка аудио через сервер (без CORS, работает с Capacitor Android)
app.post('/api/r2/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { recordingId, contentType, audioBase64 } = req.body as {
      recordingId: string;
      contentType: string;
      audioBase64: string;
    };

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
    console.log(`[R2 upload] key=${key} size=${buffer.length} bytes`);

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    console.log('[R2 upload] OK →', publicUrl);
    res.json({ publicUrl, key });
  } catch (error) {
    console.error('Error in /api/r2/upload:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// POST /api/process-recording — загружает запись в R2, запускает транскрипцию в фоне,
// сразу отвечает клиенту. Сервер сам пишет результат в Firestore через Firebase Admin.
app.post('/api/process-recording', requireAuth, async (req: Request, res: Response) => {
  const { recordingId, audioBase64, contentType, metadata } = req.body as {
    recordingId: string;
    audioBase64: string;
    contentType: string;
    metadata: {
      title: string;
      date: string;
      duration: string;
      knownPeople: string[];
    };
  };
  const uid = (req as Request & { uid: string }).uid;

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

  // Шаг 1: загружаем аудио в R2 прямо здесь
  const key = `audio/${uid}/${recordingId}.${ext}`;
  const buffer = Buffer.from(audioBase64, 'base64');

  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  } catch (e) {
    console.error('[process-recording] R2 upload failed:', e);
    res.status(500).json({ error: 'R2 upload failed' });
    return;
  }

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;
  console.log(`[process-recording] R2 OK: ${publicUrl}`);

  // Отвечаем клиенту сразу — не ждём транскрипцию
  res.json({ publicUrl, r2Key: key, queued: true });

  // Фоновая транскрипция (не блокирует ответ)
  setImmediate(async () => {
    const db = getFirestore();
    const docRef = db.collection('users').doc(uid).collection('recordings').doc(recordingId);
    try {
      console.log(`[process-recording] Starting background transcription for ${recordingId}`);
      const ai = getAI();
      const resolvedMime = contentType || 'audio/mp4';
      const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, resolvedMime);

      const { prompt, config } = buildTranscribePayload(metadata.knownPeople || []);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ fileData: { fileUri, mimeType: fileMimeType } }, { text: prompt }] }],
        config,
      });

      const text = response.text ?? '';
      let parsed: Record<string, unknown> = {};
      try {
        const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(clean);
      } catch { parsed = {}; }

      const richActionItems = ((parsed.richActionItems as Array<{text: string; assignee?: string; assignees?: string[]; deadline?: string}>) || []).map((item) => ({
        text: item.text,
        assignees: Array.isArray(item.assignees) && item.assignees.length > 0
          ? item.assignees
          : item.assignee ? [item.assignee] : [],
        deadline: item.deadline,
      }));

      await docRef.update({
        title: parsed.title || metadata.title || 'Запись',
        summary: parsed.summary || '',
        transcript: parsed.transcript || [],
        keyMoments: parsed.keyMoments || [],
        actionItems: parsed.actionItems || [],
        mood: parsed.mood || '',
        ideas: parsed.ideas || [],
        mentions: parsed.mentions || [],
        tags: parsed.tags || [],
        openQuestions: parsed.openQuestions || [],
        participants: parsed.participants || [],
        richActionItems,
        bigQuestions: parsed.bigQuestions || [],
        aiStatus: 'done',
      });
      console.log(`[process-recording] Transcription saved to Firestore for ${recordingId}`);
    } catch (err) {
      console.error(`[process-recording] Background transcription failed for ${recordingId}:`, err);
      await docRef.update({ aiStatus: 'error' }).catch(() => {});
    }
  });
});

// DELETE /api/r2/delete — удалить аудиофайл при удалении записи
app.delete('/api/r2/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { key } = req.body as { key: string };

    // Защита от удаления чужих файлов: ключ должен иметь префикс audio/{uid}/
    if (!isOwnedKey(key, uid)) {
      console.warn(`[R2 delete] forbidden key=${key} uid=${uid}`);
      res.status(403).json({ error: 'Forbidden' });
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
// process.cwd() = /app на Railway, надёжнее чем __dirname
const distPath = path.join(process.cwd(), 'dist');
console.log('[Static] distPath:', distPath, '| NODE_ENV:', process.env.NODE_ENV);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath, { maxAge: '1d' }));
  // SPA fallback — все не-API маршруты отдают index.html
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
