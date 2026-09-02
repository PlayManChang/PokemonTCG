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
// deckId = 공식 덱뷰어(pokemon-card.com/deck/result.html/deckID/...) 전체 덱리스트 보기용
const DECKS = [
  // ── 현재 환경: 스톰 에메랄다(M6, 2026-07-31 발매) ──
  // 티어표 출처: pokekameshi 2026-08-24 · 덱리스트는 공식 덱뷰어에서 스크랩
  // 🆕 = 스톰 에메랄다 환경에서 새로 티어표에 들어온 덱
  { id: 'dragapult',       name_ko: '드래펄트 ex',               name_ja: 'ドラパルトex',             tier: 1, file: 'niLLgQ-YL6A8Y-gQQn9N.json', note: '환경 최강(1강). 스톰 에메랄다 환경에서도 자리를 지킴 — 요노와르 「커스드 밤」으로 벤치를 저격하고 팬텀다이브로 마무리. 모든 덱이 드래펄트 대책 필수 (2026.08)', deckId: 'niLLgQ-YL6A8Y-gQQn9N' },
  { id: 'mega-rayquaza',   name_ko: '메가레쿠쟈 ex',              name_ja: 'メガレックウザex',           tier: 2, file: '1kvFVF-JDWJKx-k5fkkb.json', note: '🆕 스톰 에메랄다 간판. 특성 「패자의 포효」로 벤치에 나오며 에너지를 가속하고, 「스톰 에메랄다」는 자기 포켓몬 전원의 에너지 수 ×50 — 후반 폭발력 최고', deckId: '1kvFVF-JDWJKx-k5fkkb' },
  { id: 'takeraiko',       name_ko: '타케루라이코 ex',             name_ja: 'タケルライコex',            tier: 2, file: 'kVdb5F-ZkgmrI-Fkf1V5.json', note: '오거폰과 함께 에너지를 대량으로 붙여 한 방을 노리는 속공형', deckId: 'kVdb5F-ZkgmrI-Fkf1V5' },
  { id: 'foodin',          name_ko: '후딘',                    name_ja: 'フーディン',               tier: 2, file: 'MX2Uyp-wLeekg-ppRRMp.json', note: '핸드파워. 상대 패를 말려 판을 잠그는 컨트롤', deckId: 'MX2Uyp-wLeekg-ppRRMp' },
  { id: 'garura-box',      name_ko: '캥카 박스',                 name_ja: 'ガルーラボックス',            tier: 2, file: '9iLQQg-IZmSbV-NningL.json', note: '🆕 메가 캥카 ex 중심의 굿스터프. 파이어로 ex 「익사이트 다이브」로 벤치 전개가 빨라져 티어2 진입', deckId: '9iLQQg-IZmSbV-NningL' },
  { id: 'omatsuriondo',    name_ko: '오마츠리온도(축제)',            name_ja: 'おまつりおんど',             tier: 2, file: 'QLLgH9-dlyOhY-Nnging.json', note: '「축제 회장」이 깔려 있으면 토사킨토·아즈마오우가 기술을 2연타. 스타디움 관리가 생명', deckId: 'QLLgH9-dlyOhY-Nnging' },
  { id: 'nzoroark',        name_ko: 'N의 조로아크 ex',            name_ja: 'Nのゾロアークex',           tier: 2, file: 'ppXMUX-Qecj3h-yySRpM.json', note: '핸데스(손패 파괴) 전략으로 T1에 대항', deckId: 'ppXMUX-Qecj3h-yySRpM' },
  { id: 'yadoking',        name_ko: '야도킹',                   name_ja: 'ヤドキング',               tier: 2, file: 'fFkFbk-LG7BwQ-vVF1Vk.json', note: '기술·특성으로 상대 움직임을 제한하는 방해형', deckId: 'fFkFbk-LG7BwQ-vVF1Vk' },
  { id: 'mega-lucario',    name_ko: '메가루카리오 ex',             name_ja: 'メガルカリオex',            tier: 3, file: 'UR2MXy-P7Pfrq-pMypUy.json', note: '', deckId: 'UR2MXy-P7Pfrq-pMypUy' },
  { id: 'bashadorapa',     name_ko: '바샤 드래펄트',               name_ja: 'バシャードラパ',             tier: 3, file: 'kFbb1V-8nVmCY-1FkfFf.json', note: '🆕 드래펄트 + 번치코 조합. 에너지 가속으로 팬텀다이브 타이밍을 앞당긴 변형', deckId: 'kFbb1V-8nVmCY-1FkfFf' },
  { id: 'mary-orronge',    name_ko: '마리의 오롱털 ex',            name_ja: 'マリィのオーロンゲex',         tier: 3, file: 'kFkfbb-t1JgQb-5VFfvF.json', note: '', deckId: 'kFkfbb-t1JgQb-5VFfvF' },
  { id: 'bakegakure',      name_ko: '바케가쿠레',                 name_ja: 'ばけがくれ',               tier: 3, file: '2pyEyy-CgxY47-pURREp.json', note: '특성으로 상대 기술·특성을 무시. 야바소차를 트래시에 쌓아 전체 데미지를 노린다', deckId: '2pyEyy-CgxY47-pURREp' },
  { id: 'shirona-garchomp', name_ko: '시로나의 가브리아스 ex',         name_ja: 'シロナのガブリアスex',         tier: 3, file: 'LnQi9n-TWLU6N-PgNLgN.json', note: '', deckId: 'LnQi9n-TWLU6N-PgNLgN' },
  { id: 'mega-drilbur',    name_ko: '메가몰드류 ex',              name_ja: 'メガドリュウズex',           tier: 3, file: 'pppRMX-JZDwG9-XyUSSU.json', note: '드래펄트 대항 메타 — 게노세크트·메타그로스 조합', deckId: 'pppRMX-JZDwG9-XyUSSU' },
  { id: 'strindar',        name_ko: '스트린더',                  name_ja: 'ストリンダー',              tier: 3, file: 'pMMpRM-dzaTgl-EypUyp.json', note: '🆕 스트린더 중심의 악 타입. 아라불타케·모모와로우로 독을 얹어 굳힌다', deckId: 'pMMpRM-dzaTgl-EypUyp' },
  { id: 'mega-greninja',   name_ko: '메가 겟코우가 ex',            name_ja: 'メガゲッコウガex',           tier: 3, file: 'vbFkw1-fA38fT-FFVFkF.json', note: '', deckId: 'vbFkw1-fA38fT-FFVFkF' },
  { id: 'kamitsuorochi',   name_ko: '카미츠오로치 ex',             name_ja: 'カミツオロチex',            tier: 3, file: 'RyMy2X-YlWV4K-2pyUX2.json', note: '오거폰 초록가면으로 에너지를 대며 카미츠오로치로 때리는 안정형. 시티리그 우승 다수', deckId: 'RyMy2X-YlWV4K-2pyUX2' },
  // ── 이전 환경(어비스아이 M5, 2026-05~06) 기록 — 카드 풀 유지용 ──
  { id: 'rocket-mewtwo', name_ko: '로켓단의 뮤츠 ex', name_ja: 'ロケット団のミュウツーex', tier: 4, file: 'rocket-mewtwo.json', note: '', deckId: 'cGc84x-CnvrtW-GYxx8c' },
  { id: 'mega-venusaur', name_ko: '메가 이상해꽃 ex', name_ja: 'メガフシギバナex', tier: 4, file: 'vwkvkb-tw6BXE-kF1kfF.json', note: 'HP380 고내구. 솔라트랜스로 에너지 이동, 정글덤프 240. 5/23 세키치쿠배 우승', deckId: 'vwkvkb-tw6BXE-kF1kfF' },
  { id: 'mega-livolt',  name_ko: '메가 라이볼트 ex',  name_ja: 'メガライボルトex',   tier: 4, file: 'mega-livolt.json',  note: '', deckId: 'nnHLNn-6zLr6V-gigQ9Q' },
  { id: 'dodekabashi',  name_ko: '도데카바시',        name_ja: 'ドデカバシ',         tier: 4, file: 'dodekabashi.json',  note: '', deckId: 'nQgPnN-FUmwSI-Qn9inn' },
  { id: 'mega-chandelure', name_ko: '메가 샹델라 ex', name_ja: 'メガシャンデラex',   tier: 4, file: 'mega-chandelure.json', note: '', deckId: 'J8Jxxc-iAMkjI-8DcGcY' },
  { id: 'wailord',         name_ko: '고래왕',           name_ja: 'ホエルオーex',        tier: 4, file: 'wailord.json',         note: '쥬레곤 컨트롤', deckId: 'GGcaD8-P89wLv-88DcaY' },
  { id: 'riguree-control', name_ko: '리그레 컨트롤',     name_ja: 'リグレーコントロール', tier: 4, file: 'riguree-control.json', note: '컨트롤', deckId: 'HinHn9-k9H1jV-gNnngQ' },
  { id: 'mega-garura',     name_ko: '메가 캥카 ex',      name_ja: 'メガガルーラex',       tier: 4, file: 'mega-garura.json',     note: '', deckId: 'yRM3yp-xRqcOP-SyMypp' },
  { id: 'mega-absol',      name_ko: '메가 앱솔 ex',      name_ja: 'メガアブソルex',       tier: 4, file: 'mega-absol.json',      note: '', deckId: 'cYc8xY-ktp0Nc-8aYcKG' },
  { id: 'olive',           name_ko: '올리르바 ex',       name_ja: 'オリーヴァex',         tier: 4, file: 'olive.json',           note: '', deckId: 'bkb5kk-3T370E-V5FwFv' },
  { id: 'iineinu',         name_ko: '이이네이누',        name_ja: 'イイネイヌ',          tier: 4, file: 'iineinu.json',         note: '', deckId: 'ySp3yy-BiMqtw-MR3ppp' },
  { id: 'mega-starmie',    name_ko: '메가 아쿠스타 ex',   name_ja: 'メガスターミーex',     tier: 4, file: 'mega-starmie.json',    note: '', deckId: 'pRS3Sp-QPdXt2-yypyyR' },
  { id: 'daigo-metagross', name_ko: '다이고의 메타그로스 ex', name_ja: 'ダイゴのメタグロスex', tier: 4, file: 'daigo-metagross.json', note: '', deckId: 'kF5v5k-ubmgBy-bwkFFb' },
  { id: 'sazandora',       name_ko: '삼삼드래 ex',       name_ja: 'サザンドラex',         tier: 4, file: 'sazandora.json',       note: '', deckId: '8Y4cGJ-cJXj8k-K4Kcx8' },
  { id: 'ogerpon-bullet',  name_ko: '오거폰 불릿',       name_ja: 'オーガポンバレット',   tier: 4, file: 'ogerpon-bullet.json',  note: '오거폰 다타입 운용. 2026.06 피피/오거폰형이 駿河屋CS(126명) 우승', deckId: 'p3SySX-3ZRLMK-Ryp22y' },
  { id: 'rampardos',        name_ko: '램펄드 ex',        name_ja: 'ラムパルドex',        tier: 4, file: 'rampardos.json',        note: '화석·고타점', deckId: 'cYcaY8-Xz7M6k-DcGc8D' },
  { id: 'mega-charizard-x', name_ko: '메가 리자몽 X ex',  name_ja: 'メガリザードンXex',    tier: 4, file: 'mega-charizard-x.json', note: '불꽃 고화력', deckId: 'ySyp2R-UqbO1K-SXSM3p' },
  { id: 'cinccino',         name_ko: '치라치노 ex',      name_ja: 'チラチーノex',        tier: 4, file: 'cinccino.json',         note: '코인 회피', deckId: 'iQng69-nLb2QT-nLgnnN' },
  { id: 'mega-darkrai',     name_ko: '메가 다크라이 ex',  name_ja: 'メガダークライex',     tier: 4, file: 'mega-darkrai.json',     note: '악 메가', deckId: 'x8DYGD-wPy64o-YccJ8G' },
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

// 일본어 음역 카드의 한국 공식명 별칭(검색용). name_ja → 한국명.
// (name_ko가 이미 한국 공식명인 카드는 불필요 — 검색이 이미 됨)
const KO_ALIAS = {
  'タケルライコ': '우레이충', 'タケルライコex': '우레이충 우레이충ex',
  'カミツオロチ': '과미드라', 'カミツオロチex': '과미드라 과미드라ex',
};

// 가타카나/히라가나 → 한글 발음 (일본어 읽는 법). 카나로만 된 이름에만 적용.
const KANA_DI = {
  'キャ':'캬','キュ':'큐','キョ':'쿄','ギャ':'갸','ギュ':'규','ギョ':'교','シャ':'샤','シュ':'슈','ショ':'쇼',
  'ジャ':'자','ジュ':'주','ジョ':'조','チャ':'차','チュ':'추','チョ':'초','ニャ':'냐','ニュ':'뉴','ニョ':'뇨',
  'ヒャ':'햐','ヒュ':'휴','ヒョ':'효','ビャ':'뱌','ビュ':'뷰','ビョ':'뵤','ピャ':'퍄','ピュ':'퓨','ピョ':'표',
  'ミャ':'먀','ミュ':'뮤','ミョ':'묘','リャ':'랴','リュ':'류','リョ':'료','シェ':'셰','ジェ':'제','チェ':'체',
  'ティ':'티','ディ':'디','トゥ':'투','ドゥ':'두','ファ':'파','フィ':'피','フェ':'페','フォ':'포','フュ':'퓨',
  'ウィ':'위','ウェ':'웨','ウォ':'워','ヴァ':'바','ヴィ':'비','ヴェ':'베','ヴォ':'보','ツァ':'차','ツェ':'체','ツォ':'초','イェ':'예',
};
const KANA_BA = {
  'ア':'아','イ':'이','ウ':'우','エ':'에','オ':'오','カ':'카','キ':'키','ク':'쿠','ケ':'케','コ':'코',
  'ガ':'가','ギ':'기','グ':'구','ゲ':'게','ゴ':'고','サ':'사','シ':'시','ス':'스','セ':'세','ソ':'소',
  'ザ':'자','ジ':'지','ズ':'즈','ゼ':'제','ゾ':'조','タ':'타','チ':'치','ツ':'츠','テ':'테','ト':'토',
  'ダ':'다','ヂ':'지','ヅ':'즈','デ':'데','ド':'도','ナ':'나','ニ':'니','ヌ':'누','ネ':'네','ノ':'노',
  'ハ':'하','ヒ':'히','フ':'후','ヘ':'헤','ホ':'호','バ':'바','ビ':'비','ブ':'부','ベ':'베','ボ':'보',
  'パ':'파','ピ':'피','プ':'푸','ペ':'페','ポ':'포','マ':'마','ミ':'미','ム':'무','メ':'메','モ':'모',
  'ヤ':'야','ユ':'유','ヨ':'요','ラ':'라','リ':'리','ル':'루','レ':'레','ロ':'로','ワ':'와','ヲ':'오','ヴ':'부',
  'ァ':'아','ィ':'이','ゥ':'우','ェ':'에','ォ':'오',
};
function addFinal(ch, f) { // 마지막 한글 음절에 받침 추가 (ㄴ=4, ㅅ=19)
  const c = ch.charCodeAt(0);
  if (c < 0xAC00 || c > 0xD7A3 || (c - 0xAC00) % 28 !== 0) return ch;
  return String.fromCharCode(c + f);
}
function kanaToHangul(input) {
  if (!input) return '';
  let s = input.replace(/\s*ex$/i, '').trim();
  const core = s.replace(/[ー・\s]/g, '');
  if (!core || !/^[ぁ-んァ-ヶ]+$/.test(core)) return ''; // 카나 전용 이름만
  s = s.replace(/[ぁ-ん]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60)); // 히라가나→가타카나
  const out = [];
  for (let i = 0; i < s.length;) {
    const two = s.substr(i, 2);
    if (KANA_DI[two]) { out.push(KANA_DI[two]); i += 2; continue; }
    const one = s[i];
    if (one === 'ー') { i++; continue; }
    if (one === '・' || one === ' ') { out.push(' '); i++; continue; }
    if (one === 'ッ') { if (out.length) out[out.length - 1] = addFinal(out[out.length - 1], 19); i++; continue; }
    if (one === 'ン') { if (out.length) out[out.length - 1] = addFinal(out[out.length - 1], 4); i++; continue; }
    if (KANA_BA[one]) { out.push(KANA_BA[one]); i++; continue; }
    i++;
  }
  let r = out.join('').trim();
  if (/\s*ex$/i.test(input)) r += ' ex';
  return r;
}

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
// 1-a) 등록되지 않은 덱 스크랩도 ID→romaji 매핑에만 사용한다.
// (덱 레지스트리에서 빠진 옛 덱의 카드 ID로 작성된 기존 번역이 유실되지 않도록)
for (const f of fs.readdirSync(DECKS_DIR).filter((x) => x.endsWith('.json'))) {
  for (const c of JSON.parse(fs.readFileSync(path.join(DECKS_DIR, f), 'utf8'))) {
    if (!idInfo[c.id]) idInfo[c.id] = { set: c.set, type: c.type, romaji: c.romaji, id: c.id };
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

// 에너지 비용 교정 데이터(공식 페이지 재수집) — scripts/scrape-energy.js 생성
const ENERGY_FILE = path.join(ROOT, 'data', 'sources', 'energy.json');
const energyOverride = fs.existsSync(ENERGY_FILE) ? JSON.parse(fs.readFileSync(ENERGY_FILE, 'utf8')) : {};
// 한자가 섞인 이름은 kanaToHangul이 읽지 못하므로, 가나 표기를 따로 공급한다.
const KANA_FILE = path.join(ROOT, 'data', 'sources', 'kana.json');
const kanaOverride = fs.existsSync(KANA_FILE) ? JSON.parse(fs.readFileSync(KANA_FILE, 'utf8')) : {};
const readOf = (ja) => kanaToHangul(kanaOverride[ja] || ja);

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
  const nameJa = det.name_ja || '';
  const read = readOf(det.kana || nameJa); // 일본어 발음(한글) — kana 오버라이드 우선
  const ov = energyOverride[String(id)] || []; // 공식 페이지 기반 에너지 비용 교정
  const abilities = (det.abilities || []).map((a) => ({ ...a, read: readOf(a.name_ja || '') }));
  const attacks = (det.attacks || []).map((a, idx) => {
    let cost = a.cost_ko || '';
    const m = ov.find((x) => x.name_ja === a.name_ja) || (ov.length === (det.attacks || []).length ? ov[idx] : null);
    if (m && m.cost != null) cost = m.cost; // 정확한 에너지로 덮어쓰기
    return { ...a, cost_ko: cost, read: readOf(a.name_ja || '') };
  });
  cards.push({
    id,
    name_ja: nameJa,
    name_ko: det.name_ko || '',
    read: (read && read !== (det.name_ko || '')) ? read : '',
    alias: KO_ALIAS[nameJa] || '',
    category: det.category || 'pokemon',
    subtype_ko: det.subtype_ko || '',
    hp: det.hp || null,
    type_ko: det.type_ko || '',
    regulation: normReg(det.regulation),
    abilities,
    attacks,
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
  decks: DECKS.map((d) => ({ id: d.id, name_ko: d.name_ko, name_ja: d.name_ja, tier: d.tier, note: d.note, deckId: d.deckId || '' })),
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
