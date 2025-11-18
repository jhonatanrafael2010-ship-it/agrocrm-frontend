// ⚠️ IMPORTANTE:
// Este SW NÃO intercepta requisições da API (Render).
// Ele só cacheia arquivos estáticos do frontend.

const CACHE_NAME = "agrocrm-cache-v3";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/vite.svg",
];

// INSTALAR — cache só do frontend
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ATIVAR — limpar versões antigas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH — NÃO cacheia /api/ !!!!
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 🔥 Ignorar API (backend Render)
  if (req.url.includes("/api/")) return;

  // Apenas GET deve ser cacheado
  if (req.method !== "GET") return;

  // 🔥 Cache-first para arquivos estáticos
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).catch(() => caches.match("/index.html"))
      );
    })
  );
});
