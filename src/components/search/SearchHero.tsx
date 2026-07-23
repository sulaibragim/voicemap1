import { useState } from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';
import { searchRecordings, transcribeChatVoice, type SearchResult } from '../../lib/api';
import { useChatRecording } from '../../hooks/useChatRecording';
import { SearchVoiceButton } from './SearchVoiceButton';
import { SearchResultPanel } from './SearchResultPanel';
import { useT, type TKey } from '../../i18n';

interface SearchHeroProps {
  /** Открыть источник ответа на нужной секунде записи */
  onOpenSource: (recordingId: string, timestamp: string) => void;
}

// Примеры запросов — клик сразу подставляет и ищет. Ключи, а не строки: зависят от языка
const EXAMPLE_QUERY_KEYS: TKey[] = ['search.example1', 'search.example2', 'search.example3'];

// Заглушка пустого аудио приходит с сервера на языке пользователя (см. server/lib/lang.ts),
// поэтому сверяем с обоими вариантами — иначе на английском тишина уйдёт в поиск как запрос.
const SILENCE_MARKERS = ['[Тишина]', '[Silence]'];

/**
 * Главный герой-блок дашборда — голосовой/текстовый поиск по своим записям.
 * Состояния: пусто → слушаю (запись голоса) → ищу (транскрипция/поиск) → есть ответ.
 */
export const SearchHero = ({ onOpenSource }: SearchHeroProps) => {
  const t = useT();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const runSearch = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSearching) return;
    setIsSearching(true);
    setResult(null);
    // searchRecordings не бросает — при ошибке вернёт понятный fallback-ответ
    const res = await searchRecordings(trimmed);
    setResult(res);
    setIsSearching(false);
  };

  const { isRecording, recordingTime, startRecording, stopRecording, formatTime } = useChatRecording({
    onAudioReady: async (base64Audio, mimeType) => {
      try {
        const transcript = await transcribeChatVoice(base64Audio, mimeType);
        if (!transcript || SILENCE_MARKERS.includes(transcript.trim())) {
          setIsSearching(false);
          return;
        }
        setQuery(transcript);
        await runSearch(transcript);
      } catch {
        setIsSearching(false);
      }
    },
  });

  // Клик «Стоп» переводит кнопку в состояние поиска сразу, не дожидаясь колбэка распознавания
  const handleStopRecording = () => {
    setIsSearching(true);
    stopRecording();
  };

  const isBusy = isRecording || isSearching;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 md:col-span-8 lg:col-span-8 rounded-3xl bg-surface-container border border-white/5 p-5 md:p-10 flex flex-col"
    >
      {/* Заголовок */}
      <div className="text-center md:text-left mb-6">
        <h1 className="font-headline text-2xl md:text-4xl font-black tracking-tight text-on-surface">
          {t('search.title')}
        </h1>
        <p className="text-sm md:text-base text-on-surface-variant mt-1">
          {t('search.subtitle')}
        </p>
      </div>

      <SearchVoiceButton
        isRecording={isRecording}
        isSearching={isSearching}
        recordingTime={recordingTime}
        onStart={startRecording}
        onStop={handleStopRecording}
        formatTime={formatTime}
      />

      {/* Текстовый ввод */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
          disabled={isBusy}
          placeholder={t('search.placeholder')}
          className="w-full bg-surface-container-high border border-white/10 rounded-full py-3.5 pl-5 pr-14 text-sm md:text-base focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
        />
        <button
          onClick={() => runSearch(query)}
          disabled={!query.trim() || isBusy}
          aria-label="Искать"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-primary text-on-primary-fixed disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Чипы-примеры */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERY_KEYS.map(key => {
          const chip = t(key);
          return (
          <button
            key={key}
            onClick={() => { setQuery(chip); void runSearch(chip); }}
            disabled={isBusy}
            className="text-xs font-bold px-3.5 py-2 rounded-full bg-surface-container-high border border-white/8 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {chip}
          </button>
          );
        })}
      </div>

      <SearchResultPanel
        result={result}
        onOpenSource={onOpenSource}
        onClear={() => { setResult(null); setQuery(''); }}
      />
    </motion.div>
  );
};
