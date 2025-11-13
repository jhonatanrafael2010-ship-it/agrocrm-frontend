const CACHE_NAME = "agrocrm-cache-v2";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/vite.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Não cacheia POST, PUT, DELETE etc
  if (request.method !== "GET") return;

  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
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
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }

        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});

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
