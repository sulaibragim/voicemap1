import { describe, it, expect, beforeEach, vi } from 'vitest';

// Firestore подменяем: проверяем нашу работу с батчами и разбор результатов,
// а не поведение SDK.
const state = vi.hoisted(() => ({
  /** Каждый коммит — один батч. Внутри операции, попавшие в него. */
  commits: [] as Array<Array<Record<string, unknown>>>,
  deleted: [] as string[],
  /** Что вернёт findNearest */
  hits: [] as Array<Record<string, unknown>>,
  /** С какими параметрами звали findNearest */
  lastQuery: null as Record<string, unknown> | null,
  /** Документы, которые «найдёт» where() при удалении */
  existingForDelete: 0,
}));

vi.mock('firebase-admin/firestore', () => {
  const makeBatch = () => {
    const ops: Array<Record<string, unknown>> = [];
    return {
      set: (_ref: unknown, data: Record<string, unknown>) => { ops.push(data); },
      delete: (ref: { id: string }) => { ops.push({ __deleted: ref.id }); state.deleted.push(ref.id); },
      commit: async () => { state.commits.push(ops); },
    };
  };

  const collection = {
    doc: () => ({ id: `doc-${Math.floor(state.commits.length)}` }),
    findNearest: (options: Record<string, unknown>) => {
      state.lastQuery = options;
      return {
        get: async () => ({ docs: state.hits.map(data => ({ data: () => data })) }),
      };
    },
    where: () => ({
      get: async () => ({
        empty: state.existingForDelete === 0,
        docs: Array.from({ length: state.existingForDelete }, (_, i) => ({ ref: { id: `chunk-${i}` } })),
      }),
    }),
  };

  return {
    getFirestore: () => ({
      collection: () => ({ doc: () => ({ collection: () => collection }) }),
      batch: makeBatch,
    }),
    FieldValue: {
      vector: (values: number[]) => ({ __vector: values }),
      serverTimestamp: () => ({ __ts: true }),
    },
  };
});

const { indexChunks, searchChunks, deleteChunksForRecording } = await import('../../server/lib/vectorStore');

const UID = 'user-1';

function chunk(index: number) {
  return {
    recordingId: 'rec-1',
    chunkIndex: index,
    text: `кусок ${index}`,
    speakers: ['Я'],
    startTimestamp: '00:0' + (index % 10),
    recordingTitle: 'Планёрка',
    recordingDate: '23 июля',
  };
}

beforeEach(() => {
  state.commits = [];
  state.deleted = [];
  state.hits = [];
  state.lastQuery = null;
  state.existingForDelete = 0;
});

describe('indexChunks', () => {
  it('пустой список не создаёт батчей', async () => {
    await indexChunks(UID, [], []);
    expect(state.commits).toHaveLength(0);
  });

  it('рассинхрон chunks/vectors — ошибка, а не тихая порча индекса', async () => {
    // Пропустить это значит связать текст с чужим вектором: поиск начнёт
    // находить не то, и причину будет не найти.
    await expect(indexChunks(UID, [chunk(0), chunk(1)], [[0.1]]))
      .rejects.toThrow(/length mismatch: 2 vs 1/);
  });

  it('режет на батчи по 500 — предел Firestore на операций в батче', async () => {
    const chunks = Array.from({ length: 1200 }, (_, i) => chunk(i));
    const vectors = chunks.map(() => [0.1, 0.2]);

    await indexChunks(UID, chunks, vectors);

    expect(state.commits.map(ops => ops.length)).toEqual([500, 500, 200]);
  });

  it('кладёт вектор через FieldValue.vector — иначе findNearest его не увидит', async () => {
    await indexChunks(UID, [chunk(0)], [[0.1, 0.2, 0.3]]);

    const written = state.commits[0][0];
    expect(written.embedding).toEqual({ __vector: [0.1, 0.2, 0.3] });
    expect(written.text).toBe('кусок 0');
    expect(written.recordingId).toBe('rec-1');
  });
});

describe('searchChunks', () => {
  it('ищет по косинусной близости в поле embedding', async () => {
    await searchChunks(UID, [0.1, 0.2], 10);

    expect(state.lastQuery).toMatchObject({
      vectorField: 'embedding',
      distanceMeasure: 'COSINE',
      limit: 10,
    });
  });

  it('разбирает найденное в понятную форму', async () => {
    state.hits = [{
      recordingId: 'rec-7',
      text: 'Цену не поднимаем',
      startTimestamp: '12:34',
      speakers: ['Иван'],
      recordingTitle: 'Планёрка',
      distance: 0.12,
    }];

    const [hit] = await searchChunks(UID, [0.1]);

    expect(hit).toEqual({
      recordingId: 'rec-7',
      text: 'Цену не поднимаем',
      startTimestamp: '12:34',
      speakers: ['Иван'],
      title: 'Планёрка',
      distance: 0.12,
    });
  });

  it('битые документы не роняют поиск — отдаём пустые поля', async () => {
    // В индексе могут оказаться записи от старых версий схемы.
    // Уронить весь поиск из-за одного кривого документа нельзя.
    state.hits = [{ recordingId: 42, speakers: 'не массив', distance: 'близко' }];

    const [hit] = await searchChunks(UID, [0.1]);

    expect(hit.recordingId).toBe('');
    expect(hit.text).toBe('');
    expect(hit.speakers).toEqual([]);
    expect(hit.distance).toBeUndefined();
  });

  it('отфильтровывает не-строки внутри speakers', async () => {
    state.hits = [{ speakers: ['Иван', null, 7, 'Мария'] }];
    const [hit] = await searchChunks(UID, [0.1]);
    expect(hit.speakers).toEqual(['Иван', 'Мария']);
  });
});

describe('deleteChunksForRecording', () => {
  it('нечего удалять — батч не создаётся', async () => {
    state.existingForDelete = 0;
    await deleteChunksForRecording(UID, 'rec-1');
    expect(state.commits).toHaveLength(0);
  });

  it('удаляет все чанки записи', async () => {
    state.existingForDelete = 3;
    await deleteChunksForRecording(UID, 'rec-1');
    expect(state.deleted).toEqual(['chunk-0', 'chunk-1', 'chunk-2']);
  });

  it('режет удаление на батчи по 500', async () => {
    state.existingForDelete = 1100;
    await deleteChunksForRecording(UID, 'rec-1');
    expect(state.commits.map(ops => ops.length)).toEqual([500, 500, 100]);
  });
});
