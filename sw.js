const CACHE_NAME = 'anizenlite-v7.0.0';
const OFFLINE_URL = '/index.html';

// Recursos estáticos para cachear inmediatamente
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/anime.html',
  '/directorioav1.html',
  '/directoriojk.html',
  '/horarios.html',
  '/lab.html',
  '/populares.html',
  '/ver.html',
  '/manifest.json',
  '/styles/style.css',
  '/styles/style_index.css',
  '/styles/style_anime.css',
  '/styles/style_ver.css',
  '/scripts/tema.js',
  '/scripts/utils.js',
  '/scripts/firebase-login.js',
  '/scripts/index.js',
  '/scripts/header.js',
  '/scripts/sidebar.js',
  '/scripts/anime.js',
  '/scripts/directorioav1.js',
  '/scripts/directoriojk.js',
  '/scripts/horarios.js',
  '/scripts/lab.js',
  '/scripts/populares.js',
  '/scripts/ver.js',
  '/scripts/ai-recommendations.js',
  '/icons/icon3.png',
  '/icons/ogimagen.png',
  '/icons/icon.png',
  '/icons/icon2.png',
  '/img/loading.png'
];

// Evento de instalación del service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando recursos estáticos');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] Instalación completada');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Error durante la instalación:', error);
      })
  );
});

// Evento de activación del service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Eliminar caches antiguos
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activación completada');
        return self.clients.claim();
      })
  );
});

// Estrategia de caché: Network First con fallback al cache
self.addEventListener('fetch', (event) => {
  // Solo interceptar solicitudes GET
  if (event.request.method !== 'GET') return;

  // Ignorar solicitudes de extensiones y protocolos especiales
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Verificar si la respuesta es válida
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clonar la respuesta para poder usarla
        const responseToCache = response.clone();

        // Cachear la respuesta para futuras solicitudes
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Si falla la red, intentar obtener del cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Si no está en el cache, devolver la página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }

            // Para imágenes, intentar devolver una imagen placeholder
            if (event.request.destination === 'image') {
              return new Response('Placeholder', { status: 503 });
            }

            return new Response('Servicio no disponible offline', { status: 503 });
          });
      })
  );
});

// Sincronización en segundo plano para cuando se recupera la conexión
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sincronización en segundo plano:', event.tag);
  // Aquí puedes implementar lógica de sincronización
  // Por ejemplo, enviar datos guardados localmente cuando se recupera la conexión
});

// Manejo de notificaciones push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Notificación push recibida');
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/icons/icon3.png',
    badge: '/icons/icon3.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Anime Lite', options)
  );
});

// Manejo de clic en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificación clickeada');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});