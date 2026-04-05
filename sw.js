// The Quad — sw.js  (Pure Web Push / VAPID — no Firebase needed)

const CACHE_NAME = 'thequad-v2';
const APP_URL    = 'https://thequad-oss.github.io/The-Quad-/';

// ── Install & Activate ────────────────────────────────────────
self.addEventListener('install',  e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (bypass for external APIs) ─────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (
    u.hostname.includes('supabase')   ||
    u.hostname.includes('unpkg')      ||
    u.hostname.includes('fonts')      ||
    u.hostname.includes('gstatic')    ||
    u.hostname.includes('googleapis')
  ) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.ok) {
          const c = r.clone();
          caches.open(CACHE_NAME).then(ca => ca.put(e.request, c));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Notification labels per type ──────────────────────────────
const LABELS = {
  like:       { emoji: '👍', single: 'Someone liked your post',        multi: (n) => `👍 ${n} people liked your post` },
  comment:    { emoji: '💬', single: 'New comment on your post',        multi: (n) => `💬 ${n} new comments on your post` },
  reply:      { emoji: '↩️', single: 'Someone replied to your comment', multi: (n) => `↩️ ${n} replies to your comment` },
  connection: { emoji: '🤝', single: 'New connection request',          multi: (n) => `🤝 ${n} new connection requests` },
  message:    { emoji: '📩', single: 'You have a new message',          multi: (n) => `📩 ${n} new messages` },
};

// ── Push — fires when edge function sends a notification ──────
self.addEventListener('push', e => {
  let type  = 'message';
  let url   = APP_URL;
  let count = 1;

  try {
    const data = e.data?.json();
    if (data?.type)  type  = data.type;
    if (data?.url)   url   = data.url;
    if (data?.count) count = data.count;
  } catch (_) {}

  const label = LABELS[type] || LABELS.message;
  const body  = count > 1 ? label.multi(count) : `${label.emoji} ${label.single}`;

  // Tag per type+url so likes group together but messages per chat don't merge
  const tag = `thequad-${type}-${url}`;

  e.waitUntil(
    // Check existing notification with same tag to increment count
    self.registration.getNotifications({ tag })
      .then(existing => {
        // Extract current count from existing notification if any
        let newCount = count;
        if (existing.length > 0) {
          const prev = existing[0].data?.count || 1;
          newCount = prev + 1;
          existing[0].close();
        }

        const finalBody = newCount > 1 ? label.multi(newCount) : `${label.emoji} ${label.single}`;

        return self.registration.showNotification('The Quad 👻', {
          body:     finalBody,
          icon:     '/The-Quad-/icon-192.png',
          badge:    '/The-Quad-/icon-192.png',
          vibrate:  [200, 100, 200],
          silent:   false,
          tag,
          renotify: true,
          data:     { url, type, count: newCount },
        });
      })
  );
});

// ── Notification click — opens specific post or chat ──────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || APP_URL;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
