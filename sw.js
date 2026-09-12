const CACHE_NAME = 'memento-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Ascolta messaggi dalla pagina per controllare gli anniversari
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'checkAnniversaries') {
    checkAnniversaries();
  }
});

// Se implementato Periodic Sync (supportato solo su alcuni browser con installazione PWA)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-anniversaries') {
    event.waitUntil(checkAnniversaries());
  }
});

function checkAnniversaries() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MementoDB", 3);
    
    request.onerror = (e) => reject(e);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("photos")) {
          resolve();
          return;
      }
      const tx = db.transaction("photos", "readonly");
      const store = tx.objectStore("photos");
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const photos = getAllRequest.result;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        let notifications = [];

        photos.forEach(photo => {
          if (!photo.year || !photo.month || !photo.day) return; // Data incompleta
          
          const photoDate = new Date(photo.year, photo.month - 1, photo.day);
          
          // Calcolo differenza in giorni
          const diffTime = Math.abs(today - photoDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          const diffYears = today.getFullYear() - photoDate.getFullYear();
          
          // Controllo anniversario annuale (ogni anno)
          if (diffYears > 0 && 
              today.getDate() === photoDate.getDate() && 
              today.getMonth() === photoDate.getMonth()) {
              
              notifications.push(`Oggi è l'anniversario (${diffYears} ${diffYears === 1 ? 'anno' : 'anni'}) del ricordo a ${photo.place || 'cui tieni'}!`);
          }
          
          // Controllo giorni esatti (ogni 500 giorni)
          if (diffDays > 0 && diffDays % 500 === 0) {
              notifications.push(`Incredibile! Sono passati ${diffDays} giorni dal ricordo a ${photo.place || 'cui tieni'}!`);
          }
        });
        
        // Manda le notifiche (massimo 3 per non spammare l'utente)
        const uniqueNotifications = [...new Set(notifications)].slice(0, 3);
        
        uniqueNotifications.forEach(msg => {
            self.registration.showNotification("Memento - Ricordo Speciale", {
                body: msg,
                icon: 'icon.png',
                badge: 'icon.png',
                vibrate: [200, 100, 200]
            });
        });
        
        resolve();
      };
    };
  });
}
