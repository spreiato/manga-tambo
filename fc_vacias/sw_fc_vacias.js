const CACHE_NAME = 'fc-vacias-v1';
const urlsToCache = [
  './index_fc_vacias.html',
  './manifest_fc_vacias.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
