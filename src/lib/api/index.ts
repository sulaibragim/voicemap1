// Точка входа клиента API. Модуль разделён по назначению — так же, как роуты
// на сервере (server/routes/ai/). Реэкспорт здесь нужен, чтобы импорты вида
// `from '../../lib/api'` по всему проекту продолжали работать без правок.
export {
  setApiLanguage, getApiLanguage, toApiError,
  QuotaExceededError, fetchTranscriptionUsage,
  type OutputLang, type TranscriptionUsage,
} from './client';

export {
  transcribeRecording, retranscribeFromUrl, transcribeChatVoice,
} from './transcribe';

export {
  searchRecordings, deleteRecordingChunks, backfillSearchIndex,
  type SearchSource, type SearchResult, type BackfillResult,
} from './search';

export {
  fetchDailyTip, appendToRecording, condenseTranscript, developIdea,
  parseTasksFromVoice, weeklyReview, parseReminderTime,
  type DigestAIResult,
} from './assist';

export {
  uploadAudioToR2, processRecordingAsync, deleteAudioFromR2,
} from './upload';
