// data/sources/cards/*.json (Agent 수집·번역) + data/sources/decks/*.json (덱 스크랩)
// 을 합쳐 멀티덱/티어 구조의 data/cards.json 을 생성한다.
// 같은 이름의 재판(다른 ID)은 하나로 정규화하고, 카드가 어느 덱들에 속하는지(decks)와
// 덱별 매수(deckCounts)를 기록한다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CARDS = path.join(ROOT, 'data', 'sources', 'cards');
const DECKS_DIR = path.join(ROOT, 'data', 'sources', 'decks');
const OUT = path.join(ROOT, 'data', 'cards.json');

// 덱 레지스트리 (티어/이름/스크랩 파일)
const DECKS = [
  { id: 'dragapult',    name_ko: '드래펄트 ex',     name_ja: 'ドラパルトex',         tier: 1, file: 'x4GJ8c-Cr6ymd-GYJD8x.json', note: '현재 최강 메타' },
  { id: 'bakegakure',   name_ko: '바케가쿠레',       name_ja: 'ばけがくれ',           tier: 2, file: 'JcYG88-tChzHO-cxG8Y8.json', note: 'ジュペッタ 특성 기반' },
  { id: 'mega-drilbur', name_ko: '메가몰드류 ex',    name_ja: 'メガドリュウズex',      tier: 2, file: 'SXRpyM-pSQX3o-Syy2Rp.json', note: '강철 메가진화' },
  { id: 'nzoroark',     name_ko: 'N의 조로아크 ex',  name_ja: 'Nのゾロアークex',      tier: 2, file: 'nzoroark.json',       note: 'とりひき 드로우 엔진' },
  { id: 'kamitsuorochi', name_ko: '카미츠오로치 ex', name_ja: 'カミツオロチex',        tier: 3, file: 'kamitsuorochi.json', note: '' },
  { id: 'takeraiko',    name_ko: '타케루라이코 ex',  name_ja: 'タケルライコex',        tier: 3, file: 'takeraiko.json',     note: '' },
  { id: 'mega-lucario', name_ko: '메가루카리오 ex',  name_ja: 'メガルカリオex',        tier: 3, file: 'mega-lucario.json',  note: '' },
  { id: 'shirona-garchomp', name_ko: '시로나의 가브리아스 ex', name_ja: 'シロナのガブリアスex', tier: 3, file: 'shirona-garchomp.json', note: '' },
  { id: 'foodin',       name_ko: '후딘',             name_ja: 'フーディン',            tier: 3, file: 'foodin.json',        note: '핸드파워' },
  { id: 'mega-greninja', name_ko: '메가 겟코우가 ex', name_ja: 'メガゲッコウガex',      tier: 3, file: 'mega-greninja.json', note: '' },
  { id: 'rocket-mewtwo', name_ko: '로켓단의 뮤츠 ex', name_ja: 'ロケット団のミュウツーex', tier: 3, file: 'rocket-mewtwo.json', note: '' },
  // tier 4 = 최근 짐배틀 우승덱 (pokekameshi)
  { id: 'omatsuriondo', name_ko: '오마츠리온도(축제)', name_ja: 'おまつりおんど',     tier: 4, file: 'omatsuriondo.json', note: '최근 짐배틀 우승' },
  { id: 'mega-livolt',  name_ko: '메가 라이볼트 ex',  name_ja: 'メガライボルトex',   tier: 4, file: 'mega-livolt.json',  note: '최근 짐배틀 우승' },
  { id: 'dodekabashi',  name_ko: '도데카바시',        name_ja: 'ドデカバシ',         tier: 4, file: 'dodekabashi.json',  note: '최근 짐배틀 우승' },
  { id: 'mega-chandelure', name_ko: '메가 샹델라 ex', name_ja: 'メガシャンデラex',   tier: 4, file: 'mega-chandelure.json', note: '최근 짐배틀 우승' },
];

const BASIC_ENERGY = {
  KIHONHONOOENERUGI: ['基本炎エネルギー', '기본 불꽃 에너지', '불꽃'],
  KIHONMIZUENERUGI: ['基本水エネルギー', '기본 물 에너지', '물'],
  KIHONKUSAENERUGI: ['基本草エネルギー', '기본 풀 에너지', '풀'],
  KIHONKAMINARIENERUGI: ['基本雷エネルギー', '기본 번개 에너지', '번개'],
  KIHONCHIXYOUENERUGI: ['基本超エネルギー', '기본 초 에너지', '초'],
  KIHONTOUENERUGI: ['基本闘エネルギー', '기본 격투 에너지', '격투'],
  KIHONAKUENERUGI: ['基本悪エネルギー', '기본 악 에너지', '악'],
  KIHONHAGANEENERUGI: ['基本鋼エネルギー', '기본 강철 에너지', '강철'],
  KIHONFEARIIENERUGI: ['基本フェアリーエネルギー', '기본 페어리 에너지', '페어리'],
};

const pad6 = (id) => String(id).padStart(6, '0');
const imgUrl = (info) => info ? `https://www.pokemon-card.com/assets/images/card_images/large/${info.set}/${pad6(info.id)}_${info.type}_${info.romaji}.jpg` : '';
const normReg = (r) => (/^[A-J]$/.test((r || '').trim()) ? r.trim() : '');

// 1) 덱 스크랩 로드
const idInfo = {};            // id -> {set,type,romaji,id}
const romajiDecks = {};       // romaji -> { deckId: count }
const tierById = Object.fromEntries(DECKS.map((d) => [d.id, d.tier]));
for (const d of DECKS) {
  const p = path.join(DECKS_DIR, d.file);
  if (!fs.existsSync(p)) { console.log('⚠ 스크랩 없음:', d.file); continue; }
  for (const c of JSON.parse(fs.readFileSync(p, 'utf8'))) {
    idInfo[c.id] = { set: c.set, type: c.type, romaji: c.romaji, id: c.id };
    const r = c.romaji;
    (romajiDecks[r] = romajiDecks[r] || {});
    romajiDecks[r][d.id] = (romajiDecks[r][d.id] || 0) + (c.count || 1);
  }
}
// 1-b) 세트 스캔 로드 (덱에 없어도 세트 단위로 포함)
const SETS_DIR = path.join(ROOT, 'data', 'sources', 'sets');
const romajiSet = {}; // romaji -> setCode (세트 멤버십)
if (fs.existsSync(SETS_DIR)) {
  for (const f of fs.readdirSync(SETS_DIR).filter((x) => x.endsWith('.json'))) {
    for (const c of JSON.parse(fs.readFileSync(path.join(SETS_DIR, f), 'utf8'))) {
      if (!idInfo[c.id]) idInfo[c.id] = { set: c.set, type: c.type, romaji: c.romaji, id: c.id };
      if (!romajiSet[c.romaji]) romajiSet[c.romaji] = c.set;
    }
  }
}

const idToRomaji = Object.fromEntries(Object.values(idInfo).map((i) => [i.id, i.romaji]));

// 2) 카드 상세(번역물) 로드 → romaji 기준 정규화
const detailByRomaji = {};
const fillEmpty = (dst, src) => {
  for (const k of ['name_ja', 'name_ko', 'subtype_ko', 'type_ko', 'text_ja', 'text_ko', 'hp', 'set', 'number']) {
    if ((dst[k] === '' || dst[k] == null) && src[k]) dst[k] = src[k];
  }
  if ((!dst.abilities || !dst.abilities.length) && src.abilities && src.abilities.length) dst.abilities = src.abilities;
  if ((!dst.attacks || !dst.attacks.length) && src.attacks && src.attacks.length) dst.attacks = src.attacks;
};
if (fs.existsSync(CARDS)) {
  for (const f of fs.readdirSync(CARDS).filter((x) => x.endsWith('.json')).sort()) {
    for (const c of JSON.parse(fs.readFileSync(path.join(CARDS, f), 'utf8'))) {
      const r = idToRomaji[c.id] || c.name_ja;
      if (!detailByRomaji[r]) detailByRomaji[r] = { ...c, _romaji: r };
      else fillEmpty(detailByRomaji[r], c);
    }
  }
}

// 3) romaji별 정규화 카드 생성
const cards = [];
const missing = [];
const universe = [...new Set([...Object.keys(romajiDecks), ...Object.keys(romajiSet)])];
for (const romaji of universe) {
  let det = detailByRomaji[romaji];
  if (!det) {
    if (BASIC_ENERGY[romaji]) {
      const [nja, nko, tko] = BASIC_ENERGY[romaji];
      det = { category: 'energy', subtype_ko: '기본 에너지', name_ja: nja, name_ko: nko, type_ko: tko, abilities: [], attacks: [] };
    } else { missing.push(romaji); continue; }
  }
  const info = idInfo[det.id] || Object.values(idInfo).find((i) => i.romaji === romaji);
  const id = det.id || (info && info.id);
  const decks = Object.keys(romajiDecks[romaji] || {});
  const tiers = [...new Set(decks.map((d) => tierById[d]))].sort();
  cards.push({
    id,
    name_ja: det.name_ja || '',
    name_ko: det.name_ko || '',
    category: det.category || 'pokemon',
    subtype_ko: det.subtype_ko || '',
    hp: det.hp || null,
    type_ko: det.type_ko || '',
    regulation: normReg(det.regulation),
    abilities: det.abilities || [],
    attacks: det.attacks || [],
    text_ja: det.text_ja || '',
    text_ko: det.text_ko || '',
    set: (info && info.set) || det.set || '',
    image: imgUrl(info),
    official_url: det.official_url || (id ? `https://www.pokemon-card.com/card-search/details.php/card/${id}` : ''),
    decks,
    deckCounts: romajiDecks[romaji] || {},
    tiers,
  });
}

const catOrder = { pokemon: 0, trainer: 1, energy: 2 };
cards.sort((a, b) => (Math.min(...a.tiers) - Math.min(...b.tiers)) || (catOrder[a.category] - catOrder[b.category]));

const out = {
  decks: DECKS.map((d) => ({ id: d.id, name_ko: d.name_ko, name_ja: d.name_ja, tier: d.tier, note: d.note })),
  cards,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

const per = {};
cards.forEach((c) => (per[c.category] = (per[c.category] || 0) + 1));
console.log('cards.json:', cards.length, '장(정규화)', JSON.stringify(per));
DECKS.forEach((d) => console.log(`  [T${d.tier}] ${d.name_ko}: ${cards.filter((c) => c.decks.includes(d.id)).length}종`));
console.log('이미지 연결:', cards.filter((c) => c.image).length, '| 특성:', cards.filter((c) => c.abilities.length).length, '| 기술:', cards.filter((c) => c.attacks.length).length);
const noAbilityText = cards.flatMap((c) => (c.abilities || []).filter((a) => (a.name_ko || a.name_ja) && !a.text_ko).map(() => c.name_ko));
if (noAbilityText.length) console.log('⚠ 특성효과 비어있음:', noAbilityText.join(', '));
if (missing.length) console.log('⚠ 상세 누락(미수집):', missing.join(', '));
