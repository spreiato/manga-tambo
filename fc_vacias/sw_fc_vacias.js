const CACHE_NAME = 'fc-vacias-v1';
const ASSETS = [
  './',
  './index_fc_vacias.html',
  './manifest_fc_vacias.json'
];

// 1. Instalación: Guarda los recursos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activación: Limpia cachés viejas y toma el control de inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia Offline: Busca en caché primero; si no está, recurre a la red
self.addEventListener('fetch', (event) => {
  // Ignora peticiones POST (sincronizaciones a Apps Script)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      return caches.match('./index_fc_vacias.html');
    })
  );
});
