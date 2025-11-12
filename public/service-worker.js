const CACHE_NAME = "agrocrm-cache-v2";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/vite.svg",
  "/manifest.json",
];

// Instala o cache inicial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Intercepta todas as requisições
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Ignora requisições externas (como Render, Google Fonts, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // ⚠️ Garante que é uma resposta válida antes de salvar no cache
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache).catch((err) => {
            console.warn("⚠️ Falha ao armazenar no cache:", err);
          });
        });
        return response;
      })
      .catch(async () => {
        // 🔁 Tenta retornar do cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // 🧭 Se for navegação (HTML), retorna index.html offline
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }

        // ❌ Garante que sempre retorna um Response válido
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});

// Atualiza o cache, removendo versões antigas
self.addEventListener("activate", (event) => {
  const whitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!whitelist.includes(key)) {
            console.log(`🧹 Removendo cache antigo: ${key}`);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});
