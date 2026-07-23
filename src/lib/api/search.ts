// Голосовой поиск по записям и обслуживание поискового индекса.
import { post, getAuthHeader, API_ROOT } from './client';

// ── Голосовой/текстовый RAG-поиск по своим записям ───────────────────────────

/** Источник ответа: конкретная запись + момент внутри неё */
export interface SearchSource {
  recordingId: string;
  title: string;
  /** Таймкод внутри записи: "12:34" или "1:02:33" */
  timestamp: string;
  snippet: string;
}

export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

/** Type guard для одного источника из ответа сервера */
function isSearchSource(value: unknown): value is SearchSource {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.recordingId === 'string'
    && typeof v.title === 'string'
    && typeof v.timestamp === 'string'
    && typeof v.snippet === 'string';
}

/**
 * Поиск по своим записям (сервер: /api/ai/search — векторный индекс + Gemini).
 * Никогда не бросает наружу: при ошибке сети/сервера возвращает пустой результат.
 */
export async function searchRecordings(query: string, limit?: number): Promise<SearchResult> {
  const fallback: SearchResult = { answer: 'Не удалось выполнить поиск.', sources: [] };
  try {
    const body: Record<string, unknown> = { query };
    if (typeof limit === 'number') body.limit = limit;

    const raw = await post<unknown>('/search', body);
    if (typeof raw !== 'object' || raw === null) return fallback;

    const parsed = raw as Record<string, unknown>;
    const answer = typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer
      : 'Ничего не нашёл по этому запросу.';
    const sources = Array.isArray(parsed.sources) ? parsed.sources.filter(isSearchSource) : [];

    return { answer, sources };
  } catch (e) {
    console.warn('[searchRecordings] failed:', e);
    return fallback;
  }
}

/**
 * Удаляет поисковые чанки записи. Без этого голосовой поиск продолжит
 * находить уже удалённую запись. Ошибки не критичны — глушим, чтобы не
 * ломать удаление самой записи.
 */
export async function deleteRecordingChunks(recordingId: string): Promise<void> {
  try {
    const authHeader = await getAuthHeader();
    await fetch(`${API_ROOT}/api/ai/chunks/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ recordingId }),
    });
  } catch (e) {
    console.warn('[deleteRecordingChunks] failed:', e);
  }
}

// ── Бэкфилл поискового индекса (миграция старых записей) ────────────────────

export interface BackfillResult {
  processed: number;
  indexedChunks: number;
  failed: number;
  remaining: number;
}

/** Type guard для ответа /backfill — защищаемся от неожиданной формы JSON */
function isBackfillResult(value: unknown): value is BackfillResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.processed === 'number'
    && typeof v.indexedChunks === 'number'
    && typeof v.failed === 'number'
    && typeof v.remaining === 'number';
}

/**
 * Индексирует одну пачку ещё не проиндексированных записей пользователя (сервер: /api/ai/backfill).
 * Вызывается повторно на клиенте (в цикле), пока в ответе remaining > 0.
 * Бросает исключение при ошибке сети/сервера — вызывающий код (UI) должен сам решить,
 * останавливать ли цикл и как показать ошибку пользователю.
 */
export async function backfillSearchIndex(limit?: number): Promise<BackfillResult> {
  const body: Record<string, unknown> = {};
  if (typeof limit === 'number') body.limit = limit;

  const raw = await post<unknown>('/backfill', body);
  if (!isBackfillResult(raw)) {
    throw new Error('backfillSearchIndex: unexpected response shape');
  }
  return raw;
}
