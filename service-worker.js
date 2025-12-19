const CACHE_NAME = 'bomberos-v30'; // Versión actualizada
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './manifest.json',
  './images/icon-192.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Fuerza la instalación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name); // Limpia versiones viejas
        })
      );
    })
  );
  return self.clients.claim(); // Toma el control de la app de inmediato
});

self.addEventListener('fetch', event => {
  if (!(event.request.url.indexOf('http') === 0)) return;
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});




















