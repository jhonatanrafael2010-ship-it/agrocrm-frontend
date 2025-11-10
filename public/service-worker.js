const CACHE_NAME = 'agrocrm-cache-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/manifest.json'
];

// Instala o cache inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Responde a requisições
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        })
      );
    })
  );
});

// Atualiza o cache
self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => !whitelist.includes(key) && caches.delete(key)))
    )
  );
});
