function notificationPath(value) {
  try {
    const target = new URL(value || '/', self.location.origin);
    return target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  event.waitUntil(self.registration.showNotification(payload.title || '哈利路亞家教會', {
    body: payload.body || '',
    icon: '/assets/brand/logo.png',
    data: {url: notificationPath(payload.actionUrl)}
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = notificationPath(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(path).then(() => existing.focus());
    return self.clients.openWindow(path);
  }));
});
