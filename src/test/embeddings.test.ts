import { describe, it, expect, beforeEach, vi } from 'vitest';

// Gemini подменяем целиком: проверяем нашу обработку ответа, а не работу SDK.
const state = vi.hoisted(() => ({
  calls: [] as Array<{ model: string; contents: string[]; taskType?: string; dim?: number }>,
  // Что вернуть на очередной вызов. Функция — чтобы менять поведение по батчам.
  respond: (batch: string[]) => ({
    embeddings: batch.map(() => ({ values: new Array(768).fill(0.5) })),
  }) as { embeddings?: Array<{ values?: number[] }> },
}));

vi.mock('../../server/lib/gemini', () => ({
  getAI: () => ({
    models: {
      embedContent: async (params: {
        model: string;
        contents: string[];
        config?: { outputDimensionality?: number; taskType?: string };
      }) => {
        state.calls.push({
          model: params.model,
          contents: params.contents,
          taskType: params.config?.taskType,
          dim: params.config?.outputDimensionality,
        });
        return state.respond(params.contents);
      },
    },
  }),
}));

const { embedTexts, EMBED_DIM } = await import('../../server/lib/embeddings');

/** Вектор заданной длины со значением v — удобно проверять нормализацию */
function vec(value: number, length = EMBED_DIM): number[] {
  return new Array(length).fill(value);
}

beforeEach(() => {
  state.calls = [];
  state.respond = (batch) => ({ embeddings: batch.map(() => ({ values: vec(0.5) })) });
});

describe('embedTexts — базовое поведение', () => {
  it('пустой список не ходит в сеть', async () => {
    await expect(embedTexts([])).resolves.toEqual([]);
    expect(state.calls).toHaveLength(0);
  });

  it('сохраняет порядок текстов — иначе чанки перепутаются с векторами', async () => {
    state.respond = (batch) => ({
      // Каждому тексту — свой опознаваемый вектор
      embeddings: batch.map((_, i) => ({ values: vec(i + 1) })),
    });

    const vectors = await embedTexts(['первый', 'второй', 'третий']);
    expect(vectors).toHaveLength(3);
    // После нормализации все компоненты равны, но векторы различимы по знаку/величине
    expect(vectors[0][0]).toBeCloseTo(vectors[1][0], 10);
    expect(state.calls[0].contents).toEqual(['первый', 'второй', 'третий']);
  });

  it('передаёт taskType: индекс и запрос считаются по-разному', async () => {
    await embedTexts(['текст'], 'RETRIEVAL_DOCUMENT');
    expect(state.calls[0].taskType).toBe('RETRIEVAL_DOCUMENT');

    await embedTexts(['запрос'], 'RETRIEVAL_QUERY');
    expect(state.calls[1].taskType).toBe('RETRIEVAL_QUERY');
  });

  it('запрашивает размерность, совпадающую с векторным индексом Firestore', async () => {
    await embedTexts(['текст']);
    expect(state.calls[0].dim).toBe(EMBED_DIM);
  });
});

describe('embedTexts — нормализация', () => {
  it('приводит вектор к единичной длине: косинусная близость этого требует', async () => {
    state.respond = () => ({ embeddings: [{ values: vec(2) }] });

    const [vector] = await embedTexts(['текст']);
    const length = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(length).toBeCloseTo(1, 10);
  });

  it('не делит на ноль на нулевом векторе', async () => {
    state.respond = () => ({ embeddings: [{ values: vec(0) }] });

    const [vector] = await embedTexts(['текст']);
    expect(vector.every(v => Number.isFinite(v))).toBe(true);
  });
});

describe('embedTexts — батчи', () => {
  it('режет большой список на батчи по 100', async () => {
    const texts = Array.from({ length: 250 }, (_, i) => `текст ${i}`);
    const vectors = await embedTexts(texts);

    expect(vectors).toHaveLength(250);
    expect(state.calls.map(c => c.contents.length)).toEqual([100, 100, 50]);
  });
});

describe('embedTexts — отказы', () => {
  it('несовпадение числа векторов — ошибка, а не тихая рассинхронизация', async () => {
    // Молча пропустить это значит связать чанк с чужим вектором:
    // поиск начнёт находить не то, и никто не поймёт почему.
    state.respond = () => ({ embeddings: [{ values: vec(0.5) }] });

    await expect(embedTexts(['раз', 'два'])).rejects.toThrow(/Expected 2 embeddings, got 1/);
  });

  it('неверная размерность — ошибка: индекс Firestore такой вектор не примет', async () => {
    state.respond = () => ({ embeddings: [{ values: vec(0.5, 512) }] });

    await expect(embedTexts(['текст'])).rejects.toThrow(/Invalid embedding dimension/);
  });

  it('пустой ответ модели — ошибка', async () => {
    state.respond = () => ({ embeddings: [] });
    await expect(embedTexts(['текст'])).rejects.toThrow(/Expected 1 embeddings, got 0/);
  });

  it('сбой сети заворачивается с указанием батча', async () => {
    state.respond = () => { throw new Error('503 Service Unavailable'); };

    await expect(embedTexts(['текст'])).rejects.toThrow(/Gemini embedContent failed.*503/);
  });
});
