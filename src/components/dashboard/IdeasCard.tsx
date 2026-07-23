import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { Brain, ChevronRight, StickyNote } from 'lucide-react';
import type { Recording, Note } from '../../types';

interface IdeaItem {
  idea: string;
  recordingId?: string;
  recordingTitle: string;
  isNote: boolean;
}

interface IdeasCardProps {
  recordings: Recording[];
  notes?: Note[];
  onOpenRecording: (id: string) => void;
}

export const IdeasCard = ({ recordings, notes = [], onOpenRecording }: IdeasCardProps) => {
  const t = useT();
  const recIdeas: IdeaItem[] = recordings
    .flatMap(r => (r.ideas || []).map(idea => ({
      idea,
      recordingId: r.id,
      recordingTitle: r.title,
      isNote: false,
    })));

  const noteIdeas: IdeaItem[] = notes
    .filter(n => n.type === 'Идея')
    .map(n => ({
      idea: n.content,
      recordingId: undefined,
      recordingTitle: t('note.quickNote'),
      isNote: true,
    }));

  const allIdeas = [...noteIdeas, ...recIdeas].slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="col-span-12 md:col-span-8 lg:col-span-8 bg-surface-container p-4 lg:p-10 rounded-3xl overflow-hidden relative md:h-[380px] flex flex-col"
    >
      <div className="flex justify-between items-start mb-4 lg:mb-10 flex-shrink-0">
        <h3 className="font-headline text-2xl lg:text-4xl font-bold">{t('card.ideasTitle')}</h3>
        <span className="px-4 py-1 rounded-full bg-tertiary/10 text-tertiary font-bold text-[10px] tracking-widest uppercase">{t('card.ideasCount', { count: allIdeas.length })}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 flex-1 overflow-y-auto pr-1">
        {allIdeas.length > 0 ? allIdeas.map(({ idea, recordingId, recordingTitle, isNote }, i) => (
          <button
            key={i}
            onClick={() => recordingId ? onOpenRecording(recordingId) : undefined}
            className={`bg-surface-container-highest p-3 lg:p-6 rounded-2xl flex items-start gap-4 hover:translate-y-[-4px] hover:bg-surface-container-high transition-all text-left group ${recordingId ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {isNote
              ? <StickyNote className="text-tertiary w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0 mt-0.5" />
              : <Brain className="text-secondary w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0 mt-0.5" />
            }
            <div className="min-w-0 flex-1">
              <p className="font-body text-xs lg:text-sm font-bold leading-snug mb-2">{idea}</p>
              <p className={`flex items-center gap-1 text-[10px] transition-colors truncate ${isNote ? 'text-tertiary/70' : 'text-on-surface-variant/50 group-hover:text-primary'}`}>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                {recordingTitle}
              </p>
            </div>
          </button>
        )) : (
          <div className="col-span-2 text-on-surface-variant text-sm">{t('card.ideasEmpty')}</div>
        )}
      </div>
    </motion.div>
  );
};
