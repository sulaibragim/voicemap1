import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Recording, Note, Space } from '../types';

// Пути коллекций
const recCol = (uid: string) => collection(db, 'users', uid, 'recordings');
const noteCol = (uid: string) => collection(db, 'users', uid, 'notes');
const spaceCol = (uid: string) => collection(db, 'users', uid, 'spaces');
const recDoc = (uid: string, id: string) => doc(db, 'users', uid, 'recordings', id);
const noteDoc = (uid: string, id: string) => doc(db, 'users', uid, 'notes', id);
const spaceDoc = (uid: string, id: string) => doc(db, 'users', uid, 'spaces', id);

// --- Recordings ---
export async function loadRecordings(uid: string): Promise<Recording[]> {
  // Без orderBy — сортируем на клиенте, чтобы не требовать Firestore-индекс
  const snap = await getDocs(recCol(uid));
  console.log('[Firestore] loadRecordings: got', snap.docs.length, 'docs for uid:', uid);
  const recs = snap.docs.map(d => ({ ...(d.data() as Recording), id: d.id }));
  // Сортируем по createdAt desc (или по id desc как fallback)
  return recs.sort((a, b) => {
    const aTime = (a as Recording & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? parseInt(a.id);
    const bTime = (b as Recording & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? parseInt(b.id);
    return bTime - aTime;
  });
}

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

export async function deleteRecording(uid: string, id: string): Promise<void> {
  await deleteDoc(recDoc(uid, id));
}

export async function clearRecordings(uid: string): Promise<void> {
  const snap = await getDocs(recCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// --- Notes ---
export async function loadNotes(uid: string): Promise<Note[]> {
  const snap = await getDocs(noteCol(uid));
  console.log('[Firestore] loadNotes: got', snap.docs.length, 'docs');
  const notes = snap.docs.map(d => ({ ...(d.data() as Note), id: d.id }));
  return notes.sort((a, b) => {
    const aTime = (a as Note & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
    const bTime = (b as Note & { createdAt?: { seconds?: number } }).createdAt?.seconds ?? 0;
    return bTime - aTime;
  });
}

export async function saveNote(uid: string, note: Note): Promise<void> {
  await setDoc(noteDoc(uid, note.id), { ...note, createdAt: serverTimestamp() }, { merge: true });
}

export async function updateNote(uid: string, note: Note): Promise<void> {
  await setDoc(noteDoc(uid, note.id), note, { merge: true });
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

// --- Spaces ---
export async function loadSpaces(uid: string): Promise<Space[]> {
  const snap = await getDocs(spaceCol(uid));
  return snap.docs.map(d => ({ ...(d.data() as Space), id: d.id }));
}

export async function saveSpace(uid: string, space: Space): Promise<void> {
  await setDoc(spaceDoc(uid, space.id), space);
}

export async function updateSpace(uid: string, space: Space): Promise<void> {
  await updateDoc(spaceDoc(uid, space.id), { ...space });
}

export async function deleteSpace(uid: string, id: string): Promise<void> {
  await deleteDoc(spaceDoc(uid, id));
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
