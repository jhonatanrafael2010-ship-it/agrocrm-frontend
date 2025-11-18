// ============================================================
// 🌐 AGROCRM — Service Worker Oficial
// Versão estável: v5
// ============================================================
//
// ✔ NÃO intercepta /api/ (Render backend)
// ✔ NÃO intercepta uploads de fotos
// ✔ Cacheia SOMENTE assets estáticos
// ✔ Evita "Request failed" durante addAll()
// ✔ Mantém PWA rápida e confiável
//
// ============================================================

const CACHE_NAME = "agrocrm-static-v5";

// Apenas arquivos estáticos que SEMPRE existem no build
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/vite.svg",
];

// ============================================================
// 🟦 INSTALL — pré-cache apenas assets garantidos
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          // Evita crash se algum item falhar
          console.warn("⚠️ Falha ao adicionar asset no cache:", asset, err);
        }
      }
    })
  );

  self.skipWaiting();
});

// ============================================================
// 🟩 ACTIVATE — limpa SW antigos
// ============================================================
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

// ============================================================
// 🟨 FETCH — Cache-first APENAS para arquivos estáticos
// ============================================================
//
// ⚠️ MUITO IMPORTANTE:
// • Não interceptamos /api/
// • Não interceptamos uploads (POST/PUT)
// • Não interceptamos fotos
//
// ============================================================

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 🔥 1 — nunca interceptar API
  if (url.pathname.startsWith("/api")) return;

  // 🔥 2 — nunca interceptar uploads/métodos de escrita
  if (req.method !== "GET") return;

  // 🔥 3 — somente cache para arquivos locais do próprio domínio
  if (url.origin !== self.location.origin) return;

  // 🔥 4 — estratégia cache-first segura
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Não cacheia respostas inválidas
          if (!res || res.status !== 200 || res.type !== "basic") return res;

          const clone = res.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone);
          });

          return res;
        })
        .catch(() => {
          // fallback para SPA
          return caches.match("/index.html");
        });
    })
  );
});
