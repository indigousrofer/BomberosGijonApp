/* =========================================================
   Service Worker - Bomberos Gijon App
   - Un solo sistema de versiones: CACHE_NAME
   - Updates robustos: WAITING -> (mensaje SKIP_WAITING) -> ACTIVATE
   ========================================================= */

// 1) Sube este número SOLO cuando publiques una versión nueva
const CACHE_NAME = 'bomberos-v81';

// 2) Solo los “core assets” imprescindibles (app shell)
// OJO: si tu app vive bajo /BomberosGijonApp/ usa rutas coherentes con eso.
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './calendar.js',
  './admin.js',
  './ranking.js',
  './app_register_helper.js',
  './manifest.json',
  './images/icon-192.png',
  './images/favicon.png',
];

// ---------------------------------------------------------
// INSTALL: precache del app shell
// ---------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  // Fuerza la activación inmediata (útil en desarrollo/fix rápido)
  self.skipWaiting();
});

// ---------------------------------------------------------
// ACTIVATE: limpieza de caches antiguas + claim
// ---------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------
// MESSAGE: permitir activar cuando el usuario lo pide
// ---------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------
// FETCH: cache-first para navegación y assets
// ---------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Ignora requests no-http(s)
  if (!event.request.url.startsWith('http')) return;

  const req = event.request;

  // Navegación (index.html) → cache-first con fallback a network
  if (req.mode === 'navigate') {
    const url = new URL(req.url);
    const last = url.pathname.split('/').pop() || '';
    const hasExt = /\.[a-zA-Z0-9]+$/.test(last);

    // Si es un archivo real (.pdf, .jpg, etc), dejamos pasar la navegación normal
    if (hasExt && !last.endsWith('.html')) {
      event.respondWith(fetch(req));
      return;
    }

    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch('./index.html'))
    );
    return;
  }

  // Resto → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cachea solo respuestas válidas (status 200)
          // Así evitamos guardar 404 u otros errores
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => { });
          }

          return res;
        })
        .catch(() => cached); // fallback “best effort”
    })
  );
});





















