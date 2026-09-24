// sw.js - Bark Service Worker for 100% Offline PWA Experience

const CACHE_NAME = 'bark-v1.0.2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './favicon.svg',
  './sounds/dog_big_bark.mp3',
  './sounds/dog_guard_barks.mp3',
  './sounds/dog_angry.mp3',
  './sounds/dog_small_poodle.mp3',
  './sounds/dog_dachshund.mp3',
  './sounds/dog_alert.mp3',
  './sounds/dog_playful.mp3',
  './sounds/dog_wolf_howl.mp3',
  './sounds/debug_test_beep.mp3',
  './sounds/cat_classic_meow.mp3',
  './sounds/cat_kitten_squeak.mp3',
  './sounds/cat_gentle_purr.mp3',
  './sounds/cat_angry_hiss.mp3',
  './sounds/cat_hungry_demand.mp3',
  './sounds/cat_chirp_trill.mp3',
  './sounds/cat_dramatic_yowl.mp3',
  './sounds/cat_door_greeting.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const rangeHeader = event.request.headers.get('range');

  // Handle Safari Range requests (HTTP 206 Partial Content) for audio
  if (rangeHeader && (url.pathname.endsWith('.mp3') || url.pathname.includes('/sounds/'))) {
    event.respondWith(
      caches.match(event.request.url, { ignoreSearch: true }).then(async (cachedResponse) => {
        if (!cachedResponse) {
          return fetch(event.request);
        }

        const arrayBuffer = await cachedResponse.arrayBuffer();
        const total = arrayBuffer.byteLength;
        const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);

        let start = 0;
        let end = total - 1;

        if (matches) {
          start = parseInt(matches[1], 10);
          if (matches[2]) {
            end = parseInt(matches[2], 10);
          }
        }

        if (start >= total || end >= total) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${total}` }
          });
        }

        const slicedBuffer = arrayBuffer.slice(start, end + 1);
        return new Response(slicedBuffer, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': slicedBuffer.byteLength,
            'Accept-Ranges': 'bytes'
          }
        });
      })
    );
    return;
  }

  // Standard Cache-First strategy for general assets
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
