import { useCallback } from 'react';
import { registerPlugin } from '@capacitor/core';

export type AudioMode = 'mic' | 'speaker' | 'both';

interface NativeRecorderPlugin {
  startRecording(options: { mode: AudioMode }): Promise<{ filePath: string; fileName: string; mode: string }>;
  pauseRecording(): Promise<{ success: boolean }>;
  resumeRecording(): Promise<{ success: boolean }>;
  stopRecording(): Promise<{ success: boolean }>;
}

const NativeRecorder = registerPlugin<NativeRecorderPlugin>('NativeRecorder');

const isCapacitor = typeof window !== 'undefined' &&
  !!(window as unknown as { Capacitor?: unknown }).Capacitor;

export function useNativeRecorder() {
  const isAvailable = isCapacitor;

  const startNativeRecording = useCallback(async (mode: AudioMode = 'mic') => {
    if (!isAvailable) return null;
    try {
      const result = await NativeRecorder.startRecording({ mode });
      console.log('[NativeRecorder] Started:', result.filePath, 'mode:', result.mode);
      return result;
    } catch (e) {
      console.warn('[NativeRecorder] startRecording failed:', e);
      return null;
    }
  }, [isAvailable]);

  const pauseNativeRecording = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      await NativeRecorder.pauseRecording();
      return true;
    } catch (e) {
      console.warn('[NativeRecorder] pauseRecording failed:', e);
      return false;
    }
  }, [isAvailable]);

  const resumeNativeRecording = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      await NativeRecorder.resumeRecording();
      return true;
    } catch (e) {
      console.warn('[NativeRecorder] resumeRecording failed:', e);
      return false;
    }
  }, [isAvailable]);

  const stopNativeRecording = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      await NativeRecorder.stopRecording();
      return true;
    } catch (e) {
      console.warn('[NativeRecorder] stopRecording failed:', e);
      return false;
    }
  }, [isAvailable]);

  return { isAvailable, startNativeRecording, pauseNativeRecording, resumeNativeRecording, stopNativeRecording };
}
