const CACHE_NAME = "library-pos-v1";
const ASSETS_TO_CACHE = [
    "/",
    "/build/client/index.js", 
    "/build/client/_assets/index.css", 
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/manifest.json",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener("fetch", (event) => {
    // Bypass Replicache sync endpoint
    if (event.request.url.includes("/replicache-sync")) {
        return event.respondWith(fetch(event.request));
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached response if available
            if (response) {
                return response;
            }
            // Fetch from network and cache dynamically
            return fetch(event.request).then((networkResponse) => {
                if (
                    !networkResponse ||
                    networkResponse.status !== 200 ||
                    networkResponse.type !== "basic"
                ) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Fallback to cached root page if offline
                return caches.match("/");
            });
        })
    );
});

self.addEventListener("activate", (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});