/* Cada módulo conserva exclusivamente su propia caché; nunca toca bases locales. */
const PREFIX = "mt-safe-inseminacion-";
const CACHE = PREFIX + '20261027-2';
const LEGACY = "inseminacion-";
const ASSETS = ["./index_inseminacion.html", "./manifest_inseminacion.json", "../tambo.js?v=20261027.2", "../menu-flotante.js?v=20261027.2"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && (key.startsWith(PREFIX) || key.startsWith(LEGACY))).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if(event.request.mode !== 'navigate' && cached) return cached;
    try {
      const response = await fetch(event.request);
      if(response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch(error) {
      if(cached) return cached;
      if(event.request.mode === 'navigate') {
        const home = await cache.match(ASSETS[0]);
        if(home) return home;
      }
      throw error;
    }
  })());
});
