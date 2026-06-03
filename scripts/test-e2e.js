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
  const setM5 = cardData.cards.filter((c) => c.set === 'M5').length;

  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], protocolTimeout: 180000 });
  const page = await browser.newPage();
  // 외부 카드 이미지(pokemon-card.com) 로딩으로 인한 지연/타임아웃 방지 (로직만 검증)
  await page.setRequestInterception(true);
  page.on('request', (r) => { if (r.resourceType() === 'image') r.abort(); else r.continue(); });
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
    assert(menuVisible && menuLinks === 10, `메뉴 열림 + 링크 ${menuLinks}개(용어집/카드검색/대회안내/구매처/면세쇼핑/위치한눈에/여행가이드 + 외부3)`);
    const extLinks = await page.$$eval('.nav-menu a[target="_blank"]', (e) => e.length);
    assert(extLinks === 3, `외부 사이트 바로가기 ${extLinks}개`);
    await page.goto(BASE + '/guide.html', { waitUntil: 'domcontentloaded' });
    const gcards = await page.$$eval('.gcard', (e) => e.length);
    assert(gcards >= 8, `대회 안내 페이지 렌더 (섹션 ${gcards}개)`);
    const pdfLinks = await page.$$eval('.rule-btns a[href$=".pdf"]', (e) => e.length);
    assert(pdfLinks === 6, `공식 룰 PDF 링크 ${pdfLinks}개 (3종 × 보기/저장)`);
    const pdfFiles = ['penalty-quickchart-ko.pdf', 'penalty-guideline-ko.pdf', 'floor-rule-ko.pdf'];
    const pdfExist = pdfFiles.every((f) => fs.existsSync(path.join(ROOT, 'docs', f)));
    assert(pdfExist, '룰 PDF 파일 3종 docs/ 존재');

    console.log('\n[10-b] 카드 구매처 페이지 (지도 링크)');
    const shopData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shops.json'), 'utf8'));
    const shopTotal = shopData.areas.reduce((s, a) => s + a.shops.length, 0);
    await page.goto(BASE + '/shops.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const shopItems = await page.$$eval('.shop-item', (e) => e.length);
    assert(shopItems === shopTotal, `구매처 ${shopItems}곳 렌더 (데이터 ${shopTotal}곳과 일치)`);
    const mapLinks = await page.$$eval('.shop-name[href*="google.com/maps"]', (e) => e.length);
    assert(mapLinks === shopTotal, `구글 지도 링크 ${mapLinks}개 연결됨`);

    console.log('\n[10-b2] 면세 쇼핑 페이지 (면세 가이드·돈키호테)');
    const shopping = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shopping.json'), 'utf8'));
    const donkiTotal = shopping.areas.reduce((s, a) => s + a.shops.length, 0);
    await page.goto(BASE + '/shopping.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const donkiItems = await page.$$eval('.shop-item .shop-name[href*="google.com/maps"]', (e) => e.length);
    assert(donkiItems === donkiTotal, `돈키호테 ${donkiItems}곳 지도링크 렌더 (데이터 ${donkiTotal}곳)`);
    const tfPhrases = await page.$$eval('.tf-phrases li', (e) => e.length);
    assert(tfPhrases === shopping.taxfree.phrases.length, `면세 일본어 ${tfPhrases}구문 렌더`);
    const tfWarn = await page.$$eval('.tf-warn', (e) => e.length);
    assert(tfWarn === 1, '면세 합산 경고(소모품 밀봉) 표시됨');
    const distChips = await page.$$eval('.shop-dist', (e) => e.length);
    assert(distChips >= 10, `호텔 거리(가까운 순) 칩 ${distChips}개 표시됨`);

    console.log('\n[10-b3] 위치 한눈에 페이지 (지역별 약식 지도)');
    const locData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'locations.json'), 'utf8'));
    const locPts = locData.regions.reduce((s, r) => s + r.points.length, 0);
    await page.goto(BASE + '/locations.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.loc-svg', { timeout: 5000 });
    const svgCount = await page.$$eval('.loc-svg', (e) => e.length);
    assert(svgCount === locData.regions.length, `지역 약식 지도 ${svgCount}개 (지역 ${locData.regions.length}개)`);
    const dots = await page.$$eval('.loc-svg .loc-ic', (e) => e.length);
    assert(dots === locPts, `지도 점 ${dots}개 (좌표 ${locPts}개)`);
    const usedTypes = new Set();
    locData.regions.forEach((r) => r.points.forEach((p) => usedTypes.add(p.t)));
    const chips = await page.$$eval('.loc-chip', (e) => e.length);
    assert(chips === usedTypes.size, `색상+아이콘 칩 ${chips}개 (사용 종류 ${usedTypes.size}개와 일치)`);
    const legendLinks = await page.$$eval('.loc-legend .loc-seg-map[href*="google.com/maps"]', (e) => e.length);
    assert(legendLinks === locPts, `범례 지도 버튼 ${legendLinks}개 연결됨`);
    const locDirLinks = await page.$$eval('.loc-legend .loc-seg-dir[href*="google.com/maps/dir"]', (e) => e.length);
    assert(locDirLinks === locPts, `범례 길찾기 버튼 ${locDirLinks}개 연결됨`);

    console.log('\n[10-c] 여행 가이드 페이지 (지도·교통비·분기)');
    const planData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plan.json'), 'utf8'));
    await page.goto(BASE + '/plan.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const planDays = await page.$$eval('.plan-day', (e) => e.length);
    assert(planDays === planData.days.length, `일정 ${planDays}일 렌더 (데이터 ${planData.days.length}일과 일치)`);
    const dirLinks = await page.$$eval('a[href*="google.com/maps/dir"]', (e) => e.length);
    assert(dirLinks >= planData.keyRoutes.length, `이동경로 길찾기 버튼 ${dirLinks}개`);
    // 교통비 인원수 변경 → 합계 자동 변경
    const totalSel = '.plan-total-row td:last-child';
    const total3 = await page.$eval(totalSel, (e) => e.textContent);
    await page.$eval('.plan-people-input', (i) => { i.value = '5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 150));
    const total5 = await page.$eval(totalSel, (e) => e.textContent);
    assert(total3 !== total5, `교통비 인원수 변경 시 합계 자동 재계산 (${total3} → ${total5})`);
    // DAY2 분기 토글
    const day7before = await page.$$eval('.plan-day', (els) => els.find((e) => e.textContent.includes('DAY2')).textContent);
    await page.$$eval('.plan-toggle-btn', (btns) => { const b = btns.find((x) => x.textContent.includes('탈락')); if (b) b.click(); });
    await new Promise((r) => setTimeout(r, 150));
    const day7after = await page.$$eval('.plan-day', (els) => els.find((e) => e.textContent.includes('DAY2')).textContent);
    assert(day7before !== day7after, 'DAY2 진출/탈락 토글 시 일정 자동 분기됨');

    console.log('\n[10-d] 한국 공식명 검색 별칭 + 일본어 발음 표기');
    await page.goto(BASE + '/cards.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pcard', { timeout: 8000 });
    await page.click('.tier-row .chip[data-id="3"]');
    await new Promise((r) => setTimeout(r, 200));
    await page.select('#deckSelect', 'takeraiko');
    await new Promise((r) => setTimeout(r, 300));
    await page.type('#search', '우레'); // 타케루라이코 = 한국명 우레이충
    await new Promise((r) => setTimeout(r, 300));
    const aliasHit = await page.$$eval('.pcard', (e) => e.length);
    assert(aliasHit >= 1, `'우레'(한국명 우레이충) 검색 → 타케루라이코 ${aliasHit}종 매칭 (별칭 검색)`);
    await page.click('#clearSearch');
    await new Promise((r) => setTimeout(r, 150));
    await page.select('#deckSelect', 'dragapult');
    await new Promise((r) => setTimeout(r, 300));
    const readEls = await page.$$eval('.pcard-read', (e) => e.length);
    assert(readEls >= 1, `카드 이름 일본어 발음(🗣) 표기 ${readEls}건 렌더`);
    const atkReadEls = await page.$$eval('.attack .pblock-read', (e) => e.length);
    assert(atkReadEls >= 1, `기술 이름 일본어 발음 ${atkReadEls}건 렌더`);
    const deckBtn = await page.$eval('.deck-list-btn', (e) => e.href).catch(() => '');
    assert(/deck\/result\.html\/deckID\//.test(deckBtn), `전체 덱리스트(공식) 버튼 링크 연결됨`);
    const deckMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8')).decks;
    assert(deckMeta.length === 31, `덱 ${deckMeta.length}개 (마리의 오롱털 포함 31덱)`);
    assert(deckMeta.every((dk) => dk.deckId), `모든 덱에 공식 덱ID 연결됨`);
    const atkNoCost = await page.$$eval('.pcard-pokemon .attack', (els) => els.filter((e) => !e.querySelector('.pblock-cost')).length);
    assert(atkNoCost === 0, `덱 내 모든 기술에 에너지 비용 표시됨 (누락 ${atkNoCost}건)`);
    // 데이터 차원: 포켓몬 기술 에너지 비용 빈칸 0 검증
    const cardsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
    const emptyCost = cardsJson.cards.flatMap((c) => c.attacks || []).filter((a) => !a.cost_ko).length;
    assert(emptyCost === 0, `전체 데이터 기술 에너지 비용 빈칸 ${emptyCost}건 (공식 페이지 교정 완료)`);

    console.log('\n[11] 세트별 보기 (M5 아비스아이)');
    await page.goto(BASE + '/cards.html', { waitUntil: 'domcontentloaded' }); // 상태 초기화 위해 새로 로드
    await page.waitForSelector('.pcard', { timeout: 8000 });
    await page.click('#modeSet');
    await new Promise((r) => setTimeout(r, 300));
    const setOpts = await page.$$eval('#setSelect option', (e) => e.length);
    const setCards = await page.$$eval('.pcard', (e) => e.length);
    assert(setOpts >= 1 && setCards === setM5, `세트별 모드: 세트옵션 ${setOpts}개, 기본세트(M5) ${setCards}종 (데이터 ${setM5}종)`);

    console.log('\n[11-c] 헤더 스크롤 접힘 (흔들림 방지)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 150));
    const atTop = await page.$eval('.app-header', (e) => e.classList.contains('compact'));
    await page.evaluate(() => window.scrollTo(0, 400));
    await new Promise((r) => setTimeout(r, 300));
    const scrolled = await page.$eval('.app-header', (e) => e.classList.contains('compact'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));
    const backTop = await page.$eval('.app-header', (e) => e.classList.contains('compact'));
    assert(!atTop && scrolled && !backTop, `헤더 접힘 전이 정상 (맨위:${atTop}→스크롤:${scrolled}→맨위:${backTop})`);
    const anchor = await page.$eval('body', (e) => getComputedStyle(e).overflowAnchor);
    assert(anchor === 'none', `스크롤 앵커링 비활성(overflow-anchor:${anchor}) — 접힘 흔들림 차단`);

    console.log('\n[12] 콘솔 에러');
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
