// The Quad — sw.js  (Pure Web Push / VAPID — no Firebase needed)

const CACHE_NAME = 'thequad-v6';
const APP_URL    = 'https://thequad-oss.github.io/The-Quad-/';

// ── Supabase config for push_queue fetch ─────────────────────
const SB_URL      = 'https://inrikoexanggtssgugwa.supabase.co';
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlucmlrb2V4YW5nZ3Rzc2d1Z3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTM5OTksImV4cCI6MjA4ODAyOTk5OX0.Ib7rsL63FkF2YEcWEUkl1h2nCBj2VAgW6R8rEOMy294';

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
  like:       { body: '👍 Someone liked your post',        multi: (n) => `👍 ${n} people liked your post`,    tag: 'like-group'       },
  comment:    { body: '💬 New comment on your post',        multi: (n) => `💬 ${n} new comments on your post`, tag: 'comment-group'    },
  reply:      { body: '↩️ Someone replied to your comment', multi: (n) => `↩️ ${n} replies to your comment`,  tag: 'reply-group'      },
  connection: { body: '🤝 New connection request',          multi: (n) => `🤝 ${n} new connection requests`,  tag: 'connection-group' },
  message:    { body: '📩 You have a new message',          multi: (n) => `📩 ${n} new messages`,             tag: 'message-group'    },
};

// ── Push — fires when edge function sends a notification ──────
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let type = 'message';
    let url  = APP_URL;

    try {
      // Get this device's push subscription endpoint
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        // Fetch the notification type from push_queue using the endpoint
        const res  = await fetch(
          `${SB_URL}/rest/v1/push_queue?endpoint=eq.${encodeURIComponent(sub.endpoint)}&order=created_at.desc&limit=1`,
          { headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` } }
        );
        const rows = await res.json();
        if (rows?.length) {
          type = rows[0].type || 'message';
          url  = rows[0].url  || APP_URL;
          // Clean up so it doesn't repeat on next push
          fetch(`${SB_URL}/rest/v1/push_queue?id=eq.${rows[0].id}`, {
            method: 'DELETE',
            headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` }
          });
        }
      }
    } catch (err) {
      console.log('[SW] push_queue error:', err);
    }

    const label = LABELS[type] || LABELS.message;
    const tag   = label.tag;

    const existing = await self.registration.getNotifications({ tag });
    let newCount = 1;
    if (existing.length > 0) {
      newCount = (existing[0].data?.count || 1) + 1;
      existing[0].close();
    }

    const body = newCount > 1 ? label.multi(newCount) : label.body;
    console.log('[SW] Showing notification:', type, body);

    return self.registration.showNotification('The Quad 👻', {
      body,
      icon:     '/The-Quad-/icon-192.png',
      badge:    '/The-Quad-/icon-192.png',
      vibrate:  [200, 100, 200],
      color:    '#800000',
      silent:   false,
      tag,
      renotify: true,
      data:     { url, type, count: newCount },
    });
  })());
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
