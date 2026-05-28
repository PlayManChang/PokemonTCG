// data/sources/*.json 를 모두 읽어 data/terms.json 을 재생성한다 (멱등).
// 각 소스 파일은 항목 배열이며, 각 항목은 다음 형식:
//   { "ja": "...", "reading": "", "ko_pron": "...", "ko": "...",
//     "section": "기본 인사"        // 또는
//     "category": "greetings"       // 둘 중 하나로 카테고리 지정
//     "note": "", "important": true // (선택)
//   }
// 새 자료를 추가하려면 data/sources/ 에 같은 형식의 .json 파일을 넣고 이 스크립트를 다시 실행하면 된다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'sources');
const OUT = path.join(ROOT, 'data', 'terms.json');

const categories = [
  { id: 'greetings', name: '인사·매너', icon: '👋' },
  { id: 'daily',     name: '일상·여행', icon: '🍙' },
  { id: 'match',     name: '대전 진행', icon: '⚔️' },
  { id: 'check',     name: '확인·질문', icon: '💬' },
  { id: 'effect',    name: '효과·용어', icon: '✨' },
  { id: 'evolution', name: '진화',     icon: '🧬' },
  { id: 'energy',    name: '에너지',   icon: '⚡' },
  { id: 'trainer',   name: '카드·트레이너', icon: '🃏' },
  { id: 'pokecheck', name: '포켓몬체크·상태', icon: '🔄' },
  { id: 'side',      name: '사이드',   icon: '🏆' },
  { id: 'dice',      name: '주사위·코인', icon: '🎲' },
  { id: 'judge',     name: '저지',     icon: '🧑‍⚖️' },
  { id: 'numbers',   name: '숫자·시간', icon: '🔢' },
];
const validCat = new Set(categories.map((c) => c.id));

// 이미지 전사물의 구역 제목 → 카테고리 매핑
const sectionToCat = {
  '기본 인사': 'greetings',
  '게임 중 자주 쓰는 말': 'match', '전투·행동': 'match', '턴 진행': 'match',
  '턴 진행 (이어짐)': 'match', '실전에서 자주 쓰는 문장': 'match',
  '① 「특성을 사용합니다」': 'match', '② 「○○의 특성을 사용합니다」': 'match',
  '② 「○○의 특성을 사용합니다」 (예시)': 'match',
  '확인/질문할 때': 'check', '확인 / 질문할 때': 'check',
  '포켓몬 체크': 'pokecheck', '포켓몬 체크 (이어짐)': 'pokecheck',
  '⑤ 특수 상태가 됩니다 - 효과 처리할 때 자주 쓰는 말': 'pokecheck',
  '에너지 타입': 'energy', '에너지 관련': 'energy',
  '진화 단계 관련 일본어 표현 표': 'evolution',
  '아이템 사용 시 일본어 표현 표': 'trainer',
  '도구(포켓몬의 도구) 사용 시 일본어 표현 표': 'trainer',
  '스타디움 사용 시 일본어 표현 표': 'trainer',
  '서포터 사용 시 일본어 표현 표': 'trainer',
  '카드/게임 용어': 'effect', '카드 효과에서 자주 나오는 말': 'effect',
  '효과/기술 추가효과 (이어짐)': 'effect', '기술/데미지 카운터 (이어짐)': 'effect',
  '약점 계산 시 일본어 표현 표': 'effect',
  '사이드 관련': 'side',
  'サイコロ (주사위)': 'dice', '게임에서 자주 쓰이는 다른 표현 (다이스)': 'dice',
  '1. 짝수 앞면': 'dice', '2. 홀수 뒷면': 'dice',
  '숫자 (0-10)': 'numbers', '숫자 (11-19)': 'numbers',
  '숫자 20-90 (10단위)': 'numbers', '숫자 (100-1000)': 'numbers',
  '포켓몬 카드에서 자주 쓰는 숫자': 'numbers',
};

const norm = (s) => (s || '').trim();
const resolveCat = (it) => {
  if (it.category && validCat.has(it.category)) return it.category;
  const c = sectionToCat[norm(it.section)];
  return c || null;
};

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
const seen = new Map();
const unknown = new Set();
let read = 0;

for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  for (const it of arr) {
    const ja = norm(it.ja);
    if (!ja) continue;
    read++;
    const cat = resolveCat(it);
    if (!cat) unknown.add(norm(it.section) || '(빈 섹션)');
    const term = {
      category: cat || 'effect',
      ja,
      reading: norm(it.reading),
      ko_pron: norm(it.ko_pron),
      ko: norm(it.ko),
      note: norm(it.note),
      important: it.important === true || cat === 'greetings' || cat === 'check',
    };
    const k = ja + '|' + norm(it.ko);
    if (!seen.has(k)) {
      seen.set(k, term);
    } else {
      const p = seen.get(k);
      if (!p.reading && term.reading) p.reading = term.reading;
      if (!p.ko_pron && term.ko_pron) p.ko_pron = term.ko_pron;
      if (!p.note && term.note) p.note = term.note;
      if (term.important) p.important = true;
    }
  }
}

const order = Object.fromEntries(categories.map((c, i) => [c.id, i]));
const all = [...seen.values()].sort((a, b) => order[a.category] - order[b.category]);
all.forEach((t, i) => (t.id = i + 1));
const out = {
  categories,
  terms: all.map((t) => ({
    id: t.id, category: t.category, ja: t.ja, reading: t.reading,
    ko_pron: t.ko_pron, ko: t.ko, note: t.note, important: t.important,
  })),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log('소스 파일:', files.join(', '));
console.log('읽은 항목:', read, '| 중복제거 후:', all.length);
const per = {};
all.forEach((t) => (per[t.category] = (per[t.category] || 0) + 1));
console.log('카테고리별:', categories.map((c) => `${c.id}:${per[c.id] || 0}`).join('  '));
if (unknown.size) console.log('⚠ 매핑 안 된 섹션:', [...unknown]);
