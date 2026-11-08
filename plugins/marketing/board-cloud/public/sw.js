// The board's service worker: shows the server's reminders (a push carries no data; this asks
// the board what's due), opens the board on a tap, and lets the board install as an app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // network only: the board is always live
self.addEventListener('push', (e) => {
  e.waitUntil(
    fetch('/api/push/next', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((n) => self.registration.showNotification(n?.title || 'Time to post', {
        body: n?.body || 'Open the review board.', tag: n?.tag || 'board', icon: '/icon-192.png', badge: '/icon-192.png',
        data: { url: n?.url || '/' }, renotify: true,
      })),
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const w = wins.find((c) => new URL(c.url).origin === self.location.origin);
    return w ? w.navigate(url).then((c) => (c || w).focus()) : self.clients.openWindow(url);
  }));
});
