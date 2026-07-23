import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserProfile } from '../hooks/useUserProfile';
import { defaultAppSettings } from '../types';
import { DEFAULT_PROFILE } from '../lib/assistantPrompt';

vi.mock('../lib/firestoreService', () => ({
  loadUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock('../firebase', () => ({ db: {} }));

import * as firestoreService from '../lib/firestoreService';

const mockLoad = vi.mocked(firestoreService.loadUserProfile);
const mockSave = vi.mocked(firestoreService.saveUserProfile);

beforeEach(() => {
  vi.clearAllMocks();
  mockLoad.mockResolvedValue({});
  mockSave.mockResolvedValue(undefined);
});

// ─── Инициализация ───────────────────────────────────────────────────────────

describe('useUserProfile — инициализация', () => {
  it('без uid не вызывает loadUserProfile', async () => {
    const { result } = renderHook(() => useUserProfile(null));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('с uid вызывает loadUserProfile один раз', async () => {
    renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    expect(mockLoad).toHaveBeenCalledWith('user-123');
  });

  it('возвращает дефолтные настройки если Firestore пустой', async () => {
    mockLoad.mockResolvedValue({});
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.settings).toEqual(defaultAppSettings);
  });

  it('сливает настройки из Firestore с дефолтными', async () => {
    mockLoad.mockResolvedValue({ settings: { userName: 'Алия', autoStopMinutes: 30 } });
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.settings.userName).toBe('Алия');
    expect(result.current.settings.autoStopMinutes).toBe(30);
    expect(result.current.settings.transcriptionLang).toBe(defaultAppSettings.transcriptionLang);
  });

  it('загружает assistantProfile из Firestore', async () => {
    mockLoad.mockResolvedValue({ assistantProfile: { name: 'Aria', tone: 'formal' } });
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.assistantProfile.name).toBe('Aria');
    expect(result.current.assistantProfile.tone).toBe('formal');
    expect(result.current.assistantProfile.useEmoji).toBe(DEFAULT_PROFILE.useEmoji);
  });

  it('profileLoading сразу false без uid', async () => {
    const { result } = renderHook(() => useUserProfile(null));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
  });
});

// ─── updateSettings ──────────────────────────────────────────────────────────

describe('useUserProfile — updateSettings', () => {
  it('обновляет настройки локально сразу', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => { result.current.updateSettings({ userName: 'Sultan' }); });
    expect(result.current.settings.userName).toBe('Sultan');
  });

  it('сохраняет в Firestore с дебаунсом 1 сек', async () => {
    vi.useFakeTimers();
    try {
      mockLoad.mockResolvedValue({});
      const { result } = renderHook(() => useUserProfile('user-123'));

      // Ждём загрузку с реальными промисами
      await act(async () => { await Promise.resolve(); });

      act(() => { result.current.updateSettings({ userName: 'Sultan' }); });
      expect(mockSave).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(1000); });
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith('user-123', {
        settings: expect.objectContaining({ userName: 'Sultan' }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('несколько вызовов подряд — один saveUserProfile (debounce)', async () => {
    vi.useFakeTimers();
    try {
      mockLoad.mockResolvedValue({});
      const { result } = renderHook(() => useUserProfile('user-123'));
      await act(async () => { await Promise.resolve(); });

      act(() => {
        result.current.updateSettings({ userName: 'A' });
        result.current.updateSettings({ userName: 'AB' });
        result.current.updateSettings({ userName: 'ABC' });
      });
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith('user-123', {
        settings: expect.objectContaining({ userName: 'ABC' }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('не вызывает saveUserProfile без uid', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useUserProfile(null));
      await act(async () => { await Promise.resolve(); });

      act(() => { result.current.updateSettings({ userName: 'Sultan' }); });
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSave).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── updateAssistantProfile ──────────────────────────────────────────────────

describe('useUserProfile — updateAssistantProfile', () => {
  it('обновляет профиль ассистента локально', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => { result.current.updateAssistantProfile({ name: 'Nova', tone: 'brief' }); });
    expect(result.current.assistantProfile.name).toBe('Nova');
    expect(result.current.assistantProfile.tone).toBe('brief');
  });

  it('сохраняет изменение профиля в Firestore', async () => {
    vi.useFakeTimers();
    try {
      mockLoad.mockResolvedValue({});
      const { result } = renderHook(() => useUserProfile('user-123'));
      await act(async () => { await Promise.resolve(); });

      act(() => { result.current.updateAssistantProfile({ useEmoji: true }); });
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSave).toHaveBeenCalledWith('user-123', {
        assistantProfile: expect.objectContaining({ useEmoji: true }),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── Контакты ────────────────────────────────────────────────────────────────

describe('useUserProfile — контакты', () => {
  it('извлекает имена участников из записи', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => {
      result.current.addPersonFromRecording({
        id: 'rec-1', title: '', date: '', duration: '', tags: [], summary: '', transcript: [],
        participants: [{ name: 'Алия', speakerLabel: 'Участник 1', role: 'PM' }],
      });
    });

    expect(result.current.getKnownNames()).toContain('Алия');
  });

  it('не добавляет "Я", "I", "Me"', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => {
      result.current.addPersonFromRecording({
        id: 'rec-1', title: '', date: '', duration: '', tags: [], summary: '', transcript: [],
        participants: [
          { name: 'Я', speakerLabel: 'Участник 1', role: '' },
          { name: 'I', speakerLabel: 'Участник 2', role: '' },
          { name: 'Данияр', speakerLabel: 'Участник 3', role: '' },
        ],
      });
    });

    const names = result.current.getKnownNames();
    expect(names).not.toContain('Я');
    expect(names).not.toContain('I');
    expect(names).toContain('Данияр');
  });

  it('не дублирует одно и то же имя', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => {
      result.current.addPersonFromRecording({
        id: 'rec-1', title: '', date: '', duration: '', tags: [], summary: '', transcript: [],
        participants: [{ name: 'Алия', speakerLabel: 'Участник 1', role: '' }],
      });
    });
    act(() => {
      result.current.addPersonFromRecording({
        id: 'rec-2', title: '', date: '', duration: '', tags: [], summary: '', transcript: [],
        participants: [{ name: 'Алия', speakerLabel: 'Участник 1', role: '' }],
      });
    });

    expect(result.current.getKnownNames().filter(n => n === 'Алия')).toHaveLength(1);
  });

  it('загружает people из Firestore при инициализации', async () => {
    mockLoad.mockResolvedValue({
      people: [{ name: 'Ботагоз', firstMet: '2025-01-01', recordingIds: ['rec-1'] }],
    });
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(result.current.getKnownNames()).toContain('Ботагоз');
  });

  it('запись без участников — ничего не добавляет', async () => {
    const { result } = renderHook(() => useUserProfile('user-123'));
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    act(() => {
      result.current.addPersonFromRecording({
        id: 'rec-1', title: '', date: '', duration: '', tags: [], summary: '', transcript: [],
        participants: [],
      });
    });

    expect(result.current.getKnownNames()).toHaveLength(0);
  });
});
