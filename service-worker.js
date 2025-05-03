const CACHE_NAME = 'mi-cache-v1'; // Cambia la versión para forzar limpieza
const ARCHIVOS_CACHE = [
  '/', // agrega aquí tus rutas y archivos
  '/index.html',
  '/styles.css',
  '/script.js',
  '/logo.png',
];

// Instala y guarda archivos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARCHIVOS_CACHE);
    })
  );
});

// Activa y elimina caches antiguos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Intercepta peticiones
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
