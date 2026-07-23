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

export const EMBED_MODEL = 'text-embedding-004';
export const EMBED_DIM = 768;

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
      vectors.push(values);
    }
  }

  return vectors;
}
