/* Goods · Panel — service worker
   Liviano y respetuoso con la privacidad:
   - Solo guarda la "cáscara" del panel (la página y los íconos) para que abra rápido
     y muestre un aviso si no hay señal.
   - NUNCA guarda turnos, nombres, teléfonos ni montos: las consultas a la base de datos
     (otro dominio) no pasan por acá.
   - Siempre intenta la versión más nueva primero; lo guardado se usa solo sin conexión.
   - Al publicar una versión nueva se borra lo guardado de la anterior. */
const CACHE = 'goods-panel-v1';
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
