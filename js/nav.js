'use strict';
// 공용 햄버거 메뉴: 용어집 ↔ 카드 검색 이동. 두 페이지에서 함께 사용.
(function () {
  const btn = document.getElementById('menuBtn');
  if (!btn) return;

  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const links = [
    { href: 'index.html', label: '📖 용어집', desc: '인사·게임 용어' },
    { href: 'cards.html', label: '🃏 카드 검색', desc: '메타 덱 카드 (한국어)' },
  ];

  const menu = document.createElement('nav');
  menu.className = 'nav-menu';
  menu.hidden = true;
  links.forEach((l) => {
    const a = document.createElement('a');
    a.href = './' + l.href;
    const isCurrent = l.href === here || (here === '' && l.href === 'index.html');
    if (isCurrent) a.className = 'current';
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
