// Сборка роутов /api/ai. Разделены по назначению:
//   transcribe — аудио в текст, тратит лимит расшифровки
//   search     — RAG-поиск по записям
//   backfill   — разовая миграция индекса (обслуживание)
//   assist     — помощники, порождающие новый текст
//   parse      — помощники, структурирующие уже сказанное
//
// Порядок монтирования значения не имеет: пути не пересекаются.
import { Router } from 'express';
import { transcribeRouter } from './transcribe';
import { searchRouter } from './search';
import { backfillRouter } from './backfill';
import { assistRouter } from './assist';
import { parseRouter } from './parse';

const router = Router();

router.use(transcribeRouter);
router.use(searchRouter);
router.use(backfillRouter);
router.use(assistRouter);
router.use(parseRouter);

export { router as aiRouter };
export { buildTranscribePayload } from '../../lib/gemini';
