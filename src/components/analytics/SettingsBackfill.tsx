import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { backfillSearchIndex } from '../../lib/api';
import { Section } from './SettingsRows';

interface SettingsBackfillProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Индексация старых записей для голосового поиска.
 *
 * Записи, сделанные до появления RAG-поиска, поиском не находятся, пока их не
 * проиндексируешь. Сервер отдаёт индекс пачками, поэтому крутим цикл, пока он
 * не скажет, что больше нечего.
 */
export const SettingsBackfill = ({ showToast }: SettingsBackfillProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);

  const handleBackfill = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProcessed(0);

    let totalProcessed = 0;
    let totalFailed = 0;

    try {
      for (;;) {
        const result = await backfillSearchIndex();
        totalProcessed += result.processed;
        totalFailed += result.failed;
        setProcessed(totalProcessed);

        if (result.remaining <= 0) break;

        // За итерацию не обработано ничего, а записи ещё остались — значит все
        // они падают с ошибкой. Дальше крутить цикл бессмысленно.
        if (result.processed === 0) {
          showToast(
            `Не удалось проиндексировать часть записей (${result.remaining} осталось). Попробуйте позже.`,
            'error',
          );
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
      console.warn('[SettingsBackfill] backfillSearchIndex failed:', e);
      showToast('Не удалось проиндексировать записи. Попробуйте позже.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Section title="Поиск по записям">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Индексация старых записей</p>
            <p className="text-xs text-on-surface-variant">
              Старые записи не находятся поиском, пока не проиндексированы. Это разовая операция.
            </p>
          </div>
        </div>

        <button
          onClick={handleBackfill}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-surface-container-high text-on-surface hover:text-primary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Проиндексировано {processed}…</span>
            </>
          ) : (
            <span>Проиндексировать старые записи</span>
          )}
        </button>
      </div>
    </Section>
  );
};
