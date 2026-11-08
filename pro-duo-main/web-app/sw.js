/* ============================================================================
 * Irriga.ai Pro-Duo · v1.6.7.a (SABIÁ) — Service Worker Offline-First (PWA)
 * ========================================================================== */
const CACHE_NAME = 'irriga-pro-duo-v1.6.7a-telegram-bot-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './dev-gui.html',
  './paho-mqtt.js',
  './app.js',
  './sheets.js',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  '../core/crops.js',
  '../core/irriga-core.js',
  '../core/yaml-lite.js',
  '../core/notificacoes-sabia.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1. APIs dinâmicas (clima Open-Meteo e REST local): tenta rede primeiro com cache de contingência
  if (url.hostname.includes('open-meteo.com') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 2. Arquivos da aplicação: Network-First garantindo sempre a versão mais nova no ar
  // Se estiver sem internet no sítio, recorre instantaneamente ao cache local
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
