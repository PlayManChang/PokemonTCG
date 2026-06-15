'use strict';
// 2027 대회 일정(홈/허브) 페이지: data/events.json 을 읽어 대회 카드 목록을 렌더.
// 각 카드 → event.html?id=... 상세로 이동. D-day는 오늘 날짜로 자동 계산.
// 내용 수정은 data/events.json 만 고치면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('eventsRoot');
  if (!root) return;

  const enc = encodeURIComponent;
  const mapSearch = (q) => 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const extLink = (a) => { a.target = '_blank'; a.rel = 'noopener'; return a; };

  // 오늘 0시 기준 남은 일수(끝나는 날까지 지나면 '종료')
  function dday(ev) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(ev.dateStart + 'T00:00:00');
    const end = new Date((ev.dateEnd || ev.dateStart) + 'T23:59:59');
    const MS = 86400000;
    if (today > end) return { state: 'past', label: '종료', cls: 'ev-badge-past' };
    if (today >= start && today <= end) return { state: 'now', label: '진행 중', cls: 'ev-badge-now' };
    const days = Math.ceil((start - today) / MS);
    return { state: 'upcoming', label: 'D-' + days, cls: days <= 30 ? 'ev-badge-soon' : 'ev-badge-up' };
  }

  // 오늘 0시 기준 목표일까지 남은 일수(지났으면 null)
  function ddaysTo(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const days = Math.ceil((target - today) / 86400000);
    return days > 0 ? days : null;
  }

  function leagueText(keys, leagues) {
    const map = {};
    (leagues || []).forEach((l) => { map[l.key] = l.ko; });
    return (keys || []).map((k) => map[k] || k).join(' · ');
  }

  function render(data) {
    document.title = data.title + ' · 대회 일정';
    const sub = document.getElementById('seasonSub');
    if (sub && data.title) sub.textContent = data.title;

    // 안내문
    if (data.intro) {
      const intro = el('section', 'gcard ev-intro');
      intro.appendChild(el('p', null, data.intro));
      if (data.regulationNote) {
        const r = el('p', 'ev-reg');
        r.appendChild(el('b', null, '⚖️ 레귤레이션: '));
        r.appendChild(el('span', null, data.regulationNote));
        intro.appendChild(r);
        if (data.regulationUrl) {
          const a = el('a', 'plan-link-btn');
          a.href = data.regulationUrl; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = '🔗 공식 레귤레이션 확인';
          intro.appendChild(a);
        }
      }
      root.appendChild(intro);
    }

    // 대회 카드 1장
    function renderCard(ev) {
      const d = dday(ev);
      const card = el('a', 'gcard ev-card' + (d.state === 'past' ? ' is-past' : '') + (ev.highlight ? ' ev-card-hl' : ''));
      card.href = './event.html?id=' + enc(ev.id);

      const top = el('div', 'ev-top');
      const city = el('div', 'ev-city');
      city.appendChild(el('span', 'ev-cityname', '📍 ' + ev.city));
      if (ev.cityJa) city.appendChild(el('span', 'ev-cityja', ev.cityJa));
      top.appendChild(city);
      top.appendChild(el('span', 'ev-badge ' + d.cls, d.label));
      card.appendChild(top);

      // 카운트다운(있는 대회만, 다가오는 경우)
      if (ev.countdownDate && d.state === 'upcoming') {
        const days = ddaysTo(ev.countdownDate);
        if (days != null) card.appendChild(el('div', 'ev-countdown', '🔥 대회까지 ' + days + '일 남았어요'));
      }

      card.appendChild(el('div', 'ev-date', '🗓️ ' + ev.dateLabel));
      if (ev.venue) card.appendChild(el('div', 'ev-venue', '🏟️ ' + ev.venue.name));
      card.appendChild(el('div', 'ev-league', '👥 ' + leagueText(ev.leagues, data.leagues) + ' 리그'));
      if (ev.note) card.appendChild(el('p', 'ev-note', ev.note));

      const go = el('div', 'ev-go');
      go.appendChild(el('span', null, '상세 보기'));
      go.appendChild(el('span', 'ev-go-arrow', '›'));
      card.appendChild(go);
      return card;
    }

    // 시티리그(일본) 안내 카드
    function renderCityLeague(cl) {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '🎫 ' + cl.title));
      if (cl.note) sec.appendChild(el('p', 'ev-note', cl.note));
      const ul = el('ul', 'kv');
      (cl.seasons || []).forEach((s) => {
        const li = el('li');
        li.appendChild(el('b', null, s.season));
        li.appendChild(el('span', null, s.period));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // 지역 그룹별 대회 목록 (그룹 없으면 단일 목록)
    const allEvents = (data.events || []).slice();
    const groups = data.regionGroups && data.regionGroups.length
      ? data.regionGroups
      : [{ key: null, label: null }];
    groups.forEach((g) => {
      const inGroup = allEvents
        .filter((ev) => g.key == null || (ev.region || 'japan') === g.key)
        .sort((a, b) => a.dateStart.localeCompare(b.dateStart));
      if (!inGroup.length) return;
      if (g.label) {
        const head = el('div', 'ev-group-head');
        head.appendChild(el('h2', 'ev-group-title', g.label));
        if (g.note) head.appendChild(el('p', 'ev-group-note', g.note));
        root.appendChild(head);
      }
      inGroup.forEach((ev) => root.appendChild(renderCard(ev)));
      // 시티리그(일본)는 일본 그룹 바로 뒤에 표시
      if ((g.key === 'japan' || g.key == null) && data.cityLeague) renderCityLeague(data.cityLeague);
    });

    // 공통 도구 (모든 대회 공통) — 용어집·카드검색
    const quick = el('section', 'gcard');
    quick.appendChild(el('h2', null, '🧭 공통 도구'));
    const links = [
      { href: 'glossary.html', icon: '📖', label: '용어집', desc: '인사·대전 진행·저지 호출 일본어' },
      { href: 'cards.html', icon: '🃏', label: '카드 검색', desc: '메타 덱·신상 세트 한국어' }
    ];
    const grid = el('div', 'ev-quick');
    links.forEach((l) => {
      const a = el('a', 'ev-quick-item');
      a.href = './' + l.href;
      a.appendChild(el('span', 'ev-quick-icon', l.icon));
      const tx = el('span', 'ev-quick-tx');
      tx.appendChild(el('span', 'ev-quick-label', l.label));
      tx.appendChild(el('span', 'ev-quick-desc', l.desc));
      a.appendChild(tx);
      grid.appendChild(a);
    });
    quick.appendChild(grid);
    root.appendChild(quick);

    // 메타검색 (외부 사이트 — 환경·티어·덱레시피)
    const meta = el('section', 'gcard');
    meta.appendChild(el('h2', null, '📊 메타검색 (외부)'));
    const metaLinks = [
      { href: 'https://pokecabook.com/', icon: '📊', label: '포케카북', desc: '환경·티어·덱레시피' },
      { href: 'https://pokeka-win-decks.jp/', icon: '🏆', label: '윈덱스', desc: '티어표·우승덱 분석' },
      { href: 'https://pokekameshi.com/', icon: '🍚', label: '포케카메시', desc: '덱·카드리스트' }
    ];
    const mgrid = el('div', 'ev-quick');
    metaLinks.forEach((l) => {
      const a = extLink(el('a', 'ev-quick-item'));
      a.href = l.href;
      a.appendChild(el('span', 'ev-quick-icon', l.icon));
      const tx = el('span', 'ev-quick-tx');
      tx.appendChild(el('span', 'ev-quick-label', l.label + ' ↗'));
      tx.appendChild(el('span', 'ev-quick-desc', l.desc));
      a.appendChild(tx);
      mgrid.appendChild(a);
    });
    meta.appendChild(mgrid);
    root.appendChild(meta);

    if (data.official) {
      const off = el('a', 'plan-link-btn');
      off.href = data.official; off.target = '_blank'; off.rel = 'noopener';
      off.textContent = '🔗 공식 대회 일정 페이지';
      root.appendChild(off);
    }
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated + ' · 일정·회장은 변경될 수 있으니 공식 페이지로 최종 확인하세요.'));
  }

  fetch('./data/events.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      root.innerHTML = '<p class="disclaimer">대회 일정을 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>';
    });
})();
