import { useState } from 'react';
import { ArrowLeft, Download, Trash2, RefreshCw, Database, FileText, Mic, User, MessageSquare, Sparkles, Info, Search, Loader2, ShieldAlert, Languages } from 'lucide-react';
import { ConsentNotice } from '../recording/ConsentNotice';
import { plural } from '../../lib/plural';
import { backfillSearchIndex } from '../../lib/api';
import type { Recording, Note, AppSettings } from '../../types';
import { Section, Divider, RowToggle, RowChips, RowAction } from './SettingsRows';
import { UsageCard } from './UsageCard';

const FEEDBACK_EMAIL = 'mailto:sulaibragim@gmail.com?subject=VoiceMap';
const APP_VERSION = '0.1.0-alpha';

interface SettingsViewProps {
  recordings: Recording[];
  notes: Note[];
  onBack: () => void;
  onResetDemo: () => void;
  onClearRecordings: () => void;
  onClearNotes: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  settings: AppSettings;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
}

export const SettingsView = ({
  recordings, notes, onBack, onResetDemo, onClearRecordings, onClearNotes, showToast, settings, onSettingsChange,
}: SettingsViewProps) => {
  const [confirmClear, setConfirmClear] = useState<'recordings' | 'notes' | 'all' | null>(null);
  const [nameInput, setNameInput] = useState(settings.userName);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(0);
  const [showConsent, setShowConsent] = useState(false);

  const totalMinutes = recordings.reduce((acc, r) => {
    if (!r.duration) return acc;
    const [m, s] = r.duration.split(':').map(Number);
    return acc + (m || 0) + (s || 0) / 60;
  }, 0);
  const totalTasks = recordings.reduce((acc, r) => acc + (r.actionItems?.length || 0), 0);
  const totalIdeas = recordings.reduce((acc, r) => acc + (r.ideas?.length || 0), 0);
  const completedNotes = notes.filter(n => n.isCompleted).length;

  const exportData = () => {
    const data = { recordings, notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicemap-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Данные экспортированы', 'success');
  };

  // Бэкфилл поискового индекса: старые записи (созданные до появления RAG-поиска)
  // индексируются пачками — крутим цикл, пока сервер не скажет, что больше нечего индексировать.
  const handleBackfill = async () => {
    if (isBackfilling) return;
    setIsBackfilling(true);
    setBackfillProgress(0);
    let totalProcessed = 0;
    let totalFailed = 0;
    try {
      for (;;) {
        const result = await backfillSearchIndex();
        totalProcessed += result.processed;
        totalFailed += result.failed;
        setBackfillProgress(totalProcessed);

        if (result.remaining <= 0) break;
        // Защита от бесконечного цикла: за итерацию ничего не обработано, но записи ещё остались —
        // значит все они падают с ошибкой, дальше крутить цикл бессмысленно.
        if (result.processed === 0) {
          showToast(`Не удалось проиндексировать часть записей (${result.remaining} осталось). Попробуйте позже.`, 'error');
          return;
        }
      }
      showToast(
        totalFailed > 0
          ? `Готово: проиндексировано ${totalProcessed} записей, ${totalFailed} с ошибками`
          : `Готово: проиндексировано ${totalProcessed} записей`,
        'success',
      );
    } catch (e) {
      console.warn('[SettingsView] backfillSearchIndex failed:', e);
      showToast('Не удалось проиндексировать записи. Попробуйте позже.', 'error');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleConfirm = () => {
    if (confirmClear === 'recordings') { onClearRecordings(); showToast('Записи удалены', 'success'); }
    else if (confirmClear === 'notes') { onClearNotes(); showToast('Заметки удалены', 'success'); }
    else if (confirmClear === 'all') { onClearRecordings(); onClearNotes(); showToast('Все данные удалены', 'success'); }
    setConfirmClear(null);
  };

  const userInitial = (settings.userName || 'V').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Настройки</h1>
      </header>

      {/* Повторный показ предупреждения — только чтение, подтверждать заново нечего */}
      {showConsent && (
        <ConsentNotice readOnly onAcknowledge={() => setShowConsent(false)} onCancel={() => setShowConsent(false)} />
      )}

      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-2xl w-full mx-auto">

        {/* Профиль */}
        <Section title="Профиль">
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-white">{userInitial}</span>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => { onSettingsChange({ userName: nameInput.trim() }); showToast('Имя сохранено', 'success'); }}
                placeholder="Твоё имя"
                className="w-full bg-surface-container-high rounded-xl px-4 py-2.5 text-sm font-bold text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-xs text-on-surface-variant mt-1.5 pl-1">Альфа-тестер</p>
            </div>
          </div>
        </Section>

        {/* Статистика */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Статистика</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Mic, label: 'Записей', value: recordings.length },
              { icon: FileText, label: 'Заметок', value: notes.length },
              { icon: Database, label: 'Минут', value: Math.round(totalMinutes) },
              { icon: Database, label: 'Задач', value: totalTasks },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface-container rounded-2xl p-4 border border-white/5 text-center">
                <Icon className="w-4 h-4 text-primary mx-auto mb-2 opacity-70" />
                <p className="text-2xl font-black text-on-surface">{value}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">Идей найдено AI</p>
              <p className="text-xl font-black text-primary">{totalIdeas}</p>
            </div>
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">Задач выполнено</p>
              <p className="text-xl font-black text-secondary">{completedNotes}</p>
            </div>
          </div>
        </section>

        {/* Язык */}
        <Section title="Язык">
          <RowChips
            icon={Languages}
            label="Язык приложения и AI"
            description="Саммари, идеи и ответы поиска будут на этом языке. Речь в транскрипте не переводится"
            options={[
              { label: 'Русский', value: 'ru' },
              { label: 'English', value: 'en' },
            ]}
            value={settings.language}
            onChange={v => { onSettingsChange({ language: v as AppSettings['language'] }); showToast('Настройки сохранены', 'success'); }}
          />
        </Section>

        {/* Лимит расшифровки */}
        <Section title="Лимит расшифровки">
          <UsageCard />
        </Section>

        {/* Запись */}
        <Section title="Запись">
          <RowChips
            icon={Mic}
            label="Автостоп"
            description="Остановить запись автоматически"
            options={[
              { label: 'Выкл', value: null },
              { label: '5 мин', value: 5 },
              { label: '10 мин', value: 10 },
              { label: '15 мин', value: 15 },
              { label: '30 мин', value: 30 },
            ]}
            value={settings.autoStopMinutes}
            onChange={v => { onSettingsChange({ autoStopMinutes: v as AppSettings['autoStopMinutes'] }); showToast('Настройки сохранены', 'success'); }}
          />
          <Divider />
          <RowChips
            icon={Mic}
            label="Язык транскрипции"
            description="Gemini автоматически определяет язык"
            options={[
              { label: 'Авто', value: 'auto' },
              { label: 'Русский', value: 'ru' },
              { label: 'English', value: 'en' },
            ]}
            value={settings.transcriptionLang}
            onChange={v => { onSettingsChange({ transcriptionLang: v as AppSettings['transcriptionLang'] }); showToast('Настройки сохранены', 'success'); }}
          />
          <Divider />
          <RowAction
            icon={ShieldAlert}
            label="Согласие на запись"
            description="В ряде штатов США записывать разговор можно только с согласия всех участников"
            iconColor="text-warning"
            bgColor="bg-warning/10"
            onClick={() => setShowConsent(true)}
            rightLabel="Прочитать"
          />
        </Section>

        {/* AI */}
        <Section title="Искусственный интеллект">
          <RowChips
            icon={Sparkles}
            label="Детализация саммари"
            description="Насколько подробным будет резюме"
            options={[
              { label: 'Кратко', value: 'brief' },
              { label: 'Стандарт', value: 'standard' },
              { label: 'Подробно', value: 'detailed' },
            ]}
            value={settings.summaryDetail}
            onChange={v => { onSettingsChange({ summaryDetail: v as AppSettings['summaryDetail'] }); showToast('Настройки сохранены', 'success'); }}
          />
          <Divider />
          <RowToggle
            icon={Sparkles}
            label="Выделять идеи"
            description="AI находит идеи в каждой записи"
            checked={settings.extractIdeas}
            onChange={v => { onSettingsChange({ extractIdeas: v }); showToast('Настройки сохранены', 'success'); }}
          />
          <Divider />
          <RowToggle
            icon={Sparkles}
            label="Выделять задачи"
            description="AI находит action items в записях"
            checked={settings.extractTasks}
            onChange={v => { onSettingsChange({ extractTasks: v }); showToast('Настройки сохранены', 'success'); }}
          />
        </Section>

        {/* Данные */}
        <Section title="Данные">
          <RowAction icon={Download} label="Экспорт данных" description="Скачать записи и заметки в JSON" onClick={exportData} rightLabel="Скачать" />
          {/* Dev-only: сброс до демо пишет только в локальный state и не сохраняется
              в Firestore — при активном листенере данные откатятся. В проде скрываем. */}
          {import.meta.env.DEV && (
            <>
              <Divider />
              <RowAction icon={RefreshCw} label="Сбросить до демо" description="Восстановить начальные демо-данные (dev)" iconColor="text-tertiary" bgColor="bg-tertiary/10" onClick={() => { onResetDemo(); onBack(); }} />
            </>
          )}
        </Section>

        {/* Поиск по записям */}
        <Section title="Поиск по записям">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Индексация старых записей</p>
                <p className="text-xs text-on-surface-variant">Старые записи не находятся поиском, пока не проиндексированы. Это разовая операция.</p>
              </div>
            </div>
            <button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-surface-container-high text-on-surface hover:text-primary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBackfilling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Проиндексировано {backfillProgress}…</span>
                </>
              ) : (
                <span>Проиндексировать старые записи</span>
              )}
            </button>
          </div>
        </Section>

        {/* Фидбэк */}
        <Section title="Поддержка">
          <RowAction
            icon={MessageSquare}
            label="Сообщить о проблеме"
            description="Написать на почту — ответим быстро"
            iconColor="text-secondary"
            bgColor="bg-secondary/10"
            onClick={() => { window.location.href = FEEDBACK_EMAIL; }}
          />
          <Divider />
          <RowAction
            icon={User}
            label="Связаться с разработчиком"
            description="Идеи, предложения, вопросы"
            iconColor="text-secondary"
            bgColor="bg-secondary/10"
            onClick={() => { window.location.href = FEEDBACK_EMAIL; }}
          />
        </Section>

        {/* О приложении */}
        <Section title="О приложении">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">VoiceMap</p>
                <p className="text-xs text-on-surface-variant">Версия {APP_VERSION} · Альфа</p>
              </div>
            </div>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-lg font-bold">Alpha</span>
          </div>
          <Divider />
          <div className="px-5 py-4 flex flex-col gap-1.5">
            <p className="text-xs text-on-surface-variant">AI: Gemini 2.5 Flash (Google)</p>
            <p className="text-xs text-on-surface-variant">База: Firebase (Google)</p>
            <p className="text-xs text-on-surface-variant">Аудио: MediaRecorder API</p>
          </div>
        </Section>

        {/* Опасная зона */}
        <Section title="Опасная зона" danger>
          {(['recordings', 'notes', 'all'] as const).map((type, i) => (
            <div key={type}>
              {i > 0 && <Divider />}
              {confirmClear === type ? (
                <div className="flex items-center justify-between p-5 bg-error/5">
                  <p className="text-sm text-error font-bold">
                    {type === 'recordings' ? 'Удалить все записи?' : type === 'notes' ? 'Удалить все заметки?' : 'Удалить всё?'}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmClear(null)} className="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-surface-container-high rounded-lg cursor-pointer hover:text-on-surface transition-colors">Отмена</button>
                    <button onClick={handleConfirm} className="px-3 py-1.5 text-xs font-bold text-white bg-error rounded-lg cursor-pointer hover:bg-error/80 transition-colors">Удалить</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(type)} className="w-full flex items-center gap-3 p-5 hover:bg-error/5 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-error" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">
                      {type === 'recordings' ? 'Очистить записи' : type === 'notes' ? 'Очистить заметки' : 'Удалить всё'}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {type === 'recordings' ? `${recordings.length} ${plural(recordings.length, ['запись', 'записи', 'записей'])} будет удалено` : type === 'notes' ? `${notes.length} ${plural(notes.length, ['заметка', 'заметки', 'заметок'])} будет удалено` : 'Все данные будут удалены без возможности восстановления'}
                    </p>
                  </div>
                </button>
              )}
            </div>
          ))}
        </Section>

      </main>
    </div>
  );
};
