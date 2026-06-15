'use strict';
// 대회 상세 페이지: event.html?id=xxx 로 들어오면 해당 대회의
// 개요·참가방법·교통·호텔·맛집·체크리스트를 한 화면에 렌더한다.
// 데이터: events.json(코어) + transport/hotels/restaurants/checklists.json (eventId별).
// 내용 수정은 data/*.json 만 고치면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('eventRoot');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';

  const enc = encodeURIComponent;
  const mapSearch = (q) => 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  const mapDir = (q, mode) => 'https://www.google.com/maps/dir/?api=1&destination=' + enc(q) + '&travelmode=' + (mode || 'transit');
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const extLink = (a) => { a.target = '_blank'; a.rel = 'noopener'; return a; };

  const leagueText = (keys, leagues) => {
    const m = {};
    (leagues || []).forEach((l) => { m[l.key] = l.ko; });
    return (keys || []).map((k) => m[k] || k).join(' · ');
  };

  // 섹션 등록(탭 내비 자동 생성)
  const sections = [];
  function section(slug, title) {
    const sec = el('section', 'gcard ev-sec');
    sec.id = 'sec-' + slug;
    sec.appendChild(el('h2', null, title));
    sections.push({ slug, title });
    root.appendChild(sec);
    return sec;
  }

  function ddayBadge(ev) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(ev.dateStart + 'T00:00:00');
    const end = new Date((ev.dateEnd || ev.dateStart) + 'T23:59:59');
    if (today > end) return { label: '종료', cls: 'ev-badge-past' };
    if (today >= start && today <= end) return { label: '진행 중', cls: 'ev-badge-now' };
    const days = Math.ceil((start - today) / 86400000);
    return { label: 'D-' + days, cls: days <= 30 ? 'ev-badge-soon' : 'ev-badge-up' };
  }

  function placeRow(p, mode) {
    // 이름 + [지도] / [길찾기] 버튼 한 줄(locations 페이지와 동일 패턴)
    const li = el('li', 'ev-place');
    const head = el('div', 'ev-place-head');
    const nm = el('div', 'ev-place-name');
    nm.appendChild(el('span', 'ev-place-ko', p.name));
    if (p.nameJa) nm.appendChild(el('span', 'ev-place-ja', p.nameJa));
    head.appendChild(nm);
    const seg = el('div', 'loc-seg');
    const mapA = extLink(el('a', 'loc-seg-map')); mapA.href = mapSearch(p.map || p.name); mapA.textContent = '🗺️ 지도';
    const dirA = extLink(el('a', 'loc-seg-dir')); dirA.href = mapDir(p.map || p.name, mode); dirA.textContent = '🧭 길찾기';
    seg.append(mapA, dirA);
    head.appendChild(seg);
    li.appendChild(head);

    const meta = [];
    if (p.area) meta.push(p.area);
    if (p.genre) meta.push(p.genre);
    if (p.price) meta.push('💰 ' + p.price);
    if (meta.length) li.appendChild(el('div', 'ev-place-meta', meta.join(' · ')));
    if (p.near) li.appendChild(el('div', 'ev-place-near', '📍 ' + p.near));
    if (p.note) li.appendChild(el('div', 'ev-place-note', p.note));
    return li;
  }

  function render(ev, data, transport, hotels, restaurants, checklists) {
    document.getElementById('evTitle').textContent = ev.city;
    document.getElementById('evSub').textContent = ev.name;
    document.title = ev.name;

    // ── 개요 ──
    {
      const sec = section('overview', '🏟️ 대회 개요');
      const b = ddayBadge(ev);
      sec.querySelector('h2').appendChild(el('span', 'ev-badge ev-badge-inline ' + b.cls, b.label));
      // 카운트다운 (countdownDate가 있고 아직 다가오는 대회)
      if (ev.countdownDate) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(ev.countdownDate + 'T00:00:00');
        const days = Math.ceil((target - today) / 86400000);
        if (days > 0) {
          const cd = el('div', 'ev-cd');
          cd.appendChild(el('span', 'ev-cd-num', String(days)));
          cd.appendChild(el('span', 'ev-cd-label', '일 남았어요'));
          sec.appendChild(cd);
        }
      }
      const kv = el('ul', 'kv');
      const add = (k, v) => { const li = el('li'); li.appendChild(el('b', null, k)); li.appendChild(el('span', null, v)); kv.appendChild(li); };
      add('일정', ev.dateLabel);
      add('회장', ev.venue.name + (ev.venue.nameJa ? ' (' + ev.venue.nameJa + ')' : ''));
      add('리그', leagueText(ev.leagues, data.leagues));
      add('레귤레이션', ev.regulation || '스탠다드');
      sec.appendChild(kv);

      const mapA = extLink(el('a', 'plan-link-btn')); mapA.href = mapSearch(ev.venue.map || ev.venue.name); mapA.textContent = '🗺️ 회장 지도에서 보기';
      sec.appendChild(mapA);
      if (ev.venue.nearestStation) sec.appendChild(el('p', 'ev-place-near', '🚉 ' + ev.venue.nearestStation));
      if (ev.note) sec.appendChild(el('p', 'ev-note', ev.note));
      if (ev.official) {
        const off = extLink(el('a', 'plan-link-btn')); off.href = ev.official; off.textContent = '🔗 공식 페이지';
        sec.appendChild(off);
      }
    }

    // ── 현지 가이드 (대회별 하위 페이지 5종) ──
    {
      const sec = section('guide', '🏙️ ' + ev.city + ' 현지 가이드');
      sec.appendChild(el('p', 'ev-note', '이 대회 도시의 안내·구매처·쇼핑·위치·여행 정보를 모았어요. 아직 준비 중인 항목도 자료가 모이면 채워집니다.'));
      const tiles = [
        { href: 'guide.html', icon: '📋', label: '대회 안내', desc: '리그·덱 규정·지참물·매너' },
        { href: 'shops.html?event=' + enc(ev.id), icon: '🏪', label: '카드 구매처', desc: '현지 포켓몬카드 가게 지도' },
        { href: 'shopping.html?event=' + enc(ev.id), icon: '🛍️', label: '쇼핑', desc: '쇼핑·면세/세금 안내' },
        { href: 'locations.html?event=' + enc(ev.id), icon: '📌', label: '위치 한눈에', desc: '주요 장소 약식 지도' },
        { href: 'plan.html?event=' + enc(ev.id), icon: '🗺️', label: '여행 가이드', desc: '일정·교통비·예산' }
      ];
      // 대회별 추가 타일 (예: NAIC의 FAQ·비용 계산기)
      (ev.extraTiles || []).forEach((t) => {
        tiles.push({ href: t.page + '?event=' + enc(ev.id), icon: t.icon || '🔗', label: t.label, desc: t.desc || '' });
      });
      const grid = el('div', 'ev-quick');
      tiles.forEach((t) => {
        const a = el('a', 'ev-quick-item');
        a.href = './' + t.href;
        a.appendChild(el('span', 'ev-quick-icon', t.icon));
        const tx = el('span', 'ev-quick-tx');
        tx.appendChild(el('span', 'ev-quick-label', t.label));
        tx.appendChild(el('span', 'ev-quick-desc', t.desc));
        a.appendChild(tx);
        grid.appendChild(a);
      });
      sec.appendChild(grid);
    }

    // ── 참가 방법 ──
    {
      const sec = section('entry', '📋 참가 방법·준비');
      if (ev.entry) {
        // 대회별 맞춤 참가 안내 (예: NAIC 오픈 등록·영어 표현)
        if (ev.entry.intro) sec.appendChild(el('p', null, ev.entry.intro));
        (ev.entry.links || []).forEach((l) => {
          const a = extLink(el('a', 'plan-link-btn')); a.href = l.url; a.textContent = '🔗 ' + l.label;
          sec.appendChild(a);
        });
        if (ev.entry.phrases && ev.entry.phrases.length) {
          sec.appendChild(el('h3', 'ev-h3', '🗣️ 현장 영어 표현'));
          const ul = el('ul', 'tf-phrases');
          ev.entry.phrases.forEach((p) => {
            const li = el('li');
            li.appendChild(el('span', 'tf-jp', p.en));
            li.appendChild(el('span', 'tf-pron', p.ko));
            li.appendChild(el('span', 'tf-mean', p.mean));
            ul.appendChild(li);
          });
          sec.appendChild(ul);
        }
      } else {
        sec.appendChild(el('p', null, '챔피언스리그는 플레이어즈클럽 사전 신청·당첨이 필요한 공식 대회입니다. 리그(주니어/시니어/마스터)는 생년 기준으로 결정되고, 덱은 스탠다드 레귤레이션(사용 가능한 카드 마크)을 반드시 확인하세요.'));
        if (data.regulationNote) {
          const r = el('p', 'ev-reg');
          r.appendChild(el('b', null, '⚖️ '));
          r.appendChild(el('span', null, data.regulationNote));
          sec.appendChild(r);
        }
      }
      const g = extLink(el('a', 'plan-link-btn')); g.target = '_self'; g.rel = ''; g.href = './guide.html';
      g.textContent = '📋 공통 대회 규칙·매너 보기';
      sec.appendChild(g);
    }

    // ── 교통 ──
    if (transport) {
      const sec = section('transport', '🚆 교통 안내');
      if (transport.fromAirport && transport.fromAirport.length) {
        sec.appendChild(el('h3', 'ev-h3', '✈️ 공항에서'));
        transport.fromAirport.forEach((f) => {
          const box = el('div', 'ev-air');
          box.appendChild(el('div', 'ev-air-head', f.airport + (f.time ? ' · ' + f.time : '')));
          box.appendChild(el('div', 'ev-air-route', f.route));
          if (f.note) box.appendChild(el('div', 'ev-place-note', f.note));
          sec.appendChild(box);
        });
      }
      // 항공사 비교 (국제선이 있는 대회 — 예: NAIC)
      if (transport.airlines && transport.airlines.length) {
        sec.appendChild(el('h3', 'ev-h3', '🛫 항공사 비교'));
        transport.airlines.forEach((a) => {
          const box = el('div', 'ev-air');
          const head = el('div', 'ev-air-head');
          head.appendChild(el('span', null, a.name));
          if (a.price) head.appendChild(el('span', 'ev-air-price', a.price));
          box.appendChild(head);
          if (a.route) box.appendChild(el('div', 'ev-air-route', a.route));
          if (a.note) box.appendChild(el('div', 'ev-place-note', a.note));
          sec.appendChild(box);
        });
      }
      if (transport.toVenue) {
        sec.appendChild(el('h3', 'ev-h3', '🏟️ 회장까지'));
        sec.appendChild(el('p', null, transport.toVenue));
      }
      if (transport.routes && transport.routes.length) {
        sec.appendChild(el('h3', 'ev-h3', '🧭 실시간 길찾기'));
        transport.routes.forEach((r) => {
          const a = extLink(el('a', 'plan-route-btn'));
          a.href = mapDir(r.query, 'transit');
          a.innerHTML = '🚆 ' + r.label + ' <span class="plan-go">실시간 길찾기 ↗</span>';
          sec.appendChild(a);
        });
      }
      if (transport.icCard) {
        sec.appendChild(el('h3', 'ev-h3', '💳 교통카드'));
        sec.appendChild(el('p', null, transport.icCard));
      }
      if (transport.rental) {
        sec.appendChild(el('h3', 'ev-h3', '🚗 렌터카'));
        if (transport.rental.note) sec.appendChild(el('p', null, transport.rental.note));
        if (transport.rental.itinerary) sec.appendChild(el('p', 'ev-place-note', '📍 추천 코스: ' + transport.rental.itinerary));
        if (transport.rental.cost) sec.appendChild(el('p', 'ev-place-note', '💰 ' + transport.rental.cost));
      }
      if (transport.note) sec.appendChild(el('p', 'ev-tip', '💡 ' + transport.note));
    }

    // ── 호텔 ──
    if (hotels && hotels.length) {
      const sec = section('hotels', '🏨 호텔');
      const ul = el('ul', 'ev-places');
      hotels.forEach((h) => ul.appendChild(placeRow(h, 'transit')));
      sec.appendChild(ul);
      sec.appendChild(el('p', 'disclaimer', '가격·정보는 변동될 수 있어요. 예약 전 확인하세요.'));
    }

    // ── 맛집 ──
    if (restaurants && restaurants.length) {
      const sec = section('food', '🍜 맛집');
      const ul = el('ul', 'ev-places');
      restaurants.forEach((r) => ul.appendChild(placeRow(r, 'transit')));
      sec.appendChild(ul);
      sec.appendChild(el('p', 'disclaimer', '영업시간·정보는 변동될 수 있어요. 방문 전 확인하세요.'));
    }

    // ── 체크리스트 ──
    if (checklists) {
      const sec = section('checklist', '✅ 체크리스트');
      if (checklists.intro) sec.appendChild(el('p', 'guide-legend', checklists.intro));
      const groups = (checklists.common || []).slice();
      const byEvent = (checklists.byEvent && checklists.byEvent[ev.id]) || [];
      byEvent.forEach((g) => groups.push(g));

      const storeKey = 'pjcs-check-' + ev.id;
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch (e) { saved = {}; }
      const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(saved)); } catch (e) {} };

      groups.forEach((g, gi) => {
        sec.appendChild(el('h3', 'ev-h3', g.group));
        const ul = el('ul', 'ev-check');
        (g.items || []).forEach((item, ii) => {
          const key = gi + '-' + ii;
          const li = el('li', 'ev-check-item');
          const label = el('label', 'ev-check-label');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!saved[key];
          if (cb.checked) li.classList.add('is-done');
          cb.addEventListener('change', () => {
            saved[key] = cb.checked; save();
            li.classList.toggle('is-done', cb.checked);
          });
          label.appendChild(cb);
          label.appendChild(el('span', 'ev-check-text', item));
          li.appendChild(label);
          ul.appendChild(li);
        });
        sec.appendChild(ul);
      });
    }

    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated + ' · 일정·정보는 변경될 수 있으니 공식 페이지로 최종 확인하세요.'));

    // 탭 내비게이션 (섹션 바로가기)
    const tabs = document.getElementById('evTabs');
    if (tabs && sections.length) {
      sections.forEach((s) => {
        const a = el('a', 'ev-tab');
        a.href = '#sec-' + s.slug;
        a.textContent = s.title.replace(/^[^ ]+ /, '');
        tabs.appendChild(a);
      });
      tabs.hidden = false;
    }
  }

  function fail(msg) {
    root.innerHTML = '<p class="disclaimer">' + msg + '</p>';
  }

  // events.json 으로 대회를 찾고, 나머지 데이터는 있으면 채우고 없으면 건너뛴다.
  fetch('./data/events.json')
    .then((r) => r.json())
    .then((data) => {
      const ev = (data.events || []).find((e) => e.id === id);
      if (!ev) { fail('대회를 찾을 수 없어요. <a href="./index.html">대회 일정</a>에서 다시 선택해 주세요.'); return; }
      const grab = (url) => fetch(url).then((r) => r.json()).catch(() => null);
      Promise.all([
        grab('./data/transport.json'),
        grab('./data/hotels.json'),
        grab('./data/restaurants.json'),
        grab('./data/checklists.json')
      ]).then(([tr, ho, re, ch]) => {
        render(
          ev, data,
          tr && tr[ev.id],
          ho && ho[ev.id],
          re && re[ev.id],
          ch
        );
      });
    })
    .catch(() => fail('대회 정보를 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));
})();
