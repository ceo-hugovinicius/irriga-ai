// ============================================================================
// 🌱 IRRIGA.AI PRO-DUO — SERVICE WORKER OFFLINE-FIRST (ANDROID & iOS PWA)
// ============================================================================
// Permite instalar o aplicativo na tela inicial do Android e do iPhone e
// garante que ele abra instantaneamente na roça mesmo sem sinal de internet.
// ============================================================================

const CACHE_NAME = 'irriga-pro-duo-v1.2';
const CORE_ASSETS = [
  './',
  './index.html',
  './dev-gui.html',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Alguns arquivos locais não puderam ser cacheados:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Chamadas de Clima (Open-Meteo) ou Hardware Local (ESP32 /api/*): Network-First
  if (url.hostname.includes('open-meteo.com') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2. Arquivos do App (HTML, JS, Manifesto, Ícones, Fontes): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
