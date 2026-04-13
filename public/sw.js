self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Finca El Molino', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      data: data.url || '/',
      tag: data.tag || 'general'
    })
  )
})
self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data))
})
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'NOTIFY') {
    self.registration.showNotification(event.data.title || 'Finca El Molino', {
      body: event.data.body || '',
      icon: '/icon.png',
      tag: event.data.tag || 'general'
    })
  }
})
