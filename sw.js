// The Quad — sw.js  (Pure Web Push / VAPID — no Firebase needed)

const CACHE_NAME = 'thequad-v4';
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
// body: exact label shown on lock screen
// tag:  groups same-type notifications so they collapse instead of spamming
const LABELS = {
  like:       { body: '👍 Someone liked your post',        multi: (n) => `👍 ${n} people liked your post`,     tag: 'like-group'       },
  comment:    { body: '💬 New comment on your post',        multi: (n) => `💬 ${n} new comments on your post`,  tag: 'comment-group'    },
  reply:      { body: '↩️ Someone replied to your comment', multi: (n) => `↩️ ${n} replies to your comment`,   tag: 'reply-group'      },
  connection: { body: '🤝 New connection request',          multi: (n) => `🤝 ${n} new connection requests`,   tag: 'connection-group' },
  message:    { body: '📩 You have a new message',          multi: (n) => `📩 ${n} new messages`,              tag: 'message-group'    },
};

// ── Push — fires when edge function sends a notification ──────
self.addEventListener('push', e => {
  let type  = null;
  let url   = APP_URL;
  let count = 1;

  // Try JSON first
  try {
    const raw = e.data?.text();
    console.log('[SW] Raw push data:', raw);
    const data = JSON.parse(raw || '{}');
    if (data.type)  type  = data.type;
    if (data.url)   url   = data.url;
    if (data.count) count = data.count;
    // also handle old format: { title, body }
    if (!type && data.body) {
      const b = data.body.toLowerCase();
      if (b.includes('liked') || b.includes('upvot'))       type = 'like';
      else if (b.includes('repl'))                           type = 'reply';
      else if (b.includes('comment'))                        type = 'comment';
      else if (b.includes('connection') || b.includes('request')) type = 'connection';
      else if (b.includes('message'))                        type = 'message';
    }
  } catch (err) {
    console.log('[SW] Push parse error:', err);
  }

  if (!type) type = 'message';

  const label = LABELS[type] || LABELS.message;
  const tag   = label.tag;   // e.g. "like-group" — collapses same-type notifications

  e.waitUntil(
    self.registration.getNotifications({ tag })
      .then(existing => {
        let newCount = count;
        if (existing.length > 0) {
          newCount = (existing[0].data?.count || 1) + 1;
          existing[0].close();
        }

        const body = newCount > 1
          ? label.multi(newCount)
          : label.body;

        console.log('[SW] Showing notification:', type, body);

        return self.registration.showNotification('The Quad 👻', {
          body,
          icon:     '/The-Quad-/icon-192.png',
          badge:    '/The-Quad-/icon-192.png',
          vibrate:  [200, 100, 200],
          color:    '#800000',            // maroon — tints app name & small icon on Android
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
