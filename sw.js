// Service worker : rend l'application utilisable hors ligne une fois installée.
// Stratégie : réponse immédiate depuis le cache, puis mise à jour en arrière-plan (visible au lancement suivant).
// Les appels à l'API GitHub (synchronisation) ne passent jamais par le cache.
const CACHE = 'organise-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/dates.js', 'js/model.js', 'js/core.js', 'js/sync.js', 'js/views.js', 'js/peek.js', 'js/app.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
];
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin && !FONTS.includes(url.origin)) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    // Les adresses avec #route ou ?param pointent toutes vers la même page.
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const cached = await cache.match(key);
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { e.waitUntil(fresh); return cached; }
    return fresh;
  }));
});
