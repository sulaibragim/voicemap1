// Хранилище чанков для векторного RAG-поиска: users/{uid}/chunks/{chunkId}.
//
// API подтверждены по типам @google-cloud/firestore@7.11.6 (используется firebase-admin@13.8.0):
//
// 1) FieldValue.vector(values?: number[]): VectorValue
//    node_modules/@google-cloud/firestore/build/src/field-value.d.ts:
//      "static vector(values?: number[]): VectorValue;"
//    firebase-admin/firestore реэкспортирует FieldValue напрямую из '@google-cloud/firestore'.
//
// 2) Query.findNearest(options: VectorQueryOptions): VectorQuery
//    node_modules/@google-cloud/firestore/build/src/reference/query.d.ts:
//      "findNearest(options: VectorQueryOptions): VectorQuery<AppModelType, DbModelType>;"
//    CollectionReference extends Query, поэтому доступен прямо на collection-ref.
//
// 3) VectorQueryOptions (vector-query-options.d.ts):
//      vectorField: string | FieldPath;
//      queryVector: VectorValue | Array<number>;
//      limit: number;
//      distanceMeasure: 'EUCLIDEAN' | 'COSINE' | 'DOT_PRODUCT';
//      distanceResultField?: string | FieldPath;  // поле с посчитанной дистанцией в результате
//      distanceThreshold?: number;
//
// 4) VectorQuery.get(): Promise<VectorQuerySnapshot>, у которого есть .docs: QueryDocumentSnapshot[]
//    (vector-query.d.ts / vector-query-snapshot.d.ts).
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Chunk } from './chunk';

export interface ChunkHit {
  recordingId: string;
  text: string;
  startTimestamp: string;
  speakers: string[];
  title: string;
  distance?: number;
}

// Firestore допускает максимум 500 операций в одном батче.
const BATCH_LIMIT = 500;
const DISTANCE_FIELD = 'distance';

function chunksCollection(uid: string) {
  return getFirestore().collection('users').doc(uid).collection('chunks');
}

// Записывает чанки с их эмбеддингами в Firestore батчами (≤500 операций на батч).
// chunks и vectors должны быть одной длины и в одном порядке.
export async function indexChunks(uid: string, chunks: Chunk[], vectors: number[][]): Promise<void> {
  if (chunks.length !== vectors.length) {
    throw new Error(`[indexChunks] chunks/vectors length mismatch: ${chunks.length} vs ${vectors.length}`);
  }
  if (chunks.length === 0) return;

  const db = getFirestore();
  const collRef = chunksCollection(uid);

  for (let i = 0; i < chunks.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunkSlice = chunks.slice(i, i + BATCH_LIMIT);
    const vectorSlice = vectors.slice(i, i + BATCH_LIMIT);

    chunkSlice.forEach((chunk, idx) => {
      const docRef = collRef.doc();
      batch.set(docRef, {
        recordingId: chunk.recordingId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        speakers: chunk.speakers,
        startTimestamp: chunk.startTimestamp,
        recordingTitle: chunk.recordingTitle,
        recordingDate: chunk.recordingDate,
        embedding: FieldValue.vector(vectorSlice[idx]),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  }
}

// Векторный поиск ближайших чанков к queryVector (косинусная близость).
// Возвращает топ-N чанков, отсортированных Firestore по релевантности.
export async function searchChunks(uid: string, queryVector: number[], limit = 30): Promise<ChunkHit[]> {
  const collRef = chunksCollection(uid);

  const vectorQuery = collRef.findNearest({
    vectorField: 'embedding',
    queryVector,
    limit,
    distanceMeasure: 'COSINE',
    distanceResultField: DISTANCE_FIELD,
  });

  const snapshot = await vectorQuery.get();

  return snapshot.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;
    const speakersRaw = data.speakers;
    const speakers = Array.isArray(speakersRaw)
      ? speakersRaw.filter((s): s is string => typeof s === 'string')
      : [];
    const distanceRaw = data[DISTANCE_FIELD];

    return {
      recordingId: typeof data.recordingId === 'string' ? data.recordingId : '',
      text: typeof data.text === 'string' ? data.text : '',
      startTimestamp: typeof data.startTimestamp === 'string' ? data.startTimestamp : '',
      speakers,
      title: typeof data.recordingTitle === 'string' ? data.recordingTitle : '',
      distance: typeof distanceRaw === 'number' ? distanceRaw : undefined,
    };
  });
}

// Удаляет все чанки, принадлежащие конкретной записи (используется при удалении записи).
export async function deleteChunksForRecording(uid: string, recordingId: string): Promise<void> {
  const db = getFirestore();
  const collRef = chunksCollection(uid);
  const snapshot = await collRef.where('recordingId', '==', recordingId).get();
  if (snapshot.empty) return;

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_LIMIT).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
