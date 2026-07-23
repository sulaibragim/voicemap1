/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Brain, Loader2 } from 'lucide-react';
import { retranscribeFromUrl, deleteAudioFromR2, processRecordingAsync } from './lib/api';
import { useToast } from './hooks/useToast';
import { useDailyTip } from './hooks/useDailyTip';

import type { Note, NoteType, Recording, Space } from './types';
import { useReminders } from './hooks/useReminders';
import { useAuth } from './hooks/useAuth';
import { useFirestoreData } from './hooks/useFirestoreData';
import { useUserProfile } from './hooks/useUserProfile';
import { LoginScreen } from './components/auth/LoginScreen';

// Eager — нужны на первом экране (Dashboard)
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { LiveSessionCard } from './components/dashboard/LiveSessionCard';
import { QuickNoteCard } from './components/dashboard/QuickNoteCard';
import { FocusTodayCard } from './components/dashboard/FocusTodayCard';
import { IdeasCard } from './components/dashboard/IdeasCard';
import { AITipCard } from './components/dashboard/AITipCard';
import { ActivityChartCard } from './components/dashboard/ActivityChartCard';
import { BrainStatsCard } from './components/dashboard/WeeklyGoalsCard';
import { WeeklyDigestCard } from './components/dashboard/WeeklyDigestCard';
import { RecentRecordings } from './components/dashboard/RecentRecordings';
import { ChatSidebar } from './components/ChatSidebar';

// Lazy — view-экраны и модалки. Грузятся только когда юзер на них переходит.
// Это разгружает основной бандл (1.65MB → ~700KB) и ускоряет первый рендер.
// Каждый именованный export оборачиваем в default через .then() — React.lazy ждёт default.
const NotesGallery = lazy(() =>
  import('./components/notes/NotesGallery').then(m => ({ default: m.NotesGallery }))
);
const QuickNoteModal = lazy(() =>
  import('./components/notes/QuickNoteModal').then(m => ({ default: m.QuickNoteModal }))
);
const RecordingsLibrary = lazy(() =>
  import('./components/recording/RecordingsLibrary').then(m => ({ default: m.RecordingsLibrary }))
);
const SpacesLibrary = lazy(() =>
  import('./components/recording/SpacesLibrary').then(m => ({ default: m.SpacesLibrary }))
);
const SpacePickerModal = lazy(() =>
  import('./components/recording/SpacePickerModal').then(m => ({ default: m.SpacePickerModal }))
);
const RecordingSession = lazy(() =>
  import('./components/recording/RecordingSession').then(m => ({ default: m.RecordingSession }))
);
const RecordingDetail = lazy(() =>
  import('./components/recording/RecordingDetail').then(m => ({ default: m.RecordingDetail }))
);
const AnalyticsView = lazy(() =>
  import('./components/analytics/AnalyticsView').then(m => ({ default: m.AnalyticsView }))
);
const FocusView = lazy(() =>
  import('./components/analytics/FocusView').then(m => ({ default: m.FocusView }))
);
const TagsView = lazy(() =>
  import('./components/analytics/TagsView').then(m => ({ default: m.TagsView }))
);
const SettingsView = lazy(() =>
  import('./components/analytics/SettingsView').then(m => ({ default: m.SettingsView }))
);
const RemindersView = lazy(() =>
  import('./components/reminders/RemindersView').then(m => ({ default: m.RemindersView }))
);

// Универсальный fallback для Suspense — спиннер на полный экран
const ViewLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

// Dev-only: моковый пользователь для демо-просмотра интерфейса без реального входа.
// Активируется только в dev-сборке (import.meta.env.DEV) по кнопке на экране входа.
const DEMO_USER = { uid: 'demo-local', displayName: 'Демо', email: 'demo@voicemap.local', photoURL: null };

function suggestSpaceId(recording: Recording, spaces: Space[]): string | undefined {
  for (const space of spaces) {
    const nl = space.name.toLowerCase();
    if (recording.tags.some(t => t.toLowerCase().includes(nl) || nl.includes(t.replace('#', '').toLowerCase()))) return space.id;
    if (recording.title.toLowerCase().includes(nl) || recording.summary.toLowerCase().includes(nl)) return space.id;
  }
  return undefined;
}

export default function App() {
  const { user: authUser, loading: authLoading, signInWithGoogle, logout } = useAuth();

  const {
    settings: appSettings, updateSettings,
    assistantProfile, updateAssistantProfile,
    addPersonFromRecording, getKnownNames,
    profileLoading,
  } = useUserProfile(authUser?.uid ?? null);

  const {
    recordings, notes, spaces, loading: dataLoading,
    addRecording, updateRecordingItem, patchRecordingItem, deleteRecordingItem, clearAllRecordings, setRecordingsLocal,
    addNote, updateNoteItem, deleteNoteItem, clearAllNotes, setNotesLocal,
    addSpace, updateSpaceItem, deleteSpaceItem,
  } = useFirestoreData(authUser?.uid ?? null);

  const [currentView, setCurrentView] = useState('dashboard');
  type NavEntry = { view: string; spaceMapActiveId?: string | null };
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [spaceMapActiveId, setSpaceMapActiveId] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [quickNoteType, setQuickNoteType] = useState<NoteType | null>(null);
  const [spacePickerRecordingId, setSpacePickerRecordingId] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);

  // Dev-only демо-просмотр без входа. effectiveUser проходит гейт логина, но uid в хуки
  // данных НЕ передаётся (остаётся null → локальный режим, без Firestore) — данные засеиваются ниже.
  const [demoMode, setDemoMode] = useState(false);
  const effectiveUser = authUser ?? (demoMode ? DEMO_USER : null);

  useEffect(() => {
    // import.meta.env.DEV статически = false в проде → Vite/terser вырезает тело эффекта целиком
    if (!import.meta.env.DEV || !demoMode || authUser) return;
    // Грузим демо-данные в локальный state (Firestore не трогаем)
    import('./data/demoSeed').then(({ initialRecordings, initialNotes }) => {
      setRecordingsLocal(initialRecordings);
      setNotesLocal(initialNotes);
    }).catch(e => console.error('[demoMode] failed to load demo seed:', e));
    // setRecordingsLocal/setNotesLocal стабильны (обёртки над setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, authUser]);

  // Если запись_detail открыта но запись не найдена — возвращаемся на дашборд
  // Проверяем только ПОСЛЕ завершения загрузки данных из Firestore
  useEffect(() => {
    if (currentView === 'recording_detail' && selectedRecordingId && !dataLoading) {
      const found = recordings.find(r => r.id === selectedRecordingId);
      if (!found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentView('dashboard');
      }
    }
  }, [currentView, selectedRecordingId, recordings, dataLoading]);

  // Фокус-задачи от ассистента
  const [dailyFocus, setDailyFocus] = useState<Array<{ id: string; task: string; done: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('voicemap_daily_focus') || '[]'); }
    catch { return []; }
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const { toast, showToast } = useToast();
  const { dailyTip, isGeneratingTip } = useDailyTip(recordings);

  useReminders({
    notes,
    onUpdateNote: (updated) => updateNoteItem(updated),
    showToast,
  });

  useEffect(() => {
    localStorage.setItem('voicemap_daily_focus', JSON.stringify(dailyFocus));
  }, [dailyFocus]);

  const handleLogout = async () => {
    setDemoMode(false);
    await logout();
  };

  // Открыть запись с сохранением откуда пришли (для кнопки «Назад»)
  const openRecording = (id: string) => {
    setNavStack(prev => [...prev, { view: currentView, spaceMapActiveId }]);
    setSelectedRecordingId(id);
    setCurrentView('recording_detail');
  };

  const goBack = () => {
    const entry = navStack[navStack.length - 1];
    if (entry) {
      setNavStack(prev => prev.slice(0, -1));
      setCurrentView(entry.view);
      if (entry.spaceMapActiveId !== undefined) setSpaceMapActiveId(entry.spaceMapActiveId);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleFinishRecording = async (blob: Blob, durationSeconds: number) => {
    setCurrentView('dashboard');
    setIsProcessing(true);

    const recordingId = Date.now().toString();
    const m = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(durationSeconds % 60).toString().padStart(2, '0');
    const duration = `${m}:${s}`;
    const date = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    // Создаём запись сразу со статусом "обрабатывается"
    const pendingRecording: Recording = {
      id: recordingId,
      title: 'Обрабатывается...',
      date,
      duration,
      tags: [],
      summary: '',
      transcript: [],
      keyMoments: [],
      actionItems: [],
      ideas: [],
      mentions: [],
      openQuestions: [],
      participants: [],
      richActionItems: [],
      bigQuestions: [],
      aiStatus: 'processing',
      audioUrl: undefined,
      r2Key: undefined,
    };

    // Сохраняем в Firestore сразу — пользователь видит запись немедленно.
    // ВАЖНО: ждём завершения write, иначе сервер может обновить документ
    // транскрипцией РАНЬШЕ, чем клиент успеет создать pending-запись →
    // обновление сервера улетит в несуществующий док, а клиент потом перепишет
    // pending-данными уже готовую транскрипцию.
    await addRecording(pendingRecording);
    addPersonFromRecording(pendingRecording);
    setNavStack(prev => [...prev, { view: 'dashboard', spaceMapActiveId: null }]);
    setSelectedRecordingId(recordingId);
    setSpacePickerRecordingId(recordingId);
    setIsProcessing(false);

    // Загружаем на сервер в фоне — сервер сам обновит Firestore после транскрипции.
    // Используем patchRecordingItem (НЕ updateRecordingItem с полным объектом),
    // чтобы НЕ затереть свежие поля title/summary/transcript, которые сервер
    // мог уже записать через фоновую транскрипцию.
    try {
      const { publicUrl, r2Key } = await processRecordingAsync(blob, recordingId, {
        title: 'Новая запись',
        date,
        duration,
        knownPeople: getKnownNames(),
      });
      await patchRecordingItem(recordingId, { audioUrl: publicUrl, r2Key });
      console.log('[handleFinishRecording] Upload done, background transcription queued');
    } catch (err) {
      console.warn('[handleFinishRecording] Upload failed:', err);
      showToast('Ошибка загрузки аудио. Попробуй снова.', 'error');
      await patchRecordingItem(recordingId, { aiStatus: 'error' });
    }
  };

  // ⚠️ Dev-only фича (кнопка видна только в dev-сборке, см. SettingsView):
  // пишет только в локальный state и localStorage, в Firestore НЕ сохраняет —
  // при активном Firestore-листенере следующий снапшот всё откатит.
  const handleResetDemo = async () => {
    localStorage.removeItem('voicemap_recordings');
    localStorage.removeItem('voicemap_notes');
    // Lazy import — demoSeed (~12KB) грузится только когда юзер реально жмёт «Сбросить демо»
    try {
      const { initialRecordings, initialNotes } = await import('./data/demoSeed');
      setRecordingsLocal(initialRecordings);
      setNotesLocal(initialNotes);
      showToast('Демо-данные сброшены', 'success');
    } catch (e) {
      console.error('[handleResetDemo] failed to load demo seed:', e);
      showToast('Не удалось загрузить демо-данные', 'error');
    }
  };

  // Полное удаление записи: revoke blob-URL'ов (основного аудио и дополнений),
  // удаление файла из R2 и самого документа. Единый хелпер для всех мест удаления.
  const removeRecording = (id: string) => {
    const target = recordings.find(r => r.id === id);
    if (target?.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(target.audioUrl);
    target?.appendAudios?.forEach(a => {
      if (a.url?.startsWith('blob:')) URL.revokeObjectURL(a.url);
    });
    if (target?.r2Key) {
      deleteAudioFromR2(target.r2Key).catch(err => console.warn('R2 delete failed:', err));
    }
    deleteRecordingItem(id);
    showToast('Запись удалена', 'success');
  };

  const renderView = () => {
    if (currentView === 'gallery') {
      return <NotesGallery notes={notes} onBack={() => setCurrentView('dashboard')} setCurrentView={setCurrentView} onDeleteNote={(id) => {
        deleteNoteItem(id);
        showToast('Заметка удалена', 'success');
      }} onUpdateNote={(updated) => {
        updateNoteItem(updated);
      }} showToast={showToast} />;
    }

    if (currentView === 'library') {
      const openDetail = (id: string) => openRecording(id);
      // Список записей + поиск — главный экран библиотеки на всех размерах.
      // Карта-космос убрана как обязательные «ворота»: пользователь ищет, а не листает глазами.
      return (
        <RecordingsLibrary
          recordings={recordings}
          onBack={() => setCurrentView('dashboard')}
          onOpenDetail={openDetail}
          onDeleteRecording={removeRecording}
          onUpdateRecording={(updated) => updateRecordingItem(updated)}
        />
      );
    }

    if (currentView === 'library_spaces') {
      return (
        <div className="flex h-screen w-full">
          <SpacesLibrary
            recordings={recordings}
            spaces={spaces}
            onBack={() => setCurrentView('library')}
            onOpenDetail={openRecording}
            activeSpaceId={spaceMapActiveId}
            onSetActiveSpaceId={setSpaceMapActiveId}
            onUpdateSpace={(updated) => updateSpaceItem(updated)}
            onDeleteRecording={removeRecording}
            onUpdateRecording={(updated) => updateRecordingItem(updated)}
            onCreateSpace={(data) => {
              const newSpace: Space = { ...data, id: 'space-' + Date.now(), createdAt: new Date().toISOString() };
              addSpace(newSpace);
            }}
            onDeleteSpace={(id) => deleteSpaceItem(id)}
            onMoveRecording={(recId, spaceId) => { const rec = recordings.find(r => r.id === recId); if (rec) updateRecordingItem({ ...rec, spaceId: spaceId ?? undefined }); }}
          />
        </div>
      );
    }

    if (currentView === 'recording_detail' && selectedRecordingId) {
      const rec = recordings.find(r => r.id === selectedRecordingId);
      if (rec) {
        // key={rec.id} — при переходе между связанными записями компонент полностью
        // пересоздаётся, и весь локальный UI-state (activeTab, transcriptMode,
        // isCondensing, mobileTab и т.д.) сбрасывается автоматически
        return <RecordingDetail key={rec.id} recording={rec} onBack={goBack} onDelete={() => {
          removeRecording(rec.id);
          goBack();
        }} onUpdate={(updatedRec) => {
          updateRecordingItem(updatedRec);
        }} showToast={showToast} allRecordings={recordings} onOpenRecording={(id) => openRecording(id)} onRetranscribe={async () => {
          // Повторная транскрипция: фетчим аудио с R2 через сервер и обрабатываем Gemini File API
          const recording = recordings.find(r => r.id === selectedRecordingId);
          if (!recording?.audioUrl) {
            showToast('Нет аудиофайла для транскрипции', 'error');
            return;
          }
          // Определяем mimeType по URL или ключу R2
          const url = recording.audioUrl;
          const mimeType = url.includes('.webm') ? 'audio/webm'
            : url.includes('.ogg') ? 'audio/ogg'
            : 'audio/mp4';
          try {
            const result = await retranscribeFromUrl(url, mimeType, getKnownNames());
            updateRecordingItem({ ...recording, ...result, title: result.title || recording.title });
            showToast('Транскрипция готова ✓', 'success');
          } catch (err) {
            console.error('[retranscribe] failed:', err);
            showToast('Ошибка повторной транскрипции', 'error');
          }
        }} />;
      }
      // Запись ещё грузится из Firestore — показываем спиннер
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      );
    }

    if (currentView === 'recording_session') {
      return <RecordingSession onFinish={handleFinishRecording} onCancel={() => setCurrentView('dashboard')} showToast={showToast} autoStopMinutes={appSettings.autoStopMinutes} />;
    }

    if (currentView === 'analytics') {
      return <AnalyticsView recordings={recordings} onBack={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'focus') {
      return <FocusView
        recordings={recordings}
        notes={notes}
        onBack={() => setCurrentView('dashboard')}
        onOpenRecording={openRecording}
        onUpdateNote={(updated) => updateNoteItem(updated)}
        onToggleDone={(recId, taskIdx) => {
          const rec = recordings.find(r => r.id === recId);
          if (rec) {
            const cur = rec.actionItemsDone || new Array(rec.actionItems?.length ?? 0).fill(false);
            const next = [...cur];
            while (next.length < (rec.actionItems?.length ?? 0)) next.push(false);
            next[taskIdx] = !next[taskIdx];
            updateRecordingItem({ ...rec, actionItemsDone: next });
          }
        }}
      />;
    }

    if (currentView === 'tags') {
      return <TagsView recordings={recordings} onBack={() => setCurrentView('dashboard')} onOpenRecording={openRecording} />;
    }

    if (currentView === 'reminders') {
      return <RemindersView
        recordings={recordings}
        notes={notes}
        onUpdateRecording={(updated) => updateRecordingItem(updated)}
        onUpdateNote={(updated) => updateNoteItem(updated)}
        onDeleteNote={(id) => deleteNoteItem(id)}
        onOpenRecording={(id) => { openRecording(id); }}
        onBack={() => setCurrentView('dashboard')}
      />;
    }

    if (currentView === 'settings') {
      return <SettingsView
        recordings={recordings}
        notes={notes}
        onBack={() => setCurrentView('dashboard')}
        onResetDemo={handleResetDemo}
        onClearRecordings={() => clearAllRecordings()}
        onClearNotes={() => clearAllNotes()}
        showToast={showToast}
        settings={appSettings}
        onSettingsChange={updateSettings}
      />;
    }

    // Dashboard
    return (
      <div className="min-h-screen bg-background text-on-surface pb-32 font-body selection:bg-primary/30 relative">
        <Header currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} onReset={handleResetDemo} user={effectiveUser ?? undefined} />
        <main className="max-w-[1440px] mx-auto px-4 pt-6 lg:px-8 lg:pt-12">
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <LiveSessionCard onStartRecording={() => setCurrentView('recording_session')} />
            <QuickNoteCard onQuickNote={(type) => setQuickNoteType(type)} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <FocusTodayCard
              recordings={recordings}
              notes={notes}
              assistantTasks={dailyFocus}
              onToggleAssistantTask={(id) => setDailyFocus(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
              onOpenRecording={openRecording}
              onToggleDone={(recId, taskIdx) => {
                const rec = recordings.find(r => r.id === recId);
                if (rec) {
                  const cur = rec.actionItemsDone || new Array(rec.actionItems?.length ?? 0).fill(false);
                  const next = [...cur];
                  while (next.length < (rec.actionItems?.length ?? 0)) next.push(false);
                  next[taskIdx] = !next[taskIdx];
                  updateRecordingItem({ ...rec, actionItemsDone: next });
                }
              }}
              onToggleNoteTask={(noteId) => {
                const note = notes.find(n => n.id === noteId);
                if (note) updateNoteItem({ ...note, isCompleted: true });
              }}
            />
            <IdeasCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 items-stretch">
            <AITipCard dailyTip={dailyTip} isGeneratingTip={isGeneratingTip} />
            <ActivityChartCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <BrainStatsCard recordings={recordings} notes={notes} onNavigate={setCurrentView} onUpdateNote={note => updateNoteItem(note)} onUpdateRecording={(updated) => updateRecordingItem(updated)} onOpenRecording={openRecording} />
            <WeeklyDigestCard recordings={recordings} setCurrentView={setCurrentView} />
          </div>
          <RecentRecordings recordings={recordings} onOpenLibrary={() => setCurrentView('library')} onOpenDetail={openRecording} />
        </main>
        <BottomNav currentView={currentView} setCurrentView={setCurrentView} />

        {quickNoteType && (
          <QuickNoteModal
            type={quickNoteType}
            onClose={() => setQuickNoteType(null)}
            onSave={(note) => {
              addNote(note);
              showToast('Заметка сохранена', 'success');
            }}
            showToast={showToast}
          />
        )}
      </div>
    );
  };

  // Пока Firebase проверяет сессию или грузит профиль — показываем сплеш
  if (authLoading || (authUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Не авторизован — показываем экран входа
  if (!effectiveUser) {
    return (
      <LoginScreen
        onGoogleSignIn={signInWithGoogle}
        onDemoMode={import.meta.env.DEV ? () => setDemoMode(true) : undefined}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="relative h-full transition-all duration-300 ease-in-out w-full">
        <div className="h-full w-full overflow-y-auto">
          {/* Suspense оборачивает весь renderView — каждый lazy view покажет ViewLoader пока подгружается chunk */}
          <Suspense fallback={<ViewLoader />}>
            {renderView()}
          </Suspense>
        </div>

        {/* Floating AI Assistant Button */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Открыть ассистента"
          className={`fixed bottom-24 md:bottom-32 right-4 md:right-8 w-14 h-14 bg-primary text-on-primary-fixed rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(175,162,255,0.4)] hover:scale-110 transition-transform z-[150] cursor-pointer ${isAssistantOpen ? 'hidden' : currentView === 'recording_detail' ? 'hidden md:flex' : ''}`}
        >
          <Brain className="w-6 h-6" />
        </button>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className={`fixed bottom-8 left-1/2 z-[500] max-w-[90vw] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm ${
                toast.type === 'error' ? 'bg-error text-white' :
                toast.type === 'success' ? 'bg-secondary text-on-secondary' :
                'bg-surface-container-highest text-white'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatSidebar
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        recordings={recordings}
        notes={notes}
        spaces={spaces}
        profile={assistantProfile}
        onOpenRecording={openRecording}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onSetFocusTasks={(tasks) => {
          const newTasks = tasks.map(task => ({ id: `${Date.now()}-${Math.random()}`, task, done: false }));
          setDailyFocus(prev => [...newTasks, ...prev]);
          showToast(`Добавлено ${tasks.length} фокус-задач`, 'success');
        }}
        onCreateNote={(data) => {
          const note: Note = {
            id: Date.now().toString(),
            type: data.type as NoteType,
            content: data.content,
            date: new Date().toLocaleDateString('ru-RU'),
            isCompleted: false,
            dueDate: data.dueDate,
            dueTime: data.dueTime,
          };
          addNote(note);
          showToast('Заметка создана', 'success');
        }}
        onUpdateRecording={(id, updates) => {
          const rec = recordings.find(r => r.id === id);
          if (rec) updateRecordingItem({ ...rec, ...updates });
          showToast('Запись обновлена', 'success');
        }}
        onLearnRule={(rule) => {
          updateAssistantProfile({
            customRules: [...assistantProfile.customRules.slice(-9), rule],
          });
        }}
      />

      {spacePickerRecordingId && (() => {
        const rec = recordings.find(r => r.id === spacePickerRecordingId);
        if (!rec) return null;
        return (
          // Suspense без fallback — модалка появится после загрузки chunk'а, без промежуточного UI
          <Suspense fallback={null}>
            <SpacePickerModal
              recording={rec}
              spaces={spaces}
              suggestedSpaceId={suggestSpaceId(rec, spaces)}
              onAssign={(spaceId) => {
                if (spaceId) { const rec = recordings.find(r => r.id === spacePickerRecordingId); if (rec) updateRecordingItem({ ...rec, spaceId }); }
                setSpacePickerRecordingId(null);
                setCurrentView('recording_detail');
              }}
              onCreateAndAssign={(data) => {
                const id = 'space-' + Date.now();
                addSpace({ ...data, id, createdAt: new Date().toISOString() });
                return id;
              }}
            />
          </Suspense>
        );
      })()}

      {isProcessing && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
          <h2 className="text-2xl font-headline font-bold mb-2">AI обрабатывает запись...</h2>
          <p className="text-on-surface-variant">Транскрибация, выделение задач и инсайтов</p>
        </div>
      )}
    </div>
  );
}
