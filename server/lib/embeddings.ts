// Получение эмбеддингов текста через Gemini (@google/genai) для RAG-поиска.
//
// Сигнатура ai.models.embedContent подтверждена по типам SDK:
// node_modules/@google/genai/dist/node/node.d.ts
//   embedContent: (params: types.EmbedContentParameters) => Promise<types.EmbedContentResponse>;
//   interface EmbedContentParameters { model: string; contents: ContentListUnion; config?: EmbedContentConfig; }
//   class EmbedContentResponse { embeddings?: ContentEmbedding[]; ... }
//   interface ContentEmbedding { values?: number[]; ... }
//   type ContentListUnion = Content | Content[] | PartUnion | PartUnion[];
//   type PartUnion = Part | string;  // => массив строк — валидный ContentListUnion
// EmbedContentConfig.taskType типизирован как `string` (без enum) — используем
// документированные значения Gemini Embedding API 'RETRIEVAL_DOCUMENT' / 'RETRIEVAL_QUERY'
// (это НЕ проверено рантаймом, см. отчёт).
import { getAI } from './gemini';

// Имя модели вынесено в env: у разных ключей/проектов набор доступных моделей
// отличается (text-embedding-004 может отдавать 404 NOT_FOUND). Поменять модель
// можно переменной окружения, без правки кода и пересборки.
// Проверить, что доступно для конкретного ключа:
//   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';

// Размерность вектора. ВАЖНО: должна совпадать с размерностью векторного индекса
// Firestore (см. server/RAG_SETUP.md). gemini-embedding-001 по умолчанию отдаёт 3072,
// но поддерживает усечение через outputDimensionality — просим 768.
export const EMBED_DIM = 768;

// L2-нормализация. При усечении размерности (MRL) вектор перестаёт быть единичным,
// а косинусная близость в Firestore корректнее работает на нормализованных векторах.
// Если модель уже вернула нормализованный вектор — операция ничего не меняет.
function normalize(values: number[]): number[] {
  let sum = 0;
  for (const v of values) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return values;
  return values.map(v => v / norm);
}

// Модель Gemini Embedding принимает пакет строк за один вызов (contents: string[]),
// но разумно ограничиваем размер батча, чтобы не упереться в лимиты размера запроса.
const BATCH_SIZE = 100;

export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

// Считает эмбеддинги для списка текстов, сохраняя порядок входного массива.
// taskType: 'RETRIEVAL_DOCUMENT' для текстов, которые кладём в индекс (по умолчанию),
// 'RETRIEVAL_QUERY' — для пользовательского поискового запроса (см. searchChunks/search route).
export async function embedTexts(
  texts: string[],
  taskType: EmbedTaskType = 'RETRIEVAL_DOCUMENT',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ai = getAI();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: batch,
      config: {
        outputDimensionality: EMBED_DIM,
        taskType,
      },
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[embedTexts] Gemini embedContent failed (batch offset ${i}): ${message}`);
    });

    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `[embedTexts] Expected ${batch.length} embeddings, got ${embeddings.length} (batch offset ${i})`,
      );
    }

    for (const embedding of embeddings) {
      const values = embedding.values;
      if (!values || values.length !== EMBED_DIM) {
        throw new Error(
          `[embedTexts] Invalid embedding dimension: expected ${EMBED_DIM}, got ${values?.length ?? 0}`,
        );
      }
      vectors.push(normalize(values));
    }
  }

  return vectors;
}
