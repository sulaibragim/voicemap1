import { useRef, useState, useEffect, useMemo } from 'react';
import { condenseTranscript } from '../../lib/api';
import { ArrowLeft, Play, Pause, X, Loader2, Trash2, Plus, Scissors, AlignLeft, Share2, Download, Pencil, ChevronDown, Copy, FileText, Send } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { AppendPanel } from './AppendPanel';
import { AudioPlayer, parseTimestamp } from './AudioPlayer';
import { SummarySection } from './SummarySection';
import { TranscriptSection, SPEAKER_PALETTE } from './TranscriptSection';
import { ActionItemsSection } from './ActionItemsSection';
import type { Recording } from '../../types';

interface RecordingDetailProps {
  recording: Recording;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: (r: Recording) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  allRecordings?: Recording[];
  onOpenRecording?: (id: string) => void;
}

// Поиск похожих записей по общим тегам, упоминаниям и ключевым словам идей
function findRelated(current: Recording, all: Recording[]): Array<{ rec: Recording; reason: string }> {
  const results: Array<{ rec: Recording; score: number; reason: string }> = [];
  const curTags = new Set(current.tags.map(t => t.toLowerCase()));
  const curMentions = new Set((current.mentions ?? []).map(m => m.toLowerCase()));
  const curIdeas = new Set((current.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())));

  all.forEach(rec => {
    if (rec.id === current.id) return;
    let score = 0;
    const reasons: string[] = [];
    const sharedTags = rec.tags.filter(t => curTags.has(t.toLowerCase()));
    if (sharedTags.length > 0) { score += sharedTags.length * 3; reasons.push(`тег ${sharedTags[0]}`); }
    const sharedMentions = (rec.mentions ?? []).filter(m => curMentions.has(m.toLowerCase()));
    if (sharedMentions.length > 0) { score += sharedMentions.length * 2; if (reasons.length === 0) reasons.push(`упоминание ${sharedMentions[0]}`); }
    const recIdeaWords = new Set((rec.ideas ?? []).flatMap(i => i.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase())));
    const sharedIdeaWords = [...curIdeas].filter(w => recIdeaWords.has(w));
    if (sharedIdeaWords.length > 0) { score += sharedIdeaWords.length; if (reasons.length === 0) reasons.push('схожие идеи'); }
    if (score > 0) results.push({ rec, score, reason: reasons[0] ?? 'общая тема' });
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 3).map(({ rec, reason }) => ({ rec, reason }));
}

// Мини-плеер для дополненных аудиозаписей
const AppendAudioPlayer = ({ url, label, addedAt }: { url: string; label: string; addedAt: string }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Blob URL протухает после перезагрузки страницы — показываем плейсхолдер
  const isBlobUrl = url?.startsWith('blob:');

  useEffect(() => {
    const el = ref.current;
    if (!el || isBlobUrl) return;
    const onTime = () => setCurrent(el.currentTime);
    const onDur = () => setDur(el.duration);
    const onEnd = () => setPlaying(false);
    const onError = () => setLoadError(true);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
    };
  }, [isBlobUrl]);

  const toggle = () => {
    if (!ref.current || loadError) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().catch(() => setLoadError(true)); setPlaying(true); }
  };

  // Аудио недоступно (blob URL или ошибка загрузки)
  if (isBlobUrl || loadError) {
    return (
      <div className="bg-surface-container p-3 md:p-4 rounded-2xl border border-amber-400/10 flex items-center gap-3 opacity-50">
        <div className="w-9 h-9 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
          <Play className="w-4 h-4 text-amber-400/50" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-amber-400 truncate block">{label}</span>
          <span className="text-[10px] text-on-surface-variant">{addedAt} · Аудио недоступно после перезагрузки</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container p-3 md:p-4 rounded-2xl border border-amber-400/20 flex items-center gap-3">
      <audio ref={ref} src={url} className="hidden" />
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center hover:bg-amber-400/30 transition-colors shrink-0">
        {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-amber-400 truncate">{label}</span>
          <span className="text-[10px] text-on-surface-variant ml-2 shrink-0">{addedAt} · {formatTime(current)}/{dur > 0 ? formatTime(dur) : '--:--'}</span>
        </div>
        <div className="h-1.5 w-full bg-surface-container-highest rounded-full cursor-pointer" onClick={(e) => {
          if (ref.current && dur > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            ref.current.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
          }
        }}>
          <div className="h-full bg-amber-400 rounded-full transition-all duration-100" style={{ width: `${dur > 0 ? (current / dur) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
};

export const RecordingDetail = ({ recording, onBack, onDelete, onUpdate, showToast, allRecordings = [], onOpenRecording }: RecordingDetailProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<'transcript' | 'keyMoments'>('transcript');
  const [transcriptMode, setTranscriptMode] = useState<'full' | 'condensed'>('full');
  const [isCondensing, setIsCondensing] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<'summary' | 'transcript' | 'audio'>('summary');
  const touchStartXRef = useRef<number>(0);

  // Редактирование названия
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(recording.title);
  useEffect(() => { setEditTitleValue(recording.title); }, [recording.id]);

  // Переименование спикеров (мобилка)
  const [editingMobileSpeaker, setEditingMobileSpeaker] = useState<string | null>(null);
  const [editingMobileSpeakerName, setEditingMobileSpeakerName] = useState('');
  const handleMobileRenameSpeaker = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingMobileSpeaker(null);
    if (!trimmed || trimmed === oldName) return;
    const newTranscript = recording.transcript.map(item => item.speaker === oldName ? { ...item, speaker: trimmed } : item);
    const newCondensed = recording.condensedTranscript?.map(item => item.speaker === oldName ? { ...item, speaker: trimmed } : item);
    onUpdate({ ...recording, transcript: newTranscript, condensedTranscript: newCondensed, speakerNames: { ...(recording.speakerNames || {}), [oldName]: trimmed } });
    showToast(`${oldName} → ${trimmed}`, 'success');
  };

  // Редактирование тегов
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // MediaRecorder блобы не содержат длину в заголовках — duration приходит как Infinity/NaN.
    // Хак: прыгаем в конец файла, браузер вычисляет реальную длину, потом возвращаемся на 0.
    const handleLoadedMetadata = () => {
      if (!isFinite(audio.duration)) {
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      } else {
        setDuration(audio.duration);
      }
    };

    const handleSeeked = () => {
      if (!isFinite(audio.duration)) return; // ещё не вычислил
      setDuration(audio.duration);
      // Сбрасываем только если это был наш трюк (currentTime очень большое)
      if (audio.currentTime > 1e9) audio.currentTime = 0;
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    // Если аудио уже загружено (повторный рендер)
    if (audio.readyState >= 1) handleLoadedMetadata();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleTimestampClick = (timestamp: string) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseTimestamp(timestamp);
      if (!isPlaying) { audioRef.current.play(); setIsPlaying(true); }
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: recording.title, text: recording.summary, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${recording.title}\n\n${recording.summary}`);
        showToast('Ссылка скопирована в буфер обмена', 'success');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleExport = () => {
    const text = `Название: ${recording.title}\nДата: ${recording.date}\nДлительность: ${recording.duration}\nНастроение: ${recording.mood || 'Неизвестно'}\n\nСаммари:\n${recording.summary}\n\nИдеи:\n${(recording.ideas || []).map(i => `- ${i}`).join('\n')}\n\nЗадачи:\n${(recording.actionItems || []).map(t => `- ${t}`).join('\n')}\n\nТранскрипт:\n${recording.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${recording.title}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    const text = [
      recording.title,
      '',
      recording.summary,
      ...(recording.actionItems?.length ? ['', 'Задачи:', ...recording.actionItems.map(i => `• ${i}`)] : []),
      ...(recording.ideas?.length ? ['', 'Идеи:', ...recording.ideas.map(i => `• ${i}`)] : []),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    showToast('Саммари скопировано', 'success');
    setShowExportMenu(false);
  };

  const handleCopyTranscript = async () => {
    const text = recording.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    showToast('Транскрипт скопирован', 'success');
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast('Разрешите всплывающие окна', 'error'); return; }
    const mood = recording.mood ? ` · ${recording.mood}` : '';
    const tags = recording.tags?.length ? `<p style="color:#888;font-size:13px">${recording.tags.join(' ')}</p>` : '';
    const actionItemsHtml = recording.actionItems?.length
      ? `<h2>Задачи</h2><ul>${recording.actionItems.map(i => `<li>${i}</li>`).join('')}</ul>`
      : '';
    const ideasHtml = recording.ideas?.length
      ? `<h2>Идеи</h2><ul>${recording.ideas.map(i => `<li>${i}</li>`).join('')}</ul>`
      : '';
    const keyMomentsHtml = recording.keyMoments?.length
      ? `<h2>Ключевые моменты</h2><ul>${recording.keyMoments.map(i => `<li>${i}</li>`).join('')}</ul>`
      : '';
    const transcriptHtml = recording.transcript?.length
      ? `<h2>Транскрипт</h2>${recording.transcript.map(t => `<div style="margin-bottom:14px"><span style="font-weight:600">${t.speaker}</span> <span style="color:#999;font-size:12px">[${t.timestamp}]</span><p style="margin:4px 0 0">${t.text}</p></div>`).join('')}`
      : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${recording.title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:40px auto;color:#1a1a1a;line-height:1.6;padding:0 20px}
h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;font-weight:600;margin-top:24px;margin-bottom:8px;color:#333;border-bottom:1px solid #eee;padding-bottom:4px}
.meta{color:#666;font-size:13px;margin-bottom:20px}ul{margin:0;padding-left:20px}li{margin-bottom:5px}
@media print{body{margin:0}}</style></head>
<body><h1>${recording.title}</h1>
<div class="meta">${recording.date} · ${recording.duration}${mood}</div>
${tags}
<h2>Краткое содержание</h2><p>${recording.summary}</p>
${actionItemsHtml}${ideasHtml}${keyMomentsHtml}${transcriptHtml}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 600);
    setShowExportMenu(false);
  };

  const handleTelegram = () => {
    const lines = [
      `📝 ${recording.title}`,
      `🕐 ${recording.date} · ${recording.duration}`,
      '',
      recording.summary,
    ];
    if (recording.actionItems?.length) {
      lines.push('', '✅ Задачи:');
      recording.actionItems.forEach(i => lines.push(`• ${i}`));
    }
    if (recording.ideas?.length) {
      lines.push('', '💡 Идеи:');
      recording.ideas.slice(0, 3).forEach(i => lines.push(`• ${i}`));
    }
    const text = lines.join('\n');
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
    setShowExportMenu(false);
  };

  const handleTitleSave = () => {
    const trimmed = editTitleValue.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === recording.title) return;
    onUpdate({ ...recording, title: trimmed });
    showToast('Название обновлено', 'success');
  };

  const handleAddTag = () => {
    const trimmed = newTagValue.trim().toLowerCase();
    setIsAddingTag(false);
    setNewTagValue('');
    if (!trimmed || recording.tags.includes(trimmed)) return;
    onUpdate({ ...recording, tags: [...recording.tags, trimmed] });
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate({ ...recording, tags: recording.tags.filter(t => t !== tag) });
  };

  const handleSetReminder = (idx: number, date: string, time: string) => {
    const reminders = { ...(recording.taskReminders ?? {}) };
    reminders[idx] = { date, time, notified: false };
    onUpdate({ ...recording, taskReminders: reminders });
    showToast(`Напоминание установлено на ${date} в ${time}`, 'success');
  };

  const handleCondense = async () => {
    if (recording.condensedTranscript) { setTranscriptMode('condensed'); return; }
    if (recording.transcript.length === 0) return;
    setIsCondensing(true);
    try {
      const result = await condenseTranscript(recording.transcript);
      onUpdate({ ...recording, condensedTranscript: result });
      setTranscriptMode('condensed');
      showToast('Краткий транскрипт готов', 'success');
    } catch {
      showToast('Не удалось сократить транскрипт', 'error');
    } finally {
      setIsCondensing(false);
    }
  };

  // Проверка напоминаний каждые 30 секунд
  useEffect(() => {
    const check = () => {
      const reminders = recording.taskReminders;
      if (!reminders) return;
      const now = new Date();
      let updated = false;
      const next = { ...reminders };
      Object.entries(reminders).forEach(([key, reminder]) => {
        if (reminder.notified) return;
        const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
        if (reminderTime <= now) {
          const idx = Number(key);
          const taskText = recording.actionItems?.[idx] ?? 'Задача';
          showToast(`Напоминание: ${taskText}`, 'info');
          next[idx] = { ...reminder, notified: true };
          updated = true;
        }
      });
      if (updated) onUpdate({ ...recording, taskReminders: next });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [recording.taskReminders, recording.actionItems]);

  // Закрытие дропдауна экспорта по клику снаружи
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Вычисления для плеера и транскрипта
  const keyMomentMarkers = useMemo(() => {
    if (!recording.keyMoments?.length || !recording.transcript?.length) return [];
    return recording.keyMoments.map(moment => {
      const momentWords = new Set(moment.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      let bestIdx = 0; let bestScore = 0;
      recording.transcript.forEach((item, idx) => {
        const score = item.text.toLowerCase().split(/\s+/).filter(w => momentWords.has(w)).length;
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      });
      return { timestamp: recording.transcript[bestIdx].timestamp, label: moment };
    });
  }, [recording.keyMoments, recording.transcript]);

  const appendBoundaryTimestamp = useMemo(() => {
    const first = recording.transcript.find(t => t.isAppended && t.timestamp !== '--:--');
    return first ? parseTimestamp(first.timestamp) : null;
  }, [recording.transcript]);

  const uniqueSpeakers = useMemo(() =>
    [...new Set(recording.transcript.map(t => t.speaker))],
    [recording.transcript]
  );

  const shouldColorSpeakers = uniqueSpeakers.length >= 2;

  const speakerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 1;
    uniqueSpeakers.forEach(speaker => {
      if (speaker === 'Я' || speaker === 'I' || speaker === 'Me') {
        map[speaker] = SPEAKER_PALETTE[0];
      } else {
        map[speaker] = SPEAKER_PALETTE[idx % SPEAKER_PALETTE.length];
        idx++;
      }
    });
    return map;
  }, [uniqueSpeakers]);

  const relatedRecordings = useMemo(() => findRelated(recording, allRecordings), [recording, allRecordings]);

  return (
    <div className="h-dvh overflow-hidden bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center justify-between px-4 md:px-12 py-3 md:py-6 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1 mr-2 md:mr-0">
          <button onClick={onBack} className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-surface-container hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white cursor-pointer flex-shrink-0">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitleValue(recording.title); } }}
                  className="text-sm md:text-xl font-bold font-headline bg-transparent border-b border-primary outline-none text-on-surface w-full max-w-xs md:max-w-md"
                />
              ) : (
                <>
                  <h1 className="text-sm md:text-xl font-bold font-headline line-clamp-1">{recording.title}</h1>
                  <button
                    onClick={() => { setIsEditingTitle(true); setEditTitleValue(recording.title); }}
                    className="flex-shrink-0 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer opacity-40 hover:opacity-100"
                    title="Редактировать название"
                  >
                    <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                </>
              )}
            </div>
            <p className="hidden md:block text-xs text-on-surface-variant">
              {recording.date} · {recording.duration}
              {(recording.actionItems?.length ?? 0) > 0 && <> · <span className="text-secondary">{recording.actionItems!.length} задач</span></>}
              {(recording.ideas?.length ?? 0) > 0 && <> · {recording.ideas!.length} идей</>}
            </p>
            <div className="hidden md:flex items-center flex-wrap gap-1 mt-1">
              {recording.tags.map(tag => (
                <span key={tag} className="group/tag flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                  #{tag.replace(/^#/, '')}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="opacity-0 group-hover/tag:opacity-100 transition-opacity ml-0.5 hover:text-error cursor-pointer"
                    title="Удалить тег"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {isAddingTag ? (
                <input
                  autoFocus
                  value={newTagValue}
                  onChange={e => setNewTagValue(e.target.value)}
                  onBlur={handleAddTag}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setIsAddingTag(false); setNewTagValue(''); } }}
                  placeholder="тег"
                  className="bg-transparent border-b border-primary outline-none text-[10px] text-primary w-16 placeholder-primary/40"
                />
              ) : (
                <button
                  onClick={() => setIsAddingTag(true)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/5 text-on-surface-variant rounded-full text-[10px] hover:bg-white/10 hover:text-primary transition-colors cursor-pointer"
                  title="Добавить тег"
                >
                  <Plus className="w-2.5 h-2.5" /> тег
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          {/* Кнопка "Дополнить" — только на мобилке */}
          <button
            onClick={() => setIsAppending(true)}
            className="md:hidden bg-primary text-on-primary-fixed px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Дополнить
          </button>
          {/* Дропдаун экспорта */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container rounded-lg text-sm font-bold hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Экспорт</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface-container-high border border-white/10 rounded-xl shadow-xl z-50 py-1 min-w-[190px]">
                <button onClick={() => { handleShare(); setShowExportMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <Share2 className="w-4 h-4 text-on-surface-variant" /> Поделиться
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button onClick={handleCopySummary} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <Copy className="w-4 h-4 text-on-surface-variant" /> Скопировать саммари
                </button>
                <button onClick={handleCopyTranscript} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <Copy className="w-4 h-4 text-on-surface-variant" /> Скопировать транскрипт
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button onClick={handleExportPDF} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <FileText className="w-4 h-4 text-on-surface-variant" /> Скачать PDF
                </button>
                <button onClick={() => { handleExport(); setShowExportMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <Download className="w-4 h-4 text-on-surface-variant" /> Скачать TXT
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button onClick={handleTelegram} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left cursor-pointer">
                  <Send className="w-4 h-4 text-[#2AABEE]" /> Отправить в Telegram
                </button>
              </div>
            )}
          </div>
          {/* Кнопка удалить */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 flex items-center justify-center gap-2 bg-error/10 text-error rounded-lg text-sm font-bold hover:bg-error/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden md:inline">Удалить</span>
          </button>
        </div>
      </header>

      {/* Аудио-элемент — всегда присутствует */}
      {recording.audioUrl && <audio ref={audioRef} src={recording.audioUrl} className="hidden" />}

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-1 lg:items-stretch lg:gap-6 lg:p-8 lg:max-w-[1440px] lg:mx-auto lg:w-full">

        {/* ===== МОБИЛЬНЫЙ LAYOUT (скрыт на lg+) ===== */}
        <div className="lg:hidden flex flex-col flex-1 min-h-0">

          {/* Компактный плеер — всегда виден */}
          <AudioPlayer
            audioRef={audioRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            recordingDuration={recording.duration}
            hasAudioUrl={!!recording.audioUrl}
            transcript={recording.transcript}
            keyMomentMarkers={keyMomentMarkers}
            appendBoundaryTimestamp={appendBoundaryTimestamp}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onTimestampClick={handleTimestampClick}
            variant="compact"
          />

          {/* Таб-бар */}
          <div className="flex border-b border-white/5 shrink-0 bg-surface-container-low">
            {(['summary', 'transcript', 'audio'] as const).map((tab, i) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${mobileTab === tab ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'}`}
              >
                {['Саммари', 'Транскрипт', 'Аудио'][i]}
              </button>
            ))}
          </div>

          {/* Содержимое со свайпом */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const delta = e.changedTouches[0].clientX - touchStartXRef.current;
              const tabs = ['summary', 'transcript', 'audio'] as const;
              const idx = tabs.indexOf(mobileTab);
              if (delta < -50 && idx < 2) setMobileTab(tabs[idx + 1]);
              if (delta > 50 && idx > 0) setMobileTab(tabs[idx - 1]);
            }}
          >
            {/* Таб: Саммари */}
            {mobileTab === 'summary' && (
              <div className="p-4 space-y-4 pb-32">
                <div>
                  <p className="text-xs text-on-surface-variant mb-1.5">
                    {recording.date} · {recording.duration}
                    {(recording.actionItems?.length ?? 0) > 0 && <> · <span className="text-secondary">{recording.actionItems!.length} задач</span></>}
                    {(recording.ideas?.length ?? 0) > 0 && <> · {recording.ideas!.length} идей</>}
                  </p>
                  {recording.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recording.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {recording.mood && (
                  <div><p className="text-xs font-bold text-on-surface-variant mb-1">✨ Настроение</p>
                    <span className="px-3 py-1 bg-surface-container rounded-xl text-sm font-bold text-primary">{recording.mood}</span>
                  </div>
                )}
                {recording.mentions && recording.mentions.length > 0 && (
                  <div><p className="text-xs font-bold text-on-surface-variant mb-1">Упоминания</p>
                    <div className="flex flex-wrap gap-1.5">{recording.mentions.map((m, i) => <span key={i} className="px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full text-xs font-bold">{m}</span>)}</div>
                  </div>
                )}
                <div><p className="text-xs font-bold text-on-surface-variant mb-1">Краткое содержание</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{recording.summary}</p>
                </div>
                {recording.ideas && recording.ideas.length > 0 && (
                  <div><p className="text-xs font-bold text-primary mb-2">💡 Идеи и инсайты</p>
                    <ul className="space-y-1.5">{recording.ideas.map((idea, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />{idea}
                      </li>
                    ))}</ul>
                  </div>
                )}
                <ActionItemsSection
                  items={recording.actionItems || []}
                  richItems={recording.richActionItems}
                  onUpdateRichItems={(items) => onUpdate({ ...recording, richActionItems: items })}
                  done={recording.actionItemsDone}
                  onUpdate={(items) => onUpdate({ ...recording, actionItems: items })}
                  onToggleDone={(idx) => {
                    const cur = recording.actionItemsDone || new Array(recording.actionItems?.length ?? 0).fill(false);
                    const next = [...cur]; while (next.length < (recording.actionItems?.length ?? 0)) next.push(false);
                    next[idx] = !next[idx]; onUpdate({ ...recording, actionItemsDone: next });
                  }}
                  showToast={showToast}
                  taskReminders={recording.taskReminders}
                  onSetReminder={handleSetReminder}
                />
                {recording.openQuestions && recording.openQuestions.length > 0 && (
                  <div><p className="text-xs font-bold text-amber-400 mb-2">❓ Открытые вопросы</p>
                    <ul className="space-y-1.5">{recording.openQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />{q}
                      </li>
                    ))}</ul>
                  </div>
                )}
                {recording.bigQuestions && recording.bigQuestions.length > 0 && (
                  <div><p className="text-xs font-bold mb-2" style={{ color: 'var(--color-tertiary)' }}>🎯 Большие вопросы</p>
                    <ul className="space-y-1.5">{recording.bigQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl border-l-2 border-tertiary/40">
                        {q}
                      </li>
                    ))}</ul>
                  </div>
                )}
                {/* Участники — мобилка */}
                {uniqueSpeakers.length > 1 && (
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant mb-2">👥 Участники</p>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSpeakers.map(speaker => {
                        const detected = recording.participants?.find(p => p.speakerLabel === speaker);
                        const displayName = detected?.name && !detected.name.startsWith('Участник') && !detected.name.startsWith('Speaker') ? detected.name : speaker;
                        return editingMobileSpeaker === speaker ? (
                          <input
                            key={speaker}
                            autoFocus
                            value={editingMobileSpeakerName}
                            onChange={e => setEditingMobileSpeakerName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleMobileRenameSpeaker(speaker, editingMobileSpeakerName);
                              if (e.key === 'Escape') setEditingMobileSpeaker(null);
                            }}
                            onBlur={() => handleMobileRenameSpeaker(speaker, editingMobileSpeakerName)}
                            className="bg-surface-container border border-secondary/50 rounded-lg px-2.5 py-1 text-xs w-28 outline-none text-white"
                          />
                        ) : (
                          <button
                            key={speaker}
                            onClick={() => { setEditingMobileSpeaker(speaker); setEditingMobileSpeakerName(displayName); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold hover:bg-surface-container-highest transition-colors cursor-pointer"
                            style={shouldColorSpeakers ? { color: speakerColorMap[speaker] } : {}}
                          >
                            {displayName}
                            <Pencil className="w-2.5 h-2.5 opacity-40" />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-on-surface-variant/40 mt-1">Нажмите на имя чтобы переименовать</p>
                  </div>
                )}
              </div>
            )}

            {/* Таб: Транскрипт */}
            {mobileTab === 'transcript' && (
              <div className="p-4 pb-32">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold">
                    <button onClick={() => setTranscriptMode('full')} className={`px-3 py-1.5 rounded transition-colors ${transcriptMode === 'full' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}><AlignLeft className="w-3 h-3 inline mr-1" />Полная</button>
                    <button onClick={handleCondense} disabled={isCondensing} className={`px-3 py-1.5 rounded transition-colors disabled:opacity-60 ${transcriptMode === 'condensed' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>{isCondensing ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : <Scissors className="w-3 h-3 inline mr-1" />}Краткая</button>
                  </div>
                  <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold ml-auto">
                    <button onClick={() => setActiveTab('transcript')} className={`px-3 py-1.5 rounded transition-colors ${activeTab === 'transcript' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>Текст</button>
                    <button onClick={() => setActiveTab('keyMoments')} className={`px-3 py-1.5 rounded transition-colors ${activeTab === 'keyMoments' ? 'bg-surface-container-low text-white' : 'text-on-surface-variant'}`}>Моменты</button>
                  </div>
                </div>
                {activeTab === 'transcript' ? (
                  <div className="space-y-4">
                    {(transcriptMode === 'full' ? recording.transcript : (recording.condensedTranscript ?? recording.transcript)).map((item, i) => {
                      const activeIdx = (() => {
                        if (!recording.transcript.length) return -1;
                        for (let j = recording.transcript.length - 1; j >= 0; j--) {
                          if (currentTime >= parseTimestamp(recording.transcript[j].timestamp)) return j;
                        }
                        return 0;
                      })();
                      const isActive = transcriptMode === 'full' && i === activeIdx;
                      const speakerColor = shouldColorSpeakers ? (speakerColorMap[item.speaker] ?? SPEAKER_PALETTE[1]) : undefined;
                      return (
                        <div key={i} className={`transition-colors rounded-xl ${isActive ? 'bg-primary/5 px-3 py-2 -mx-3' : ''}`}>
                          <button onClick={() => item.timestamp !== '--:--' && handleTimestampClick(item.timestamp)} className={`flex items-center gap-2 mb-1 ${item.timestamp !== '--:--' ? 'cursor-pointer' : 'cursor-default'}`}>
                            <span className="font-bold text-xs tracking-wide uppercase" style={speakerColor ? { color: speakerColor } : { color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>{item.speaker}</span>
                            {item.timestamp !== '--:--' && <span className="text-[10px] font-mono text-on-surface-variant/40">{item.timestamp}</span>}
                            {item.isAppended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-bold uppercase">дополнено</span>}
                          </button>
                          <p className={`text-sm leading-relaxed ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-3">{(recording.keyMoments || []).map((moment, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />{moment}
                    </li>
                  ))}</ul>
                )}
              </div>
            )}

            {/* Таб: Аудио */}
            {mobileTab === 'audio' && (
              <div className="p-4 space-y-3 pb-32">
                {recording.appendAudios && recording.appendAudios.length > 0 ? (
                  recording.appendAudios.map((ap, idx) => <AppendAudioPlayer key={idx} url={ap.url} label={ap.label} addedAt={ap.addedAt} />)
                ) : (
                  <div className="text-center py-20 text-on-surface-variant">
                    <p className="text-sm">Дополнительных аудио нет</p>
                    <p className="text-xs mt-1 opacity-60">Нажми «Дополнить → Аудио» чтобы добавить</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== ДЕСКТОП: ЛЕВАЯ КОЛОНКА (скрыта на мобилке) ===== */}
        <div className="hidden lg:block lg:col-span-5 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-8">
          <AudioPlayer
            audioRef={audioRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            recordingDuration={recording.duration}
            hasAudioUrl={!!recording.audioUrl}
            transcript={recording.transcript}
            keyMomentMarkers={keyMomentMarkers}
            appendBoundaryTimestamp={appendBoundaryTimestamp}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onTimestampClick={handleTimestampClick}
            variant="full"
          />

          {/* Дополненные аудиозаписи */}
          {recording.appendAudios && recording.appendAudios.length > 0 && (
            <div className="space-y-3 max-h-48 overflow-y-auto lg:max-h-none">
              {recording.appendAudios.map((ap, idx) => (
                <AppendAudioPlayer key={idx} url={ap.url} label={ap.label} addedAt={ap.addedAt} />
              ))}
            </div>
          )}

          <SummarySection
            recording={recording}
            onUpdate={onUpdate}
            showToast={showToast}
            relatedRecordings={relatedRecordings}
            onOpenRecording={onOpenRecording}
            uniqueSpeakers={uniqueSpeakers}
            speakerColorMap={speakerColorMap}
            shouldColorSpeakers={shouldColorSpeakers}
            handleSetReminder={handleSetReminder}
          />
        </div>

        {/* ===== ДЕСКТОП: ПРАВАЯ КОЛОНКА (скрыта на мобилке) ===== */}
        <TranscriptSection
          recording={recording}
          currentTime={currentTime}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          transcriptMode={transcriptMode}
          onModeChange={setTranscriptMode}
          onCondense={handleCondense}
          isCondensing={isCondensing}
          speakerColorMap={speakerColorMap}
          shouldColorSpeakers={shouldColorSpeakers}
          onTimestampClick={handleTimestampClick}
        />
      </main>

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-container p-6 rounded-2xl border border-white/10 max-w-sm mx-4 w-full">
            <p className="font-headline font-bold text-lg mb-2">Удалить запись?</p>
            <p className="text-sm text-on-surface-variant mb-6">Это действие нельзя отменить.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-surface-container-high rounded-xl text-sm font-bold hover:bg-surface-container-highest transition-colors cursor-pointer">
                Отмена
              </button>
              <button onClick={onDelete} className="flex-1 py-2 bg-error/20 text-error rounded-xl text-sm font-bold hover:bg-error/30 transition-colors cursor-pointer">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Панель дополнения */}
      <AppendPanel
        recording={recording}
        isAppending={isAppending}
        onOpen={() => setIsAppending(true)}
        onClose={() => setIsAppending(false)}
        onUpdate={onUpdate}
        showToast={showToast}
      />
    </div>
  );
};
