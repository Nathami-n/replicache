const CACHE_NAME = "library-pos-v1";
const STATIC_CACHE = "static-v1";

// Core assets that must be cached
const CORE_ASSETS = ["/", "/manifest.json", "/192.png"];

// These will be populated by your build process
const STATIC_ASSETS = [
  // Your actual built files will be added here by vite config
];

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  event.waitUntil(
    Promise.all([
      // Cache core assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log("Caching core assets...");
        return cache.addAll(CORE_ASSETS);
      }),
      // Cache static assets (CSS, JS files)
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("Caching static assets...");
        if (STATIC_ASSETS.length > 0) {
          return cache.addAll(STATIC_ASSETS);
        }
        return Promise.resolve();
      }),
    ])
      .then(() => {
        console.log("Assets cached successfully");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Failed to cache assets:", error);
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  const cacheWhitelist = [CACHE_NAME, STATIC_CACHE];

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control immediately
      self.clients.claim(),
    ]).then(() => {
      console.log("Service Worker activated successfully");
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // IMPORTANT: Skip ALL Replicache API endpoints
  // This ensures Replicache can sync properly when online
  if (url.pathname.includes("/api/replicache/")) {
    console.log("Skipping cache for Replicache API:", url.pathname);
    return; // Let it go to network
  }

  // Skip other API calls that shouldn't be cached
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Only cache requests from our own origin
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  try {
    // For static assets (CSS, JS, images), use cache-first strategy
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request);
    }

    // For HTML pages, use network-first strategy
    if (isHTMLRequest(request)) {
      return await networkFirst(request);
    }

    // Default to cache-first for other resources
    return await cacheFirst(request);
  } catch (error) {
    console.error("Request failed:", error);
    return await getOfflineFallback(request);
  }
}

async function cacheFirst(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // If not in cache, fetch from network and cache it
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/build/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)
  );
}

function isHTMLRequest(request) {
  return (
    request.headers.get("accept")?.includes("text/html") ||
    request.mode === "navigate"
  );
}

async function getOfflineFallback(request) {
  // For HTML requests, return the cached home page
  if (isHTMLRequest(request)) {
    const cachedHome = await caches.match("/");
    if (cachedHome) {
      return cachedHome;
    }
  }

  // For other requests, return a simple offline response
  return new Response(
    JSON.stringify({
      error: "Offline",
      message: "This resource is not available offline",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    }
  );
}
