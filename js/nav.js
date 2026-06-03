'use strict';
// 공용 햄버거 메뉴: 용어집 ↔ 카드 검색 이동. 두 페이지에서 함께 사용.
(function () {
  const btn = document.getElementById('menuBtn');
  if (!btn) return;

  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  // 메뉴는 config.js(window.TRIP) 기반 — 모듈이 꺼진 항목은 자동 숨김
  const cfg = window.TRIP || {};
  const mods = cfg.modules || {};
  const links = (cfg.menu && cfg.menu.length ? cfg.menu : [
    { href: 'index.html', label: '📖 용어집', desc: '인사·게임 용어' },
    { href: 'cards.html', label: '🃏 카드 검색', desc: '메타 덱·세트 카드 (한국어)' },
    { href: 'guide.html', label: '📋 대회 안내', desc: 'PJCS 2026 참가 주의사항' },
    { href: 'shops.html', label: '🏪 카드 구매처', desc: '요코하마·도쿄 카드샵 지도' },
    { href: 'shopping.html', label: '🛍️ 면세 / 쇼핑', desc: '면세 가이드·쇼핑·돈키호테' },
    { href: 'locations.html', label: '📌 위치 한눈에', desc: '주요 장소 지역별 약식 지도' },
    { href: 'plan.html', label: '🗺️ 여행 가이드', desc: '일정·지도·교통비·예산' },
  ]).filter((l) => l.external || !l.key || mods[l.key] !== false);

  const menu = document.createElement('nav');
  menu.className = 'nav-menu';
  menu.hidden = true;
  links.forEach((l) => {
    const a = document.createElement('a');
    if (l.external) {
      a.href = l.href;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.href = './' + l.href;
      if (l.href === here || (here === '' && l.href === 'index.html')) a.className = 'current';
    }
    const t = document.createElement('span');
    t.className = 'nav-label';
    t.textContent = l.label;
    const d = document.createElement('span');
    d.className = 'nav-desc';
    d.textContent = l.desc;
    a.append(t, d);
    menu.appendChild(a);
  });
  document.body.appendChild(menu);

  function position() {
    const r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = r.left + 'px';
  }
  function toggle(e) {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (!menu.hidden) position();
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  }
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', toggle);
  document.addEventListener('click', () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
  window.addEventListener('resize', () => { if (!menu.hidden) position(); });
  menu.addEventListener('click', (e) => e.stopPropagation());
})();
