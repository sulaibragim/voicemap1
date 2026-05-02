import { Plus, Share2, Copy, FileText, Download, Send, Trash2 } from 'lucide-react';

interface MobileActionSheetProps {
  onClose: () => void;
  onAppend: () => void;
  onShare: () => void;
  onCopySummary: () => void;
  onCopyTranscript: () => void;
  onExportPDF: () => void;
  onExportTXT: () => void;
  onTelegram: () => void;
  onDelete: () => void;
}

export const MobileActionSheet = ({
  onClose,
  onAppend,
  onShare,
  onCopySummary,
  onCopyTranscript,
  onExportPDF,
  onExportTXT,
  onTelegram,
  onDelete,
}: MobileActionSheetProps) => {
  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface-container-high rounded-t-3xl border-t border-white/10 pb-safe">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-4 pb-6 space-y-1">
          <button
            onClick={onAppend}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-primary/10 text-primary rounded-2xl font-bold text-sm cursor-pointer"
          >
            <Plus className="w-5 h-5" /> Дополнить запись
          </button>
          <div className="h-2" />
          <button
            onClick={onShare}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <Share2 className="w-5 h-5 text-on-surface-variant" /> Поделиться
          </button>
          <button
            onClick={onCopySummary}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <Copy className="w-5 h-5 text-on-surface-variant" /> Скопировать саммари
          </button>
          <button
            onClick={onCopyTranscript}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <Copy className="w-5 h-5 text-on-surface-variant" /> Скопировать транскрипт
          </button>
          <button
            onClick={onExportPDF}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <FileText className="w-5 h-5 text-on-surface-variant" /> Скачать PDF
          </button>
          <button
            onClick={onExportTXT}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <Download className="w-5 h-5 text-on-surface-variant" /> Скачать TXT
          </button>
          <button
            onClick={onTelegram}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-2xl text-sm cursor-pointer transition-colors"
          >
            <Send className="w-5 h-5 text-[#2AABEE]" /> Отправить в Telegram
          </button>
          <div className="h-2" />
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-error/10 text-error rounded-2xl text-sm font-bold cursor-pointer transition-colors"
          >
            <Trash2 className="w-5 h-5" /> Удалить запись
          </button>
        </div>
      </div>
    </div>
  );
};
