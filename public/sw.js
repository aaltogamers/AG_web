self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function () {
            return true
          })
          .map(function (cacheName) {
            return caches.delete(cacheName)
          })
      )
    })
  )
})
