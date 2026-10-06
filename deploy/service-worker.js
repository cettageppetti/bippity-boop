const CACHE = 'bippity-boop-v32';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './game-engine.mjs',
  './profile.mjs',
  './confetti.mjs',
  './pwa.mjs',
  './audio.mjs',
  './ui.mjs',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('bippity-boop-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Live development must always use current files instead of cached releases.
  if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(self.registration.scope).hostname)) return;
  const url = new URL(event.request.url);
  const assetURLs = ASSETS.map(asset => new URL(asset, self.registration.scope).href);
  if (!assetURLs.includes(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        try {
          await cache.put(event.request, response.clone());
        } catch {
          // A cache write failure must not prevent a successful network response.
        }
      }
      return response;
    } catch {
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
