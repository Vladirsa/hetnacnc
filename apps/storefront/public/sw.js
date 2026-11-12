const CACHE = 'hetna-static-v1';
// v2: vibración y número de avisos sin abrir en el ícono
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

// ── Notificaciones al celular (packages/api/src/lib/push.ts) ──────────────
// Número en el ícono de HETNA (celular o computadora) = avisos sin abrir.
// Donde el sistema no lo permite (algunos Android), no pasa nada.
const contarSinAbrir = () =>
  self.registration.getNotifications().then((n) => {
    if (!self.navigator || !('setAppBadge' in self.navigator)) return;
    return n.length ? self.navigator.setAppBadge(n.length) : self.navigator.clearAppBadge();
  }).catch(() => undefined);

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'HETNA CNC';
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: d.cuerpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.etiqueta || undefined,
      renotify: !!d.etiqueta,
      data: { url: d.url || '/' },
      lang: 'es-MX',
      // Vibra al llegar (donde el celular lo permite)
      vibrate: [200, 100, 200],
    }).then(contarSinAbrir)
  );
});

// Si la persona descarta el aviso, también baja el número
self.addEventListener('notificationclose', (e) => e.waitUntil(contarSinAbrir()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    contarSinAbrir().then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url === url && 'focus' in v) return v.focus();
      }
      return self.clients.openWindow(url);
    }))
  );
});
