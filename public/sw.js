/* Einfacher Service Worker für die statischen Dateien.
   Netz zuerst, damit ein Update sofort ankommt; der Cache springt nur ohne Verbindung ein.
   Alles unter /api geht immer direkt ans Netz und wird nie zwischengespeichert. */
const CACHE = 'pizza_app-v8';
const STATISCH = [
  '/', '/app.css', '/app.js', '/calc.js', '/manifest.webmanifest',
  '/fonts/bricolage-grotesque.woff2', '/fonts/instrument-sans.woff2',
  '/img/kopf.webp', '/img/siegel.webp', '/img/icon-192.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(STATISCH)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;
  // cache: 'no-cache' prüft jede Datei beim Server nach, auch wenn ein Proxy dem Browser eine längere Haltezeit vorgibt
  const ausCache = () => caches.match(ev.request, {ignoreSearch: true});
  ev.respondWith(
    fetch(ev.request, ev.request.mode === 'navigate' ? {} : {cache: 'no-cache'}).then(async res => {
      if (res.ok) { const kopie = res.clone(); caches.open(CACHE).then(c => c.put(ev.request, kopie)); }
      // Steht nur der Server still, antwortet der Proxy davor mit einer Fehlerseite: auch dann die gemerkte Datei nehmen
      return res.status >= 500 ? (await ausCache()) || res : res;
    }).catch(() => ausCache().then(r => r || Response.error()))
  );
});
