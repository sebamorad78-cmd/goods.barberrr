/* Goods · Panel — service worker
   Liviano y respetuoso con la privacidad:
   - Solo guarda la "cáscara" del panel (la página y los íconos) para que abra rápido
     y muestre un aviso si no hay señal.
   - NUNCA guarda turnos, nombres, teléfonos ni montos: las consultas a la base de datos
     (otro dominio) no pasan por acá.
   - Siempre intenta la versión más nueva primero; lo guardado se usa solo sin conexión.
   - Al publicar una versión nueva se borra lo guardado de la anterior. */
const CACHE = 'goods-panel-v3';
const SHELL = ['/panel', '/app/icon-192.png', '/app/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // base de datos, fuentes, etc.: directo a internet
  if (req.mode === 'navigate'){
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      if (res.ok) caches.open(CACHE).then(c => c.put('/panel', copy));
      return res;
    }).catch(() => caches.match('/panel')));
    return;
  }
  if (url.pathname.startsWith('/app/')){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});

// Avisos de turnos: llegan desde el servidor y se muestran como notificación
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch(_) { d = { title: 'Goods', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Goods · Turnos', {
    body: d.body || '', tag: d.tag, icon: '/app/icon-192.png', badge: '/app/icon-192.png', data: { url: d.url || '/panel' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/panel';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list){ if (c.url.includes('/panel')) { c.focus(); c.postMessage('refrescar'); return; } }
    return self.clients.openWindow(url);
  }));
});
