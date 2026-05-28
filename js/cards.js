'use strict';

const state = { decks: [], cards: [], filter: 'all', query: '' };
const els = {
  list: document.getElementById('list'),
  chips: document.getElementById('chips'),
  search: document.getElementById('search'),
  clear: document.getElementById('clearSearch'),
  count: document.getElementById('resultCount'),
  empty: document.getElementById('empty'),
  deckInfo: document.getElementById('deckInfo'),
};

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
  renderDeckInfo();
  buildChips();
  bindEvents();
  render();
  registerSW();
}

function renderDeckInfo() {
  if (!state.decks.length) return;
  const d = state.decks[0];
  els.deckInfo.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = `${d.name_ko} (${d.name_ja})`;
  const span = document.createElement('span');
  span.textContent = `  ·  ${d.tier || ''}${d.note ? '  ·  ' + d.note : ''}`;
  els.deckInfo.append(strong, span);
}

function buildChips() {
  const meta = [
    { id: 'all', name: '전체', icon: '📋' },
    { id: 'pokemon', name: '포켓몬', icon: '🐉' },
    { id: 'trainer', name: '트레이너', icon: '🎴' },
    { id: 'energy', name: '에너지', icon: '⚡' },
  ];
  els.chips.innerHTML = '';
  meta.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'chip' + (c.id === state.filter ? ' active' : '');
    b.textContent = `${c.icon} ${c.name}`;
    b.dataset.id = c.id;
    b.addEventListener('click', () => {
      state.filter = c.id;
      [...els.chips.children].forEach((ch) => ch.classList.toggle('active', ch.dataset.id === c.id));
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

function cardText(c) {
  const parts = [c.name_ja, c.name_ko, c.text_ja, c.text_ko];
  (c.abilities || []).forEach((a) => parts.push(a.name_ja, a.name_ko, a.text_ja, a.text_ko));
  (c.attacks || []).forEach((a) => parts.push(a.name_ja, a.name_ko, a.text_ja, a.text_ko));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getFiltered() {
  const q = state.query.toLowerCase();
  return state.cards.filter((c) => {
    if (state.filter !== 'all' && c.category !== state.filter) return false;
    if (!q) return true;
    return cardText(c).includes(q);
  });
}

function render() {
  const items = getFiltered();
  els.list.innerHTML = '';
  els.empty.hidden = items.length > 0;
  els.count.textContent = items.length ? `${items.length}장` : '';
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

  const badges = document.createElement('div');
  badges.className = 'pcard-badges';
  if (c.subtype_ko) badges.appendChild(badge(c.subtype_ko, 'b-type'));
  if (c.hp) badges.appendChild(badge('HP ' + c.hp, 'b-hp'));
  if (c.type_ko) badges.appendChild(badge(c.type_ko));
  if (c.regulation) badges.appendChild(badge('레귤 ' + c.regulation));
  meta.appendChild(badges);
  head.appendChild(meta);

  const speak = document.createElement('button');
  speak.className = 'icon-btn';
  speak.textContent = '🔊';
  speak.setAttribute('aria-label', '일본어 이름 듣기');
  speak.addEventListener('click', () => speakJa(c.name_ja));
  head.appendChild(speak);

  li.appendChild(head);

  (c.abilities || []).forEach((a) => {
    li.appendChild(block('특성', a.name_ko, a.name_ja, a.text_ko, a.text_ja, 'ability'));
  });
  (c.attacks || []).forEach((a) => {
    const dmg = a.damage ? ' (' + a.damage + ')' : '';
    li.appendChild(block('기술', (a.name_ko || '') + dmg, a.name_ja, a.text_ko, a.text_ja, 'attack', a.cost_ko));
  });
  if (c.text_ko || c.text_ja) {
    li.appendChild(block(c.subtype_ko || '효과', '', '', c.text_ko, c.text_ja, 'trainer'));
  }

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

function block(label, nameKo, nameJa, textKo, textJa, cls, cost) {
  const wrap = document.createElement('div');
  wrap.className = 'pblock ' + cls;

  const top = document.createElement('div');
  top.className = 'pblock-top';
  const lab = document.createElement('span');
  lab.className = 'pblock-label';
  lab.textContent = label;
  top.appendChild(lab);
  if (cost) { const cs = document.createElement('span'); cs.className = 'pblock-cost'; cs.textContent = cost; top.appendChild(cs); }
  if (nameKo) {
    const nm = document.createElement('span');
    nm.className = 'pblock-name';
    nm.appendChild(hl(nameKo));
    top.appendChild(nm);
  }
  if (nameJa) {
    const nj = document.createElement('span');
    nj.className = 'pblock-name-ja';
    nj.lang = 'ja';
    nj.appendChild(hl(nameJa));
    top.appendChild(nj);
  }
  wrap.appendChild(top);

  if (textKo) {
    const ko = document.createElement('div');
    ko.className = 'pblock-text';
    ko.appendChild(hl(textKo));
    wrap.appendChild(ko);
  }
  if (textJa) {
    const ja = document.createElement('div');
    ja.className = 'pblock-text-ja';
    ja.lang = 'ja';
    ja.appendChild(hl(textJa));
    wrap.appendChild(ja);
  }
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
