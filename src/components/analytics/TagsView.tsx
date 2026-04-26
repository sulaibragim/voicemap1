import { useState } from 'react';
import { ArrowLeft, Folder, ChevronRight, Mic } from 'lucide-react';
import type { Recording } from '../../types';

interface TagsViewProps {
  recordings: Recording[];
  onBack: () => void;
  onOpenRecording?: (id: string) => void;
}

export const TagsView = ({ recordings, onBack, onOpenRecording }: TagsViewProps) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(recordings.flatMap(r => r.tags || [])));

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? null : tag);
  };

  const taggedRecordings = selectedTag
    ? recordings.filter(r => r.tags.includes(selectedTag))
    : [];

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Теги</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h2 className="font-headline text-4xl font-bold mb-2">Управление тегами</h2>
          <p className="text-on-surface-variant">Организуйте ваши записи по темам</p>
        </div>

        <div className="flex flex-wrap gap-4">
          {allTags.length > 0 ? allTags.map((tag, i) => {
            const isActive = selectedTag === tag;
            return (
              <button
                key={i}
                onClick={() => handleTagClick(tag)}
                className={`px-6 py-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-primary/20 border-primary/40'
                    : 'bg-surface-container border-white/5 hover:bg-surface-container-high'
                }`}
              >
                <span className={`font-bold ${isActive ? 'text-primary' : 'text-primary'}`}>#</span>
                <span className="font-headline text-lg">{tag.replace('#', '')}</span>
                <span className="ml-2 text-xs text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-full">
                  {recordings.filter(r => r.tags.includes(tag)).length}
                </span>
              </button>
            );
          }) : (
            <div className="text-center py-20 text-on-surface-variant flex flex-col items-center w-full">
              <Folder className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Нет тегов</h3>
              <p className="text-sm max-w-xs">Теги появляются автоматически, когда AI обрабатывает запись</p>
              <button
                onClick={onBack}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary-fixed rounded-xl text-sm font-bold hover:scale-105 transition-transform cursor-pointer mx-auto"
              >
                <Mic className="w-4 h-4" />
                Сделать запись
              </button>
            </div>
          )}
        </div>

        {selectedTag && (
          <div className="mt-8">
            <h3 className="font-headline text-2xl font-bold mb-6">
              Записи с <span className="text-primary">#{selectedTag.replace('#', '')}</span>
            </h3>
            {taggedRecordings.length > 0 ? (
              <div className="space-y-4">
                {taggedRecordings.map(rec => (
                  <div
                    key={rec.id}
                    className="bg-surface-container p-6 rounded-3xl border border-white/5 hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-headline text-lg font-bold mb-1 line-clamp-1">{rec.title}</h4>
                        <p className="text-xs text-on-surface-variant mb-2">{rec.date} · {rec.duration}</p>
                        {rec.summary && (
                          <p className="text-sm text-on-surface-variant line-clamp-2">{rec.summary}</p>
                        )}
                      </div>
                      {onOpenRecording && (
                        <button
                          onClick={() => onOpenRecording(rec.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors cursor-pointer flex-shrink-0"
                        >
                          Открыть
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-on-surface-variant">Записей с этим тегом нет.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
