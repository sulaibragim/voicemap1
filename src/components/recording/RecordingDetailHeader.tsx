import type * as React from 'react';
import { ArrowLeft, X, Plus, Share2, Download, Pencil, ChevronDown, Copy, FileText, Send, MoreHorizontal, Trash2 } from 'lucide-react';
import { plural } from '../../lib/plural';
import type { Recording } from '../../types';

interface RecordingDetailHeaderProps {
  recording: Recording;
  onBack: () => void;
  // Редактирование названия
  isEditingTitle: boolean;
  setIsEditingTitle: (v: boolean) => void;
  editTitleValue: string;
  setEditTitleValue: (v: string) => void;
  handleTitleSave: () => void;
  // Редактирование тегов
  isAddingTag: boolean;
  setIsAddingTag: (v: boolean) => void;
  newTagValue: string;
  setNewTagValue: (v: string) => void;
  handleAddTag: () => void;
  handleRemoveTag: (tag: string) => void;
  // Дропдаун экспорта
  showExportMenu: boolean;
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  handleShare: () => void;
  handleCopySummary: () => void;
  handleCopyTranscript: () => void;
  handleExportPDF: () => void;
  handleExport: () => void;
  handleTelegram: () => void;
  // Мобильное меню
  setShowMobileMenu: (v: boolean) => void;
  // Удаление
  setShowDeleteConfirm: (v: boolean) => void;
}

export const RecordingDetailHeader = ({
  recording,
  onBack,
  isEditingTitle,
  setIsEditingTitle,
  editTitleValue,
  setEditTitleValue,
  handleTitleSave,
  isAddingTag,
  setIsAddingTag,
  newTagValue,
  setNewTagValue,
  handleAddTag,
  handleRemoveTag,
  showExportMenu,
  setShowExportMenu,
  exportMenuRef,
  handleShare,
  handleCopySummary,
  handleCopyTranscript,
  handleExportPDF,
  handleExport,
  handleTelegram,
  setShowMobileMenu,
  setShowDeleteConfirm,
}: RecordingDetailHeaderProps) => {
  return (
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
                <h1 className="text-sm md:text-xl font-bold font-headline line-clamp-2 md:line-clamp-1 leading-snug">{recording.title}</h1>
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
            {(recording.actionItems?.length ?? 0) > 0 && <> · <span className="text-secondary">{recording.actionItems!.length} {plural(recording.actionItems!.length, ['задача', 'задачи', 'задач'])}</span></>}
            {(recording.ideas?.length ?? 0) > 0 && <> · {recording.ideas!.length} {plural(recording.ideas!.length, ['идея', 'идеи', 'идей'])}</>}
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
        {/* Кнопка "..." — только мобилка, открывает bottom sheet */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className="md:hidden w-9 h-9 flex items-center justify-center bg-surface-container rounded-lg text-on-surface-variant hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Действия"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {/* Десктоп: дропдаун экспорта */}
        <div className="relative hidden md:block" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container rounded-lg text-sm font-bold hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Экспорт</span>
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

        {/* Десктоп: кнопка удалить */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="hidden md:flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-bold hover:bg-error/20 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Удалить
        </button>
      </div>
    </header>
  );
};
