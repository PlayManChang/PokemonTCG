// 공식 카드 상세페이지에서 각 기술(ワザ)의 에너지 비용을 정확히 재수집한다.
// cards.json의 기술 보유 카드 전부를 대상으로 id별 [{name_ja, cost}] 를 모아
// data/sources/energy.json 으로 저장 → merge-cards.js가 cost_ko 교정에 사용.
// 실행: node scripts/scrape-energy.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const cardsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
const ids = [...new Set(cardsData.cards.filter((c) => (c.attacks || []).length && c.id).map((c) => String(c.id)))];

const ENERGY = { 'icon-grass':'풀','icon-fire':'불꽃','icon-water':'물','icon-electric':'번개','icon-lightning':'번개','icon-psychic':'초','icon-fighting':'격투','icon-darkness':'악','icon-dark':'악','icon-metal':'강철','icon-steel':'강철','icon-dragon':'드래곤','icon-fairy':'페어리','icon-colorless':'무색','icon-none':'무색','icon-void':'무색' };

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => { const t = r.resourceType(); if (t === 'image' || t === 'font' || t === 'media') r.abort(); else r.continue(); });

  const out = {};
  let done = 0, fail = 0;
  for (const id of ids) {
    try {
      await page.goto(`https://www.pokemon-card.com/card-search/details.php/card/${id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const atks = await page.evaluate((ENERGY) => {
        const rb = document.querySelector('.RightBox-inner');
        if (!rb) return null;
        const res = [];
        let section = '';
        for (const el of rb.children) {
          if (el.tagName === 'H2') { section = el.innerText.trim(); continue; }
          if (el.tagName === 'H4') {
            const energies = [...el.querySelectorAll('[class*="icon-"]')]
              .map((i) => { const c = [...i.classList].find((x) => ENERGY[x]); return ENERGY[c] || ''; })
              .filter(Boolean);
            const dmg = (el.querySelector('.f_right')?.innerText || '').trim();
            const name = el.innerText.replace(dmg, '').replace(/\s+/g, ' ').trim();
            // 특성(特性) 섹션의 h4는 기술이 아님 → 제외
            if (section.includes('特性')) continue;
            res.push({ name_ja: name, cost: energies.join('') });
          }
        }
        return res;
      }, ENERGY);
      if (atks && atks.length) out[id] = atks;
      done++;
      if (done % 20 === 0) process.stdout.write(` ${done}/${ids.length}`);
      else process.stdout.write('.');
    } catch (e) {
      fail++; process.stdout.write('!');
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'data', 'sources', 'energy.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(`\n저장: ${Object.keys(out).length}장 → data/sources/energy.json (실패 ${fail})`);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
