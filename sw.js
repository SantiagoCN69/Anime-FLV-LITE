
const CACHE_VERSION = 'v8.6.1';

const STATIC_CACHE = `anizenlite-static-${CACHE_VERSION}`;
const PAGE_CACHE = `anizenlite-pages-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';


// ─────────────────────────────────────────────
// RECURSOS ESTÁTICOS
// ─────────────────────────────────────────────

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/anime.html',
  '/directorioav1.html',
  '/directoriojk.html',
  '/horarios.html',
  '/lab.html',
  '/populares.html',

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

  '/img/loading.png',
  '/img/cat.png',
  '/icons/eye-solid.svg',
  '/icons/eye-slash-solid.svg',
];

// ─────────────────────────────────────────────
// INSTALACIÓN
// ─────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando:', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precargando recursos estáticos');

        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Instalación completada');

        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error durante instalación:', error);

        throw error;
      })
  );
});

// ─────────────────────────────────────────────
// ACTIVACIÓN
// ─────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== PAGE_CACHE
            ) {
              console.log('[SW] Eliminando cache:', cacheName);

              return caches.delete(cacheName);
            }

            return null;
          })
        );
      })
      .then(() => {
        console.log('[SW] Activación completada');

        return self.clients.claim();
      })
  );
});

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Solo HTTP/HTTPS
  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:'
  ) {
    return;
  }

  // ───────────────────────────────────────────
  // 1. VÍDEOS / MEDIA
  // ───────────────────────────────────────────
  //
  // No cachear vídeos.
  //
  // Esto evita llenar la caché con archivos grandes
  // y permite que Range Requests funcionen normalmente.

  if (
    request.destination === 'video' ||
    request.destination === 'audio' ||
    request.headers.has('range') ||
    /\.(mp4|mkv|webm|m3u8|ts)(\?|$)/i.test(url.pathname)
  ) {
    return;
  }

  // ───────────────────────────────────────────
  // 2. FIREBASE / APIs EXTERNAS
  // ───────────────────────────────────────────
  //
  // No interceptar APIs ni Firebase.
  //
  // La aplicación siempre obtiene los datos
  // directamente desde la red.

  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // Requests cross-origin:
  // no almacenarlos en nuestra caché.
  if (url.origin !== self.location.origin) {
    return;
  }

  // ───────────────────────────────────────────
  // 3. NAVEGACIÓN / HTML
  // ───────────────────────────────────────────

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstPage(request)
    );

    return;
  }

  // ───────────────────────────────────────────
  // 4. RECURSOS ESTÁTICOS
  // ───────────────────────────────────────────

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      staleWhileRevalidate(request)
    );

    return;
  }

  // ───────────────────────────────────────────
  // 5. RESTO DE RECURSOS DEL MISMO DOMINIO
  // ───────────────────────────────────────────

  event.respondWith(
    networkFirst(request)
  );
});

// ─────────────────────────────────────────────
// NETWORK FIRST — PÁGINAS
// ─────────────────────────────────────────────

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type === 'basic'
    ) {
      const cache = await caches.open(PAGE_CACHE);

      await cache.put(
        request,
        response.clone()
      );
    }

    return response;

  } catch (error) {
    console.log('[SW] Offline:', request.url);

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no existe la página solicitada,
    // utilizar index.html como fallback.
    const offlineResponse = await caches.match(
      OFFLINE_URL
    );

    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response(
      'Sin conexión',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }
    );
  }
}

// ─────────────────────────────────────────────
// NETWORK FIRST — RECURSOS
// ─────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type === 'basic'
    ) {
      const cache = await caches.open(PAGE_CACHE);

      await cache.put(
        request,
        response.clone()
      );
    }

    return response;

  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      'Recurso no disponible offline',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      }
    );
  }
}

// ─────────────────────────────────────────────
// STALE WHILE REVALIDATE
// ─────────────────────────────────────────────
//
// Devuelve inmediatamente la versión cacheada
// mientras actualiza la caché en segundo plano.
//
// Ideal para CSS, JS e imágenes.

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);

  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (
        response &&
        response.ok &&
        response.type === 'basic'
      ) {
        cache.put(
          request,
          response.clone()
        );
      }

      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkFetch;

  if (networkResponse) {
    return networkResponse;
  }

  // Placeholder para imágenes
  if (request.destination === 'image') {
    const loading = await caches.match(
      '/img/loading.png'
    );

    if (loading) {
      return loading;
    }
  }

  return new Response(
    'Recurso no disponible offline',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    }
  );
}

// ─────────────────────────────────────────────
// BACKGROUND SYNC
// ─────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  console.log(
    '[SW] Background Sync:',
    event.tag
  );

  // Aquí puedes implementar posteriormente
  // sincronización de datos pendientes.
});

// ─────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido');

  let data = {
    title: 'AniZen',
    body: 'Nueva notificación',
    url: '/'
  };

  try {
    if (event.data) {
      const payload = event.data.json();

      data = {
        ...data,
        ...payload
      };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon3.png',
    badge: '/icons/icon3.png',

    vibrate: [100, 50, 100],

    data: {
      url: data.url,
      dateOfArrival: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title,
      options
    )
  );
});

// ─────────────────────────────────────────────
// CLICK EN NOTIFICACIÓN
// ─────────────────────────────────────────────

self.addEventListener(
  'notificationclick',
  (event) => {
    console.log(
      '[SW] Notificación clickeada'
    );

    event.notification.close();

    const targetUrl =
      event.notification.data?.url || '/';

    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then((clientList) => {

        // Si la aplicación ya está abierta,
        // reutilizar la ventana.
        for (const client of clientList) {
          if (
            'focus' in client &&
            client.url.startsWith(
              self.location.origin
            )
          ) {
            return client.navigate(targetUrl)
              .then(() => client.focus());
          }
        }

        // Si no está abierta, crear ventana.
        if (clients.openWindow) {
          return clients.openWindow(
            targetUrl
          );
        }
      })
    );
  }
);

