/* 萬用計算機 — Service Worker
 *
 * 作用:
 *  1. 第一次開啟時,把所有檔案存進手機,之後沒有網路也能開啟、計算。
 *  2. 每次開啟時先用手機裡的檔案「秒開」,同時在背景檢查有沒有新版;
 *     有的話整批更新,下一次開啟就是新版(不需要手動清除任何東西)。
 *
 * 大幅修改網頁後,建議把下面的 VERSION 改成新字串(例如 v1.1.0)再上傳,
 * 手機會視為全新版本、整組重新安裝。 */
var VERSION = 'v1.1.0';
var CACHE = 'wcalc-' + VERSION;
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './calc.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// 有些主機會把網址導向(例如 /index.html → /)。被導向過的回應存進快取後,
// 在 iOS/Safari 上拿來回應「網頁導覽」會失敗,所以存入前先重新包成乾淨的回應。
function clean(res) {
  if (!res.redirected) return res;
  return res.blob().then(function (b) {
    return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

// 下載整組檔案(cache:'reload' 跳過瀏覽器 HTTP 快取);全部成功才回傳,避免新舊檔案混在一起
function fetchAll() {
  return Promise.all(ASSETS.map(function (url) {
    return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
      if (!res.ok) throw new Error('下載失敗: ' + url + ' (' + res.status + ')');
      return Promise.resolve(clean(res)).then(function (r) { return [url, r]; });
    });
  }));
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    fetchAll().then(function (pairs) {
      return caches.open(CACHE).then(function (cache) {
        return Promise.all(pairs.map(function (p) { return cache.put(p[0], p[1]); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf('wcalc-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 背景更新:整組下載成功後才一次寫入快取;沒網路或失敗就保持現狀
var lastRefresh = 0;
function refreshInBackground() {
  var now = Date.now();
  if (now - lastRefresh < 60 * 1000) return Promise.resolve();
  lastRefresh = now;
  return fetchAll().then(function (pairs) {
    return caches.open(CACHE).then(function (cache) {
      return Promise.all(pairs.map(function (p) { return cache.put(p[0], p[1]); }));
    });
  }).catch(function () { /* 離線或伺服器暫時失敗:忽略 */ });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') event.waitUntil(refreshInBackground());

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(req).catch(function () {
          if (req.mode === 'navigate') return cache.match('./index.html');
          return Response.error();
        });
      });
    })
  );
});
