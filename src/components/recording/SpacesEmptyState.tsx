import { FolderOpen, Plus } from 'lucide-react';

interface SpacesEmptyStateProps {
  hasSpaces: boolean;
  isSpace: boolean;
  spaceName?: string;
  onCreateSpace: () => void;
}

export const SpacesEmptyState = ({ hasSpaces, isSpace, spaceName, onCreateSpace }: SpacesEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
    <div className="w-24 h-24 rounded-3xl bg-surface-container flex items-center justify-center">
      <FolderOpen className="w-10 h-10 text-on-surface-variant opacity-40" />
    </div>
    {!hasSpaces ? (
      <>
        <div>
          <p className="font-headline text-2xl font-bold mb-2">Создай первое пространство</p>
          <p className="text-sm text-on-surface-variant max-w-xs">Пространства помогают организовать записи по проектам, темам или контексту</p>
        </div>
        <button onClick={onCreateSpace} className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Создать пространство
        </button>
      </>
    ) : isSpace ? (
      <div>
        <p className="font-headline text-xl font-bold mb-2">В «{spaceName}» пока пусто</p>
        <p className="text-sm text-on-surface-variant">Записи появятся здесь после следующей сессии или перемести уже существующие</p>
      </div>
    ) : (
      <div>
        <p className="font-headline text-xl font-bold mb-2">Ничего не найдено</p>
        <p className="text-sm text-on-surface-variant">Попробуй другой запрос</p>
      </div>
    )}
  </div>
);
