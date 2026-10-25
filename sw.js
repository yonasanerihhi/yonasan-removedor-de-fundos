/* Service worker: sempre tenta a rede primeiro (site sempre atualizado) e usa o cache só se estiver offline */
const CACHE = 'remover-fundos-v4'; // troque o número a cada deploy
const ASSETS = ['./', './index.html', './css/style.css', './js/app.js', './img/icon.png', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })).catch(() => {}))))
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
  e.respondWith(
    fetch(r, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(r, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(r).then((hit) => hit || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});
