/* SoundMyth service worker — minimal & conservative.
 * - App shell (navigations): NETWORK-FIRST so a new deploy always lands; cache only as
 *   an offline fallback (never serves stale HTML while online).
 * - Same-origin static assets + Google Fonts: cache-first (fast, offline).
 * - Everything else (Supabase API, Unsplash, TheAudioDB…): untouched → normal network.
 */
const CACHE = 'soundmyth-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App shell → network-first (fresh on every load), cache fallback when offline
  if (url.origin === location.origin && (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('/', cp)); return r; })
        .catch(() => caches.match('/').then(m => m || caches.match('/index.html')))
    );
    return;
  }

  // Same-origin static (favicon, manifest) + Google Fonts → cache-first
  if (url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then(m => m || fetch(req).then(r => {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return r;
      }))
    );
  }
  // else: default network (Supabase, image hosts, etc.)
});
