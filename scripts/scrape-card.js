// 공식 카드 상세페이지에서 카드 상세(이름/HP/타입/특성/기술/설명문)를 수집한다.
// 사용: node scripts/scrape-card.js <출력파일> <id> [id...]
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUT = process.argv[2];
const IDS = process.argv.slice(3);
if (!OUT || !IDS.length) { console.error('사용: node scripts/scrape-card.js <out.json> <id...>'); process.exit(1); }

const ENERGY = { 'icon-grass':'풀','icon-fire':'불꽃','icon-water':'물','icon-electric':'번개','icon-lightning':'번개','icon-psychic':'초','icon-fighting':'격투','icon-darkness':'악','icon-dark':'악','icon-metal':'강철','icon-steel':'강철','icon-dragon':'드래곤','icon-fairy':'페어리','icon-colorless':'무색','icon-none':'무색','icon-void':'무색' };

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => { const t = r.resourceType(); if (t==='image'||t==='font'||t==='media') r.abort(); else r.continue(); });

  const out = [];
  for (const id of IDS) {
    try {
      await page.goto(`https://www.pokemon-card.com/card-search/details.php/card/${id}`, { waitUntil:'domcontentloaded', timeout:30000 });
      const c = await page.evaluate((ENERGY) => {
        const T = (el) => (el ? el.innerText.replace(/\s+/g,' ').trim() : '');
        const name = T(document.querySelector('h1.Heading1, h1'));
        const rb = document.querySelector('.RightBox-inner');
        const hpEl = document.querySelector('.mt20 .hp-num, .hp-num');
        const typeIcon = document.querySelector('.hp-type [class*="icon-"], .TypeIcon [class*="icon-"]');
        const typeCls = typeIcon ? [...typeIcon.classList].find((x)=>ENERGY[x]) : null;
        const abilities = [], attacks = [];
        let section = '', pendingH4 = null;
        if (rb) for (const el of rb.children) {
          if (el.tagName === 'H2') { section = T(el); pendingH4 = null; continue; }
          if (el.tagName === 'H4') {
            const dmg = T(el.querySelector('.f_right'));
            const nm = T(el).replace(dmg,'').replace(/\s+/g,' ').trim();
            const cost = [...el.querySelectorAll('[class*="icon-"]')]
              .map((i)=>{ const k=[...i.classList].find((x)=>ENERGY[x]); return ENERGY[k]||''; }).filter(Boolean).join('');
            pendingH4 = { section, name_ja: nm, cost_ko: cost, damage: dmg, text_ja: '' };
            (section.includes('特性') ? abilities : attacks).push(pendingH4);
            continue;
          }
          if (el.tagName === 'P' && pendingH4) { pendingH4.text_ja = T(el); pendingH4 = null; }
        }
        // 트레이너/에너지: 본문 텍스트를 별도 추출
        let trainerText = '';
        if (rb && !attacks.length && !abilities.length) {
          trainerText = [...rb.querySelectorAll('p')].map(T).filter(Boolean).join(String.fromCharCode(10));
        }
        const detailTxt = T(document.querySelector('.RightBox') || document.body);
        const numM = detailTxt.match(/(\d{3})\s*\/\s*(\d{3})/);
        const stM = detailTxt.match(/(たね|1 ?進化|2 ?進化|サポート|グッズ|スタジアム|ポケモンのどうぐ|基本エネルギー|特殊エネルギー)/);
        const subtype = stM ? stM[1] : '';
        const bodyTxt = document.body.innerText;
        const regM = bodyTxt.match(/レギュレーションマーク[：: ]*([A-Z0-9]+)/);
        return { name_ja: name, hp: hpEl ? parseInt(T(hpEl),10) : null, type_cls: typeCls ? ENERGY[typeCls] : '',
                 abilities, attacks, subtype, trainerText,
                 number: numM ? `${numM[1]}/${numM[2]}` : '',
                 regulation: regM?regM[1]:'', raw: detailTxt.slice(0, 900) };
      }, ENERGY);
      out.push({ id: Number(id), ...c });
      process.stdout.write('.');
    } catch (e) { out.push({ id:Number(id), error: e.message }); process.stdout.write('!'); }
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(`\n저장 ${out.length}장 → ${OUT}`);
})().catch((e)=>{ console.error('FAIL', e.message); process.exit(1); });
