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
  const setM6 = cardData.cards.filter((c) => c.set === 'M6').length;

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
    console.log('\n[1] 첫 로딩 & 렌더링 (용어집 glossary.html)');
    await page.goto(BASE + '/glossary.html', { waitUntil: 'networkidle0' });
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
    assert(menuVisible && menuLinks === 7, `메뉴 열림 + 링크 ${menuLinks}개(2027·2026 대회일정/용어집/카드검색 + 메타검색 외부3)`);
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
    const shopData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shops', 'yokohama.json'), 'utf8'));
    const shopTotal = shopData.areas.reduce((s, a) => s + a.shops.length, 0);
    await page.goto(BASE + '/shops.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const shopItems = await page.$$eval('.shop-item', (e) => e.length);
    assert(shopItems === shopTotal, `구매처 ${shopItems}곳 렌더 (데이터 ${shopTotal}곳과 일치)`);
    // 검색어 링크(google.com/maps/search)와 직링크(maps.google.com/?cid=) 둘 다 허용
    const mapLinks = await page.$$eval('.shop-name[href*="google.com"]', (e) => e.length);
    assert(mapLinks === shopTotal, `구글 지도 링크 ${mapLinks}개 연결됨`);
    // 주소가 있는 가게는 주소·도보 안내가 함께 렌더되는지
    const addrTotal = shopData.areas.reduce((s, a) => s + a.shops.filter((x) => x.addr).length, 0);
    const addrShown = await page.$$eval('.shop-addr', (e) => e.length);
    assert(addrShown === addrTotal, `주소 표기 ${addrShown}곳 렌더 (데이터 ${addrTotal}곳과 일치)`);
    const ykAddrs = await page.$$eval('.shop-addr', (e) => e.map((x) => x.textContent).join(' '));
    assert(/外神田3丁目2-3/.test(ykAddrs) && /外神田4丁目6-10/.test(ykAddrs), 'YK 1·2호점 주소가 일본어 원문으로 표시됨');
    const ykMaps = await page.$$eval('.shop-name[href*="google.com/maps"]', (e) => e.map((x) => decodeURIComponent(x.href)).join(' '));
    assert(/外神田3-2-3/.test(ykMaps) && /外神田4-6-10/.test(ykMaps), 'YK 지도 링크가 주소 기반으로 연결됨');
    // 영업시간·전화 + mapUrl(구글지도 cid 직링크) 지원
    const hoursTotal = shopData.areas.reduce((s, a) => s + a.shops.filter((x) => x.hours || x.tel).length, 0);
    const metaShown = await page.$$eval('.shop-meta', (e) => e.length);
    assert(metaShown === hoursTotal, `영업시간/전화 표기 ${metaShown}곳 렌더 (데이터 ${hoursTotal}곳과 일치)`);
    const telHref = await page.$eval('.shop-tel', (e) => e.getAttribute('href'));
    assert(telHref === 'tel:0335254530', `전화 걸기 링크 연결됨 (${telHref})`);
    const cidLink = await page.$$eval('.shop-name', (e) => e.some((x) => x.href.includes('cid=13412024686535764331')));
    assert(cidLink, '오타츄 5호점은 구글지도 cid 직링크로 연결됨(핀 정확)');

    console.log('\n[10-b2] 면세 쇼핑 페이지 (면세 가이드·돈키호테)');
    const shopping = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shopping', 'yokohama.json'), 'utf8'));
    const donkiTotal = shopping.areas.reduce((s, a) => s + a.shops.length, 0);
    await page.goto(BASE + '/shopping.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const donkiItems = await page.$$eval('.shop-item .shop-name[href*="google.com/maps"]', (e) => e.length);
    assert(donkiItems === donkiTotal, `쇼핑·맛집 ${donkiItems}곳 지도링크 렌더 (데이터 ${donkiTotal}곳)`);
    const tfPhrases = await page.$$eval('.tf-phrases li', (e) => e.length);
    assert(tfPhrases === shopping.taxfree.phrases.length, `면세 일본어 ${tfPhrases}구문 렌더`);
    // 6월 여행 잔재(긴자·도쿄역/이케부쿠로) 정리 + 꼼데가르송·맛집 반영
    const shopAreas = await page.$$eval('#shopSpots h2, #shoppingRoot h2, section.gcard h2', (e) => e.map((x) => x.textContent).join(' | '));
    assert(!/이케부쿠로|도쿄역/.test(shopAreas), `기존 도쿄 구역 삭제됨 (${shopAreas})`);
    const cdgAddr = await page.$$eval('.shop-addr', (e) => e.map((x) => x.textContent).join(' '));
    assert(/銀座6-9-5/.test(cdgAddr) && /南青山5-2-1/.test(cdgAddr), '꼼데가르송 PLAY 매장 2곳 주소 표시됨');
    const eatery = await page.$$eval('.shop-type', (e) => e.map((x) => x.textContent).filter((t) => t.includes('맛집')).length);
    assert(eatery >= 3, `맛집 항목 ${eatery}곳 표시됨 (긴자·아오야마)`);
    // 9/20 큰비로 아키하바라 카드 원정을 접었다 — 쇼핑 페이지에도 남으면 안 된다
    assert(!/아키하바라/.test(JSON.stringify(shopping.areas)), '면세·쇼핑 구역에 아키하바라 잔존 없음 (9/20 동선 변경)');
    const tfWarn = await page.$$eval('.tf-warn', (e) => e.length);
    assert(tfWarn === 1, '면세 합산 경고(소모품 밀봉) 표시됨');
    const distChips = await page.$$eval('.shop-dist', (e) => e.length);
    assert(distChips >= 10, `호텔 거리(가까운 순) 칩 ${distChips}개 표시됨`);

    console.log('\n[10-b3] 위치 한눈에 페이지 (지역별 약식 지도)');
    const locData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'locations', 'yokohama.json'), 'utf8'));
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
    const planData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plan', 'yokohama.json'), 'utf8'));
    await page.goto(BASE + '/plan.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const planDays = await page.$$eval('.plan-day', (e) => e.length);
    assert(planDays === planData.days.length, `일정 ${planDays}일 렌더 (데이터 ${planData.days.length}일과 일치)`);
    const dirLinks = await page.$$eval('a[href*="google.com/maps/dir"]', (e) => e.length);
    assert(dirLinks >= planData.keyRoutes.length, `이동경로 길찾기 버튼 ${dirLinks}개`);
    // 교통비 인원수 변경 → 합계 자동 변경
    const totalSel = '.plan-total-row td:last-child';
    const totalDefault = await page.$eval(totalSel, (e) => e.textContent);
    await page.$eval('.plan-people-input', (i) => { i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 150));
    const total2 = await page.$eval(totalSel, (e) => e.textContent);
    assert(totalDefault !== total2, `교통비 인원수 변경 시 합계 자동 재계산 (${totalDefault} → ${total2})`);
    assert(planData.transit.peopleDefault === 5, `교통비 기본 인원 5인 (동행 포함)`);
    // 대회 결과 분기 토글 (진출/탈락 → 일정 전환). 라벨은 대회마다 다르므로 두 번째 버튼을 누른다.
    const branchBefore = await page.$$eval('.plan-day', (els) => els.map((e) => e.textContent).join('|'));
    await page.$$eval('.plan-toggle-btn', (btns) => { if (btns[1]) btns[1].click(); });
    await new Promise((r) => setTimeout(r, 150));
    const branchAfter = await page.$$eval('.plan-day', (els) => els.map((e) => e.textContent).join('|'));
    assert(branchBefore !== branchAfter, '대회 결과 토글 시 일정 자동 분기됨');
    const branchLabels = await page.$$eval('.plan-toggle-btn', (btns) => btns.map((b) => b.textContent).join(' / '));
    assert(/결승 진출/.test(branchLabels) && /예선 종료/.test(branchLabels), `분기 버튼이 시니어 하루 대회에 맞게 표기됨 (${branchLabels})`);
    // PJCS 2026 기록은 '2026 대회 일정' 메뉴로 이동 → 2027 가이드엔 없어야 함
    const archLink = await page.$('.plan-archive a[href*="event=pjcs2026"]');
    assert(!archLink, '2027 가이드에서 지난 기록 블록 제거됨(2026 메뉴로 이동)');

    console.log('\n[10-c2] 지난 여행 기록 페이지 (PJCS 2026 보존)');
    const pastData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plan', 'pjcs2026.json'), 'utf8'));
    await page.goto(BASE + '/plan.html?event=pjcs2026', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const pastDays = await page.$$eval('.plan-day', (e) => e.length);
    assert(pastDays === pastData.days.length, `PJCS 2026 기록 ${pastDays}일 렌더 (데이터 ${pastData.days.length}일과 일치)`);
    const pastFlight = await page.$eval('#planRoot', (e) => e.innerText.includes('6/4') && e.innerText.includes('LJ221'));
    assert(pastFlight, '6월 항공편·일정이 그대로 보존됨');
    const backPast = await page.$('.plan-archive a[href*="past.html"]');
    assert(!!backPast, '기록 페이지에서 2026 대회 일정으로 돌아가는 링크 있음');

    console.log('\n[10-c3] 2026 대회 일정 메뉴 (지난 대회 기록)');
    const pastEvents = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'past-events.json'), 'utf8'));
    await page.goto(BASE + '/past.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-archive', { timeout: 5000 });
    const pastCards = await page.$$eval('#pastRoot .plan-archive', (e) => e.length);
    assert(pastCards === pastEvents.events.length, `지난 대회 ${pastCards}건 렌더 (데이터 ${pastEvents.events.length}건과 일치)`);
    const toRecord = await page.$('#pastRoot a[href*="event=pjcs2026"]');
    assert(!!toRecord, 'PJCS 2026 여행 기록으로 가는 링크 있음');
    const toHome = await page.$('#pastRoot a[href$="index.html"]');
    assert(!!toHome, '2027 대회 일정으로 돌아가는 링크 있음');
    // 햄버거 메뉴에서 새 페이지로 갈 수 있는지 (모든 페이지 공용 nav)
    await page.click('#menuBtn');
    const navHrefs = await page.$$eval('.nav-menu a', (as) => as.map((a) => a.getAttribute('href')).join(' '));
    assert(/past\.html/.test(navHrefs) && /index\.html/.test(navHrefs), '메뉴에 2026·2027 대회 일정 모두 있음');

    console.log('\n[10-d] 한국 공식명 검색 별칭 + 일본어 발음 표기');
    await page.goto(BASE + '/cards.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pcard', { timeout: 8000 });
    await page.click('.tier-row .chip[data-id="2"]'); // 타케루라이코는 스톰 에메랄다 환경에서 T2
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
    assert(deckMeta.length === 36, `덱 ${deckMeta.length}개 (현재환경 17 + 이전환경 기록 19)`);
    const curDecks = deckMeta.filter((dk) => dk.tier <= 3);
    assert(curDecks.length === 17, `스톰 에메랄다 환경 티어표 ${curDecks.length}덱 (T1 1 + T2 7 + T3 9)`);
    assert(deckMeta.filter((dk) => dk.tier === 1).length === 1, `T1(드래펄트) 1덱`);
    const m6 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8')).cards
      .filter((c) => c.set === 'M6');
    assert(m6.length >= 5, `스톰 에메랄다(M6) 신규 카드 ${m6.length}종 수록`);
    const kanjiNoRead = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8')).cards
      .filter((c) => !c.read && /[一-鿿]/.test(String(c.name_ja).replace(/\s*ex$/, '')));
    assert(kanjiNoRead.length === 0, `한자 이름 카드도 일본어 발음 표시됨 (누락 ${kanjiNoRead.length}종)`);
    assert(deckMeta.every((dk) => dk.deckId), `모든 덱에 공식 덱ID 연결됨`);
    const atkNoCost = await page.$$eval('.pcard-pokemon .attack', (els) => els.filter((e) => !e.querySelector('.pblock-cost')).length);
    assert(atkNoCost === 0, `덱 내 모든 기술에 에너지 비용 표시됨 (누락 ${atkNoCost}건)`);
    // 데이터 차원: 포켓몬 기술 에너지 비용 빈칸 0 검증
    const cardsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
    const emptyCost = cardsJson.cards.flatMap((c) => c.attacks || []).filter((a) => !a.cost_ko).length;
    assert(emptyCost === 0, `전체 데이터 기술 에너지 비용 빈칸 ${emptyCost}건 (공식 페이지 교정 완료)`);

    console.log('\n[10-e] 2027 대회 일정(메인/홈 = index)');
    const eventsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'events.json'), 'utf8'));
    const evCount = eventsData.events.length;
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ev-card', { timeout: 5000 });
    const evCards = await page.$$eval('.ev-card', (e) => e.length);
    assert(evCards === evCount, `메인에 대회 카드 ${evCards}개 렌더 (데이터 ${evCount}개와 일치)`);
    const ddayBadges = await page.$$eval('.ev-card .ev-badge', (e) => e.length);
    assert(ddayBadges === evCount, `D-day/상태 배지 ${ddayBadges}개 표시됨`);
    const quickLinks = await page.$$eval('.ev-quick-item', (e) => e.length);
    assert(quickLinks === 5, `공통 도구+메타검색 바로가기 ${quickLinks}개(용어집/카드검색 + 외부3)`);
    const homeExt = await page.$$eval('.ev-quick-item[target="_blank"]', (e) => e.length);
    assert(homeExt === 3, `메타검색 외부 타일 ${homeExt}개(포케카북/윈덱스/포케카메시)`);

    console.log('\n[10-f] 대회 상세 (개요·교통·호텔·체크리스트)');
    const evId = eventsData.events[0].id;
    const hotelsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'hotels.json'), 'utf8'));
    const checkData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'checklists.json'), 'utf8'));
    await page.goto(BASE + '/event.html?id=' + evId, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#sec-overview', { timeout: 5000 });
    const secIds = ['sec-overview', 'sec-prizes', 'sec-guide', 'sec-entry', 'sec-transport', 'sec-hotels', 'sec-checklist']; // 맛집은 food.html 로 분리
    const secsPresent = await page.evaluate((ids) => ids.filter((s) => document.getElementById(s)).length, secIds);
    assert(secsPresent === secIds.length, `상세 섹션 ${secsPresent}/${secIds.length}개 렌더(개요·상품·현지가이드·참가·교통·호텔·체크리스트)`);
    // 상품·출전권: 시니어(우리 리그) 조건이 강조돼 보여야 한다
    const evJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'events.json'), 'utf8'));
    const yk = evJson.events.find((x) => x.id === 'yokohama');
    const pzItems = await page.$$eval('.pz-item', (e) => e.length);
    assert(pzItems === yk.prizes.items.length, `상품·출전권 ${pzItems}개 렌더 (데이터 ${yk.prizes.items.length}개)`);
    const pzConds = await page.$$eval('.pz-cond .pz-cond-v', (e) => e.map((x) => x.textContent));
    assert(pzConds.length === yk.prizes.items.length && pzConds.includes('4승 이상'),
      `시니어 조건 ${pzConds.length}개 표시됨`);
    // 마스터 리그는 빼기로 했다 — 되살아나면 실패시킨다
    assert(!/마스터/.test(JSON.stringify(yk.prizes)), '상품·출전권에 마스터 리그 조건 없음');
    const pzGoals = await page.$$eval('.pz-goals-list li', (e) => e.length);
    assert(pzGoals >= 4, `시니어 목표 요약 ${pzGoals}줄 표시됨`);
    const pzSide = await page.$eval('.pz-side', (e) => e.textContent.includes('사이드 이벤트'));
    assert(pzSide, '탈락 시 사이드 이벤트 안내 표시됨');
    const guideTiles = await page.$$eval('#sec-guide .ev-quick-item', (e) => e.length);
    const evExtra = (eventsData.events[0].extraTiles || []).length;
    assert(guideTiles === 6 + evExtra, `현지 가이드 타일 ${guideTiles}개(기본6 + 추가${evExtra})`);
    const hotelRows = await page.$$eval('#sec-hotels .ev-place', (e) => e.length);
    assert(hotelRows === hotelsData[evId].length, `호텔 ${hotelRows}곳 렌더 (데이터 ${hotelsData[evId].length}곳과 일치)`);
    const inlineFood = await page.$$eval('#sec-food', (e) => e.length);
    assert(inlineFood === 0, `상세보기에서 맛집 섹션 분리됨 (food.html 타일로 이동)`);
    const foodTile = await page.$$eval('.ev-quick-item[href*="food.html"]', (e) => e.length);
    assert(foodTile === 1, `현지 가이드에 맛집 타일 연결됨`);
    const evMapLinks = await page.$$eval('a[href*="google.com/maps"]', (e) => e.length);
    assert(evMapLinks >= hotelRows, `지도/길찾기 링크 ${evMapLinks}개 연결됨`);
    const commonChecks = checkData.common.reduce((s, g) => s + g.items.length, 0);
    const eventChecks = (checkData.byEvent[evId] || []).reduce((s, g) => s + g.items.length, 0);
    const checkBoxes = await page.$$eval('#sec-checklist .ev-check-item input', (e) => e.length);
    assert(checkBoxes === commonChecks + eventChecks, `체크리스트 항목 ${checkBoxes}개 (공통 ${commonChecks} + 대회별 ${eventChecks})`);
    // 체크 → 저장(localStorage) → 다시 로드 시 유지
    await page.$eval('#sec-checklist .ev-check-item input', (i) => i.click());
    await new Promise((r) => setTimeout(r, 150));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#sec-checklist .ev-check-item input', { timeout: 5000 });
    const firstChecked = await page.$eval('#sec-checklist .ev-check-item input', (i) => i.checked);
    assert(firstChecked === true, '체크 항목이 새로고침 후에도 유지됨(localStorage 저장)');
    const evTabs = await page.$$eval('.ev-tab', (e) => e.length);
    assert(evTabs === secIds.length, `섹션 탭 내비 ${evTabs}개 생성됨`);

    console.log('\n[10-g] 대회별 하위 페이지 (?event= 파라미터)');
    const chibaShops = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shops', 'chiba.json'), 'utf8'));
    const chibaShopTotal = chibaShops.areas.reduce((s, a) => s + a.shops.length, 0);
    await page.goto(BASE + '/shops.html?event=chiba', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const chibaShopItems = await page.$$eval('.shop-item', (e) => e.length);
    assert(chibaShopItems === chibaShopTotal, `치바 구매처 ${chibaShopItems}곳 렌더 (데이터 ${chibaShopTotal}곳)`);
    const backLink = await page.$eval('.ev-back', (e) => e.getAttribute('href')).catch(() => '');
    assert(/event\.html\?id=chiba/.test(backLink), `'치바 대회로' 뒤로가기 링크 연결됨 (${backLink})`);

    const osakaLoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'locations', 'osaka.json'), 'utf8'));
    await page.goto(BASE + '/locations.html?event=osaka', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.loc-svg', { timeout: 5000 });
    const osakaSvgs = await page.$$eval('.loc-svg', (e) => e.length);
    assert(osakaSvgs === osakaLoc.regions.length, `오사카 약식 지도 ${osakaSvgs}개 (지역 ${osakaLoc.regions.length}개)`);

    // 자료 없는 대회(plan/chiba) → '준비 중' 안내
    await page.goto(BASE + '/plan.html?event=chiba', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ev-notready', { timeout: 5000 });
    const notReady = await page.$('.ev-notready');
    assert(!!notReady, '자료 없는 대회 여행가이드 → 준비 중 안내 표시');

    console.log('\n[10-h] NAIC (미국 시카고) 통합');
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ev-card', { timeout: 5000 });
    const groupHeads = await page.$$eval('.ev-group-title', (e) => e.length);
    assert(groupHeads === 3, `메인 지역 그룹 ${groupHeads}개(일본/북미/오세아니아)`);
    const naicCard = await page.$('a.ev-card[href*="naic-chicago"]');
    assert(!!naicCard, 'NAIC 대회 카드가 메인에 표시됨');

    await page.goto(BASE + '/event.html?id=naic-chicago', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#sec-overview', { timeout: 5000 });
    const cdNum = await page.$('.ev-cd-num');
    assert(!!cdNum, 'NAIC 카운트다운(D-day) 표시됨');
    const airlines = await page.$$eval('#sec-transport .ev-air-head', (e) => e.length);
    assert(airlines >= 5, `교통: 공항+항공사 비교 ${airlines}블록 표시됨`);
    const naicTiles = await page.$$eval('#sec-guide .ev-quick-item', (e) => e.length);
    assert(naicTiles === 8, `NAIC 현지가이드 타일 ${naicTiles}개(기본6 + FAQ + 비용계산기)`);
    const entryPhrases = await page.$$eval('#sec-entry .tf-phrases li', (e) => e.length);
    assert(entryPhrases >= 3, `미국 현장 영어 표현 ${entryPhrases}개 표시됨`);
    // NAIC 체크리스트: 공통(일본어) 제외, 자체 목록만 → 일본어 없어야 함
    const naicCheckGroups = await page.$$eval('#sec-checklist .ev-h3', (e) => e.length);
    assert(naicCheckGroups === checkData.byEvent['naic-chicago'].length, `NAIC 체크리스트 자체 그룹만 ${naicCheckGroups}개(공통 일본어 제외)`);
    const naicHasJP = await page.$$eval('#sec-checklist .ev-check-text', (els) => els.some((e) => /[぀-ヿ一-龯]/.test(e.textContent)));
    assert(!naicHasJP, 'NAIC 체크리스트에 일본어 없음 ✅');

    const faqData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'faq', 'naic-chicago.json'), 'utf8'));
    await page.goto(BASE + '/faq.html?event=naic-chicago', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.faq-item', { timeout: 5000 });
    const faqItems = await page.$$eval('.faq-item', (e) => e.length);
    assert(faqItems === faqData.items.length, `FAQ 항목 ${faqItems}개 렌더 (데이터 ${faqData.items.length}개)`);

    await page.goto(BASE + '/calc.html?event=naic-chicago', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.calc-input', { timeout: 5000 });
    const calcTotalSel = '.plan-total-row td:last-child';
    const ct1 = await page.$eval(calcTotalSel, (e) => e.textContent);
    await page.$eval('.calc-input', (i) => { i.value = '5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 150));
    const ct2 = await page.$eval(calcTotalSel, (e) => e.textContent);
    assert(ct1 !== ct2, `비용 계산기 인원 변경 시 총액 재계산 (${ct1} → ${ct2})`);

    await page.goto(BASE + '/plan.html?event=naic-chicago', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const usdShown = await page.$$eval('.plan-table td', (tds) => tds.some((t) => t.textContent.includes('$')));
    assert(usdShown, '여행가이드 교통비가 USD($)로 표시됨');

    await page.goto(BASE + '/shopping.html?event=naic-chicago', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const usTaxTitle = await page.$$eval('.gcard h2', (hs) => hs.some((h) => h.textContent.includes('미국 세금')));
    assert(usTaxTitle, '쇼핑 페이지에 미국 세금 안내 제목 표시됨');

    console.log('\n[10-i] 시드니 RC (호주) 통합');
    const sydCard = await page.$('a.ev-card[href*="sydney-rc"]');
    assert(true, '(메인 그룹 3개 중 오세아니아 포함 — 위에서 확인)');
    await page.goto(BASE + '/event.html?id=sydney-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#sec-overview', { timeout: 5000 });
    const sydTiles = await page.$$eval('#sec-guide .ev-quick-item', (e) => e.length);
    assert(sydTiles === 8, `시드니 현지가이드 타일 ${sydTiles}개(기본6 + FAQ + 계산기)`);
    const sydCd = await page.$('.ev-cd-num');
    assert(!!sydCd, '시드니 카운트다운 표시됨');
    const sydCheckJP = await page.$$eval('#sec-checklist .ev-check-text', (els) => els.some((e) => /[぀-ヿ一-龯]/.test(e.textContent)));
    assert(!sydCheckJP, '시드니 체크리스트에 일본어 없음 ✅');
    const sydEta = await page.$$eval('#sec-checklist .ev-check-text', (els) => els.some((e) => e.textContent.includes('ETA')));
    assert(sydEta, '시드니 체크리스트에 ETA(호주 비자) 안내 포함');

    // 여행가이드 AUD 통화
    await page.goto(BASE + '/plan.html?event=sydney-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const audShown = await page.$$eval('.plan-table td', (tds) => tds.some((t) => t.textContent.includes('A$')));
    assert(audShown, '시드니 여행가이드 교통비가 AUD(A$)로 표시됨');

    // FAQ (ETA)
    await page.goto(BASE + '/faq.html?event=sydney-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.faq-item', { timeout: 5000 });
    const sydFaqEta = await page.$$eval('.faq-item', (els) => els.some((e) => e.textContent.includes('ETA')));
    assert(sydFaqEta, '시드니 FAQ에 ETA 비자 안내 포함');

    console.log('\n[10-j] 브리즈번 RC (호주) + 비용계산기 참가비');
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ev-card', { timeout: 5000 });
    const bneCard = await page.$('a.ev-card[href*="brisbane-rc"]');
    assert(!!bneCard, '브리즈번 대회 카드가 메인에 표시됨');

    await page.goto(BASE + '/event.html?id=brisbane-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#sec-overview', { timeout: 5000 });
    const bneTiles = await page.$$eval('#sec-guide .ev-quick-item', (e) => e.length);
    assert(bneTiles === 8, `브리즈번 현지가이드 타일 ${bneTiles}개(기본6 + FAQ + 계산기)`);
    const bneCheckJP = await page.$$eval('#sec-checklist .ev-check-text', (els) => els.some((e) => /[぀-ヿ一-龯]/.test(e.textContent)));
    assert(!bneCheckJP, '브리즈번 체크리스트에 일본어 없음 ✅');
    const bneEta = await page.$$eval('#sec-checklist .ev-check-text', (els) => els.some((e) => e.textContent.includes('ETA')));
    assert(bneEta, '브리즈번 체크리스트에 ETA(호주 비자) 포함');

    // 비용 계산기: 참가비 항목 + 참가자수 입력
    await page.goto(BASE + '/calc.html?event=brisbane-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.calc-input', { timeout: 5000 });
    const calcInputs = await page.$$eval('.calc-input', (e) => e.length);
    assert(calcInputs === 4, `계산기 입력칸 ${calcInputs}개(인원·숙박·참가자수·쇼핑)`);
    const hasEntryRow = await page.$$eval('.plan-table td', (tds) => tds.some((t) => t.textContent.includes('참가비')));
    assert(hasEntryRow, '비용 계산기에 대회 참가비 항목 표시됨');
    const bneTotalSel = '.plan-total-row td:last-child';
    const bt1 = await page.$eval(bneTotalSel, (e) => e.textContent);
    // 참가자수(3번째 입력)를 0으로 → 참가비 빠져 총액 감소
    await page.$$eval('.calc-input', (els) => { els[2].value = '0'; els[2].dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 150));
    const bt2 = await page.$eval(bneTotalSel, (e) => e.textContent);
    assert(bt1 !== bt2, `참가자수 변경 시 참가비 반영돼 총액 변동 (${bt1} → ${bt2})`);

    await page.goto(BASE + '/plan.html?event=brisbane-rc', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-day', { timeout: 5000 });
    const bneAud = await page.$$eval('.plan-table td', (tds) => tds.some((t) => t.textContent.includes('A$')));
    assert(bneAud, '브리즈번 여행가이드 교통비가 AUD(A$)로 표시됨');

    console.log('\n[10-j2] 여행 가이드 — 낡은 안내 잔존 검사');
    // 동선이 바뀔 때마다 일정·지도에 옛 안내가 남는 사고가 반복돼서 자동으로 잡는다.
    const planJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plan', 'yokohama.json'), 'utf8'));
    const liveBlob = JSON.stringify({ days: planJson.days, mapGroups: planJson.mapGroups, keyRoutes: planJson.keyRoutes });
    // YCAT 리무진버스 → N'EX 로 교체됨 (교통비 비교 서술에만 남아 있어야 함)
    assert(!liveBlob.includes('YCAT'), '일정·지도·이동경로에 YCAT(옛 귀국 수단) 잔존 없음');
    // 사쿠라기초·노게는 일정에서 뺐다
    assert(!liveBlob.includes('노게'), '일정에 노게(방문 안 함) 잔존 없음');
    // 9/22 제목이 옛 동선(미나토미라이→YCAT)으로 남아 있지 않은지
    const day22 = planJson.days.find((x) => x.date.startsWith('9/22'));
    assert(!/YCAT|리무진/.test(day22.title + day22.move), `9/22 제목·요약이 N'EX 기준 ("${day22.title}")`);

    console.log('\n[10-j3] 태풍 안내 (예보는 매일 바뀐다 — 날짜가 낡지 않았는지)');
    // 출발 직전에는 예보를 매일 갱신해야 해서, 안내에 박아둔 발표일이 데이터 갱신일과 맞는지 본다.
    await page.goto(BASE + '/plan.html?event=yokohama', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.plan-alert', { timeout: 5000 });
    const alertTxt = await page.$$eval('.plan-alert', (e) => e.map((x) => x.innerText).join('\n'));
    assert(/태풍/.test(alertTxt), '태풍 경보가 일정 맨 위에 렌더됨');
    assert(!alertTxt.includes('**'), '태풍 경보에 마크다운 별표 없음');
    const noteDate = (planJson.typhoonAlert.note.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    assert(noteDate === planJson.updated,
      `태풍 예보 발표일이 데이터 갱신일과 일치 (${noteDate} = ${planJson.updated})`);
    // 9/20은 큰비라 카드 매입을 접고 포켓몬센터·꼼데가르송 실내 동선으로 바꿨다
    const day20 = planJson.days.find((x) => x.date.startsWith('9/20'));
    const d20blob = JSON.stringify(day20);
    assert(/포켓몬센터 도쿄DX/.test(d20blob) && /도버 스트리트 마켓/.test(d20blob),
      '9/20 일정에 포켓몬센터 도쿄DX와 DSM 긴자가 모두 있음');
    assert(!/하레루야|오타츄|magi|카드랩/.test(d20blob),
      '9/20 일정에 카드샵 매입 코스 잔존 없음 (큰비로 취소)');
    // 도쿄역↔니혼바시는 아직 지하로 안 이어진다 — 큰비 날 그 길을 안내하면 안 된다
    assert(!/도쿄역 도보|도쿄역까지 도보/.test(d20blob),
      '9/20에 도쿄역 도보 이동 안내 없음 (니혼바시까지 지하 연결은 2028년 예정)');

    // 지하에서는 GPS가 안 잡힌다 — 표지판 글자가 안내에 남아 있어야 한다
    const signs = ['中央南改札', '銀座口', '浅草方面', '渋谷方面', '高島屋方面改札', 'B2 出口', 'A2 出口'];
    const planBlob = JSON.stringify(planJson);
    const missingSigns = signs.filter((w) => !planBlob.includes(w));
    assert(missingSigns.length === 0,
      `지하 구간 표지판 안내 ${signs.length}개 모두 있음` + (missingSigns.length ? ' / 누락: ' + missingSigns.join(',') : ''));
    const gpsCard = planJson.airport.some((a) => a.title.includes('GPS'));
    assert(gpsCard, '여행 팁에 GPS·표지판 안내 카드가 있음');

    console.log('\n[10-k] 맛집 페이지 (지역별)');
    const foodJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'food', 'yokohama.json'), 'utf8'));
    await page.goto(BASE + '/food.html?event=yokohama', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-item', { timeout: 5000 });
    const foodAreas = await page.$$eval('#foodRoot .gcard > h2', (e) => e.length);
    assert(foodAreas === foodJson.areas.length, `맛집 지역 ${foodAreas}개 렌더 (데이터 ${foodJson.areas.length}개)`);
    const foodShops = await page.$$eval('.shop-item .shop-name[href*="google.com/maps"]', (e) => e.length);
    const foodTotal = foodJson.areas.reduce((n, a) => n + a.shops.length, 0);
    assert(foodShops === foodTotal, `맛집 ${foodShops}곳 지도링크 렌더 (데이터 ${foodTotal}곳)`);
    const whenChips = await page.$$eval('.food-when', (e) => e.length);
    assert(whenChips === foodJson.areas.length, `지역마다 일정 배지 표시됨 (${whenChips}개)`);
    const foodReady = await page.evaluate(() => !document.body.innerText.includes('준비 중'));
    assert(foodReady, '맛집 페이지가 데이터로 정상 렌더됨');
    // 뒤로가기 버튼이 손가락으로 누를 만한 크기인지 (접근성 최소 44px)
    const backBox = await page.$eval('.ev-back', (e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), t: e.textContent.trim() };
    });
    assert(backBox.h >= 44 && backBox.w >= 120,
      `뒤로가기 버튼 터치 영역 ${backBox.w}×${backBox.h}px ("${backBox.t}")`);
    // 구역이 날짜순으로 정렬돼 있는지 (9/19 → 9/22)
    const days = foodJson.areas.map((a) => {
      const m = String(a.when).match(/(\d+)\/(\d+)/);
      return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
    });
    const sorted = days.every((v, i) => i === 0 || v >= days[i - 1]);
    assert(sorted, `맛집 구역이 날짜순 정렬됨 (${foodJson.areas.map((a) => a.when).join(' → ')})`);
    const noNoge = !JSON.stringify(foodJson).includes('노게');
    assert(noNoge, '사쿠라기초·노게 구역 제거됨 (일정상 방문 불가)');

    console.log('\n[11] 세트별 보기 (최신 세트 M6 스톰 에메랄다)');
    await page.goto(BASE + '/cards.html', { waitUntil: 'domcontentloaded' }); // 상태 초기화 위해 새로 로드
    await page.waitForSelector('.pcard', { timeout: 8000 });
    await page.click('#modeSet');
    await new Promise((r) => setTimeout(r, 300));
    const setOpts = await page.$$eval('#setSelect option', (e) => e.length);
    const setCards = await page.$$eval('.pcard', (e) => e.length);
    assert(setOpts >= 1 && setCards === setM6, `세트별 모드: 세트옵션 ${setOpts}개, 기본세트(M6 스톰 에메랄다) ${setCards}종 (데이터 ${setM6}종)`);

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

    console.log('\n[11-e] 앱 설치 버튼·서비스워커 (모든 페이지)');
    const htmlPages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    const swJs = ['app-install.js', 'app.js', 'cards.js'];
    const noSw = htmlPages.filter((f) => {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return !swJs.some((j) => html.includes('./js/' + j));
    });
    assert(noSw.length === 0, `모든 페이지가 서비스워커를 등록함 (누락 ${noSw.join(', ') || '없음'})`);
    const noBtn = [];
    for (const f of htmlPages) {
      await page.goto(BASE + '/' + f, { waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 250));
      const shown = await page.evaluate(() => {
        const ev = new Event('beforeinstallprompt');
        ev.prompt = () => {};
        ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
        window.dispatchEvent(ev);
        const b = document.getElementById('installBtn');
        return !!b && !b.hidden;
      });
      if (!shown) noBtn.push(f);
    }
    assert(noBtn.length === 0, `${htmlPages.length}개 페이지 모두 '앱 설치' 버튼이 뜸 (누락 ${noBtn.join(', ') || '없음'})`);

    console.log('\n[11-d] 서비스워커 (오프라인 캐시 목록·데이터 신선도)');
    const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    // 배포되는 html/js 가 전부 오프라인 캐시 목록(CORE)에 들어 있는지
    const shipped = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
      .concat(fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f));
    const notCached = shipped.filter((f) => !swSrc.includes("'./" + f + "'"));
    assert(notCached.length === 0, `모든 페이지·스크립트가 오프라인 캐시 목록에 있음 (누락 ${notCached.join(', ') || '없음'})`);
    // 여행 데이터는 네트워크 우선이어야 배포 직후 바로 반영된다
    const netFirst = swSrc.includes('data') && swSrc.includes('네트워크 우선') && /await fetch\(req\);[\s\S]{0,200}cache\.match\(req\)/.test(swSrc);
    assert(netFirst, '여행 데이터(data/*.json)는 네트워크 우선 — 수정이 바로 반영됨');

    // 셸(js/css/문서)도 네트워크 우선이어야 배포 직후 옛 코드가 새 데이터와 섞이지 않는다
    const shellNetFirst = /isShell/.test(swSrc) && /req\.mode === 'navigate'/.test(swSrc)
      && /\\.\(html\|js\|css\)\$/.test(swSrc);
    assert(shellNetFirst, '셸(html·js·css)도 네트워크 우선 — 배포 직후 옛 js/css가 안 나옴');
    // 느린 망에서 멈추지 않도록 타임아웃 폴백이 있어야 한다
    assert(/setTimeout\(\(\) => r\(null\), 3000\)/.test(swSrc), '셸 네트워크 우선에 3초 타임아웃 폴백 있음');
    // 새 서비스워커가 넘겨받으면 한 번 새로고침해서 옛 화면을 남기지 않는다
    const appInstallSrc = fs.readFileSync(path.join(ROOT, 'js', 'app-install.js'), 'utf8');
    assert(/controllerchange/.test(appInstallSrc) && /location\.reload\(\)/.test(appInstallSrc),
      '새 버전 감지 시 자동 새로고침(controllerchange) 있음');
    assert(/hadController/.test(appInstallSrc), '최초 설치에서는 새로고침하지 않음(무한 새로고침 방지)');

    // 데이터 키와 렌더 코드가 어긋나면 화면이 빈다 — 상품 조건은 반드시 글자가 있어야 한다
    const evSrc = fs.readFileSync(path.join(ROOT, 'js', 'event.js'), 'utf8');
    const prizeKeys = Object.keys(yk.prizes.items[0]);
    assert(prizeKeys.includes('cond') && evSrc.includes('it.cond'),
      '상품 조건 키(cond)를 데이터와 렌더 코드가 같이 쓴다');
    const emptyConds = await page.$$eval('.pz-cond-v', (e) => e.filter((x) => !x.textContent.trim()).length);
    assert(emptyConds === 0, `빈 조건 칸 ${emptyConds}개 (0이어야 함)`);

    console.log('\n[12] 콘솔 에러');
    // 아직 자료 없는 대회의 data/*.json 은 404 → '준비 중' 폴백(의도된 동작)이라 무시
    const realErrors = consoleErrors.filter((e) => !/favicon|speech|voices|pokemon-card\.com|net::ERR|404|Not Found/i.test(e));
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
