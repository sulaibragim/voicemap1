import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppSettings, KnownPerson, Recording } from '../types';
import { defaultAppSettings } from '../types';
import type { AssistantProfile } from '../lib/assistantPrompt';
import { DEFAULT_PROFILE } from '../lib/assistantPrompt';
import { loadUserProfile, saveUserProfile } from '../lib/firestoreService';
import { readStoredLang } from '../i18n';

const SAVE_DEBOUNCE_MS = 1000;

interface UseUserProfileReturn {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  assistantProfile: AssistantProfile;
  updateAssistantProfile: (patch: Partial<AssistantProfile>) => void;
  addPersonFromRecording: (recording: Recording) => void;
  getKnownNames: () => string[];
  profileLoading: boolean;
}

export function useUserProfile(uid: string | null): UseUserProfileReturn {
  // Язык берём из localStorage: он мог быть выбран ещё до входа. Значение из
  // Firestore, если оно есть, перекроет его при загрузке профиля ниже.
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...defaultAppSettings, language: readStoredLang() }));
  const [assistantProfile, setAssistantProfile] = useState<AssistantProfile>(DEFAULT_PROFILE);
  const [people, setPeople] = useState<KnownPerson[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    loadUserProfile(uid).then(profile => {
      if (profile.settings) setSettings(prev => ({ ...prev, ...profile.settings }));
      if (profile.assistantProfile) setAssistantProfile(prev => ({ ...prev, ...profile.assistantProfile }));
      if (profile.people) setPeople(profile.people);
      setProfileLoading(false);
    });
  }, [uid]);

  const scheduleSave = useCallback((data: Parameters<typeof saveUserProfile>[1]) => {
    if (!uid) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveUserProfile(uid, data).catch(e => console.warn('[useUserProfile] save failed:', e));
    }, SAVE_DEBOUNCE_MS);
  }, [uid]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      scheduleSave({ settings: next });
      return next;
    });
  }, [scheduleSave]);

  const updateAssistantProfile = useCallback((patch: Partial<AssistantProfile>) => {
    setAssistantProfile(prev => {
      const next = { ...prev, ...patch };
      scheduleSave({ assistantProfile: next });
      return next;
    });
  }, [scheduleSave]);

  const addPersonFromRecording = useCallback((recording: Recording) => {
    const names = new Set<string>();
    (recording.participants ?? []).forEach(p => {
      if (p.name && p.name !== 'Я' && p.name !== 'I' && p.name !== 'Me'
        && !p.name.startsWith('Участник') && !p.name.startsWith('Speaker')) {
        names.add(p.name.trim());
      }
    });
    if (names.size === 0) return;

    setPeople(prev => {
      const updated = [...prev];
      names.forEach(name => {
        const existing = updated.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (!existing.recordingIds.includes(recording.id)) {
            existing.recordingIds = [...existing.recordingIds, recording.id];
          }
        } else {
          updated.push({ name, firstMet: new Date().toISOString(), recordingIds: [recording.id] });
        }
      });
      scheduleSave({ people: updated });
      return updated;
    });
  }, [scheduleSave]);

  const getKnownNames = useCallback((): string[] => people.map(p => p.name), [people]);

  return {
    settings, updateSettings,
    assistantProfile, updateAssistantProfile,
    addPersonFromRecording, getKnownNames,
    profileLoading,
  };
}
