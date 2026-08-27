const CACHE_NAME = 'manga-tambo-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/3144/3144456.png'
];

// 1. Instalar y guardar archivos en la memoria caché del celular de inmediato
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activar y limpiar versiones viejas de caché
self.addEventListener('activate', (e) => {
  e.waitUntil(
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

// 3. Estrategia Cache-First: Abre SIEMPRE desde la memoria local del teléfono
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Sin señal, no hace nada */});

        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});