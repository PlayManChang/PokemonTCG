// 배포용 dist/ 폴더를 만든다 (원본 이미지·소스·문서 제외, 앱 파일만).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const files = [
  'index.html',
  'cards.html',
  'guide.html',
  'shops.html',
  'shopping.html',
  'locations.html',
  'plan.html',
  'config.js',
  'manifest.webmanifest',
  'sw.js',
  'css/style.css',
  'js/app.js',
  'js/cards.js',
  'js/nav.js',
  'js/shops.js',
  'js/shopping.js',
  'js/locations.js',
  'js/plan.js',
  'data/terms.json',
  'data/cards.json',
  'trips/tokyo-pjcs-2026/shops.json',
  'trips/tokyo-pjcs-2026/shopping.json',
  'trips/tokyo-pjcs-2026/locations.json',
  'trips/tokyo-pjcs-2026/plan.json',
  'trips/tokyo-pjcs-2026/docs/penalty-quickchart-ko.pdf',
  'trips/tokyo-pjcs-2026/docs/penalty-guideline-ko.pdf',
  'trips/tokyo-pjcs-2026/docs/floor-rule-ko.pdf',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

fs.rmSync(DIST, { recursive: true, force: true });
for (const rel of files) {
  const src = path.join(ROOT, rel);
  const dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
console.log('dist/ 생성 완료 (' + files.length + '개 파일)');
console.log(files.map((f) => '  dist/' + f).join('\n'));
