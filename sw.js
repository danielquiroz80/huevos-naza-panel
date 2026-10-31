// Service worker mínimo: guarda la "cáscara" de la app para que abra rápido e instalable.
// Los datos siempre se piden en vivo a Supabase (nunca se guardan en caché).
const CACHE = 'naza-panel-v10';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'js/app.js', 'js/lib.js', 'js/ui.js', 'js/bio.js', 'js/mapa.js',
  'assets/logo.png', 'assets/icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Red primero, caché como respaldo (así cada publicación nueva se ve de inmediato).
  e.respondWith(
    fetch(e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' }))
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
