// The Quad — sw.js
// Place this file at the ROOT of your web server (same folder as index.html)

const CACHE_NAME = 'thequad-v2';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname.includes('supabase') || u.hostname.includes('unpkg') || u.hostname.includes('fonts')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(ca => ca.put(e.request, c)); }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push Notifications ───────────────────────────────────────
self.addEventListener('push', e => {
  let body = 'You have a new notification on The Quad 👻';
  try {
    const data = e.data.json();
    if (data.body) body = data.body;
  } catch (_) {
    if (e.data) body = e.data.text() || body;
  }

  const ghostIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23800000'/%3E%3Cpath fill='white' d='M32 8a16 16 0 0116 16v24l-6-4-6 4-6-4-6 4-6-4V24A16 16 0 0132 8zm-4 16a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4z'/%3E%3C/svg%3E";

  e.waitUntil(
    self.registration.showNotification('The Quad 👻', {
      body,
      icon: ghostIcon,
      badge: ghostIcon,
      vibrate: [100, 50, 100],
      tag: 'thequad-notification',
      renotify: true,
      data: { url: self.location.origin }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) ? e.notification.data.url : self.location.origin;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
