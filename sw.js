/* A to Zero — service worker.
   Precache the whole app so it works offline / installs to a home screen.
   Bump CACHE_VERSION whenever any shipped file changes. */

const CACHE_VERSION = "a2z-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./catalog.js",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first, falling back to cache: updates flow through when online,
   the app still opens when offline. */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
