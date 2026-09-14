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
  'food.html',
  'locations.html',
  'plan.html',
  'past.html',
  'faq.html',
  'calc.html',
  'manifest.webmanifest',
  'sw.js',
  'data/terms.json',
  'data/cards.json',
  'data/events.json',
  'data/past-events.json',
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

// css/ 와 js/ 는 통째로 자동 포함한다.
// (예전에 목록을 손으로 관리하다 js/food.js 가 빠져 배포본에서 404 난 적이 있다)
for (const sub of ['css', 'js']) {
  for (const f of fs.readdirSync(path.join(ROOT, sub))) {
    if (f.endsWith('.css') || f.endsWith('.js')) files.push(sub + '/' + f);
  }
}

// 대회별 데이터(data/shops|shopping|food|locations|plan|faq|calc/<event>.json)를 자동 포함
for (const sub of ['shops', 'shopping', 'food', 'locations', 'plan', 'faq', 'calc']) {
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

// ── 참조 무결성 검증 ───────────────────────────────────────────
// HTML 이 불러오는 로컬 파일(script/link/img)이 dist 에 실제로 있는지 확인한다.
// 없으면 빌드를 실패시켜, 배포 후 404 를 겪는 일을 막는다.
const missing = [];
for (const rel of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
  const re = /(?:src|href)="(\.\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const ref = m[1].replace(/^\.\//, '').split(/[?#]/)[0];
    if (!ref || /^https?:/.test(ref)) continue;
    if (!fs.existsSync(path.join(DIST, ref))) missing.push(rel + ' → ' + ref);
  }
}
if (missing.length) {
  console.error('\n❌ dist 에 없는 참조 ' + missing.length + '건:');
  console.error(missing.map((x) => '  ' + x).join('\n'));
  process.exit(1);
}
console.log('\n✅ HTML 참조 파일 모두 dist 에 존재');
