// 지정 세트의 카드를 ID 범위를 훑어 찾는다. 카드 이미지 경로의 세트 코드로 판별.
// 사용: node scripts/scan-set.js M5 50220 50370
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SET = process.argv[2];
const START = parseInt(process.argv[3], 10);
const END = parseInt(process.argv[4], 10);
if (!SET || !START || !END) { console.error('사용: node scripts/scan-set.js <SET> <startId> <endId>'); process.exit(1); }

const pad6 = (id) => String(id).padStart(6, '0');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // 이미지/폰트 등 불필요 리소스 차단으로 속도 향상 (HTML만 필요)
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const t = r.resourceType();
    if (t === 'image' || t === 'font' || t === 'stylesheet' || t === 'media') r.abort();
    else r.continue();
  });

  const found = [];
  for (let id = START; id <= END; id++) {
    try {
      await page.goto(`https://www.pokemon-card.com/card-search/details.php/card/${id}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const card = await page.evaluate((pid) => {
        const re = new RegExp('card_images/large/([^/]+)/(' + pid + ')_([A-Z]+)_([^.\\/]+)\\.');
        for (const img of document.querySelectorAll('img')) {
          const s = img.getAttribute('src') || img.getAttribute('data-src') || '';
          const m = s.match(re);
          if (m) return { id: String(parseInt(m[2], 10)), set: m[1], type: m[3], romaji: m[4] };
        }
        return null;
      }, pad6(id));
      if (card && card.set === SET) { found.push(card); process.stdout.write('.'); }
      else process.stdout.write(card ? 'o' : 'x');
    } catch (e) { process.stdout.write('!'); }
  }
  await browser.close();

  const outDir = path.join(__dirname, '..', 'data', 'sources', 'sets');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, SET + '.json'), JSON.stringify(found, null, 2) + '\n', 'utf8');
  console.log(`\n${SET} 발견: ${found.length}종 → data/sources/sets/${SET}.json`);
  console.log(found.map((c) => c.id + '\t' + c.type + '\t' + c.romaji).join('\n'));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
