/* ============================================================
   Service Worker — سامانه مراقب سلامت مدارس
   نسخه ۳.۲.۲ (اصلاح‌شده)
   ============================================================ */

var CACHE_VERSION = 'moragheb-v3.3.8';
var CACHE_NAME = CACHE_VERSION;

/* فایل‌هایی که حتماً کش می‌شوند
   ⚠️ توجه: فایل‌ها در ریشه مخزن گیت‌هاب هستند (نه در پوشه icons/) */
var PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      /* هر فایل جدا کش شود تا اگر یکی ۴۰۴ بود، کل نصب خراب نشود */
      return Promise.all(
        PRECACHE_ASSETS.map(function(url){
          return cache.add(url).catch(function(err){
            console.warn('[SW] Failed to precache:', url, err && err.message);
          });
        })
      );
    })
    /* ⚠️ self.skipWaiting() عمداً حذف شد تا دیالوگ به‌روزرسانی کار کند.
       در عوض، پس از تأیید کاربر از طریق message ارسال می‌شود. */
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
  var url;
  try { url = new URL(req.url); } catch(e){ return; }

  /* فقط GET و هم‌مبدأ */
  if(req.method !== 'GET') return;
  if(url.origin !== self.location.origin) return;

  /* صفحه اصلی → Network-First (همیشه تازه‌ترین نسخه) */
  if(url.pathname.endsWith('/index.html') ||
     url.pathname === '/' ||
     url.pathname.endsWith('/')){
    event.respondWith(networkFirst(req, CACHE_NAME, event));
    return;
  }

  /* بقیه (آیکون، manifest، ...) → Cache-First */
  event.respondWith(cacheFirst(req, CACHE_NAME, event));
});

/* Network-First: اول شبکه، اگر نشد کش، اگر نبود صفحه اصلی */
function networkFirst(req, cacheName, event){
  return fetch(req).then(function(res){
    if(res && res.ok){
      var clone = res.clone();
      /* waitUntil تضمین می‌کند cache.put قبل از خاموش شدن SW تمام شود */
      event.waitUntil(
        caches.open(cacheName).then(function(cache){ return cache.put(req, clone); })
          .catch(function(err){ console.warn('[SW] Cache put failed:', err); })
      );
    }
    return res;
  }).catch(function(){
    return caches.match(req).then(function(cached){
      if(cached) return cached;
      return caches.match('./index.html');
    });
  });
}

/* Cache-First: اول کش، اگر نبود شبکه، اگر نبود ۴۰۴ */
function cacheFirst(req, cacheName, event){
  return caches.match(req).then(function(cached){
    if(cached) return cached;

    return fetch(req).then(function(res){
      if(res && res.ok){
        var clone = res.clone();
        event.waitUntil(
          caches.open(cacheName).then(function(cache){ return cache.put(req, clone); })
            .catch(function(err){ console.warn('[SW] Cache put failed:', err); })
        );
      }
      return res;
    }).catch(function(){
      /* ⚠️ اصلاح: برای درخواست غیرناوبری (مثل آیکون)، index.html برنگردان */
      if(req.mode === 'navigate' || req.destination === 'document'){
        return caches.match('./index.html');
      }
      return new Response('', { status: 404, statusText: 'Not Found' });
    });
  });
}

/* ---------- پیام از صفحه (تأیید کاربر برای به‌روزرسانی) ---------- */
self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
