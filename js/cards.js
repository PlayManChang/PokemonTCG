'use strict';

const state = { decks: [], cards: [], mode: 'deck', tier: null, deck: null, set: null, filter: 'all', query: '' };
const els = {
  list: document.getElementById('list'),
  chips: document.getElementById('chips'),
  tierRow: document.getElementById('tierRow'),
  deckSelect: document.getElementById('deckSelect'),
  setSelect: document.getElementById('setSelect'),
  deckSelectors: document.getElementById('deckSelectors'),
  setSelectors: document.getElementById('setSelectors'),
  modeDeck: document.getElementById('modeDeck'),
  modeSet: document.getElementById('modeSet'),
  search: document.getElementById('search'),
  clear: document.getElementById('clearSearch'),
  count: document.getElementById('resultCount'),
  empty: document.getElementById('empty'),
  deckInfo: document.getElementById('deckInfo'),
};

// 세트 코드 → 표시 이름 (확실한 것만; 나머지는 코드 그대로)
const SET_NAMES = {
  M5: '어비스아이 (최신)', M4: '메가브레이브·심포니아', M3: '무니키스제로',
  MC: '스타트덱', SV10: '로켓단의 영광', SV9: '배틀파트너스', SV8: '초전브레이커',
  SV8a: '테라스탈페스ex', SV6: '변환의 가면', SV7: '스텔라미라클',
};
const setLabel = (code) => SET_NAMES[code] ? `${code} · ${SET_NAMES[code]}` : code;

init();

async function init() {
  try {
    const res = await fetch('./data/cards.json', { cache: 'no-cache' });
    const data = await res.json();
    state.decks = data.decks || [];
    state.cards = data.cards || [];
  } catch (e) {
    els.count.textContent = '카드 데이터를 불러오지 못했어요. 새로고침 해 주세요.';
    return;
  }
  const tiers = [...new Set(state.decks.map((d) => d.tier))].sort();
  state.tier = tiers[0];
  state.deck = (state.decks.find((d) => d.tier === state.tier) || {}).id;
  buildTierRow(tiers);
  buildDeckSelect();
  // 세트 목록 (보유 카드 수 기준, M5 우선)
  const setCount = (s) => state.cards.filter((c) => c.set === s).length;
  state.sets = [...new Set(state.cards.map((c) => c.set).filter(Boolean))]
    .sort((a, b) => (b === 'M5') - (a === 'M5') || setCount(b) - setCount(a));
  state.set = state.sets[0];
  buildSetSelect();
  buildCategoryChips();
  bindEvents();
  bindModeToggle();
  renderDeckInfo();
  render();
  registerSW();
  setupScrollCollapse();
}

// 충분히 내려가면 상단 선택 영역을 접고, 거의 맨 위로 오면 펼친다.
// 접기/펴기 임계값을 분리(히스테리시스)해, 경계에서 깜빡이지 않게 한다.
// 헤더가 접히며 높이가 바뀌어도 scrollY가 튀지 않도록 CSS에서 overflow-anchor:none.
const COMPACT_ON = 150;  // 이 이상 내려가면 접기
const COMPACT_OFF = 50;  // 이 이하로 올라오면 펼치기 (사이 구간은 현재 상태 유지)
function setupScrollCollapse() {
  const header = document.querySelector('.app-header');
  if (!header) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y > COMPACT_ON) header.classList.add('compact');
      else if (y < COMPACT_OFF) header.classList.remove('compact');
      ticking = false;
    });
  }, { passive: true });
}

function buildSetSelect() {
  const setCount = (s) => state.cards.filter((c) => c.set === s).length;
  els.setSelect.innerHTML = '';
  state.sets.forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = `${setLabel(s)} · ${setCount(s)}종`;
    if (s === state.set) o.selected = true;
    els.setSelect.appendChild(o);
  });
  els.setSelect.onchange = () => {
    state.set = els.setSelect.value;
    renderDeckInfo();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

function bindModeToggle() {
  const setMode = (m) => {
    state.mode = m;
    els.modeDeck.classList.toggle('active', m === 'deck');
    els.modeSet.classList.toggle('active', m === 'set');
    els.deckSelectors.hidden = m !== 'deck';
    els.setSelectors.hidden = m !== 'set';
    renderDeckInfo();
    render();
  };
  els.modeDeck.addEventListener('click', () => setMode('deck'));
  els.modeSet.addEventListener('click', () => setMode('set'));
}

function tierLabel(t) {
  return t === 4 ? '🏆 짐배틀 우승덱' : 'Tier ' + t;
}

function chip(label, id, active) {
  const b = document.createElement('button');
  b.className = 'chip' + (active ? ' active' : '');
  b.textContent = label;
  b.dataset.id = id;
  return b;
}

function buildTierRow(tiers) {
  els.tierRow.innerHTML = '';
  tiers.forEach((t) => {
    const b = chip(tierLabel(t), String(t), t === state.tier);
    b.addEventListener('click', () => {
      state.tier = t;
      [...els.tierRow.children].forEach((c) => c.classList.toggle('active', c.dataset.id === String(t)));
      state.deck = (state.decks.find((d) => d.tier === t) || {}).id;
      buildDeckSelect();
      renderDeckInfo();
      render();
    });
    els.tierRow.appendChild(b);
  });
}

function buildDeckSelect() {
  els.deckSelect.innerHTML = '';
  state.decks.filter((d) => d.tier === state.tier).forEach((d) => {
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = d.name_ko;
    if (d.id === state.deck) o.selected = true;
    els.deckSelect.appendChild(o);
  });
  els.deckSelect.onchange = () => {
    state.deck = els.deckSelect.value;
    renderDeckInfo();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

function buildCategoryChips() {
  const meta = [
    { id: 'all', name: '전체', icon: '📋' },
    { id: 'pokemon', name: '포켓몬', icon: '🐉' },
    { id: 'trainer', name: '트레이너', icon: '🎴' },
    { id: 'energy', name: '에너지', icon: '⚡' },
  ];
  els.chips.innerHTML = '';
  meta.forEach((c) => {
    const b = chip(`${c.icon} ${c.name}`, c.id, c.id === state.filter);
    b.addEventListener('click', () => {
      state.filter = c.id;
      [...els.chips.children].forEach((ch) => ch.classList.toggle('active', ch.dataset.id === c.id));
      render();
    });
    els.chips.appendChild(b);
  });
}

function bindEvents() {
  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    els.clear.hidden = state.query === '';
    render();
  });
  els.clear.addEventListener('click', () => {
    els.search.value = '';
    state.query = '';
    els.clear.hidden = true;
    els.search.focus();
    render();
  });
}

function renderDeckInfo() {
  els.deckInfo.textContent = '';
  if (state.mode === 'set') {
    const cnt = state.cards.filter((c) => c.set === state.set).length;
    const strong = document.createElement('strong');
    strong.textContent = setLabel(state.set);
    const span = document.createElement('span');
    span.textContent = `  ·  이 세트 보유 ${cnt}종 (한국 미발매 일본 카드)`;
    els.deckInfo.append(strong, span);
    return;
  }
  const d = state.decks.find((x) => x.id === state.deck);
  if (!d) return;
  const deckCards = state.cards.filter((c) => (c.decks || []).includes(d.id));
  const totalQty = deckCards.reduce((s, c) => s + (c.deckCounts[d.id] || 0), 0);
  const strong = document.createElement('strong');
  strong.textContent = `${d.name_ko} (${d.name_ja})`;
  const span = document.createElement('span');
  span.textContent = `  ·  ${tierLabel(d.tier)}${d.note ? ' · ' + d.note : ''}  ·  ${deckCards.length}종 / ${totalQty}장`;
  els.deckInfo.append(strong, span);
  if (d.deckId) {
    const a = document.createElement('a');
    a.className = 'deck-list-btn';
    a.href = `https://www.pokemon-card.com/deck/result.html/deckID/${d.deckId}/`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '📋 전체 덱리스트 보기 (공식 카드 이미지) ↗';
    els.deckInfo.appendChild(a);
  }
}

function cardText(c) {
  const parts = [c.name_ja, c.name_ko, c.read, c.alias, c.text_ja, c.text_ko];
  (c.abilities || []).forEach((a) => parts.push(a.name_ja, a.name_ko, a.text_ja, a.text_ko));
  (c.attacks || []).forEach((a) => parts.push(a.name_ja, a.name_ko, a.text_ja, a.text_ko));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getFiltered() {
  const q = state.query.toLowerCase();
  return state.cards.filter((c) => {
    if (state.mode === 'deck') { if (!(c.decks || []).includes(state.deck)) return false; }
    else if (c.set !== state.set) return false;
    if (state.filter !== 'all' && c.category !== state.filter) return false;
    if (!q) return true;
    return cardText(c).includes(q);
  });
}

function render() {
  const items = getFiltered();
  els.list.innerHTML = '';
  els.empty.hidden = items.length > 0;
  els.count.textContent = items.length ? `${items.length}종` : '';
  const frag = document.createDocumentFragment();
  items.forEach((c) => frag.appendChild(cardEl(c)));
  els.list.appendChild(frag);
}

function hl(text) {
  const frag = document.createDocumentFragment();
  const q = state.query;
  if (!q || !text) { frag.appendChild(document.createTextNode(text || '')); return frag; }
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0, idx;
  while ((idx = lower.indexOf(needle, i)) !== -1) {
    if (idx > i) frag.appendChild(document.createTextNode(text.slice(i, idx)));
    const m = document.createElement('mark');
    m.textContent = text.slice(idx, idx + needle.length);
    frag.appendChild(m);
    i = idx + needle.length;
  }
  if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
  return frag;
}

function badge(text, cls) {
  const s = document.createElement('span');
  s.className = 'badge' + (cls ? ' ' + cls : '');
  s.textContent = text;
  return s;
}

function cardEl(c) {
  const li = document.createElement('li');
  li.className = 'pcard pcard-' + c.category;

  const head = document.createElement('div');
  head.className = 'pcard-head';

  if (c.image) {
    const img = document.createElement('img');
    img.className = 'pcard-thumb';
    img.src = c.image;
    img.alt = c.name_ja || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.remove());
    head.appendChild(img);
  }

  const meta = document.createElement('div');
  meta.className = 'pcard-meta';

  const nameKo = document.createElement('div');
  nameKo.className = 'pcard-name';
  nameKo.appendChild(hl(c.name_ko || c.name_ja));
  const nameJa = document.createElement('div');
  nameJa.className = 'pcard-name-ja';
  nameJa.lang = 'ja';
  nameJa.appendChild(hl(c.name_ja || ''));
  meta.append(nameKo, nameJa);
  if (c.read) {
    const read = document.createElement('div');
    read.className = 'pcard-read';
    read.appendChild(document.createTextNode('🗣 '));
    read.appendChild(hl(c.read));
    meta.appendChild(read);
  }

  const badges = document.createElement('div');
  badges.className = 'pcard-badges';
  const qty = state.mode === 'deck' && c.deckCounts && c.deckCounts[state.deck];
  if (qty) badges.appendChild(badge('×' + qty, 'b-qty'));
  if (state.mode === 'set' && c.set) badges.appendChild(badge(c.set, 'b-type'));
  if (c.subtype_ko) badges.appendChild(badge(c.subtype_ko, 'b-type'));
  if (c.hp) badges.appendChild(badge('HP ' + c.hp, 'b-hp'));
  if (c.type_ko) badges.appendChild(badge(c.type_ko));
  meta.appendChild(badges);
  head.appendChild(meta);

  const speak = document.createElement('button');
  speak.className = 'icon-btn';
  speak.textContent = '🔊';
  speak.setAttribute('aria-label', '일본어 이름 듣기');
  speak.addEventListener('click', () => speakJa(c.name_ja));
  head.appendChild(speak);

  li.appendChild(head);

  (c.abilities || []).forEach((a) => li.appendChild(block('특성', a.name_ko, a.name_ja, a.text_ko, a.text_ja, 'ability', null, a.read)));
  (c.attacks || []).forEach((a) => {
    const dmg = a.damage ? ' (' + a.damage + ')' : '';
    li.appendChild(block('기술', (a.name_ko || '') + dmg, a.name_ja, a.text_ko, a.text_ja, 'attack', a.cost_ko, a.read));
  });
  if (c.text_ko || c.text_ja) li.appendChild(block(c.subtype_ko || '효과', '', '', c.text_ko, c.text_ja, 'trainer'));

  if (c.official_url) {
    const a = document.createElement('a');
    a.className = 'pcard-link';
    a.href = c.official_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '공식 카드 페이지 ↗';
    li.appendChild(a);
  }
  return li;
}

// 에너지 색칩: cost_ko의 붙은 색상명(예: "불꽃초")을 색 배지로 분해 렌더
const ENERGY_STYLE = {
  '불꽃':   { label: '불',   bg: '#ff3b30', fg: '#fff' },
  '물':     { label: '물',   bg: '#0a84ff', fg: '#fff' },
  '풀':     { label: '풀',   bg: '#19b23c', fg: '#fff' },
  '번개':   { label: '전기', bg: '#ffd60a', fg: '#222' },
  '초':     { label: '초',   bg: '#c724ff', fg: '#fff' },
  '격투':   { label: '격',   bg: '#e25822', fg: '#fff' },
  '악':     { label: '악',   bg: '#2c2c3a', fg: '#fff' },
  '강철':   { label: '강철', bg: '#6b7a8f', fg: '#fff' },
  '무색':   { label: '무',   bg: '#d1d1d6', fg: '#333' },
  '드래곤': { label: '룡',   bg: '#caa300', fg: '#fff' },
  '페어리': { label: '페',   bg: '#ff5fa2', fg: '#fff' },
};
const ENERGY_WORDS = ['드래곤', '페어리', '불꽃', '무색', '번개', '격투', '강철', '물', '풀', '초', '악']; // 긴 단어 우선
function parseEnergy(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    const w = ENERGY_WORDS.find((x) => s.startsWith(x, i));
    if (w) { out.push(w); i += w.length; } else { i++; }
  }
  return out;
}
function energyBadges(costStr) {
  const frag = document.createDocumentFragment();
  parseEnergy(costStr).forEach((w) => {
    const st = ENERGY_STYLE[w];
    const b = document.createElement('span');
    b.className = 'ecost';
    if (st) { b.textContent = st.label; b.style.background = st.bg; b.style.color = st.fg; b.title = w; }
    else { b.textContent = w; }
    frag.appendChild(b);
  });
  return frag;
}

function block(label, nameKo, nameJa, textKo, textJa, cls, cost, read) {
  const wrap = document.createElement('div');
  wrap.className = 'pblock ' + cls;
  const top = document.createElement('div');
  top.className = 'pblock-top';
  const lab = document.createElement('span');
  lab.className = 'pblock-label';
  lab.textContent = label;
  top.appendChild(lab);
  if (cost) { const cs = document.createElement('span'); cs.className = 'pblock-cost'; cs.appendChild(energyBadges(cost)); top.appendChild(cs); }
  if (nameKo) { const nm = document.createElement('span'); nm.className = 'pblock-name'; nm.appendChild(hl(nameKo)); top.appendChild(nm); }
  if (nameJa) { const nj = document.createElement('span'); nj.className = 'pblock-name-ja'; nj.lang = 'ja'; nj.appendChild(hl(nameJa)); top.appendChild(nj); }
  if (read) { const rd = document.createElement('span'); rd.className = 'pblock-read'; rd.appendChild(hl(read)); top.appendChild(rd); }
  wrap.appendChild(top);
  if (textKo) { const ko = document.createElement('div'); ko.className = 'pblock-text'; ko.appendChild(hl(textKo)); wrap.appendChild(ko); }
  if (textJa) { const ja = document.createElement('div'); ja.className = 'pblock-text-ja'; ja.lang = 'ja'; ja.appendChild(hl(textJa)); wrap.appendChild(ja); }
  return wrap;
}

/* TTS */
let jpVoice = null;
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  jpVoice = speechSynthesis.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('ja')) || null;
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speakJa(text) {
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.85;
  if (jpVoice) u.voice = jpVoice;
  speechSynthesis.speak(u);
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
