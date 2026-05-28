// 임의 페이지(pokecabook 글 등)에서 (1) pokemon-card.com 공식 덱 URL과
// (2) 카드 이미지(card_images)에서 추출한 카드 ID 목록을 뽑는다.
// 사용: node scripts/scrape-page.js <url>
const puppeteer = require('puppeteer');

const url = process.argv[2];
if (!url) { console.error('URL 필요'); process.exit(1); }

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  const result = await page.evaluate(() => {
    const deckLinks = new Set();
    document.querySelectorAll('a[href*="pokemon-card.com/deck"]').forEach((a) => {
      const m = a.href.match(/deckID\/([A-Za-z0-9-]+)/);
      if (m) deckLinks.add('https://www.pokemon-card.com/deck/result.html/deckID/' + m[1] + '/');
    });
    // iframe src도 확인
    document.querySelectorAll('iframe[src*="pokemon-card.com/deck"]').forEach((f) => {
      const m = f.src.match(/deckID\/([A-Za-z0-9-]+)/);
      if (m) deckLinks.add('https://www.pokemon-card.com/deck/result.html/deckID/' + m[1] + '/');
    });
    const re = /card_images\/large\/([^/]+)\/(\d+)_([A-Z]+)_([^.\/]+)\./;
    const cards = new Map();
    document.querySelectorAll('img').forEach((img) => {
      const m = (img.src || '').match(re);
      if (!m) return;
      const id = String(parseInt(m[2], 10));
      if (!cards.has(id)) cards.set(id, { id, set: m[1], type: m[3], romaji: m[4] });
    });
    return { deckLinks: [...deckLinks], cards: [...cards.values()] };
  });

  console.log('deckLinks:', JSON.stringify(result.deckLinks));
  console.log('cardImages:', result.cards.length);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
