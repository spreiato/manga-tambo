const CACHE_NAME = 'vacunacion-v2';
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index_vacunacion.html',
  BASE_PATH + 'manifest_vacunacion.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos addAll de forma segura o cacheamos individualmente 
      // para que si falla uno por falta de red, no tire abajo todo el proceso.
      return Promise.all(
        ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.log('No se pudo cachear en el arranque (modo offline inicial):', url);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devuelve lo que está en caché y actualiza en segundo plano si hay red
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      // Si no está en caché, intenta buscarlo en la red
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Red de seguridad final para modo offline absoluto: devuelve el index principal desde caché
        return caches.match(BASE_PATH + 'index_vacunacion.html');
      });
    })
  );
});
