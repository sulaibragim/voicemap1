// VoiceMap Service Worker — базовый offline-fallback и кэш статики.
// Стратегии:
// - HTML/SPA shell: network-first (свежий index.html, fallback на кэш)
// - Static assets (/assets/, иконки): cache-first (быстро, обновляется при смене hash в имени)
// - API (/api/): всегда network, без кэша (всё динамика, аудио/AI)
// - Firestore/R2/Google API: пропускаем (они сами управляют кэшем)

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `voicemap-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `voicemap-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install — precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate — чистим старые версии кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — стратегия по типу запроса
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Только GET — POST/PUT/DELETE не кэшируем
  if (request.method !== 'GET') return;

  // Пропускаем cross-origin (Firebase, Google APIs, R2, OAuth)
  if (url.origin !== self.location.origin) return;

  // API вызовы — всегда сеть, не кэшируем (всё динамика)
  if (url.pathname.startsWith('/api/')) return;

  // HTML / SPA shell — network-first
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Свежий ответ — обновляем кэш
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Остальные статические ресурсы (assets, иконки) — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        // Кэшируем только успешные ответы
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
