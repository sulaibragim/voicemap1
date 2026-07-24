// Понятная причина отказа AI вместо общего «AI request failed».
//
// Раньше любая проблема — мёртвый ключ, исчерпанная квота, недоступная модель —
// выглядела одинаково: «Не удалось». Владелец видел ошибку и не мог понять, чинить
// ключ, ждать сброса квоты или это сбой сети. Диагностика занимала часы.
//
// Сообщения не раскрывают ничего секретного: ключ и внутренние детали остаются
// в логах сервера, наружу уходит только категория.

export type AiErrorReason = 'invalid_key' | 'quota' | 'model_missing' | 'network' | 'unknown';

export interface AiErrorInfo {
  reason: AiErrorReason;
  /** Что показать пользователю */
  message: string;
  /** HTTP-код: 429 для квоты, 502 для проблем на нашей стороне */
  status: number;
}

/**
 * Разбирает ошибку от Gemini SDK в категорию.
 * Опирается на текст и код ответа — структурированных кодов SDK не даёт.
 */
export function classifyAiError(error: unknown): AiErrorInfo {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();
  const status = typeof (error as { status?: unknown })?.status === 'number'
    ? (error as { status: number }).status
    : undefined;

  // Ключ невалиден или отозван — самая частая причина, и чинится за минуту
  if (status === 400 && (text.includes('api key') || text.includes('api_key'))) {
    return {
      reason: 'invalid_key',
      message: 'Ключ Gemini недействителен. Проверьте GEMINI_API_KEY на сервере.',
      status: 502,
    };
  }
  if (status === 401 || status === 403 || text.includes('permission denied')) {
    return {
      reason: 'invalid_key',
      message: 'Ключ Gemini отклонён. Проверьте права ключа и его срок действия.',
      status: 502,
    };
  }

  // Квота: бесплатный тариф Gemini ограничен запросами в минуту и в сутки
  if (status === 429 || text.includes('quota') || text.includes('rate limit') || text.includes('resource_exhausted')) {
    return {
      reason: 'quota',
      message: 'Лимит запросов к Gemini исчерпан. Попробуйте через несколько минут.',
      status: 429,
    };
  }

  // Модель недоступна для этого ключа — так было с text-embedding-004
  if (status === 404 || text.includes('not found') || text.includes('is not supported')) {
    return {
      reason: 'model_missing',
      message: 'Модель Gemini недоступна для этого ключа. Проверьте имя модели в настройках сервера.',
      status: 502,
    };
  }

  if (text.includes('fetch failed') || text.includes('econnrefused') || text.includes('timeout')) {
    return {
      reason: 'network',
      message: 'Сервер не смог связаться с Gemini. Возможно, временный сбой сети.',
      status: 502,
    };
  }

  return {
    reason: 'unknown',
    message: 'Gemini вернул ошибку. Подробности в логах сервера.',
    status: 502,
  };
}

/** Логирует полную ошибку и отдаёт клиенту разобранную причину */
export function aiErrorResponse(route: string, error: unknown): AiErrorInfo {
  const info = classifyAiError(error);
  // В лог — всё целиком, включая текст от SDK: он нужен для разбора
  console.error(`[${route}] AI error (${info.reason}):`, error);
  return info;
}
