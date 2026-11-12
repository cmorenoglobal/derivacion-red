// Red primero: siempre intenta traer la versión publicada y usa la caché solo sin conexión.
const CACHE = 'derivacion-v2';
const BASE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Se guarda sin parámetros (?v=...) para no acumular copias de reglas.xlsx
  const clave = url.origin === location.origin ? url.origin + url.pathname : e.request.url;
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(clave, copia));
      }
      return resp;
    }).catch(() =>
      caches.match(clave).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});
