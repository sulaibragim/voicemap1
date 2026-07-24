// Восстановление после устаревшей версии в кэше браузера.
//
// Проблема, которую это лечит: браузер держит старый index.html, тот ссылается
// на файлы сборки, удалённые при деплое. Пользователь открывает приложение —
// экран не грузится, в консоли ошибки, и так до ручной чистки кэша.
//
// Признак — провал динамического импорта: React.lazy не смог подтянуть чанк.
// Отличить его от «нет интернета» можно: при офлайне запрос не доходит вовсе,
// а тут сервер отвечает 404 на конкретный файл.

/** Чтобы не зациклиться на перезагрузках, если дело вовсе не в кэше */
const RELOAD_FLAG = 'voicemap_stale_reload';

/** Ошибки Vite/браузеров при провале динамического импорта */
const STALE_CHUNK_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Unable to preload CSS',
];

export function isStaleChunkError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  return STALE_CHUNK_PATTERNS.some(pattern =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

/**
 * Сбрасывает кэши и перезагружает страницу — ровно один раз за сессию.
 * Повторный провал уже не про кэш: перезагрузка не поможет, а бесконечный
 * цикл сделает только хуже.
 */
async function recoverFromStaleCache(): Promise<void> {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      console.error('[staleVersion] Перезагрузка уже была — проблема не в кэше');
      return;
    }
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // sessionStorage недоступен (приватный режим) — рискуем одной перезагрузкой
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(registrations.map(r => r.unregister()));
  } catch (e) {
    console.warn('[staleVersion] Не удалось снять service worker:', e);
  }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (e) {
    console.warn('[staleVersion] Не удалось очистить кэш:', e);
  }

  window.location.reload();
}

/**
 * Ставит перехват на провалы динамических импортов.
 * Вызывать один раз при старте приложения.
 */
export function installStaleVersionRecovery(): void {
  window.addEventListener('unhandledrejection', event => {
    if (!isStaleChunkError(event.reason)) return;
    console.warn('[staleVersion] Экран не загрузился из-за устаревшего кэша — обновляю приложение');
    void recoverFromStaleCache();
  });

  // Успешная загрузка — снимаем флаг, чтобы починка работала и в следующий раз
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // Недоступно — не критично
    }
  });
}
