const CACHE_NAME = 'bomberos-v11';
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
  // FILTRO CRÍTICO: Ignorar extensiones de Chrome y otros protocolos no estándar
  if (!(event.request.url.indexOf('http') === 0)) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Comprobar que la respuesta sea válida y de protocolo seguro
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silenciar errores de red para evitar ruido en consola si estamos offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});



