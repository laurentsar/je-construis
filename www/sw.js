/* Je Construis — service worker. L'app est entièrement hors ligne : tout le
   shell est mis en cache, et rien n'a besoin du réseau (seule la vérification
   de mise à jour interroge GitHub, et elle échoue silencieusement). */
const CACHE = 'je-construis-v1.3';
const SHELL = [
  'index.html', 'styles.css', 'app.js', 'calc.js', 'plans.js', 'steps.js',
  'steps_gemma.js',
  'update-check.js', 'autobackup.js', 'manifest.webmanifest',
  'img/icon-192.png', 'img/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API GitHub (mise à jour) et Home Assistant (sauvegarde) : jamais de cache.
  if (url.hostname.includes('api.github.com') || url.port === '8123') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
