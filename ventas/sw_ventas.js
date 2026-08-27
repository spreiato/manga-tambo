const CACHE_NAME = 'ventas-tambo-v3';
const ASSETS = [
  './ventas.html',
  './manifest_ventas.json',
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
  // Solo interceptamos peticiones GET (archivos visuales/estáticos)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devuelve el archivo desde el celular de inmediato
        // En segundo plano busca si hay una versión más nueva en la red para la próxima vez
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Sin señal, no hace nada */});

        return cachedResponse;
      }
      // Si por alguna razón no está en caché, va a la red
      return fetch(e.request);
    })
  );
});