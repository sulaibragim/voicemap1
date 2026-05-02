import { useEffect, useRef, useCallback } from 'react';
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

export function useReminders({ notes, onUpdateNote, showToast }: UseRemindersProps) {
  const permissionRef = useRef<NotificationPermission>('default');
  // Locks to предотвратить дублирование уведомлений между тиками до ре-рендера
  const notifiedOneHourRef = useRef<Set<string>>(new Set());
  const notifiedFiveMinRef = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionRef.current = 'granted';
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          permissionRef.current = p;
        });
      }
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    showToast(`🔔 ${title}: ${body}`, 'info');
    if ('Notification' in window && permissionRef.current === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch {
        // Fallback: toast is already shown
      }
    }
  }, [showToast]);

  // Check reminders every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = new Date();

      // Защита от memory leak: чистим id из ref-Set'ов, которых больше нет
      // в актуальном списке notes (заметка удалена или больше не Напоминание).
      // Без этого Set растёт бесконечно при долгом использовании приложения.
      const currentReminderIds = new Set(
        notes.filter(n => n.type === 'Напоминание').map(n => n.id)
      );
      for (const id of notifiedOneHourRef.current) {
        if (!currentReminderIds.has(id)) notifiedOneHourRef.current.delete(id);
      }
      for (const id of notifiedFiveMinRef.current) {
        if (!currentReminderIds.has(id)) notifiedFiveMinRef.current.delete(id);
      }

      for (const note of notes) {
        if (note.type !== 'Напоминание' || !note.dueDate || !note.dueTime) continue;

        const due = new Date(`${note.dueDate}T${note.dueTime}`);
        const diffMs = due.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        // 1 hour notification (between 55 and 65 min before)
        if (!note.notifiedOneHour && !notifiedOneHourRef.current.has(note.id) && diffMin > 55 && diffMin <= 65) {
          notifiedOneHourRef.current.add(note.id);
          sendNotification('Напоминание через 1 час', note.content);
          onUpdateNote({ ...note, notifiedOneHour: true });
        }

        // 5 min notification (between 3 and 7 min before)
        if (!note.notifiedFiveMin && !notifiedFiveMinRef.current.has(note.id) && diffMin > 3 && diffMin <= 7) {
          notifiedFiveMinRef.current.add(note.id);
          sendNotification('Напоминание через 5 минут', note.content);
          onUpdateNote({ ...note, notifiedFiveMin: true });
        }

        // Due now (between -2 and 1 min)
        if (diffMin >= -2 && diffMin <= 1 && note.notifiedFiveMin) {
          if (note.isRecurring && note.recurringPattern && note.recurringPattern !== 'none') {
            // Reschedule recurring reminder — сбрасываем оба lock'а
            notifiedOneHourRef.current.delete(note.id);
            notifiedFiveMinRef.current.delete(note.id);
            const nextDate = getNextRecurringDate(note.dueDate, note.recurringPattern);
            onUpdateNote({
              ...note,
              dueDate: nextDate,
              notifiedOneHour: false,
              notifiedFiveMin: false,
            });
          }
        }
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [notes, onUpdateNote, sendNotification]);
}
