import { useState, useCallback } from 'react';
import type { Recording, KnownPerson } from '../types';

const STORAGE_KEY = 'voicemap_people';

function loadPeople(): KnownPerson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KnownPerson[]) : [];
  } catch {
    return [];
  }
}

function savePeople(people: KnownPerson[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

export function usePeople() {
  const [people, setPeople] = useState<KnownPerson[]>(loadPeople);

  // Извлекает имена людей из записи и добавляет их в список известных людей
  const addFromRecording = useCallback((recording: Recording) => {
    const names = new Set<string>();

    // Из AI-определённых участников
    (recording.participants ?? []).forEach(p => {
      if (
        p.name &&
        p.name !== 'Я' &&
        p.name !== 'I' &&
        p.name !== 'Me' &&
        !p.name.startsWith('Участник') &&
        !p.name.startsWith('Speaker')
      ) {
        names.add(p.name.trim());
      }
    });

    if (names.size === 0) return;

    setPeople(prev => {
      const updated = [...prev];
      names.forEach(name => {
        const existing = updated.find(
          p => p.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          // Обновляем: добавляем id записи, если ещё нет
          if (!existing.recordingIds.includes(recording.id)) {
            existing.recordingIds = [...existing.recordingIds, recording.id];
          }
        } else {
          // Новый человек
          updated.push({
            name,
            firstMet: new Date().toISOString(),
            recordingIds: [recording.id],
          });
        }
      });
      savePeople(updated);
      return updated;
    });
  }, []);

  // Возвращает только массив имён для передачи AI в качестве контекста
  const getNames = useCallback((): string[] => {
    return people.map(p => p.name);
  }, [people]);

  return { people, addFromRecording, getNames };
}
