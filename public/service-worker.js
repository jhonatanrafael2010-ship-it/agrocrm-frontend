const CACHE_NAME = "agrocrm-cache-v2";
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        "/manifest.json"
        ]).catch(err => console.warn("⚠️ Cache parcial: alguns arquivos offline não foram adicionados", err));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ❌ Evita cachear requisições não-GET (PUT, POST, DELETE, etc)
  if (req.method !== "GET") {
    return;
  }


  // ⚙️ Se for navegação (React Router)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL, { cacheName: CACHE_NAME })
      )
    );
    return;
  }

  // 📦 Cache-first para arquivos estáticos
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return response;
          })
      )
    );
  }
});
