// sw.js - Bark Service Worker for 100% Offline PWA Experience

const CACHE_NAME = 'bark-v1.0.0';

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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache newly fetched valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
