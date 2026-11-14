// Service Worker for "Bền bỉ tới cùng" (Persistence To The End)
// Public shell/asset caching, Web Push & Notification handling

const CACHE_VERSION = 4;
const CACHE_NAME = `ben-bi-cache-v${CACHE_VERSION}`;
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-192x192.png',
  '/maskable-512x512.png',
  '/apple-touch-icon.png'
];

function canCache(response) {
  return response.status === 200 && !response.redirected &&
    !/(?:^|,)\s*(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') || '');
}

async function storeResponse(key, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, response);
  } catch (err) {
    // A storage failure must not replace a successful network response.
    console.warn('[SW] Cache write failure:', err);
  }
}

// Install: precache the public shell, then the hashed build assets it references,
// so the very first offline launch after install still renders the app.
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponses = new Map();

  await Promise.all(PRECACHE_ASSETS.map(async (asset) => {
    try {
      const response = await fetch(asset, { cache: 'reload' });
      if (!canCache(response)) return;
      await cache.put(asset, response.clone());
      shellResponses.set(asset, response);
    } catch (err) {
      console.warn('[SW] Precache asset fetch failure:', err);
    }
  }));

  const root = shellResponses.get('/');
  if (!root) return;

  const html = await root.text();
  const buildAssets = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|mjs|css))"/g)) {
    buildAssets.add(match[1]);
  }

  await Promise.all([...buildAssets].map(async (asset) => {
    try {
      const response = await fetch(asset, { cache: 'reload' });
      if (canCache(response)) await cache.put(asset, response);
    } catch (err) {
      console.warn('[SW] Precache build asset failure:', err);
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheShell()
      .catch((err) => console.warn('[SW] Precache failed:', err))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete only this app's older versions, not other apps' caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            const version = /^ben-bi-cache-v(\d+)$/.exec(name);
            return version && Number(version[1]) < CACHE_VERSION;
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Google Fonts: cache-first at runtime so typography survives offline after the first visit.
  const isFontCss = url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css2');
  const isFontFile = url.hostname === 'fonts.gstatic.com';
  if (req.method === 'GET' && (isFontCss || isFontFile)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      const response = await fetch(req);
      // no-cors stylesheet/font responses are opaque (status 0) but still usable.
      if (response.ok || response.type === 'opaque') {
        try {
          await cache.put(req, response.clone());
        } catch (err) {
          console.warn('[SW] Font cache write failure:', err);
        }
      }
      return response;
    })());
    return;
  }

  // Private/API requests and development modules must go straight to the network.
  // Query-bearing URLs may contain auth codes or Vite import/HMR parameters.
  if (req.method !== 'GET' || url.origin !== self.location.origin ||
      !/^https?:$/.test(url.protocol) || req.headers.has('Authorization') ||
      url.pathname === '/api' || url.pathname.startsWith('/api/') || url.search ||
      /^\/(?:@vite|@id|@fs|@react-refresh|__vite_ping|__open-in-editor|src|node_modules)(?:\/|$)/.test(url.pathname) ||
      /\.(?:tsx?|jsx)$/.test(url.pathname)) {
    return;
  }

  const isShell = url.pathname === '/' || url.pathname === '/index.html';
  const isNavigation = req.mode === 'navigate';
  const isStaticAsset = PRECACHE_ASSETS.includes(url.pathname) ||
    /^\/assets\/.+\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i.test(url.pathname) ||
    /^\/icons\/.+\.(?:png|jpe?g|svg|webp|ico)$/i.test(url.pathname);

  // Do not cache arbitrary same-origin endpoints, even if they return HTTP 200.
  if (!isNavigation && !isShell && !isStaticAsset) return;

  // Always refresh the shell online. Only canonical shell URLs can update '/';
  // other navigations may fall back to it but must never persist private HTML.
  if (isNavigation || isShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        if (isShell && canCache(response)) {
          await storeResponse('/', response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cachedRoot = await cache.match('/', { ignoreVary: true });
        return cachedRoot || new Response('Ứng dụng Bền Bỉ đang ngoại tuyến.', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Allowlisted public assets: stale-while-revalidate in this app's cache only.
  const networkResponse = fetch(req).then(async (response) => {
    if (canCache(response)) await storeResponse(req, response.clone());
    return response;
  });
  event.waitUntil(networkResponse.catch(() => {}));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Install-time fetches carry no Origin header, while page module requests do;
    // with `Vary: Origin` (Vercel/Vite) a plain match would miss. Vary is irrelevant here.
    const cached = await cache.match(req, { ignoreVary: true });
    return cached || networkResponse;
  })());
});

// Web Push event listener
self.addEventListener('push', (event) => {
  let data = {
    title: 'Bền bỉ tới cùng',
    body: 'Đến giờ duy trì chuỗi kỷ luật hàng ngày của bạn!',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: 'ben-bi-reminder',
    data: { url: '/' }
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
      { action: 'close', title: 'Để sau' }
    ]
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
    })
  );
});
