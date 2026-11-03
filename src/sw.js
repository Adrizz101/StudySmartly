/* StudySmartly offline service worker.
 * The PWA build injects the hashed client assets into __WB_MANIFEST.
 */
const precacheManifest = self.__WB_MANIFEST || [];
const PRECACHE_CACHE = "studysmartly-precache-v1";
const PAGE_CACHE = "studysmartly-pages-v1";
const ASSET_CACHE = "studysmartly-assets-v1";
const CURRENT_CACHES = [PRECACHE_CACHE, PAGE_CACHE, ASSET_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE_CACHE);
    const urls = precacheManifest
      .map((entry) => entry.url)
      .filter((url) => typeof url === "string" && !url.startsWith("http"));
    await cache.addAll(urls);

    try {
      const shell = await fetch("/", { cache: "reload" });
      if (shell.ok) await cache.put("/", shell.clone());
    } catch {
      // The precached build assets remain available if the shell is temporarily unreachable.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("studysmartly-") && !CURRENT_CACHES.includes(name))
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(async (response) => {
        if (response.ok) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > 30) await cache.delete(keys[0]);
        }
        return response;
      });

      if (cached) {
        event.waitUntil(refresh.catch(() => undefined));
        return cached;
      }

      try {
        return await refresh;
      } catch {
        return (
          await caches.match("/") ||
          await caches.match("/index.html") ||
          Response.error()
        );
      }
    })());
    return;
  }

  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(async (response) => {
        if (response.ok) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > 100) await cache.delete(keys[0]);
        }
        return response;
      });

      if (cached) {
        event.waitUntil(refresh.catch(() => undefined));
        return cached;
      }

      try {
        return await refresh;
      } catch {
        return Response.error();
      }
    })());
  }
});
