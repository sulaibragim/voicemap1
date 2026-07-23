import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initFirebase } from './lib/firebase';
import { aiRouter } from './routes/ai';
import { r2Router } from './routes/r2';
import { processingRouter } from './routes/processing';

dotenv.config();
initFirebase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Сервер работает за прокси Railway — без этого express-rate-limit видит все запросы с одного IP прокси
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean)
);

app.use(cors({
  origin: (origin, cb) => {
    // Запрещённый origin — просто отказ без CORS-заголовков (cb(null, false)), а не Error (иначе 500 + stack trace в логах)
    cb(null, !origin || ALLOWED_ORIGINS.has(origin));
  },
  credentials: true,
}));

// Роуты, реально принимающие base64-аудио — им нужен большой лимит тела.
// express.json() с большим лимитом монтируется на конкретные пути ДО глобального парсера:
// body-parser помечает req._body = true при первом же парсинге, поэтому глобальный
// парсер ниже просто пропустит (next()) уже обработанные запросы к этим путям.
const audioBodyParser = express.json({ limit: '100mb' });
app.use('/api/r2/upload', audioBodyParser);
app.use('/api/process-recording', audioBodyParser);
app.use('/api/ai/transcribe', audioBodyParser);
app.use('/api/ai/retranscribe', audioBodyParser);
app.use('/api/ai/chat-voice', audioBodyParser);

// Глобальный лимит для всех остальных запросов (без аудио)
app.use(express.json({ limit: '2mb' }));

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many upload requests, try again later' },
});

app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/r2', uploadLimiter, r2Router);
app.use('/api/process-recording', uploadLimiter, processingRouter);

const distPath = path.join(process.cwd(), 'dist');
console.log('[Static] distPath:', distPath, '| NODE_ENV:', process.env.NODE_ENV);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath, { maxAge: '1d' }));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
