/* Service worker: HTML sempre da rede (com cache de reserva), resto cache-first */
const CACHE = 'remover-fundos-v2'; // troque o número a cada deploy
const ASSETS = ['./', './index.html', './css/style.css', './js/app.js', './img/icon.png', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(self.location.origin)) return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(r, copy));
        return res;
      }).catch(() => caches.match(r).then((h) => h || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(r, copy));
      return res;
    }))
  );
});
