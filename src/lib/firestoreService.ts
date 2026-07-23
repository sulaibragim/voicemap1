import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  writeBatch, serverTimestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Recording, Note, Space, AppSettings, KnownPerson } from '../types';
import type { AssistantProfile } from './assistantPrompt';

// --- User Profile (settings, assistantProfile, people) ---

export interface UserProfileDoc {
  settings?: Partial<AppSettings>;
  assistantProfile?: Partial<AssistantProfile>;
  people?: KnownPerson[];
}

const userRootDoc = (uid: string) => doc(db, 'users', uid);

export async function loadUserProfile(uid: string): Promise<UserProfileDoc> {
  try {
    const snap = await getDoc(userRootDoc(uid));
    if (!snap.exists()) return {};
    return snap.data() as UserProfileDoc;
  } catch (e) {
    console.warn('[Firestore] loadUserProfile failed:', e);
    return {};
  }
}

export async function saveUserProfile(uid: string, data: Partial<UserProfileDoc>): Promise<void> {
  await setDoc(userRootDoc(uid), data, { merge: true });
}

// Пути коллекций
const recCol = (uid: string) => collection(db, 'users', uid, 'recordings');
const noteCol = (uid: string) => collection(db, 'users', uid, 'notes');
const spaceCol = (uid: string) => collection(db, 'users', uid, 'spaces');
const recDoc = (uid: string, id: string) => doc(db, 'users', uid, 'recordings', id);
const noteDoc = (uid: string, id: string) => doc(db, 'users', uid, 'notes', id);
const spaceDoc = (uid: string, id: string) => doc(db, 'users', uid, 'spaces', id);

// --- Recordings ---

// Удаляем undefined-значения — Firestore их не принимает и бросает ошибку
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function saveRecording(uid: string, rec: Recording): Promise<void> {
  const data = { ...stripUndefined(rec), createdAt: serverTimestamp() };
  console.log('[Firestore] saveRecording:', rec.id, '| audioUrl:', rec.audioUrl?.slice(0, 60), '| r2Key:', rec.r2Key);
  await setDoc(recDoc(uid, rec.id), data, { merge: true });
  console.log('[Firestore] saveRecording OK:', rec.id);
}

export async function updateRecording(uid: string, rec: Recording): Promise<void> {
  const data = stripUndefined(rec);
  console.log('[Firestore] updateRecording:', rec.id, '| audioUrl:', rec.audioUrl?.slice(0, 60), '| r2Key:', rec.r2Key);
  await setDoc(recDoc(uid, rec.id), data, { merge: true });
  console.log('[Firestore] updateRecording OK:', rec.id);
}

// Частичное обновление: пишет только указанные поля. Защищает от race condition
// с фоновой транскрипцией от сервера — клиент не отправляет в Firestore старые
// значения title/summary/transcript, которые сервер уже мог обновить.
export async function patchRecording(uid: string, id: string, patch: Partial<Recording>): Promise<void> {
  const data = stripUndefined(patch);
  await setDoc(recDoc(uid, id), data, { merge: true });
}

export async function deleteRecording(uid: string, id: string): Promise<void> {
  await deleteDoc(recDoc(uid, id));
}

export async function clearRecordings(uid: string): Promise<void> {
  const snap = await getDocs(recCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// Real-time listener — уведомляет об изменениях в коллекции recordings
// Используется для начальной загрузки и получения результатов фоновой транскрипции от сервера
export function subscribeToRecordings(
  uid: string,
  onUpdate: (recordings: Recording[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(recCol(uid), (snap) => {
    const recs = snap.docs.map(d => ({ ...(d.data() as Recording), id: d.id }));
    const sorted = recs.sort((a, b) => {
      const aTime = (a as Recording & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? parseInt(a.id);
      const bTime = (b as Recording & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? parseInt(b.id);
      return bTime - aTime;
    });
    onUpdate(sorted);
  }, (err) => {
    console.warn('[Firestore] subscribeToRecordings error:', err);
    onError?.(err);
  });
}

// --- Notes ---
export async function saveNote(uid: string, note: Note): Promise<void> {
  // stripUndefined обязателен: Firestore кидает исключение на undefined-полях
  // (например, dueDate: undefined у заметок из чат-ассистента)
  await setDoc(noteDoc(uid, note.id), { ...stripUndefined(note), createdAt: serverTimestamp() }, { merge: true });
}

export async function updateNote(uid: string, note: Note): Promise<void> {
  await setDoc(noteDoc(uid, note.id), stripUndefined(note), { merge: true });
}

export async function deleteNote(uid: string, id: string): Promise<void> {
  await deleteDoc(noteDoc(uid, id));
}

export async function clearNotes(uid: string): Promise<void> {
  const snap = await getDocs(noteCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// Real-time listener на notes — первый снапшот выполняет роль начальной загрузки
export function subscribeToNotes(
  uid: string,
  onUpdate: (notes: Note[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(noteCol(uid), (snap) => {
    const notes = snap.docs.map(d => ({ ...(d.data() as Note), id: d.id }));
    const sorted = notes.sort((a, b) => {
      const aTime = (a as Note & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
      const bTime = (b as Note & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
      return bTime - aTime;
    });
    onUpdate(sorted);
  }, (err) => {
    console.warn('[Firestore] subscribeToNotes error:', err);
    onError?.(err);
  });
}

// --- Spaces ---
export async function saveSpace(uid: string, space: Space): Promise<void> {
  // Как и у recordings/notes: setDoc + merge (не падает, если документа нет) + stripUndefined
  await setDoc(spaceDoc(uid, space.id), stripUndefined(space), { merge: true });
}

export async function updateSpace(uid: string, space: Space): Promise<void> {
  await setDoc(spaceDoc(uid, space.id), stripUndefined(space), { merge: true });
}

export async function deleteSpace(uid: string, id: string): Promise<void> {
  await deleteDoc(spaceDoc(uid, id));
}

// Real-time listener на spaces
export function subscribeToSpaces(
  uid: string,
  onUpdate: (spaces: Space[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(spaceCol(uid), (snap) => {
    onUpdate(snap.docs.map(d => ({ ...(d.data() as Space), id: d.id })));
  }, (err) => {
    console.warn('[Firestore] subscribeToSpaces error:', err);
    onError?.(err);
  });
}

// --- Batch migration from localStorage ---
export async function migrateFromLocalStorage(uid: string): Promise<{ recordings: Recording[]; notes: Note[]; spaces: Space[] } | null> {
  try {
    const rawRec = localStorage.getItem('voicemap_recordings');
    const rawNote = localStorage.getItem('voicemap_notes');
    const rawSpace = localStorage.getItem('voicemap_spaces');
    if (!rawRec && !rawNote) return null;

    const recordings: Recording[] = rawRec ? JSON.parse(rawRec) : [];
    const notes: Note[] = rawNote ? JSON.parse(rawNote) : [];
    const spaces: Space[] = rawSpace ? JSON.parse(rawSpace) : [];

    const batch = writeBatch(db);
    recordings.forEach(r => batch.set(recDoc(uid, r.id), { ...r, createdAt: serverTimestamp() }));
    notes.forEach(n => batch.set(noteDoc(uid, n.id), { ...n, createdAt: serverTimestamp() }));
    spaces.forEach(s => batch.set(spaceDoc(uid, s.id), s));
    await batch.commit();

    // Очищаем localStorage после миграции
    localStorage.removeItem('voicemap_recordings');
    localStorage.removeItem('voicemap_notes');
    localStorage.removeItem('voicemap_spaces');

    return { recordings, notes, spaces };
  } catch (e) {
    console.warn('Migration failed:', e);
    return null;
  }
}
