const CACHE = 'derivacion-v2';
// Rutas relativas: el sitio vive en /derivacion-red/, no en la raíz del dominio
const ARCHIVOS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Primero la red (datos siempre al día); la copia guardada solo se usa sin conexión
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sin el ?v=... para no acumular una copia de reglas.xlsx por cada visita
  const clave = url.origin === location.origin ? url.origin + url.pathname : req.url;
  e.respondWith(fetch(req).then(resp => {
    if (resp && resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(clave, clone));
    }
    return resp;
  }).catch(() => caches.match(clave).then(r =>
    r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
