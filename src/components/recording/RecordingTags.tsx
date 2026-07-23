import { useState } from 'react';
import { X, Plus, Hash, AtSign } from 'lucide-react';
import { groupTags, normalizeTag } from '../../lib/tagUtils';
import type { Participant } from '../../types';

interface RecordingTagsProps {
  tags: string[];
  mentions?: string[];
  participants?: Participant[];
  /** Сколько тегов видно до раскрытия. 0 — показывать все сразу */
  collapsedCount?: number;
  /** Клик по тегу — фильтр библиотеки. Без колбэка теги некликабельны */
  onOpenTag?: (tag: string) => void;
  /** Без колбэков кнопка «+ тег» и крестики не рендерятся (режим только для чтения) */
  onAddTag?: (value: string) => void;
  onRemoveTag?: (tag: string) => void;
  className?: string;
}

const CHIP_BASE = 'group/tag relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold leading-5 transition-colors';

export const RecordingTags = ({
  tags,
  mentions,
  participants,
  collapsedCount = 5,
  onOpenTag,
  onAddTag,
  onRemoveTag,
  className = '',
}: RecordingTagsProps) => {
  const [expanded, setExpanded] = useState(collapsedCount === 0);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const { topics, entities } = groupTags(tags, mentions, participants);
  // Темы идут первыми: они отвечают на «о чём запись», упоминания — уточнение
  const ordered = [...topics, ...entities];
  const visible = expanded ? ordered : ordered.slice(0, collapsedCount);
  const hiddenCount = ordered.length - visible.length;
  const entitySet = new Set(entities);
  const firstEntityIndex = visible.findIndex(t => entitySet.has(t));

  const submitDraft = () => {
    const value = draft.trim();
    setIsAdding(false);
    setDraft('');
    if (value) onAddTag?.(value);
  };

  return (
    <div className={`flex items-center gap-1.5 ${expanded ? 'flex-wrap' : 'min-w-0'} ${className}`}>
      <Hash className="w-3.5 h-3.5 text-on-surface-variant/50 flex-shrink-0" />

      {visible.map((tag, i) => {
        const isEntity = entitySet.has(tag);
        // Разделитель на границе тем и упоминаний — только если видны обе группы
        const showDivider = i === firstEntityIndex && i > 0;
        return (
          <span key={tag} className={`flex items-center gap-1.5 ${expanded ? '' : 'flex-shrink-0'}`}>
            {showDivider && <span className="w-px h-3.5 bg-white/10" />}
            <span
              onClick={onOpenTag ? () => onOpenTag(tag) : undefined}
              className={`${CHIP_BASE} ${isEntity ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'} ${onOpenTag ? 'cursor-pointer hover:bg-white/10' : ''}`}
              title={onOpenTag ? 'Показать записи с этим тегом' : undefined}
            >
              {isEntity && <AtSign className="w-3 h-3 flex-shrink-0" />}
              {normalizeTag(tag)}
              {onRemoveTag && (
                <button
                  onClick={e => { e.stopPropagation(); onRemoveTag(tag); }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-error hidden group-hover/tag:flex cursor-pointer"
                  title="Удалить тег"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          </span>
        );
      })}

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="flex-shrink-0 px-2 py-0.5 rounded-md border border-white/10 text-[11px] leading-5 text-on-surface-variant hover:text-on-surface hover:border-white/20 transition-colors cursor-pointer"
        >
          ещё {hiddenCount}
        </button>
      )}

      {expanded && collapsedCount > 0 && ordered.length > collapsedCount && (
        <button
          onClick={() => setExpanded(false)}
          className="px-2 py-0.5 rounded-md text-[11px] leading-5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          свернуть
        </button>
      )}

      {onAddTag && (isAdding ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={submitDraft}
          onKeyDown={e => { if (e.key === 'Enter') submitDraft(); if (e.key === 'Escape') { setIsAdding(false); setDraft(''); } }}
          placeholder="новый тег"
          className="flex-shrink-0 bg-transparent border-b border-primary outline-none text-[11px] leading-5 text-primary w-20 placeholder-primary/40"
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-on-surface-variant hover:bg-white/10 hover:text-primary transition-colors cursor-pointer"
          title="Добавить тег"
        >
          <Plus className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
};
