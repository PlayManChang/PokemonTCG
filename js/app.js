'use strict';

const FAV_KEY = 'pjcs_favorites_v1';
const state = {
  terms: [],
  categories: [],
  filter: 'all',      // 'all' | 'fav' | 'important' | <categoryId>
  query: '',
  favorites: new Set(loadFavorites()),
};

const els = {
  list: document.getElementById('list'),
  chips: document.getElementById('chips'),
  search: document.getElementById('search'),
  clear: document.getElementById('clearSearch'),
  count: document.getElementById('resultCount'),
  empty: document.getElementById('empty'),
};

/* ---------------- data load ---------------- */
init();

async function init() {
  try {
    const res = await fetch('./data/terms.json', { cache: 'no-cache' });
    const data = await res.json();
    state.terms = data.terms;
    state.categories = data.categories;
  } catch (e) {
    els.count.textContent = '데이터를 불러오지 못했어요. 새로고침 해 주세요.';
    return;
  }
  buildChips();
  bindEvents();
  render();
  registerSW();
}

/* ---------------- favorites ---------------- */
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
  catch { return []; }
}
function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites]));
}

/* ---------------- chips ---------------- */
function buildChips() {
  const meta = [
    { id: 'all', name: '전체', icon: '📚' },
    { id: 'important', name: '중요', icon: '⭐' },
    { id: 'fav', name: '즐겨찾기', icon: '❤️' },
    ...state.categories,
  ];
  els.chips.innerHTML = '';
  meta.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (c.id === state.filter ? ' active' : '');
    b.textContent = `${c.icon} ${c.name}`;
    b.dataset.id = c.id;
    b.addEventListener('click', () => {
      state.filter = c.id;
      [...els.chips.children].forEach(ch => ch.classList.toggle('active', ch.dataset.id === c.id));
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    els.chips.appendChild(b);
  });
}

/* ---------------- events ---------------- */
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

/* ---------------- filtering ---------------- */
function getFiltered() {
  const q = state.query.toLowerCase();
  return state.terms.filter(t => {
    if (state.filter === 'fav' && !state.favorites.has(t.id)) return false;
    if (state.filter === 'important' && !t.important) return false;
    if (!['all', 'fav', 'important'].includes(state.filter) && t.category !== state.filter) return false;
    if (!q) return true;
    return [t.ja, t.reading, t.ko_pron, t.ko, t.note].join(' ').toLowerCase().includes(q);
  });
}

/* ---------------- render ---------------- */
function render() {
  const items = getFiltered();
  els.list.innerHTML = '';
  els.empty.hidden = items.length > 0;
  if (!items.length) {
    els.empty.textContent = state.filter === 'fav'
      ? '즐겨찾기한 표현이 없어요. 카드의 ☆를 눌러 추가해 보세요.'
      : '결과가 없어요. 다른 말로 검색해 보세요.';
  }
  els.count.textContent = items.length ? `${items.length}개` : '';
  const frag = document.createDocumentFragment();
  items.forEach(t => frag.appendChild(card(t)));
  els.list.appendChild(frag);
}

function card(t) {
  const li = document.createElement('li');
  li.className = 'term' + (t.important ? ' is-important' : '');

  const top = document.createElement('div');
  top.className = 'term-top';

  const ja = document.createElement('div');
  ja.className = 'ja';
  ja.lang = 'ja';
  ja.appendChild(highlight(t.ja));

  const btns = document.createElement('div');
  btns.className = 'btns';

  const speakBtn = document.createElement('button');
  speakBtn.className = 'icon-btn';
  speakBtn.textContent = '🔊';
  speakBtn.setAttribute('aria-label', '일본어 발음 듣기');
  speakBtn.addEventListener('click', () => speak(t.ja));

  const favBtn = document.createElement('button');
  favBtn.className = 'icon-btn fav-btn' + (state.favorites.has(t.id) ? ' on' : '');
  favBtn.textContent = state.favorites.has(t.id) ? '★' : '☆';
  favBtn.setAttribute('aria-label', '즐겨찾기');
  favBtn.addEventListener('click', () => toggleFav(t.id, favBtn));

  btns.append(speakBtn, favBtn);
  top.append(ja, btns);

  li.appendChild(top);

  if (t.reading) {
    const reading = document.createElement('div');
    reading.className = 'reading';
    reading.lang = 'ja';
    reading.appendChild(highlight(t.reading));
    li.appendChild(reading);
  }

  if (t.ko_pron) {
    const pron = document.createElement('div');
    pron.className = 'ko-pron';
    pron.appendChild(highlight(t.ko_pron));
    li.appendChild(pron);
  }

  const ko = document.createElement('div');
  ko.className = 'ko';
  ko.appendChild(highlight(t.ko));
  li.appendChild(ko);

  if (t.note) {
    const note = document.createElement('div');
    note.className = 'note';
    note.appendChild(highlight(t.note));
    li.appendChild(note);
  }
  return li;
}

function toggleFav(id, btn) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    btn.classList.remove('on');
    btn.textContent = '☆';
  } else {
    state.favorites.add(id);
    btn.classList.add('on');
    btn.textContent = '★';
  }
  saveFavorites();
  if (state.filter === 'fav') render();
}

/* ---------------- highlight (XSS-safe) ---------------- */
function highlight(text) {
  const frag = document.createDocumentFragment();
  const q = state.query;
  if (!q) { frag.appendChild(document.createTextNode(text)); return frag; }
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

/* ---------------- text-to-speech ---------------- */
let jpVoice = null;
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  jpVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('ja')) || null;
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('이 기기는 음성 재생을 지원하지 않아요.');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.85;
  if (jpVoice) u.voice = jpVoice;
  speechSynthesis.speak(u);
}

/* ---------------- PWA: install + service worker ---------------- */
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
