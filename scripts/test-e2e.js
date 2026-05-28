// Puppeteer(헤드리스 Chrome) E2E 스모크 테스트.
// 자체 정적 서버를 띄우고 실제 브라우저로 앱을 검증한다.
// 실행: node scripts/test-e2e.js   (npm test)
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = 8199;
const BASE = `http://localhost:${PORT}`;

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.log('  ❌ ' + msg); }
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'terms.json'), 'utf8'));
  const total = data.terms.length;
  const greetingsCount = data.terms.filter((t) => t.category === 'greetings').length;
  const cardData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
  const firstDeck = cardData.decks.slice().sort((a, b) => a.tier - b.tier)[0].id;
  const deckCards = cardData.cards.filter((c) => (c.decks || []).includes(firstDeck));
  const deckTotal = deckCards.length;
  const deckPokemon = deckCards.filter((c) => c.category === 'pokemon').length;

  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780, isMobile: true }); // 휴대폰 크기

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  try {
    console.log('\n[1] 첫 로딩 & 렌더링');
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.term', { timeout: 5000 });
    const cardCount = await page.$$eval('.term', (els) => els.length);
    assert(cardCount === total, `용어 카드 ${cardCount}개 렌더 (데이터 ${total}개와 일치)`);
    const countText = await page.$eval('#resultCount', (e) => e.textContent);
    assert(countText.includes(String(total)), `결과 카운트 표시: "${countText}"`);

    console.log('\n[2] 검색');
    await page.type('#search', 'ありがとう');
    await new Promise((r) => setTimeout(r, 250));
    const searchCount = await page.$$eval('.term', (els) => els.length);
    assert(searchCount >= 1 && searchCount < total, `"ありがとう" 검색 → ${searchCount}개 (필터링 동작)`);
    const hasMark = await page.$('.term mark');
    assert(!!hasMark, '검색어 하이라이트(<mark>) 표시됨');

    console.log('\n[3] 검색 지우기');
    await page.click('#clearSearch');
    await new Promise((r) => setTimeout(r, 200));
    const afterClear = await page.$$eval('.term', (els) => els.length);
    assert(afterClear === total, `검색 지우면 전체 ${afterClear}개 복원`);

    console.log('\n[4] 카테고리 칩');
    await page.click('.chip[data-id="greetings"]');
    await new Promise((r) => setTimeout(r, 200));
    const greetCount = await page.$$eval('.term', (els) => els.length);
    assert(greetCount === greetingsCount, `'인사·매너' 칩 → ${greetCount}개 (데이터 ${greetingsCount}개와 일치)`);
    await page.click('.chip[data-id="all"]');
    await new Promise((r) => setTimeout(r, 200));

    console.log('\n[5] 즐겨찾기');
    await page.$eval('.term .fav-btn', (b) => b.click());
    await new Promise((r) => setTimeout(r, 150));
    await page.click('.chip[data-id="fav"]');
    await new Promise((r) => setTimeout(r, 200));
    const favCount = await page.$$eval('.term', (els) => els.length);
    assert(favCount === 1, `즐겨찾기 1개 추가 후 '즐겨찾기' 칩 → ${favCount}개`);

    console.log('\n[6] 발음 듣기 버튼');
    await page.click('.chip[data-id="all"]');
    await new Promise((r) => setTimeout(r, 150));
    await page.$eval('.term .icon-btn', (b) => b.click()); // 🔊
    assert(true, '🔊 버튼 클릭 시 예외 없음');

    console.log('\n[7] 스크린샷');
    fs.mkdirSync(path.join(ROOT, 'test-output'), { recursive: true });
    await page.click('.chip[data-id="greetings"]');
    await new Promise((r) => setTimeout(r, 200));
    const shot = path.join(ROOT, 'test-output', 'mobile-greetings.png');
    await page.screenshot({ path: shot });
    assert(fs.existsSync(shot), `스크린샷 저장: test-output/mobile-greetings.png`);

    console.log('\n[8] 카드 검색 페이지 (티어→덱→레시피)');
    // 카드 이미지는 외부(pokemon-card.com) 리소스라 CI 안정성을 위해 DOM 기준으로 대기
    await page.goto(BASE + '/cards.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pcard', { timeout: 8000 });
    const pcardCount = await page.$$eval('.pcard', (e) => e.length);
    assert(pcardCount === deckTotal, `기본 덱(${firstDeck}) ${pcardCount}종 렌더 (데이터 ${deckTotal}종과 일치)`);
    const hasAbility = await page.$('.pblock.ability');
    const hasAttack = await page.$('.pblock.attack');
    assert(!!hasAbility && !!hasAttack, '특성·기술 블록이 렌더됨');
    const abilityText = await page.$$eval('.pblock.ability .pblock-text', (els) => els.filter((e) => e.textContent.trim()).length);
    assert(abilityText >= 1, `특성 효과 내용(한국어)도 표시됨 (${abilityText}건)`);

    console.log('\n[9] 검색 + 카테고리 + 티어 전환');
    await page.type('#search', 'ベンチ');
    await new Promise((r) => setTimeout(r, 250));
    const sc = await page.$$eval('.pcard', (e) => e.length);
    assert(sc >= 1 && sc <= deckTotal, `"ベンチ"(벤치) 검색 → ${sc}종 (필터링 동작)`);
    await page.click('#clearSearch');
    await new Promise((r) => setTimeout(r, 150));
    await page.click('#chips .chip[data-id="pokemon"]');
    await new Promise((r) => setTimeout(r, 200));
    const pk = await page.$$eval('.pcard', (e) => e.length);
    assert(pk === deckPokemon, `'포켓몬' 필터 → ${pk}종 (데이터 ${deckPokemon}종과 일치)`);
    await page.click('#chips .chip[data-id="all"]');
    await new Promise((r) => setTimeout(r, 150));
    await page.click('.tier-row .chip[data-id="2"]');
    await new Promise((r) => setTimeout(r, 300));
    const t2 = await page.$$eval('.pcard', (e) => e.length);
    assert(t2 >= 1, `Tier 2 전환 → 덱 카드 ${t2}종 표시`);

    console.log('\n[10] 햄버거 메뉴');
    await page.click('#menuBtn');
    await new Promise((r) => setTimeout(r, 150));
    const menuLinks = await page.$$eval('.nav-menu a', (els) => els.length);
    const menuVisible = await page.$eval('.nav-menu', (e) => !e.hidden);
    assert(menuVisible && menuLinks === 3, `메뉴 열림 + 링크 ${menuLinks}개(용어집/카드검색/환경분석)`);

    console.log('\n[11] 콘솔 에러');
    const realErrors = consoleErrors.filter((e) => !/favicon|speech|voices|pokemon-card\.com|net::ERR/i.test(e));
    assert(realErrors.length === 0, `콘솔 에러 ${realErrors.length}건` + (realErrors.length ? ': ' + realErrors.join('; ') : ''));
  } catch (e) {
    failed++;
    console.log('  ❌ 예외 발생: ' + e.message);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n=== 결과: ${passed} 통과 / ${failed} 실패 ===`);
  process.exit(failed ? 1 : 0);
})();
