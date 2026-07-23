/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Brain, Loader2 } from 'lucide-react';
import { retranscribeFromUrl, deleteAudioFromR2, deleteRecordingChunks, QuotaExceededError, setApiLanguage } from './lib/api';
import { quotaToastMessage } from './lib/usageFormat';
import { LangProvider, readStoredLang, storeLang } from './i18n';
import { guessAudioMimeFromUrl } from './lib/audioMime';
import { parseDurationToSeconds } from './lib/recordingUtils';
import { useToast } from './hooks/useToast';
import { useRecordingPipeline } from './hooks/useRecordingPipeline';
import { useAppNavigation } from './hooks/useAppNavigation';

import type { NoteType, Recording } from './types';
import { useReminders } from './hooks/useReminders';
import { useAuth } from './hooks/useAuth';
import { useFirestoreData } from './hooks/useFirestoreData';
import { useUserProfile } from './hooks/useUserProfile';
import { LoginScreen } from './components/auth/LoginScreen';

// Eager — нужны на первом экране (Dashboard)
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { SearchHero } from './components/search/SearchHero';
import { LiveSessionCard } from './components/dashboard/LiveSessionCard';
import { ImportAudioButton } from './components/recording/ImportAudioButton';
import { QuickNoteCard } from './components/dashboard/QuickNoteCard';
import { FocusTodayCard } from './components/dashboard/FocusTodayCard';
import { IdeasCard } from './components/dashboard/IdeasCard';
import { WeeklyDigestCard } from './components/dashboard/WeeklyDigestCard';
import { RecentRecordings } from './components/dashboard/RecentRecordings';
import { FollowUpCard } from './components/dashboard/FollowUpCard';
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
const RecordingSession = lazy(() =>
  import('./components/recording/RecordingSession').then(m => ({ default: m.RecordingSession }))
);
const RecordingDetail = lazy(() =>
  import('./components/recording/RecordingDetail').then(m => ({ default: m.RecordingDetail }))
);
const FocusView = lazy(() =>
  import('./components/analytics/FocusView').then(m => ({ default: m.FocusView }))
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

export default function App() {
  const { user: authUser, loading: authLoading, signInWithGoogle, logout } = useAuth();

  const {
    settings: appSettings, updateSettings,
    addPersonFromRecording, getKnownNames,
    profileLoading,
  } = useUserProfile(authUser?.uid ?? null);

  const {
    recordings, notes, loading: dataLoading,
    addRecording, updateRecordingItem, patchRecordingItem, deleteRecordingItem, clearAllRecordings, setRecordingsLocal,
    addNote, updateNoteItem, deleteNoteItem, clearAllNotes, setNotesLocal,
  } = useFirestoreData(authUser?.uid ?? null);

  const {
    currentView, setCurrentView,
    selectedRecordingId, setSelectedRecordingId,
    pendingSeek, libraryTag,
    openRecording, openLibraryWithTag, goBack,
  } = useAppNavigation({ recordings, dataLoading });

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [quickNoteType, setQuickNoteType] = useState<NoteType | null>(null);

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

  // Фокус-задачи от ассистента
  const [dailyFocus, setDailyFocus] = useState<Array<{ id: string; task: string; done: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('voicemap_daily_focus') || '[]'); }
    catch { return []; }
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const { toast, showToast } = useToast();

  useReminders({
    notes,
    onUpdateNote: (updated) => updateNoteItem(updated),
    showToast,
  });

  useEffect(() => {
    localStorage.setItem('voicemap_daily_focus', JSON.stringify(dailyFocus));
  }, [dailyFocus]);

  // Язык вывода AI держим в модуле api — иначе его пришлось бы протаскивать
  // параметром через каждый вызов. Плюс дублируем в localStorage: экран входа
  // рендерится до загрузки настроек из Firestore и иначе всегда был бы русским.
  useEffect(() => {
    setApiLanguage(appSettings.language);
    // В localStorage пишем ТОЛЬКО когда настройки реально загружены. Иначе на экране
    // входа дефолт ('ru') затирает сохранённый выбор — и язык откатывается при каждом
    // запуске до входа.
    if (effectiveUser && !profileLoading) storeLang(appSettings.language);
  }, [appSettings.language, effectiveUser, profileLoading]);

  // До входа настроек ещё нет — берём последний известный язык из localStorage
  const uiLang = effectiveUser ? appSettings.language : readStoredLang();

  const handleLogout = async () => {
    setDemoMode(false);
    await logout();
  };

  const { handleFinishRecording, handleImportAudio } = useRecordingPipeline({
    addRecording,
    patchRecordingItem,
    addPersonFromRecording,
    getKnownNames,
    recordings,
    language: appSettings.language,
    showToast,
    onStart: () => { setCurrentView('dashboard'); setIsProcessing(true); },
    onPending: setSelectedRecordingId,
    onSettled: () => setIsProcessing(false),
  });

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

  // Переключение галочки задачи в записи. Один хелпер на все места (карточка Фокуса,
  // «Обещал и не сделал», экран Фокуса) — раньше эта логика была скопирована трижды.
  const toggleRecordingTask = (recordingId: string, taskIndex: number) => {
    const target = recordings.find(r => r.id === recordingId);
    if (!target) return;
    const total = target.actionItems?.length ?? 0;
    const next = [...(target.actionItemsDone || [])];
    while (next.length < total) next.push(false);
    next[taskIndex] = !next[taskIndex];
    updateRecordingItem({ ...target, actionItemsDone: next });
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
    // Чистим поисковый индекс — иначе голосовой поиск продолжит находить удалённую запись
    deleteRecordingChunks(id);
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
          key={libraryTag ?? 'all'}
          recordings={recordings}
          initialTag={libraryTag ?? undefined}
          onBack={() => setCurrentView('dashboard')}
          onOpenDetail={openDetail}
          onDeleteRecording={removeRecording}
          onUpdateRecording={(updated) => updateRecordingItem(updated)}
        />
      );
    }

    if (currentView === 'recording_detail' && selectedRecordingId) {
      const rec = recordings.find(r => r.id === selectedRecordingId);
      if (rec) {
        // key={rec.id} — при переходе между связанными записями компонент полностью
        // пересоздаётся, и весь локальный UI-state (activeTab, transcriptMode,
        // isCondensing, mobileTab и т.д.) сбрасывается автоматически
        return <RecordingDetail key={rec.id} recording={rec} initialSeek={pendingSeek ?? undefined} onBack={goBack} onDelete={() => {
          removeRecording(rec.id);
          goBack();
        }} onUpdate={(updatedRec) => {
          updateRecordingItem(updatedRec);
        }} showToast={showToast} allRecordings={recordings} onOpenRecording={(id) => openRecording(id)} onOpenTag={openLibraryWithTag} onRetranscribe={async () => {
          // Повторная транскрипция: фетчим аудио с R2 через сервер и обрабатываем Gemini File API
          const recording = recordings.find(r => r.id === selectedRecordingId);
          if (!recording?.audioUrl) {
            showToast('Нет аудиофайла для транскрипции', 'error');
            return;
          }
          // Определяем mimeType по расширению в URL/ключе R2 (включая импортированные mp3/wav/flac)
          const url = recording.audioUrl;
          const mimeType = guessAudioMimeFromUrl(url);
          try {
            // Длительность нужна серверу для предпроверки месячного лимита расшифровки
            const durationSeconds = parseDurationToSeconds(recording.duration);
            const result = await retranscribeFromUrl(url, mimeType, getKnownNames(), durationSeconds);
            updateRecordingItem({
              ...recording,
              ...result,
              title: result.title || recording.title,
              aiStatus: 'done',
            });
            showToast('Транскрипция готова ✓', 'success');
          } catch (err) {
            if (err instanceof QuotaExceededError) {
              showToast(quotaToastMessage(err.usage, appSettings.language), 'error');
              return;
            }
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
      return <RecordingSession
        onFinish={handleFinishRecording}
        onCancel={() => setCurrentView('dashboard')}
        showToast={showToast}
        autoStopMinutes={appSettings.autoStopMinutes}
        consentAcknowledgedAt={appSettings.consentAcknowledgedAt}
        onAcknowledgeConsent={() => updateSettings({ consentAcknowledgedAt: new Date().toISOString() })}
      />;
    }

    if (currentView === 'focus') {
      return <FocusView
        recordings={recordings}
        notes={notes}
        onBack={() => setCurrentView('dashboard')}
        onOpenRecording={openRecording}
        onUpdateNote={(updated) => updateNoteItem(updated)}
        onToggleDone={toggleRecordingTask}
      />;
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
          {/* Голосовой поиск — главный герой-блок дашборда (шире), запись — рядом (уже) */}
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <SearchHero onOpenSource={(id, timestamp) => openRecording(id, timestamp)} />
            <LiveSessionCard
              onStartRecording={() => setCurrentView('recording_session')}
              importSlot={<ImportAudioButton onImport={handleImportAudio} showToast={showToast} />}
            />
          </div>
          <RecentRecordings recordings={recordings} onOpenLibrary={() => setCurrentView('library')} onOpenDetail={openRecording} />
          {/* Долги по обещаниям. Карточка сама не рендерится, когда всё чисто */}
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 empty:mb-0">
            <FollowUpCard
              recordings={recordings}
              onOpenRecording={openRecording}
              onToggleDone={toggleRecordingTask}
            />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <FocusTodayCard
              recordings={recordings}
              notes={notes}
              assistantTasks={dailyFocus}
              onToggleAssistantTask={(id) => setDailyFocus(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
              onOpenRecording={openRecording}
              onToggleDone={toggleRecordingTask}
              onToggleNoteTask={(noteId) => {
                const note = notes.find(n => n.id === noteId);
                if (note) updateNoteItem({ ...note, isCompleted: true });
              }}
            />
            <IdeasCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
          </div>
          {/* Быстрая заметка + недельный дайджест в одном ряду: QuickNoteCard (lg:4) + WeeklyDigestCard (lg:8) = 12 колонок */}
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 items-stretch">
            <QuickNoteCard onQuickNote={(type) => setQuickNoteType(type)} />
            <WeeklyDigestCard recordings={recordings} setCurrentView={setCurrentView} />
          </div>
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
      <LangProvider lang={uiLang}>
        <LoginScreen
          onGoogleSignIn={signInWithGoogle}
          onDemoMode={import.meta.env.DEV ? () => setDemoMode(true) : undefined}
        />
      </LangProvider>
    );
  }

  return (
    <LangProvider lang={uiLang}>
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
          className={`fixed bottom-24 md:bottom-32 right-4 md:right-8 w-14 h-14 bg-primary text-on-primary-fixed rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(175,162,255,0.4)] hover:scale-110 transition-transform z-[150] cursor-pointer ${
            // На дашборде поиск уже есть крупным блоком (SearchHero) — плавающая кнопка там лишняя
            // и перекрывала контент. На остальных экранах она остаётся быстрым входом в поиск.
            isAssistantOpen || currentView === 'dashboard' ? 'hidden' : currentView === 'recording_detail' ? 'hidden md:flex' : ''
          }`}
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

      {/* Голосовой поиск по записям: ответ + источники с переходом на нужную секунду */}
      <ChatSidebar
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onOpenRecording={openRecording}
      />

      {isProcessing && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
          <h2 className="text-2xl font-headline font-bold mb-2">AI обрабатывает запись...</h2>
          <p className="text-on-surface-variant">Транскрибация, выделение задач и инсайтов</p>
        </div>
      )}
    </div>
    </LangProvider>
  );
}
