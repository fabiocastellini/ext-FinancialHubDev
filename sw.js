// Financial Hub — Service Worker
const CACHE = 'fh-v1';
const ASSETS = ['./'];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache for navigation
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Safely get origin from self.location (if browser) or from the request itself (if Cloudflare Worker)
  const currentOrigin = self.location ? self.location.origin : url.origin;

  // Only handle same-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;

  // For API calls (Supabase) — always network, never cache
  if (e.request.url.includes('supabase.co') || e.request.url.includes('coingecko') || e.request.url.includes('yahoo')) return;

  // For navigation (HTML) — network first, cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('./') || caches.match(e.request))
    );
    return;
  }

  // For other assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
