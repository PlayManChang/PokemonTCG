// 각 아키타입의 pokecabook 글에서 대표(첫) 공식 덱 URL을 찾아 그 덱의 카드 목록을 스크랩한다.
// 결과: data/sources/decks/{id}.json. 사용: node scripts/build-decks.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ARCHETYPES = [
  { id: 'nzoroark',         name_ja: 'Nのゾロアークex',        tier: 2, article: 'https://pokecabook.com/archives/187344' },
  { id: 'kamitsuorochi',    name_ja: 'カミツオロチex',          tier: 3, article: 'https://pokecabook.com/archives/137510' },
  { id: 'takeraiko',        name_ja: 'タケルライコex',          tier: 3, article: 'https://pokecabook.com/archives/93261' },
  { id: 'mega-lucario',     name_ja: 'メガルカリオex',          tier: 3, article: 'https://pokecabook.com/archives/234601' },
  { id: 'shirona-garchomp', name_ja: 'シロナのガブリアスex',    tier: 3, article: 'https://pokecabook.com/archives/205226' },
  { id: 'foodin',           name_ja: 'フーディン',              tier: 3, article: 'https://pokecabook.com/archives/53696' },
  { id: 'mega-greninja',    name_ja: 'メガゲッコウガex',        tier: 3, article: 'https://pokecabook.com/archives/111205' },
  { id: 'rocket-mewtwo',    name_ja: 'ロケット団のミュウツーex', tier: 3, article: 'https://pokecabook.com/archives/214576' },
  // 🔥 최근 짐배틀 우승덱 (pokekameshi)
  { id: 'omatsuriondo',     name_ja: 'おまつりおんど',          tier: 4, article: 'https://pokekameshi.com/omatsuriondo/' },
  { id: 'mega-livolt',      name_ja: 'メガライボルトex',        tier: 4, article: 'https://pokekameshi.com/megalivoltex/' },
  { id: 'dodekabashi',      name_ja: 'ドデカバシ',              tier: 4, article: 'https://pokekameshi.com/dodekabashi/' },
];

const only = process.argv.slice(2);
const TARGETS = only.length ? ARCHETYPES.filter((a) => only.includes(a.id)) : ARCHETYPES;

const outDir = path.join(__dirname, '..', 'data', 'sources', 'decks');
fs.mkdirSync(outDir, { recursive: true });

const firstDeckUrl = (page) => page.evaluate(() => {
  for (const a of document.querySelectorAll('a[href*="pokemon-card.com/deck"]')) {
    const m = a.href.match(/deckID\/([A-Za-z0-9-]+)/);
    if (m) return 'https://www.pokemon-card.com/deck/result.html/deckID/' + m[1] + '/';
  }
  return null;
});
const deckCards = (page) => page.evaluate(() => {
  const re = /card_images\/large\/([^/]+)\/(\d+)_([A-Z]+)_([^.\/]+)\./;
  const map = new Map();
  document.querySelectorAll('img').forEach((img) => {
    const m = (img.src || '').match(re);
    if (!m) return;
    const id = String(parseInt(m[2], 10));
    if (!map.has(id)) map.set(id, { id, set: m[1], type: m[3], romaji: m[4], count: 0 });
    map.get(id).count++;
  });
  return [...map.values()];
});

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const summary = [];
  for (const a of TARGETS) {
    try {
      await page.goto(a.article, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2500));
      const deckUrl = await firstDeckUrl(page);
      if (!deckUrl) { summary.push(`${a.id}: ❌ 덱 URL 없음`); continue; }
      await page.goto(deckUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2500));
      const cards = await deckCards(page);
      if (!cards.length) { summary.push(`${a.id}: ❌ 카드 0 (${deckUrl})`); continue; }
      fs.writeFileSync(path.join(outDir, a.id + '.json'), JSON.stringify(cards, null, 2) + '\n', 'utf8');
      summary.push(`${a.id} (T${a.tier}): ${cards.length}종  ${deckUrl.match(/deckID\/([^/]+)/)[1]}`);
    } catch (e) {
      summary.push(`${a.id}: ❌ ${e.message}`);
    }
  }
  await browser.close();
  console.log(summary.join('\n'));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
