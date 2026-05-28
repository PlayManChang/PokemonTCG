// 공식 덱 뷰어(JS 렌더링)에서 카드 목록을 긁어온다.
// 카드 이미지 URL 패턴: .../card_images/large/{SET}/{ID}_{TYPE}_{NAME}.jpg
// 사용: node scripts/scrape-deck.js <deckURL>
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const url = process.argv[2] || 'https://www.pokemon-card.com/deck/result.html/deckID/x4GJ8c-Cr6ymd-GYJD8x/';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 3500));

  const cards = await page.evaluate(() => {
    const re = /card_images\/large\/([^/]+)\/(\d+)_([A-Z]+)_([^.\/]+)\./;
    const map = new Map();
    document.querySelectorAll('img').forEach((img) => {
      const m = (img.src || '').match(re);
      if (!m) return;
      const [, set, rawId, type, name] = m;
      const id = String(parseInt(rawId, 10));
      if (!map.has(id)) map.set(id, { id, set, type, romaji: name, count: 0 });
      map.get(id).count++;
    });
    return [...map.values()];
  });

  const outDir = path.join(__dirname, '..', 'data', 'sources', 'decks');
  fs.mkdirSync(outDir, { recursive: true });
  const deckId = (url.match(/deckID\/([^/]+)/) || [])[1] || 'deck';
  const outFile = path.join(outDir, `${deckId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(cards, null, 2) + '\n', 'utf8');

  console.log('추출된 고유 카드 수:', cards.length, '→', outFile);
  console.log(cards.map((c) => `${c.id}\t${c.type}\t${c.set}\t${c.romaji}`).join('\n'));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
