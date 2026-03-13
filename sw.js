// ============================================================
//  HOGAR & FINANZAS — Service Worker
//  Estrategia: Cache-first para el shell, Network-only para la API
// ============================================================

const CACHE_NAME = 'hogar-finanzas-v1';

// Recursos del shell de la app que se cachean al instalar
const SHELL_URLS = [
  './app_gastos.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  // Google Fonts — se cachean en runtime
];

// ── INSTALL: cachear el shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés antiguas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según el tipo de petición ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Llamadas a Google Apps Script (API JSONP) → siempre network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Google Fonts → Cache-first con fallback network
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // 3. App shell (HTML, iconos, manifest) → Cache-first
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => {
          // Si es navegación y no hay red → devolver el HTML cacheado
          if (event.request.mode === 'navigate') {
            return cache.match('./app_gastos.html');
          }
        });
      })
    )
  );
});
