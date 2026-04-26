import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { appendToRecording, transcribeRecording, transcribeAudio, uploadAudioToR2 } from '../../lib/api';
import { X, Plus, Mic, Headphones, Keyboard, Loader2, Square } from 'lucide-react';
import { useAppendAudio } from './useAppendAudio';
import type { Recording, TranscriptItem } from '../../types';

interface AppendPanelProps {
  recording: Recording;
  isAppending: boolean;
  onOpen: () => void;
  onClose: () => void;
  onUpdate: (r: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function formatDuration(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

function parseDuration(dur: string): number {
  const parts = dur.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

export const AppendPanel = ({ recording, isAppending, onOpen, onClose, onUpdate, showToast }: AppendPanelProps) => {
  const [appendMode, setAppendMode] = useState<'text' | 'audio' | 'voice'>('text');
  const [appendQuery, setAppendQuery] = useState('');
  const [isProcessingAppend, setIsProcessingAppend] = useState(false);

  const { isRecordingAppend, appendRecordDuration, startAppendRecording, stopAppendRecording } =
    useAppendAudio(showToast);

  const handleClose = () => {
    stopAppendRecording();
    onClose();
  };

  const handleAppend = async () => {
    if (!appendQuery.trim()) return;
    setIsProcessingAppend(true);
    let success = false;
    try {
      const prompt = `
        You are an AI assistant helping to update a personal voice notepad recording.
        IMPORTANT: Write ALL output fields (summary, ideas, actionItems) in Russian only.
        Current Recording:
        Title: ${recording.title}
        Summary: ${recording.summary}
        Ideas: ${JSON.stringify(recording.ideas || [])}
        Action Items: ${JSON.stringify(recording.actionItems || [])}

        The user wants to add the following thought/idea/task: "${appendQuery}"

        Update the recording's data. If it's an idea, add it to ideas. If it's a task, add it to actionItems. If it's general info, update the summary.
        Return the updated JSON object with fields: "summary" (string, Russian), "ideas" (array of Russian strings), "actionItems" (array of Russian strings).
      `;
      const result = await appendToRecording(prompt);
      const appendEntry: TranscriptItem = {
        speaker: '✏️ Дополнение',
        timestamp: '--:--',
        text: appendQuery,
        isAppended: true,
      };
      onUpdate({
        ...recording,
        summary: result.summary || recording.summary,
        ideas: result.ideas || recording.ideas,
        actionItems: result.actionItems || recording.actionItems,
        actionItemsDone: result.actionItems
          ? [...(recording.actionItemsDone || []), ...(result.actionItems).map(() => false)]
          : recording.actionItemsDone,
        transcript: [...recording.transcript, appendEntry],
      });
      setAppendQuery('');
      showToast('Запись успешно дополнена', 'success');
      success = true;
    } catch (error) {
      console.error('Error appending to recording:', error);
      showToast('Ошибка при дополнении записи', 'error');
    } finally {
      setIsProcessingAppend(false);
      if (success) handleClose();
    }
  };

  const handleAppendAudio = async (blob: Blob) => {
    setIsProcessingAppend(true);
    let success = false;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const appendIdx = (recording.appendAudios?.length ?? 0) + 1;
      const appendLabel = `Дополнение ${appendIdx}`;
      const appendedAt = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const appendRecordingId = `${recording.id}-append-${Date.now()}`;

      // Транскрибируем аудио и загружаем в R2 параллельно
      const [transcribeResult, r2Result] = await Promise.allSettled([
        transcribeRecording(base64, blob.type || 'audio/webm'),
        uploadAudioToR2(blob, appendRecordingId),
      ]);

      // Постоянный URL из R2 или временный blob (пропадёт после перезагрузки)
      const appendAudioUrl = r2Result.status === 'fulfilled'
        ? r2Result.value.publicUrl
        : URL.createObjectURL(blob);
      const appendR2Key = r2Result.status === 'fulfilled' ? r2Result.value.r2Key : undefined;

      if (r2Result.status === 'rejected') {
        console.warn('[Append] R2 upload failed, using blob URL:', r2Result.reason);
      }

      const existSecs = parseDuration(recording.duration);
      const r = transcribeResult.status === 'fulfilled' ? transcribeResult.value : null;
      const offsetTranscript = (r?.transcript || []).map(item => {
        const [m, s] = item.timestamp.split(':').map(Number);
        const totalS = (m * 60 + (s || 0)) + existSecs;
        return { ...item, timestamp: formatDuration(totalS), isAppended: true };
      });

      onUpdate({
        ...recording,
        duration: formatDuration(existSecs + appendRecordDuration),
        transcript: [...recording.transcript, ...offsetTranscript],
        actionItems: [...(recording.actionItems || []), ...(r?.actionItems || [])],
        actionItemsDone: [...(recording.actionItemsDone || []), ...(r?.actionItems || []).map(() => false)],
        ideas: [...(recording.ideas || []), ...(r?.ideas || [])],
        keyMoments: [...(recording.keyMoments || []), ...(r?.keyMoments || [])],
        tags: [...new Set([...recording.tags, ...(r?.tags || [])])],
        summary: recording.summary + (r?.summary ? '\n\n**Продолжение:** ' + r.summary : ''),
        appendAudios: [...(recording.appendAudios || []), { url: appendAudioUrl, label: appendLabel, addedAt: appendedAt, r2Key: appendR2Key }],
      });
      showToast('Аудио добавлено к записи', 'success');
      success = true;
    } catch {
      showToast('Ошибка обработки аудио', 'error');
    } finally {
      setIsProcessingAppend(false);
      if (success) handleClose();
    }
  };

  const handleVoiceDictation = async (blob: Blob) => {
    setIsProcessingAppend(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const text = await transcribeAudio(
        base64,
        blob.type || 'audio/webm',
        'Transcribe this voice message exactly as spoken. Return only the transcribed text, no extra formatting.'
      );
      setAppendQuery(text);
      setAppendMode('text');
      showToast('Речь распознана — проверь и отправь', 'info');
    } catch {
      showToast('Не удалось распознать речь', 'error');
    } finally {
      setIsProcessingAppend(false);
      // Режим надиктовки — не закрываем панель, пользователь редактирует текст
    }
  };

  const handleModeSwitch = (id: 'audio' | 'voice' | 'text') => {
    setAppendMode(id);
    stopAppendRecording();
  };

  return (
    <>
      <AnimatePresence>
        {isAppending && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 w-full bg-surface-container-high border-t border-white/5 p-4 md:p-6 z-50 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-headline font-bold text-lg">Дополнить запись</h3>
                <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Табы режима ввода */}
              <div className="flex gap-2 mb-4">
                {([
                  { id: 'audio', label: 'Аудио', icon: Mic },
                  { id: 'voice', label: 'Надиктовать', icon: Headphones },
                  { id: 'text', label: 'Текстом', icon: Keyboard },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleModeSwitch(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${appendMode === id ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {/* Режим аудио */}
              {appendMode === 'audio' && (
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-surface-container rounded-xl px-4 py-3 text-on-surface-variant text-sm">
                    {isProcessingAppend ? 'Обрабатываю аудио, транскрибирую...' : isRecordingAppend ? `Запись идёт — ${formatDuration(appendRecordDuration)}` : 'Нажми Запись — продолжи митинг или добавь мысль голосом'}
                  </div>
                  {isProcessingAppend ? <Loader2 className="w-10 h-10 animate-spin text-primary shrink-0" />
                    : isRecordingAppend ? (
                      <button onClick={stopAppendRecording} className="w-12 h-12 rounded-full bg-error flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                        <Square className="w-5 h-5 text-white" fill="currentColor" />
                      </button>
                    ) : (
                      <button onClick={() => startAppendRecording(handleAppendAudio)} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                        <Mic className="w-5 h-5 text-on-primary-fixed" />
                      </button>
                    )}
                </div>
              )}

              {/* Режим надиктовки */}
              {appendMode === 'voice' && (
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-surface-container rounded-xl px-4 py-3 text-on-surface-variant text-sm">
                    {isProcessingAppend ? 'Распознаю речь...' : isRecordingAppend ? `Говори — ${formatDuration(appendRecordDuration)}` : 'Надиктуй — текст появится в поле и обработается AI'}
                  </div>
                  {isProcessingAppend ? <Loader2 className="w-10 h-10 animate-spin text-primary shrink-0" />
                    : isRecordingAppend ? (
                      <button onClick={stopAppendRecording} className="w-12 h-12 rounded-full bg-error flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                        <Square className="w-5 h-5 text-white" fill="currentColor" />
                      </button>
                    ) : (
                      <button onClick={() => startAppendRecording(handleVoiceDictation)} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                        <Headphones className="w-5 h-5 text-on-primary-fixed" />
                      </button>
                    )}
                </div>
              )}

              {/* Режим текста */}
              {appendMode === 'text' && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={appendQuery}
                    onChange={(e) => setAppendQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAppend()}
                    placeholder="Например: Добавь задачу 'Купить билеты' или идею 'Сделать редизайн'"
                    className="flex-1 bg-surface-container border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                    disabled={isProcessingAppend}
                    autoFocus
                  />
                  <button
                    onClick={handleAppend}
                    disabled={!appendQuery.trim() || isProcessingAppend}
                    className="bg-primary text-on-primary-fixed px-5 py-3 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isProcessingAppend ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Добавить
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка "Дополнить" фиксированная (только десктоп, скрыта когда панель открыта) */}
      {!isAppending && (
        <button
          onClick={onOpen}
          className="hidden md:flex fixed bottom-8 right-8 bg-surface-container-high border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl items-center gap-2 hover:bg-surface-container-highest transition-colors z-40 font-bold text-base cursor-pointer"
        >
          <Plus className="w-5 h-5 text-primary" /> Дополнить
        </button>
      )}
    </>
  );
};
