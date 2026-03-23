const CACHE = 'lightplayer-v1';
const PRECACHE = [
  './lightplayer.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/icecast-metadata-player@latest/build/icecast-metadata-player.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache audio streams or Radio Browser API calls
  if (
    url.hostname.includes('radio-browser.info') ||
    e.request.headers.get('range') ||
    e.request.destination === 'audio'
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for app shell and CDN assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
