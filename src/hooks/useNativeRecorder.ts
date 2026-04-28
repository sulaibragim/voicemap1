import { useCallback } from 'react';
import { registerPlugin } from '@capacitor/core';

interface NativeRecorderPlugin {
  startRecording(): Promise<{ filePath: string; fileName: string }>;
  stopRecording(): Promise<{ success: boolean }>;
}

// Регистрируем нативный плагин — работает только на Android
const NativeRecorder = registerPlugin<NativeRecorderPlugin>('NativeRecorder');

const isCapacitor = typeof window !== 'undefined' &&
  !!(window as unknown as { Capacitor?: unknown }).Capacitor;

/**
 * Хук для нативной записи на Android.
 * На вебе возвращает null — используй обычный MediaRecorder.
 * На Android использует Foreground Service — запись продолжается при блокировке экрана.
 */
export function useNativeRecorder() {
  const isAvailable = isCapacitor;

  const startNativeRecording = useCallback(async (): Promise<{ filePath: string; fileName: string } | null> => {
    if (!isAvailable) return null;
    try {
      const result = await NativeRecorder.startRecording();
      console.log('[NativeRecorder] Started:', result.filePath);
      return result;
    } catch (e) {
      console.warn('[NativeRecorder] startRecording failed:', e);
      return null;
    }
  }, [isAvailable]);

  const stopNativeRecording = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      await NativeRecorder.stopRecording();
      console.log('[NativeRecorder] Stopped');
      return true;
    } catch (e) {
      console.warn('[NativeRecorder] stopRecording failed:', e);
      return false;
    }
  }, [isAvailable]);

  return { isAvailable, startNativeRecording, stopNativeRecording };
}
