/* ============================================
   SERVICE WORKER - Offline Support & Caching
   ============================================ */

const CACHE_NAME = 'cyprus-realestate-v1';
const STATIC_ASSETS = [
    '/src/index.html',
    '/src/client/swipe.html',
    '/src/broker/dashboard.html',
    '/src/broker/properties.html',
    '/src/broker/selections.html',
    '/src/assets/css/common.css',
    '/src/assets/css/swipe.css',
    '/src/assets/css/broker.css',
    '/src/assets/js/data-sync.js',
    '/src/assets/js/mock-data.js',
    '/src/assets/js/swipe.js',
    '/src/assets/js/supabase-client.js'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((err) => {
                console.log('[SW] Cache failed:', err);
            })
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API and external requests
    const url = new URL(event.request.url);
    if (url.hostname.includes('supabase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('google.com') ||
        url.hostname.includes('unsplash')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone and cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache
                return caches.match(event.request);
            })
    );
});
