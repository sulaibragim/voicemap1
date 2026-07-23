// Подписи типов заметок.
//
// ВАЖНО: сами значения NoteType ('Идея' | 'Задача' | 'Напоминание') — это
// идентификаторы в Firestore, они перечислены в firestore.rules и проверяются
// при каждой записи. Переводить их НЕЛЬЗЯ: смена значения сломает валидацию
// и сделает старые заметки нечитаемыми. Переводятся только подписи в интерфейсе.

import type { TKey } from '../i18n';
import type { NoteType } from '../types';

const LABEL_KEYS: Record<NoteType, TKey> = {
  'Идея': 'note.idea',
  'Задача': 'note.task',
  'Напоминание': 'note.reminder',
};

const DESCRIPTION_KEYS: Record<NoteType, TKey> = {
  'Идея': 'note.ideaDesc',
  'Задача': 'note.taskDesc',
  'Напоминание': 'note.reminderDesc',
};

/** Ключ подписи типа заметки: 'Идея' → 'note.idea'. */
export function noteTypeLabelKey(type: NoteType): TKey {
  return LABEL_KEYS[type] ?? 'note.idea';
}

/** Ключ пояснения под подписью: «Творческая мысль или инсайт». */
export function noteTypeDescriptionKey(type: NoteType): TKey {
  return DESCRIPTION_KEYS[type] ?? 'note.ideaDesc';
}
