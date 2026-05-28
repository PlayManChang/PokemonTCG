// data/sources/cards/*.json (Agent 수집·번역) + 덱 스크래핑(이미지 URL/매수)을
// 합쳐 data/cards.json 을 생성한다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'sources', 'cards');
const DECKS = path.join(ROOT, 'data', 'sources', 'decks');
const OUT = path.join(ROOT, 'data', 'cards.json');

const DECK = {
  id: 'dragapult',
  name_ko: '드래펄트 ex',
  name_ja: 'ドラパルトex',
  tier: 'Tier 1',
  note: '2026년 5월 현재 최강 메타 (출처: pokecabook)',
  deckFile: 'x4GJ8c-Cr6ymd-GYJD8x.json',
};

// 덱 스크래핑으로 이미지 URL / 매수 맵 구성
const pad6 = (id) => String(id).padStart(6, '0');
const imgMap = new Map();
const scrapePath = path.join(DECKS, DECK.deckFile);
if (fs.existsSync(scrapePath)) {
  for (const c of JSON.parse(fs.readFileSync(scrapePath, 'utf8'))) {
    const url = `https://www.pokemon-card.com/assets/images/card_images/large/${c.set}/${pad6(c.id)}_${c.type}_${c.romaji}.jpg`;
    imgMap.set(String(c.id), { image: url, set: c.set, count: c.count || 1 });
  }
}

// 기본 에너지(설명 불필요)
const energies = [
  { id: 42780, name_ja: '基本炎エネルギー', name_ko: '기본 불꽃 에너지', type_ko: '불꽃' },
  { id: 42783, name_ja: '基本超エネルギー', name_ko: '기본 초 에너지', type_ko: '초' },
  { id: 42785, name_ja: '基本悪エネルギー', name_ko: '기본 악 에너지', type_ko: '악' },
];

const normReg = (r) => (/^[A-J]$/.test((r || '').trim()) ? r.trim() : '');

const cards = [];
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort() : [];
for (const f of files) {
  for (const c of JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))) {
    const meta = imgMap.get(String(c.id)) || {};
    cards.push({
      id: c.id,
      deck: DECK.id,
      category: c.category,
      subtype_ko: c.subtype_ko || '',
      name_ja: c.name_ja || '',
      name_ko: c.name_ko || '',
      hp: c.hp || null,
      type_ko: c.type_ko || '',
      regulation: normReg(c.regulation),
      abilities: c.abilities || [],
      attacks: c.attacks || [],
      text_ja: c.text_ja || '',
      text_ko: c.text_ko || '',
      set: meta.set || c.set || '',
      number: c.number || '',
      count: meta.count || 1,
      image: meta.image || '',
      official_url: c.official_url || `https://www.pokemon-card.com/card-search/details.php/card/${c.id}`,
    });
  }
}

for (const e of energies) {
  const meta = imgMap.get(String(e.id)) || {};
  cards.push({
    id: e.id, deck: DECK.id, category: 'energy', subtype_ko: '기본 에너지',
    name_ja: e.name_ja, name_ko: e.name_ko, hp: null, type_ko: e.type_ko,
    regulation: '', abilities: [], attacks: [], text_ja: '', text_ko: '',
    set: meta.set || '', number: '', count: meta.count || 1, image: meta.image || '',
    official_url: `https://www.pokemon-card.com/card-search/details.php/card/${e.id}`,
  });
}

const order = { pokemon: 0, trainer: 1, energy: 2 };
cards.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9));

const out = {
  decks: [{ id: DECK.id, name_ko: DECK.name_ko, name_ja: DECK.name_ja, tier: DECK.tier, note: DECK.note }],
  cards,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

const per = {};
cards.forEach((c) => (per[c.category] = (per[c.category] || 0) + 1));
console.log('cards.json 생성:', cards.length, '장 →', JSON.stringify(per));
console.log('이미지 연결:', cards.filter((c) => c.image).length, '| 특성 보유:', cards.filter((c) => c.abilities.length).length, '| 기술 보유:', cards.filter((c) => c.attacks.length).length);
