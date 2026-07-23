import { useState, useEffect } from 'react';
import type { Recording, Note, Space } from '../types';
import * as fs from '../lib/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';

interface UseFirestoreDataReturn {
  recordings: Recording[];
  notes: Note[];
  spaces: Space[];
  loading: boolean;
  // Recording CRUD
  addRecording: (rec: Recording) => Promise<void>;
  updateRecordingItem: (rec: Recording) => Promise<void>;
  patchRecordingItem: (id: string, patch: Partial<Recording>) => Promise<void>;
  deleteRecordingItem: (id: string) => Promise<void>;
  clearAllRecordings: () => Promise<void>;
  setRecordingsLocal: (recs: Recording[]) => void;
  // Note CRUD
  addNote: (note: Note) => Promise<void>;
  updateNoteItem: (note: Note) => Promise<void>;
  deleteNoteItem: (id: string) => Promise<void>;
  clearAllNotes: () => Promise<void>;
  setNotesLocal: (notes: Note[]) => void;
  // Space CRUD
  addSpace: (space: Space) => Promise<void>;
  updateSpaceItem: (space: Space) => Promise<void>;
  deleteSpaceItem: (id: string) => Promise<void>;
}

export function useFirestoreData(uid: string | null): UseFirestoreDataReturn {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Если поменялся uid (logout → другой login) — нужно переподписаться и перезагрузить.
    // Без этого второй пользователь увидит данные первого или ничего вообще.
    if (!uid) {
      // Logout / локальный режим: подписок нет (их снял cleanup прошлого запуска), чистим состояние
      /* eslint-disable react-hooks/set-state-in-effect */
      setRecordings([]);
      setNotes([]);
      setSpaces([]);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;
    const unsubs: Unsubscribe[] = [];
    // Первый снапшот и есть начальная загрузка: loading держим true,
    // пока не пришли первые снапшоты И recordings, И notes
    const firstSnap = { recordings: false, notes: false };
    const maybeFinishLoading = () => {
      if (firstSnap.recordings && firstSnap.notes) setLoading(false);
    };
    // Fallback к localStorage если Firestore недоступен (например, нет прав)
    const handleSubscribeError = () => {
      try {
        const r = localStorage.getItem('voicemap_recordings');
        const n = localStorage.getItem('voicemap_notes');
        const s = localStorage.getItem('voicemap_spaces');
        if (r) setRecordings(JSON.parse(r));
        if (n) setNotes(JSON.parse(n));
        if (s) setSpaces(JSON.parse(s));
      } catch { /* ignore */ }
      setLoading(false);
    };

    setLoading(true);

    (async () => {
      // 1) Сначала миграция из localStorage (если там есть данные; после успеха
      //    localStorage очищается, так что она однократная) — ДО подписок,
      //    чтобы первый снапшот уже содержал мигрированные документы
      await fs.migrateFromLocalStorage(uid);
      if (cancelled) return;

      // 2) Дальше ТОЛЬКО real-time подписки — без отдельных getDocs, данные не
      //    читаются дважды. Оптимистичные локальные записи видны сразу: onSnapshot
      //    с latency compensation включает ещё не подтверждённые локальные write'ы.
      unsubs.push(fs.subscribeToRecordings(uid, (updated) => {
        firstSnap.recordings = true;
        setRecordings(updated);
        maybeFinishLoading();
      }, handleSubscribeError));
      unsubs.push(fs.subscribeToNotes(uid, (updated) => {
        firstSnap.notes = true;
        setNotes(updated);
        maybeFinishLoading();
      }, handleSubscribeError));
      unsubs.push(fs.subscribeToSpaces(uid, (updated) => {
        setSpaces(updated);
      }));
    })();

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, [uid]);

  // --- Recording CRUD ---
  const addRecording = async (rec: Recording) => {
    setRecordings(prev => [rec, ...prev]);
    if (uid) await fs.saveRecording(uid, rec).catch(e => console.error('[Firestore] saveRecording failed:', e));
  };

  const updateRecordingItem = async (rec: Recording) => {
    setRecordings(prev => prev.map(r => r.id === rec.id ? rec : r));
    if (uid) await fs.updateRecording(uid, rec).catch(e => console.error('[Firestore] updateRecording failed:', e));
  };

  // Безопасное частичное обновление — мержит patch с актуальным state.
  // Используй когда не хочешь затереть свежие поля от сервера (например, после фоновой транскрипции).
  const patchRecordingItem = async (id: string, patch: Partial<Recording>) => {
    setRecordings(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    if (uid) await fs.patchRecording(uid, id, patch).catch(e => console.error('[Firestore] patchRecording failed:', e));
  };

  const deleteRecordingItem = async (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (uid) await fs.deleteRecording(uid, id).catch(e => console.warn('Firestore write failed:', e));
  };

  const clearAllRecordings = async () => {
    setRecordings([]);
    if (uid) await fs.clearRecordings(uid).catch(e => console.warn('Firestore write failed:', e));
  };

  const setRecordingsLocal = (recs: Recording[]) => setRecordings(recs);

  // --- Note CRUD ---
  const addNote = async (note: Note) => {
    setNotes(prev => [note, ...prev]);
    if (uid) await fs.saveNote(uid, note).catch(e => console.warn('Firestore write failed:', e));
  };

  const updateNoteItem = async (note: Note) => {
    setNotes(prev => prev.map(n => n.id === note.id ? note : n));
    if (uid) await fs.updateNote(uid, note).catch(e => console.warn('Firestore write failed:', e));
  };

  const deleteNoteItem = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (uid) await fs.deleteNote(uid, id).catch(e => console.warn('Firestore write failed:', e));
  };

  const clearAllNotes = async () => {
    setNotes([]);
    if (uid) await fs.clearNotes(uid).catch(e => console.warn('Firestore write failed:', e));
  };

  const setNotesLocal = (nts: Note[]) => setNotes(nts);

  // --- Space CRUD ---
  const addSpace = async (space: Space) => {
    setSpaces(prev => [...prev, space]);
    if (uid) await fs.saveSpace(uid, space).catch(e => console.warn('Firestore write failed:', e));
  };

  const updateSpaceItem = async (space: Space) => {
    setSpaces(prev => prev.map(s => s.id === space.id ? space : s));
    if (uid) await fs.updateSpace(uid, space).catch(e => console.warn('Firestore write failed:', e));
  };

  const deleteSpaceItem = async (id: string) => {
    setSpaces(prev => prev.filter(s => s.id !== id));
    if (uid) await fs.deleteSpace(uid, id).catch(e => console.warn('Firestore write failed:', e));
  };

  return {
    recordings, notes, spaces, loading,
    addRecording, updateRecordingItem, patchRecordingItem, deleteRecordingItem, clearAllRecordings, setRecordingsLocal,
    addNote, updateNoteItem, deleteNoteItem, clearAllNotes, setNotesLocal,
    addSpace, updateSpaceItem, deleteSpaceItem,
  };
}
