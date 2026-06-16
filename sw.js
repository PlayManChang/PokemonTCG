// PJCS 용어집 Service Worker — 오프라인 지원 (stale-while-revalidate)
// + 카드 이미지 런타임 캐싱(한 번 본 카드는 오프라인에서도 표시)
const CACHE = 'pjcs-v72';
const IMG_CACHE = 'pjcs-cardimg-v1';
// 설치 시 미리 받는 '핵심 앱 셸'만(가벼움 → 설치 빠름).
// 큰 파일(cards.json 512KB, 룰 PDF 700KB)은 목록에서 빼고, 처음 열 때 fetch 핸들러가 자동 캐싱한다.
const CORE = [
  './',
  './index.html',
  './glossary.html',
  './event.html',
  './cards.html',
  './guide.html',
  './shops.html',
  './shopping.html',
  './locations.html',
  './plan.html',
  './faq.html',
  './calc.html',
  './css/style.css',
  './js/app.js',
  './js/app-install.js',
  './js/cards.js',
  './js/nav.js',
  './js/events.js',
  './js/event.js',
  './js/event-chrome.js',
  './js/shops.js',
  './js/shopping.js',
  './js/locations.js',
  './js/plan.js',
  './js/faq.js',
  './js/calc.js',
  './data/terms.json',
  './data/events.json',
  './data/transport.json',
  './data/hotels.json',
  './data/restaurants.json',
  './data/checklists.json',
  './data/shops/yokohama.json',
  './data/shops/chiba.json',
  './data/shops/miyagi.json',
  './data/shops/osaka.json',
  './data/shops/aichi.json',
  './data/shops/naic-chicago.json',
  './data/shops/sydney-rc.json',
  './data/shops/brisbane-rc.json',
  './data/shopping/yokohama.json',
  './data/shopping/chiba.json',
  './data/shopping/miyagi.json',
  './data/shopping/osaka.json',
  './data/shopping/aichi.json',
  './data/shopping/naic-chicago.json',
  './data/shopping/sydney-rc.json',
  './data/shopping/brisbane-rc.json',
  './data/locations/yokohama.json',
  './data/locations/chiba.json',
  './data/locations/miyagi.json',
  './data/locations/osaka.json',
  './data/locations/aichi.json',
  './data/locations/naic-chicago.json',
  './data/locations/sydney-rc.json',
  './data/locations/brisbane-rc.json',
  './data/plan/yokohama.json',
  './data/plan/naic-chicago.json',
  './data/plan/sydney-rc.json',
  './data/plan/brisbane-rc.json',
  './data/faq/naic-chicago.json',
  './data/faq/sydney-rc.json',
  './data/faq/brisbane-rc.json',
  './data/calc/naic-chicago.json',
  './data/calc/sydney-rc.json',
  './data/calc/brisbane-rc.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // 개별 캐싱(allSettled) → 한 파일이 느리거나 실패해도 설치가 멈추지 않음
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(CORE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
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
