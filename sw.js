// rescue-gacha-v6
// Estrategia:
// - HTML → siempre desde la red (nunca cacheado)
// - Assets estáticos (imágenes, fuentes) → cache-first
// - Backend y APIs externas → nunca interceptados

const CACHE   = 'rescue-gacha-v6';
const STATIC  = ['/icon.jpg', '/logo.jpg', '/manifest.json'];

// Al instalar: cachear solo assets estáticos, NO el HTML
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        STATIC.map(url =>
          fetch(url).then(r => { if(r.ok) cache.put(url, r); }).catch(()=>{})
        )
      )
    )
  );
  self.skipWaiting(); // activar inmediatamente sin esperar
});

// Al activar: eliminar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. Nunca interceptar peticiones a otros dominios (backend, APIs, fuentes de Google)
  if (url.hostname !== self.location.hostname) return;

  // 2. Nunca interceptar métodos que no sean GET
  if (e.request.method !== 'GET') return;

  const path = url.pathname;

  // 3. HTML principal → siempre red, nunca caché
  //    Así las actualizaciones se ven inmediatamente sin limpiar caché
  if (path === '/' || path.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request)) // fallback a caché solo si no hay red
    );
    return;
  }

  // 4. Assets estáticos → cache-first (imágenes, manifest)
  if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|json|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 5. Todo lo demás → directo a la red sin cachear
});
