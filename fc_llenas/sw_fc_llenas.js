const CACHE_NAME = 'fc-llenas-v1';

// Resuelve la ruta base dinámica según dónde esté alojado el Service Worker
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index_fc_llenas.html',
  BASE_PATH + 'manifest_fc_llenas.json'
];

// 1. Instalación: Fuerza la descarga e instalación inmediata para uso offline desde el segundo cero
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Obliga al Service Worker a activarse inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activación: Toma el control total de los clientes al instante
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
    }).then(() => self.clients.claim()) // Reclama el control de la PWA abiertas inmediatamente
  );
});

// 3. Estrategia Offline: Responde desde Caché siempre; si falla, recurre a la red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Si no está en caché pero hay red, lo guarda para la próxima
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Respaldo absoluto offline
      return caches.match(BASE_PATH + 'index_fc_llenas.html') || caches.match(BASE_PATH);
    })
  );
});      }
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      return caches.match('./index_fc_llenas.html');
    })
  );
});
