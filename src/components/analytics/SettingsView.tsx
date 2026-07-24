import { useState } from 'react';
import { ArrowLeft, Download, RefreshCw, Mic, User, MessageSquare, Sparkles, Info, ShieldAlert, Languages } from 'lucide-react';
import { ConsentNotice } from '../recording/ConsentNotice';
import type { Recording, Note, AppSettings } from '../../types';
import { Section, Divider, RowToggle, RowChips, RowAction } from './SettingsRows';
import { UsageCard } from './UsageCard';
import { SettingsStats } from './SettingsStats';
import { SettingsBackfill } from './SettingsBackfill';
import { SettingsDangerZone } from './SettingsDangerZone';
import { useT } from '../../i18n';

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
  const t = useT();
  const [nameInput, setNameInput] = useState(settings.userName);
  const [showConsent, setShowConsent] = useState(false);


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

        <SettingsStats recordings={recordings} notes={notes} />

        {/* Язык */}
        <Section title={t('settings.languageSection')}>
          <RowChips
            icon={Languages}
            label={t('settings.languageLabel')}
            description={t('settings.languageDescription')}
            options={[
              { label: 'Русский', value: 'ru' },
              { label: 'English', value: 'en' },
            ]}
            value={settings.language}
            onChange={v => { onSettingsChange({ language: v as AppSettings['language'] }); showToast(t('common.settingsSaved'), 'success'); }}
          />
        </Section>

        {/* Лимит расшифровки */}
        <Section title={t('usage.section')}>
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
            onChange={v => { onSettingsChange({ autoStopMinutes: v as AppSettings['autoStopMinutes'] }); showToast(t('common.settingsSaved'), 'success'); }}
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
            onChange={v => { onSettingsChange({ transcriptionLang: v as AppSettings['transcriptionLang'] }); showToast(t('common.settingsSaved'), 'success'); }}
          />
          <Divider />
          <RowAction
            icon={ShieldAlert}
            label={t('consent.settingsLabel')}
            description={t('consent.settingsDescription')}
            iconColor="text-warning"
            bgColor="bg-warning/10"
            onClick={() => setShowConsent(true)}
            rightLabel={t('consent.settingsAction')}
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
            onChange={v => { onSettingsChange({ summaryDetail: v as AppSettings['summaryDetail'] }); showToast(t('common.settingsSaved'), 'success'); }}
          />
          <Divider />
          <RowToggle
            icon={Sparkles}
            label="Выделять идеи"
            description="AI находит идеи в каждой записи"
            checked={settings.extractIdeas}
            onChange={v => { onSettingsChange({ extractIdeas: v }); showToast(t('common.settingsSaved'), 'success'); }}
          />
          <Divider />
          <RowToggle
            icon={Sparkles}
            label="Выделять задачи"
            description="AI находит action items в записях"
            checked={settings.extractTasks}
            onChange={v => { onSettingsChange({ extractTasks: v }); showToast(t('common.settingsSaved'), 'success'); }}
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

        <SettingsBackfill showToast={showToast} />

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

        <SettingsDangerZone
          recordings={recordings}
          notes={notes}
          onClearRecordings={onClearRecordings}
          onClearNotes={onClearNotes}
          showToast={showToast}
        />

      </main>
    </div>
  );
};
