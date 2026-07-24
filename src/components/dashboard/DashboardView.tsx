import { Header } from '../layout/Header';
import { BottomNav } from '../layout/BottomNav';
import { SearchHero } from '../search/SearchHero';
import { LiveSessionCard } from './LiveSessionCard';
import { ImportAudioButton } from '../recording/ImportAudioButton';
import { QuickNoteCard } from './QuickNoteCard';
import { FocusTodayCard } from './FocusTodayCard';
import { IdeasCard } from './IdeasCard';
import { WeeklyDigestCard } from './WeeklyDigestCard';
import { RecentRecordings } from './RecentRecordings';
import { FollowUpCard } from './FollowUpCard';
import type { Note, NoteType, Recording } from '../../types';

/** Задача, предложенная ассистентом — живёт в localStorage, не в Firestore */
interface AssistantTask {
  id: string;
  task: string;
  done: boolean;
}

interface DashboardViewProps {
  recordings: Recording[];
  notes: Note[];
  user?: { displayName: string; photoURL: string | null; email: string };
  setCurrentView: (view: string) => void;
  openRecording: (id: string, seekTo?: string) => void;
  onToggleRecordingTask: (recordingId: string, taskIndex: number) => void;
  onUpdateNote: (note: Note) => void;
  onImportAudio: (file: File, durationSeconds: number) => void;
  onQuickNote: (type: NoteType) => void;
  onLogout: () => void;
  onResetDemo: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  dailyFocus: AssistantTask[];
  onToggleAssistantTask: (id: string) => void;
}

/**
 * Главный экран. Порядок блоков отражает петлю продукта: сначала поиск и запись
 * (то, ради чего приложение открывают), потом долги и задачи, потом обзорное.
 */
export const DashboardView = ({
  recordings, notes, user, setCurrentView, openRecording, onToggleRecordingTask,
  onUpdateNote, onImportAudio, onQuickNote, onLogout, onResetDemo, showToast,
  dailyFocus, onToggleAssistantTask,
}: DashboardViewProps) => (
  <div className="min-h-screen bg-background text-on-surface pb-32 font-body selection:bg-primary/30 relative">
    <Header
      currentView="dashboard"
      setCurrentView={setCurrentView}
      onLogout={onLogout}
      onReset={onResetDemo}
      user={user}
    />

    <main className="max-w-[1440px] mx-auto px-4 pt-6 lg:px-8 lg:pt-12">
      {/* Голосовой поиск — главный герой-блок (шире), запись рядом (уже) */}
      <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
        <SearchHero onOpenSource={(id, timestamp) => openRecording(id, timestamp)} />
        <LiveSessionCard
          onStartRecording={() => setCurrentView('recording_session')}
          importSlot={<ImportAudioButton onImport={onImportAudio} showToast={showToast} />}
        />
      </div>

      <RecentRecordings
        recordings={recordings}
        onOpenLibrary={() => setCurrentView('library')}
        onOpenDetail={openRecording}
      />

      {/* Долги по обещаниям. Карточка сама не рендерится, когда всё чисто */}
      <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 empty:mb-0">
        <FollowUpCard
          recordings={recordings}
          onOpenRecording={openRecording}
          onToggleDone={onToggleRecordingTask}
        />
      </div>

      <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
        <FocusTodayCard
          recordings={recordings}
          notes={notes}
          assistantTasks={dailyFocus}
          onToggleAssistantTask={onToggleAssistantTask}
          onOpenRecording={openRecording}
          onToggleDone={onToggleRecordingTask}
          onToggleNoteTask={(noteId) => {
            const note = notes.find(n => n.id === noteId);
            if (note) onUpdateNote({ ...note, isCompleted: true });
          }}
        />
        <IdeasCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
      </div>

      {/* Быстрая заметка (lg:4) + недельный дайджест (lg:8) = 12 колонок */}
      <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 items-stretch">
        <QuickNoteCard onQuickNote={onQuickNote} />
        <WeeklyDigestCard recordings={recordings} setCurrentView={setCurrentView} />
      </div>
    </main>

    <BottomNav currentView="dashboard" setCurrentView={setCurrentView} />
  </div>
);
