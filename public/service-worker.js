// public/service-worker.js

const CACHE_NAME = "agrocrm-cache-v3";

// Arquivos essenciais para o app abrir offline
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/vite.svg",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ============================================================
// 📦 INSTALL — Pré-carrega arquivos essenciais
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ============================================================
// 🌐 FETCH — Cache com fallback OFFLINE
// ============================================================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // ⚠ Não interceptar POST/PUT/DELETE porque quebram o IndexedDB sync
  if (request.method !== "GET") return;

  // ⚠ Não interceptar requisições de outros domínios
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Apenas respostas válidas são salvas no cache
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch((err) => {
              console.warn("⚠️ Falha ao armazenar no cache:", err);
            });
          });
        }
        return response;
      })
      .catch(async () => {
        // 🔥 Falhou: tentar recuperar do cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // 🔥 Navegação offline → fallback para index.html
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }

        // 🔥 Fallback genérico
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});

// ============================================================
// 🔄 ACTIVATE — limpar caches antigos
// ============================================================
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
