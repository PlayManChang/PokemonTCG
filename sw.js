// PJCS 용어집 Service Worker — 오프라인 지원 (stale-while-revalidate)
// + 카드 이미지 런타임 캐싱(한 번 본 카드는 오프라인에서도 표시)
const CACHE = 'pjcs-v55';
const IMG_CACHE = 'pjcs-cardimg-v1';
const ASSETS = [
  './',
  './index.html',
  './cards.html',
  './guide.html',
  './shops.html',
  './shopping.html',
  './locations.html',
  './plan.html',
  './css/style.css',
  './js/app.js',
  './js/cards.js',
  './js/nav.js',
  './js/shops.js',
  './js/shopping.js',
  './js/locations.js',
  './js/plan.js',
  './data/terms.json',
  './data/cards.json',
  './data/shops.json',
  './data/shopping.json',
  './data/locations.json',
  './data/plan.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './docs/penalty-quickchart-ko.pdf',
  './docs/penalty-guideline-ko.pdf',
  './docs/floor-rule-ko.pdf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 외부 카드 이미지(pokemon-card.com): 캐시 우선 런타임 캐싱 → 한 번 보면 오프라인에서도 표시
  const url = new URL(req.url);
  if (url.hostname.endsWith('pokemon-card.com') && url.pathname.includes('card_images')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
