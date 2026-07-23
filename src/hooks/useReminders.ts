import { useEffect, useRef, useState, useCallback } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Note, RecurringPattern } from '../types';

interface UseRemindersProps {
  notes: Note[];
  onUpdateNote: (note: Note) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function getNextRecurringDate(dueDate: string, pattern: RecurringPattern): string {
  const date = new Date(dueDate);
  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      break;
  }
  return date.toISOString().split('T')[0];
}

// Generates a stable numeric ID from note.id string
function noteIdToNumeric(noteId: string, suffix: number): number {
  let hash = 0;
  for (let i = 0; i < noteId.length; i++) {
    hash = ((hash << 5) - hash) + noteId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) * 10 + suffix;
}

async function requestPermissions() {
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

// Обрезаем длинный текст заметки для тоста — иначе он занимает весь экран
function truncateForToast(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function useReminders({ notes, onUpdateNote, showToast }: UseRemindersProps) {
  // permitted — useState, а не ref: разрешение приходит асинхронно, и эффект
  // планирования должен перезапуститься для уже загруженных заметок
  const [permitted, setPermitted] = useState(false);
  const scheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestPermissions().then(granted => {
      setPermitted(granted);
    });
  }, []);

  const scheduleNativeNotification = useCallback(async (
    noteId: string,
    title: string,
    body: string,
    at: Date,
    suffix: number
  ) => {
    if (!permitted) return;
    const id = noteIdToNumeric(noteId, suffix);
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: { at },
          sound: 'default',
          smallIcon: 'ic_launcher',
          actionTypeId: '',
          extra: { noteId },
        }],
      });
    } catch {
      // ignore scheduling errors silently
    }
  }, [permitted]);

  // Re-schedule all reminders whenever notes change (и когда пришло разрешение)
  useEffect(() => {
    if (!permitted) return;

    const now = new Date();

    for (const note of notes) {
      if (note.type !== 'Напоминание' || !note.dueDate || !note.dueTime) continue;

      const due = new Date(`${note.dueDate}T${note.dueTime}`);
      if (due <= now) continue; // already passed

      const key = `${note.id}-${note.dueDate}-${note.dueTime}`;
      if (scheduledRef.current.has(key)) continue; // already scheduled this exact reminder

      scheduledRef.current.add(key);

      // Schedule: 1 hour before
      const oneHourBefore = new Date(due.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now && !note.notifiedOneHour) {
        scheduleNativeNotification(
          note.id,
          'Напоминание через 1 час',
          note.content,
          oneHourBefore,
          1
        );
      }

      // Schedule: 5 min before
      const fiveMinBefore = new Date(due.getTime() - 5 * 60 * 1000);
      if (fiveMinBefore > now && !note.notifiedFiveMin) {
        scheduleNativeNotification(
          note.id,
          'Напоминание через 5 минут',
          note.content,
          fiveMinBefore,
          2
        );
      }

      // Schedule: exactly at due time
      scheduleNativeNotification(
        note.id,
        '🔔 ' + note.content,
        'Время пришло!',
        due,
        3
      );

      // Handle recurring: after due, reschedule
      if (note.isRecurring && note.recurringPattern && note.recurringPattern !== 'none') {
        // We'll reschedule on next app open via the poll below
      }
    }
  }, [notes, permitted, scheduleNativeNotification]);

  // Poll every 30s to handle: "due now" toast + recurring reschedule
  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const note of notes) {
        if (note.type !== 'Напоминание' || !note.dueDate || !note.dueTime) continue;

        const due = new Date(`${note.dueDate}T${note.dueTime}`);
        const diffMin = (due.getTime() - now.getTime()) / 60000;

        // Show in-app toast when due (-2 to +1 min)
        if (diffMin >= -2 && diffMin <= 1 && !note.notifiedFiveMin) {
          showToast(`🔔 ${truncateForToast(note.content)}`, 'info');
          onUpdateNote({ ...note, notifiedFiveMin: true, notifiedOneHour: true });
        }

        // Reschedule recurring after due time passed
        if (diffMin < -2 && note.isRecurring && note.recurringPattern && note.recurringPattern !== 'none' && note.notifiedFiveMin) {
          const nextDate = getNextRecurringDate(note.dueDate, note.recurringPattern);
          const nextKey = `${note.id}-${nextDate}-${note.dueTime}`;
          scheduledRef.current.delete(`${note.id}-${note.dueDate}-${note.dueTime}`);
          scheduledRef.current.delete(nextKey); // force re-schedule
          onUpdateNote({
            ...note,
            dueDate: nextDate,
            notifiedOneHour: false,
            notifiedFiveMin: false,
          });
        }
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [notes, onUpdateNote, showToast]);
}
