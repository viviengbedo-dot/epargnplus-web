/* ═══════════════════════════════════════════════════════════
   Epargn+ — Service Worker v2
   Gère : cache offline + push notifications
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'epargnplus-v2';
const OFFLINE_URLS = ['/', '/connexion', '/style.css', '/logo.svg', '/favicon.png'];

/* ── Installation ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

/* ── Activation ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch (cache-first pour assets statiques) ── */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  /* Ne pas intercepter les requêtes API */
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/'));
    })
  );
});

/* ════════════════════════════════════════════
   PUSH NOTIFICATIONS
════════════════════════════════════════════ */
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'Epargn+', body: e.data.text() }; }

  const title   = data.title   || 'Epargn+';
  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/icon-192.png',
    badge:   '/icon-48.png',
    tag:     data.tag     || 'epargnplus-notif',
    data:    { url: data.url || '/espace-client' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: data.actions || [],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

/* Clic sur la notification → ouvre l'app */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/espace-client';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('epargnplus.com') && 'focus' in client) {
          client.postMessage({ type: 'navigate', url });
          return client.focus();
        }
      }
      return clients.openWindow('https://www.epargnplus.com' + url);
    })
  );
});
