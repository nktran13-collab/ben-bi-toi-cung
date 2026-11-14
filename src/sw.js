// Service Worker for "Bền bỉ tới cùng" (Persistence To The End)
// Workbox injectManifest build: the precache list below is filled in at build time.

const manifestEntries = self.__WB_MANIFEST || [];
const manifestPaths = manifestEntries.map((entry) => new URL(entry.url, self.location.href).pathname);

function shortHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (Math.imul(hash, 31) + input.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

const BUILD_ID = shortHash(manifestPaths.slice().sort().join('|'));
const SHELL_CACHE = `ben-bi-shell-${BUILD_ID}`;
const FONT_CACHE = 'ben-bi-fonts-v1';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-192x192.png',
  '/maskable-512x512.png',
  '/apple-touch-icon.png',
];

const PRECACHE_URLS = [...new Set([...PRECACHE_ASSETS, ...manifestPaths])];
const PRECACHED_PATHS = new Set(PRECACHE_URLS);

function canCache(response) {
  return (
    response.status === 200 &&
    !response.redirected &&
    !/(?:^|,)\s*(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') || '')
  );
}

async function fetchInto(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (!canCache(response)) return null;
    await cache.put(url, response.clone());
    return response;
  } catch (err) {
    console.warn('[SW] Precache fetch failure:', url, err);
    return null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(PRECACHE_URLS.map((url) => fetchInto(cache, url)));
      await self.skipWaiting();
    })().catch((err) => console.warn('[SW] Precache failed:', err)),
  );
});

// Activate: delete only this app's older shell caches, keep fonts and other apps' caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) => /^ben-bi-cache-v\d+$/.test(name) || (name.startsWith('ben-bi-shell-') && name !== SHELL_CACHE),
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Google Fonts: cache-first at runtime so typography survives offline after the first visit.
  const isFontCss = url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css2');
  const isFontFile = url.hostname === 'fonts.gstatic.com';
  if (req.method === 'GET' && (isFontCss || isFontFile)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONT_CACHE);
        const cached = await cache.match(req);
        const refresh = fetch(req).then(async (response) => {
          // no-cors stylesheet/font responses are opaque (status 0) but still usable.
          if (response.ok || response.type === 'opaque') {
            try {
              await cache.put(req, response.clone());
            } catch (err) {
              console.warn('[SW] Font cache write failure:', err);
            }
          }
          return response;
        });
        if (cached) {
          event.waitUntil(refresh.catch(() => {}));
          return cached;
        }
        return refresh;
      })(),
    );
    return;
  }

  // Private/API requests and development modules must go straight to the network.
  // Query-bearing URLs may contain auth codes or Vite import/HMR parameters.
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !/^https?:$/.test(url.protocol) ||
    req.headers.has('Authorization') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.search ||
    /^\/(?:@vite|@id|@fs|@react-refresh|__vite_ping|__open-in-editor|src|node_modules)(?:\/|$)/.test(url.pathname) ||
    /\.(?:tsx?|jsx)$/.test(url.pathname)
  ) {
    return;
  }

  const isShell = url.pathname === '/' || url.pathname === '/index.html';
  const isNavigation = req.mode === 'navigate';
  const isStaticAsset =
    PRECACHED_PATHS.has(url.pathname) ||
    /^\/assets\/.+\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i.test(url.pathname) ||
    /^\/icons\/.+\.(?:png|jpe?g|svg|webp|ico)$/i.test(url.pathname);

  // Do not cache arbitrary same-origin endpoints, even if they return HTTP 200.
  if (!isNavigation && !isShell && !isStaticAsset) return;

  // Always refresh the shell online. Only canonical shell URLs can update '/';
  // other navigations may fall back to it but must never persist private HTML.
  if (isNavigation || isShell) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          if (isShell && canCache(response)) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put('/', response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cachedRoot = await cache.match('/', { ignoreVary: true });
          return (
            cachedRoot ||
            new Response('Ứng dụng Bền Bỉ đang ngoại tuyến.', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // Allowlisted public assets: stale-while-revalidate in this build's shell cache.
  const networkResponse = fetch(req).then(async (response) => {
    if (canCache(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(req, response.clone());
    }
    return response;
  });
  event.waitUntil(networkResponse.catch(() => {}));
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Install-time fetches carry no Origin header, while page module requests do;
      // with `Vary: Origin` (Vercel/Vite) a plain match would miss. Vary is irrelevant here.
      const cached = await cache.match(req, { ignoreVary: true });
      return cached || networkResponse;
    })(),
  );
});

// Web Push event listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'Bền bỉ tới cùng',
    body: 'Đến giờ duy trì chuỗi kỷ luật hàng ngày của bạn!',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: 'ben-bi-reminder',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'ben-bi-reminder',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Mở ứng dụng' },
      { action: 'close', title: 'Để sau' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
