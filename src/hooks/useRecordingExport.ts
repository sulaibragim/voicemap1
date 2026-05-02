import { useRef, useState, useEffect } from 'react';
import type { Recording } from '../types';

interface UseRecordingExportOptions {
  recording: Recording;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function useRecordingExport({ recording, showToast }: UseRecordingExportOptions) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
    const text = [
      `Название: ${recording.title}`,
      `Дата: ${recording.date}`,
      `Длительность: ${recording.duration}`,
      `Настроение: ${recording.mood || 'Неизвестно'}`,
      '',
      'Саммари:',
      recording.summary,
      '',
      'Идеи:',
      ...(recording.ideas || []).map(i => `- ${i}`),
      '',
      'Задачи:',
      ...(recording.actionItems || []).map(t => `- ${t}`),
      '',
      'Транскрипт:',
      ...recording.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`),
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  return {
    showExportMenu,
    setShowExportMenu,
    exportMenuRef,
    handleShare,
    handleExport,
    handleCopySummary,
    handleCopyTranscript,
    handleExportPDF,
    handleTelegram,
  };
}
