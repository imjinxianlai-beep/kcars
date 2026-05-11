// Self-unregister on localhost (dev environment)
if (self.location.hostname === 'localhost') {
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
    )
  })
} else {
  const CACHE = 'kcars-crm-v2'
  const OFFLINE_URLS = ['/', '/index.html']

  self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)))
    self.skipWaiting()
  })

  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
    )
    self.clients.claim()
  })

  self.addEventListener('fetch', e => {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
  })
}
