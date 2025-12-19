const CACHE_NAME = 'bomberos-v8';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './manifest.json',
  './images/icon-192.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

/// Estrategia: Caché con actualización en segundo plano (Stale-while-revalidate)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Si está en caché, la devolvemos inmediatamente para que la app vuele
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // IMPORTANTE: Comprobar que la respuesta sea válida antes de cachear
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone(); // CLONAMOS PRIMERO
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache); // GUARDAMOS EL CLON
          });
        }
        return networkResponse; // DEVOLVEMOS LA ORIGINAL
      }).catch(() => {
        // Si falla la red (offline total) no pasa nada, ya devolvimos la caché arriba
      });

      return cachedResponse || fetchPromise;
    })
  );
});
