// 배포용 dist/ 폴더를 만든다 (원본 이미지·소스·문서 제외, 앱 파일만).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const files = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css/style.css',
  'js/app.js',
  'data/terms.json',
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
