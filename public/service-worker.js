const CACHE_NAME = "agrocrm-cache-v3";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest"
];

// Instala o cache inicial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Intercepta requisições
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // ❌ NÃO cachear POST / PUT / DELETE / PATCH
  if (req.method !== "GET") {
    return event.respondWith(
      fetch(req).catch(() => new Response(null))
    );
  }

  // Apenas GET segue o fluxo de cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") {
          return res;
        }

        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, clone).catch((err) => {
            console.warn("⚠️ Cache PUT falhou:", err);
          });
        });

        return res;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;

          if (req.mode === "navigate") return caches.match("/index.html");

          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// Atualização de cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});
