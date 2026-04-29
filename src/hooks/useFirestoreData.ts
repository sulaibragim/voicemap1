import { useState, useEffect, useRef } from 'react';
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
  const initialized = useRef(false);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!uid || initialized.current) return;
    initialized.current = true;

    (async () => {
      setLoading(true);
      try {
        // Загружаем данные из Firestore
        let [recs, nts, sps] = await Promise.all([
          fs.loadRecordings(uid),
          fs.loadNotes(uid),
          fs.loadSpaces(uid),
        ]);

        // Если Firestore пустой — мигрируем из localStorage
        if (recs.length === 0 && nts.length === 0) {
          const migrated = await fs.migrateFromLocalStorage(uid);
          if (migrated) {
            recs = migrated.recordings;
            nts = migrated.notes;
            sps = migrated.spaces.length > 0 ? migrated.spaces : sps;
          }
        }

        // Мержим с локальным состоянием — не затираем оптимистичные записи
        // которые могли быть добавлены пока шла загрузка из Firestore
        setRecordings(prev => {
          const firestoreIds = new Set(recs.map(r => r.id));
          const optimistic = prev.filter(r => !firestoreIds.has(r.id));
          return [...optimistic, ...recs];
        });
        setNotes(prev => {
          const firestoreIds = new Set(nts.map(n => n.id));
          const optimistic = prev.filter(n => !firestoreIds.has(n.id));
          return [...optimistic, ...nts];
        });
        setSpaces(prev => {
          const firestoreIds = new Set(sps.map(s => s.id));
          const optimistic = prev.filter(s => !firestoreIds.has(s.id));
          return [...optimistic, ...sps];
        });
      } catch (e) {
        console.warn('Firestore load failed, falling back to localStorage', e);
        // Fallback к localStorage если Firestore недоступен
        try {
          const r = localStorage.getItem('voicemap_recordings');
          const n = localStorage.getItem('voicemap_notes');
          const s = localStorage.getItem('voicemap_spaces');
          if (r) setRecordings(JSON.parse(r));
          if (n) setNotes(JSON.parse(n));
          if (s) setSpaces(JSON.parse(s));
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    })();

    // Real-time listener — подхватывает обновления от сервера (фоновая транскрипция)
    unsubscribeRef.current = fs.subscribeToRecordings(uid, (updated) => {
      setRecordings(updated);
    });

    return () => {
      unsubscribeRef.current?.();
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
    addRecording, updateRecordingItem, deleteRecordingItem, clearAllRecordings, setRecordingsLocal,
    addNote, updateNoteItem, deleteNoteItem, clearAllNotes, setNotesLocal,
    addSpace, updateSpaceItem, deleteSpaceItem,
  };
}
