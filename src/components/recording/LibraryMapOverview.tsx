import { motion } from 'motion/react';
import { Mic, FileText } from 'lucide-react';
import type { Recording, Note } from '../../types';
import { CY, NOTE_COLORS, NOTE_TYPES } from '../../lib/mapUtils';
import { plural } from '../../lib/plural';
import { MapCluster } from './MapCluster';

interface TagPosition {
  tag: string;
  x: number;
  y: number;
}

interface NoteTypePosition {
  type: (typeof NOTE_TYPES)[number];
  x: number;
  y: number;
}

interface StarItem {
  left: string;
  top: string;
  opacity: number;
  size: string;
  twinkle: boolean;
}

interface LibraryMapOverviewProps {
  recordings: Recording[];
  notes: Note[];
  tagPositions: TagPosition[];
  tagClusters: Map<string, Recording[]>;
  noteTypePositions: NoteTypePosition[];
  stars: StarItem[];
  totalTasks: number;
  incompleteTasks: number;
  scale: number;
  onOpenRecClusters: () => void;
  onOpenNotesTypes: () => void;
  onOpenNotes: () => void;
}

export const LibraryMapOverview = ({
  recordings,
  notes,
  totalTasks,
  incompleteTasks,
  onOpenRecClusters,
  onOpenNotesTypes,
}: LibraryMapOverviewProps) => {
  return (
    <motion.div
      key="overview"
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line
          x1={430}
          y1={CY}
          x2={1170}
          y2={CY}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1.5"
          strokeDasharray="8 12"
        />
      </svg>

      <MapCluster
        label="Голосовые записи"
        count={recordings.length}
        x={430}
        y={CY}
        radius={172}
        color="#7B61FF"
        glowColor="#7B61FF"
        icon={<Mic className="w-9 h-9" style={{ color: '#7B61FF' }} />}
        onClick={onOpenRecClusters}
        delay={0}
      />

      {/* Stats under recordings cluster */}
      <div
        className="absolute text-center pointer-events-none"
        style={{ left: 430 - 120, top: CY + 172 + 20, width: 240 }}
      >
        <p className="text-[11px] text-on-surface-variant/60">
          {recordings.length} {plural(recordings.length, ['запись', 'записи', 'записей'])} · {totalTasks} {plural(totalTasks, ['задача', 'задачи', 'задач'])}
        </p>
      </div>

      <MapCluster
        label="Быстрые заметки"
        count={notes.length}
        x={1170}
        y={CY}
        radius={172}
        color="#4FC3F7"
        glowColor="#4FC3F7"
        icon={<FileText className="w-9 h-9" style={{ color: '#4FC3F7' }} />}
        onClick={onOpenNotesTypes}
        delay={0.1}
        unit="заметка"
      />

      {/* Stats under notes cluster */}
      <div
        className="absolute text-center pointer-events-none"
        style={{ left: 1170 - 120, top: CY + 172 + 20, width: 240 }}
      >
        <p className="text-[11px] text-on-surface-variant/60">
          {notes.length} {plural(notes.length, ['заметка', 'заметки', 'заметок'])} · {incompleteTasks} {plural(incompleteTasks, ['активная', 'активные', 'активных'])}
        </p>
      </div>
    </motion.div>
  );
};

// Re-export NOTE_COLORS for convenience if needed by consumers
export { NOTE_COLORS };
