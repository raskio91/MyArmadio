// Permette di usare l'app anche senza connessione.
// Aumenta VERSION a ogni aggiornamento: al prossimo avvio l'app scarica i file nuovi.
const VERSION = 'armadio-v1';
const FILES = [
  './', './index.html', './style.css', './app.js', './db.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './fonts/figtree-400.woff2', './fonts/figtree-600.woff2',
  './fonts/familjen-grotesk-600.woff2', './fonts/familjen-grotesk-700.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rete prima, copia locale se offline: così gli aggiornamenti arrivano subito.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
