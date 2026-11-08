/* Goods · Panel — service worker
   Rápido y respetuoso con la privacidad:
   - Guarda solo la "cáscara" del panel: la página, las letras, la librería de la base de datos,
     los íconos y las fotos de fondo. Así la app abre al instante, aunque la señal sea mala.
   - NUNCA guarda turnos, nombres, teléfonos ni montos: las consultas a la base de datos
     (otro dominio) no pasan por acá y siempre llegan frescas.
   - La página se muestra al toque desde lo guardado y, al mismo tiempo, se baja la versión
     nueva si la hay: la próxima vez que se abra ya está actualizada.
   - Al publicar una versión nueva de este archivo se borra lo guardado de la anterior. */
const CACHE = 'goods-panel-v4';
const SHELL = [
  '/panel',
  '/app/lib/supabase-2.119.0.js',
  '/app/fonts/manrope-latin.woff2',
  '/app/fonts/jetbrainsmono-latin.woff2',
  '/app/fonts/baloo2-latin.woff2',
  '/app/icon-192.png',
  '/app/apple-touch-icon.png',
  '/app/panel.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// la página del panel: lo guardado al instante, y se actualiza por detrás
function panelPage(e){
  const fresh = fetch(e.request, { cache: 'no-store' }).then(res => {
    if (res && res.ok && !res.redirected) caches.open(CACHE).then(c => c.put('/panel', res.clone()));
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  return caches.match('/panel').then(hit => hit || fresh).catch(() => fresh);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // base de datos y todo lo de afuera: directo a internet
  if (req.mode === 'navigate'){
    if (url.pathname === '/panel' || url.pathname === '/panel.html') e.respondWith(panelPage(e));
    return;
  }
  if (url.pathname.startsWith('/app/')){
    // íconos, letras, librerías y fotos: no cambian de nombre sin cambiar de versión, se guardan la primera vez
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
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
