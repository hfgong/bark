// sw.js - Bark Service Worker for offline use.
// Network-first: when online every load gets the latest files (so a normal refresh picks up
// new deploys); the cache is the fallback when offline. All sounds are precached at install.

const CACHE_NAME = 'bark-v5';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './sounds/sounds.json',
  './sounds/debug_test_beep.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // cache: 'reload' bypasses the browser HTTP cache so stale copies are never stored.
    const fresh = (url) => new Request(url, { cache: 'reload' });
    await cache.addAll(PRECACHE_ASSETS.map(fresh));
    const bank = await (await cache.match('./sounds/sounds.json')).json();
    await cache.addAll(bank.flatMap((sound) => sound.files).map((file) => fresh(`./${file}`)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Serve a byte range from a cached response (Safari requests audio with Range headers).
async function rangeResponse(cached, rangeHeader) {
  const arrayBuffer = await cached.arrayBuffer();
  const total = arrayBuffer.byteLength;
  const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
  const start = matches ? parseInt(matches[1], 10) : 0;
  const end = matches && matches[2] ? parseInt(matches[2], 10) : total - 1;
  if (start >= total || end >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  const sliced = arrayBuffer.slice(start, end + 1);
  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': sliced.byteLength,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const rangeHeader = request.headers.get('range');
  event.respondWith((async () => {
    try {
      // cache: 'no-cache' revalidates with the server (cheap 304 when unchanged).
      const response = await fetch(request, rangeHeader ? undefined : { cache: 'no-cache' });
      if (response.ok && response.status === 200 && !rangeHeader) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached && rangeHeader) return rangeResponse(cached, rangeHeader);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
