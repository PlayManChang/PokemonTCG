// 배포용 dist/ 폴더를 만든다 (원본 이미지·소스·문서 제외, 앱 파일만).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const files = [
  'index.html',
  'glossary.html',
  'event.html',
  'cards.html',
  'guide.html',
  'shops.html',
  'shopping.html',
  'locations.html',
  'plan.html',
  'faq.html',
  'calc.html',
  'manifest.webmanifest',
  'sw.js',
  'css/style.css',
  'js/app.js',
  'js/app-install.js',
  'js/cards.js',
  'js/nav.js',
  'js/events.js',
  'js/event.js',
  'js/event-chrome.js',
  'js/shops.js',
  'js/shopping.js',
  'js/locations.js',
  'js/plan.js',
  'js/faq.js',
  'js/calc.js',
  'data/terms.json',
  'data/cards.json',
  'data/events.json',
  'data/transport.json',
  'data/hotels.json',
  'data/restaurants.json',
  'data/checklists.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'docs/penalty-quickchart-ko.pdf',
  'docs/penalty-guideline-ko.pdf',
  'docs/floor-rule-ko.pdf',
];

// 대회별 데이터(data/shops|shopping|locations|plan|faq|calc/<event>.json)를 자동 포함
for (const sub of ['shops', 'shopping', 'locations', 'plan', 'faq', 'calc']) {
  const dir = path.join(ROOT, 'data', sub);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) files.push('data/' + sub + '/' + f);
    }
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
for (const rel of files) {
  const src = path.join(ROOT, rel);
  const dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
console.log('dist/ 생성 완료 (' + files.length + '개 파일)');
console.log(files.map((f) => '  dist/' + f).join('\n'));
