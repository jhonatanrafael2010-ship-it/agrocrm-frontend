const CACHE_NAME = "agrocrm-cache-v1";
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/src/main.tsx",
  "/src/App.tsx",
  "/style.css",
  "/logo192.png",
  "/logo512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // ✅ Prioriza cache, mas atualiza depois
      return (
        response ||
        fetch(event.request).then((fetchedResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchedResponse.clone());
            return fetchedResponse;
          });
        })
      );
    })
  );
});
