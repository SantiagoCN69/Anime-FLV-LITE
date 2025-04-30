const CACHE_NAME = 'anime-flv-lite-v4';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/anime.html',
    '/ver.html'
];

self.addEventListener('install', (event) => {
    // Forzar la activación inmediata del nuevo service worker
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Eliminar cachés que no sean la versión actual
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Devolver respuesta en caché o hacer fetch
                return response || fetch(event.request);
            })
    );
});
