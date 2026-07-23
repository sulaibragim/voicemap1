import type { Recording, Note, NoteType } from '../types';
import { NOTE_HEX } from './noteTheme';

// Canvas dimensions
export const CW = 1600;
export const CH = 760;
export const CX = CW / 2;
export const CY = CH / 2;

// Единый источник цвета типов заметок — см. src/lib/noteTheme.ts
export const NOTE_COLORS: Record<NoteType, string> = NOTE_HEX;

export const NOTE_TYPES: NoteType[] = ['Идея', 'Задача', 'Напоминание'];

// View types
export type View = 'overview' | 'rec-clusters' | 'note-types' | 'rec-nodes' | 'note-nodes';
export type DateFilter = 'all' | 'week' | 'month';
export type NoteStatusFilter = 'all' | 'active' | 'overdue';
export type NoteViewMode = 'scatter' | 'timeline' | 'grid';
export type RecViewMode = 'scatter' | 'list' | 'grid';

// Spiral layout: newest at center, older further out
export function spiralLayout(n: number, cx: number, cy: number) {
  if (n === 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];

  const positions: { x: number; y: number }[] = [];
  const minR = 90;
  const maxR = Math.min(320, minR + n * 28);

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 = newest (center), 1 = oldest (outer)
    const r = minR + t * (maxR - minR);
    // Distribute angle with golden ratio to avoid overlap
    const angle = i * 2.399963 - Math.PI / 2;
    positions.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return positions;
}

// Circle layout for clusters
export function circleLayout(n: number, cx: number, cy: number, r: number) {
  if (n === 0) return [];
  if (n === 1) return [{ x: cx, y: cy }];
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

// Note layout: by priority/status — incomplete important in center
export function noteLayout(notes: Note[], cx: number, cy: number) {
  const sorted = [...notes].sort((a, b) => {
    const aScore = (a.isCompleted ? 10 : 0) + (a.priority === 'high' ? -3 : a.priority === 'medium' ? -1 : 0);
    const bScore = (b.isCompleted ? 10 : 0) + (b.priority === 'high' ? -3 : b.priority === 'medium' ? -1 : 0);
    return aScore - bScore;
  });
  return spiralLayout(sorted.length, cx, cy).map((pos, i) => ({ note: sorted[i], ...pos }));
}

export function buildTagClusters(recordings: Recording[]): Map<string, Recording[]> {
  const map = new Map<string, Recording[]>();
  recordings.forEach(rec => {
    const tag = rec.tags[0] ?? '#Без тега';
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag)!.push(rec);
  });
  return map;
}

export function buildConnections(recordings: Recording[]) {
  const result = new Map<string, Array<{ targetId: string; word: string }>>();
  recordings.forEach(rec => {
    const words = new Set([
      ...rec.tags.map(t => t.replace(/^#/, '').toLowerCase()),
      ...(rec.keyMoments ?? []).flatMap(km => km.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())),
      ...(rec.mentions ?? []).map(m => m.toLowerCase()),
      ...(rec.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 5).map(w => w.toLowerCase())),
    ]);
    const conns: Array<{ targetId: string; word: string }> = [];
    recordings.forEach(other => {
      if (other.id === rec.id) return;
      const otherWords = [
        ...other.tags.map(t => t.replace(/^#/, '').toLowerCase()),
        ...(other.keyMoments ?? []).flatMap(km => km.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())),
        ...(other.mentions ?? []).map(m => m.toLowerCase()),
        ...(other.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 5).map(w => w.toLowerCase())),
      ];
      const shared = otherWords.find(w => words.has(w));
      if (shared) conns.push({ targetId: other.id, word: shared });
    });
    result.set(rec.id, conns);
  });
  return result;
}

// Returns true if recording has at least one incomplete action item
export function hasIncompleteTasks(rec: Recording): boolean {
  if (!rec.actionItems || rec.actionItems.length === 0) return false;
  return rec.actionItems.some((_, i) => !rec.actionItemsDone?.[i]);
}

export function getNoteReminderStatus(note: Note) {
  if (!note.dueDate || !note.dueTime) return null;
  const due = new Date(`${note.dueDate}T${note.dueTime}`);
  return due.getTime() < Date.now() ? 'overdue' : 'active';
}
