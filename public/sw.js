// Dads Army offline support: the app opens with no signal (e.g. at the rink) from what it last downloaded.
// Pages load fresh when online so updates arrive straight away; the hashed build files and fonts come from the
// cache.
const CACHE = 'dads-army-v4';
const SHELL = ['./', './logo.svg', './logo.webp', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png', './favicon-48.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (request, response) => {
  if (response.ok || response.type === 'opaque') {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // The page itself: the newest from the network, or the last one saved when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => put('./', response))
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Build files never change once published (their names change instead), so the cache is always right.
  if (sameOrigin && url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => put(request, response))));
    return;
  }

  // Fonts, logo and icons: answer from the cache and refresh it in the background.
  if (sameOrigin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(hit => {
        const fresh = fetch(request)
          .then(response => put(request, response))
          .catch(() => hit);
        return hit || fresh;
      })
    );
  }
});
