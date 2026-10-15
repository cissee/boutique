/*
 * BoutikDëkk — service worker.
 *
 * Il ne met en cache AUCUNE donnée personnelle : seulement les fichiers de l'application
 * (JS/CSS versionnés par Next.js), les icônes et la page /offline. Les données consultables
 * hors ligne sont dans IndexedDB, gérées par l'application et effacées à la déconnexion.
 *
 * - /_next/static/* : cache d'abord (fichiers immuables, nom unique par version) ;
 * - navigation sans réseau : page /offline ;
 * - tout le reste : réseau uniquement.
 */
const VERSION = "v1";
const STATIC_CACHE = `boutikdekk-static-${VERSION}`;
const OFFLINE_CACHE = `boutikdekk-offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];
const MAX_STATIC_ENTRIES = 400;

/** Met en cache /offline et les fichiers JS/CSS qu'elle référence. */
async function cacheOfflinePage() {
  const response = await fetch(OFFLINE_URL, { cache: "reload", credentials: "omit" });
  if (!response.ok || response.redirected) return;
  const html = await response.clone().text();
  const offline = await caches.open(OFFLINE_CACHE);
  await offline.put(OFFLINE_URL, response);

  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)<>]+/g) || []);
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets, ...SHELL].map((url) =>
      statics.match(url).then((hit) => hit || statics.add(url).catch(() => undefined)),
    ),
  );
}

async function trimStaticCache() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) {
    await cache.delete(request);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("boutikdekk-") && key !== STATIC_CACHE && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// L'application demande une mise à jour de /offline à chaque ouverture en ligne
// (nouvelle version déployée => nouveaux fichiers).
self.addEventListener("message", (event) => {
  if (event.data === "refresh-offline") {
    event.waitUntil(cacheOfflinePage().then(trimStaticCache).catch(() => undefined));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
  }
});
