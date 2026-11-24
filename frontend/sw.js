const CACHE = 'umoja-chama-v4';
const ASSETS = [
  './', 'index.html', 'app.html', 'css/style.css', 'css/app.css', 'icon.svg', 'manifest.webmanifest',
  'js/config.js', 'js/api.js', 'js/ui.js', 'js/charts.js', 'js/core.js', 'js/app.js',
  ...['dashboard', 'members', 'contributions', 'loans', 'repayments', 'expenses', 'fines', 'meetings', 'reports', 'notifications', 'settings']
    .map(v => `js/views/${v}.js`),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates show up, cache as offline fallback.
self.addEventListener('fetch', e => {
  // Only cache the app's own files. API calls go to the backend and must never be served stale.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
