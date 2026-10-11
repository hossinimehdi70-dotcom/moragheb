/* ============================================================
   Service Worker — سامانه مراقب سلامت مدارس
   نسخه ۳.۲.۱
   ============================================================ */

var CACHE_VERSION = 'moragheb-v4.2.1';
var CACHE_NAME = CACHE_VERSION;

/* فایل‌هایی که حتماً کش می‌شوند */
var PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      /* هر فایل جدا کش شود تا اگر یکی نبود، کل نصب خراب نشود */
      return Promise.all(
        PRECACHE_ASSETS.map(function(url){
          return cache.add(url).catch(function(err){
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    }).then(function(){ return self.skipWaiting(); })
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.map(function(key){
          if(key !== CACHE_NAME){
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', function(event){
  var req = event.request;
  var url = new URL(req.url);

  /* فقط درخواست‌های GET هم‌مبدأ کش می‌شوند */
  if(req.method !== 'GET') return;
  if(url.origin !== self.location.origin) return;

  /* استراتژی Network-First برای فایل اصلی (همیشه آخرین نسخه) */
  if(url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/')){
    event.respondWith(networkFirst(req, CACHE_NAME));
    return;
  }

  /* Cache-First برای بقیه فایل‌ها (آیکون، manifest، ...) */
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

/* Network-First: اول شبکه، اگر نشد کش */
function networkFirst(req, cacheName){
  return fetch(req).then(function(res){
    if(res && res.status === 200){
      var clone = res.clone();
      caches.open(cacheName).then(function(cache){ cache.put(req, clone); });
    }
    return res;
  }).catch(function(){
    return caches.match(req).then(function(cached){
      return cached || caches.match('./index.html');
    });
  });
}

/* Cache-First: اول کش، اگر نبود شبکه */
function cacheFirst(req, cacheName){
  return caches.match(req).then(function(cached){
    if(cached) return cached;
    return fetch(req).then(function(res){
      if(res && res.status === 200 && res.type === 'basic'){
        var clone = res.clone();
        caches.open(cacheName).then(function(cache){ cache.put(req, clone); });
      }
      return res;
    }).catch(function(){
      return caches.match('./index.html');
    });
  });
}

/* ---------- پیام از صفحه (برای به‌روزرسانی دستی) ---------- */
self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
