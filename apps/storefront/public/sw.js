const CACHE = 'hetna-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Solo cachea archivos estáticos (rápido y sin datos desactualizados de carrito/cuenta)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(png|jpg|jpeg|webp|avif|svg|woff2)$/.test(url.pathname);
  if (!isStatic) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
