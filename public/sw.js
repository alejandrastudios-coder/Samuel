self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Basic fetch handler needed for PWA installability
  event.respondWith(fetch(event.request));
});

// Listener for push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Stickers 2026';
  const options = {
    body: data.body || '¡Tienes una nueva actualización!',
    icon: 'https://cdn-icons-png.flaticon.com/512/1165/1165187.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1165/1165187.png',
    data: data.url || '/'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
