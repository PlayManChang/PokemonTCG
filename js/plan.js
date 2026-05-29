'use strict';
// 여행 가이드 페이지: data/plan.json 을 읽어 일정·지도버튼·교통비·예산 등을 렌더.
// 인터랙션: 태풍 플랜 A/B, DAY2 진출/탈락 분기, 교통비 인원수 자동계산.
// 내용 수정은 data/plan.json 만 고치면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('planRoot');
  if (!root) return;

  const state = { typhoon: 'a', branch: 'advanced', people: 3 };

  const enc = encodeURIComponent;
  const mapSearch = (q) => 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  const mapDir = (from, to, mode) =>
    'https://www.google.com/maps/dir/?api=1&origin=' + enc(from) + '&destination=' + enc(to) + '&travelmode=' + (mode || 'transit');
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const yen = (n) => '¥' + n.toLocaleString('ko-KR');

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const mapLink = (label, query) => {
    const a = el('a', 'plan-stop');
    a.href = mapSearch(query);
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = '📍 ' + label + ' <span class="plan-go">지도</span>';
    return a;
  };

  let data = null;

  function render() {
    root.innerHTML = '';

    // 핵심 정보
    const head = el('section', 'gcard');
    head.appendChild(el('h2', null, '🧳 여행 개요'));
    const kv = el('ul', 'kv');
    const addKv = (k, v) => { const li = el('li'); li.appendChild(el('b', null, k)); li.appendChild(el('span', null, v)); kv.appendChild(li); };
    addKv('일정', data.dates);
    addKv('경로', data.route);
    head.appendChild(kv);
    data.hotels.forEach((h) => {
      const p = el('p', 'plan-hotel');
      p.appendChild(el('b', null, h.label + ' '));
      const a = el('a', 'plan-stop'); a.href = mapSearch(h.map); a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = '🏨 ' + h.name + ' <span class="plan-go">지도</span>';
      p.appendChild(a);
      head.appendChild(p);
    });
    if (data.intro) head.appendChild(el('p', 'plan-intro', data.intro));
    root.appendChild(head);

    // 토글 컨트롤
    const ctrl = el('section', 'gcard plan-controls');
    ctrl.appendChild(el('h2', null, '⚙️ 일정 전환'));
    ctrl.appendChild(toggleRow('날씨', [
      { k: 'a', label: '☀️ 플랜 A (맑음)' }, { k: 'b', label: '🌀 플랜 B (태풍·비)' }
    ], state.typhoon, (k) => { state.typhoon = k; render(); }));
    ctrl.appendChild(toggleRow('PJCS DAY2', [
      { k: 'advanced', label: '✅ DAY1 진출' }, { k: 'eliminated', label: '❌ 탈락 (대체관광)' }
    ], state.branch, (k) => { state.branch = k; render(); }));
    root.appendChild(ctrl);

    // 핵심 이동 경로
    const routes = el('section', 'gcard');
    routes.appendChild(el('h2', null, '🧭 핵심 이동 경로 (실시간 길찾기)'));
    data.keyRoutes.forEach((r) => {
      const box = el('div', 'plan-route');
      const a = el('a', 'plan-route-btn');
      a.href = mapDir(r.from, r.to, r.mode);
      a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = (r.mode === 'walking' ? '🚶 ' : '🚆 ') + r.label + ' <span class="plan-go">실시간 길찾기 ↗</span>';
      box.appendChild(a);
      if (r.diagram) box.appendChild(routeMap(r.diagram));
      if (r.note) box.appendChild(el('p', 'plan-route-note', '※ ' + r.note));
      routes.appendChild(box);
    });
    root.appendChild(routes);

    // 일자별 일정
    data.days.forEach((d) => {
      const sec = el('section', 'gcard plan-day');
      sec.appendChild(el('h2', null, d.icon + ' ' + d.date + ' — ' + d.title));
      if (d.move) sec.appendChild(el('p', 'plan-move', '🚆 ' + d.move));

      let stops = d.stops;
      if (d.typhoon) {
        if (d.typhoonNote) sec.appendChild(el('p', 'plan-flag', '🌀 ' + d.typhoonNote));
        stops = d.typhoon[state.typhoon];
        sec.appendChild(badge(state.typhoon === 'a' ? '☀️ 플랜 A' : '🌀 플랜 B'));
      }
      if (d.branch) {
        if (d.branchNote) sec.appendChild(el('p', 'plan-flag', '🔀 ' + d.branchNote));
        stops = d.branch[state.branch];
        sec.appendChild(badge(state.branch === 'advanced' ? '✅ 진출 일정' : '❌ 탈락 대체일정'));
      }

      const ul = el('ul', 'plan-stops');
      (stops || []).forEach((s) => {
        const li = el('li');
        if (s.map) li.appendChild(mapLink(s.label, s.map));
        else li.appendChild(el('span', 'plan-stop-plain', s.label));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      if (d.tip) sec.appendChild(el('p', 'plan-tip', '💡 ' + d.tip));
      root.appendChild(sec);
    });

    // 지도 모음
    const maps = el('section', 'gcard');
    maps.appendChild(el('h2', null, '🗺️ 지도 모음'));
    data.mapGroups.forEach((g) => {
      maps.appendChild(el('h3', 'plan-mapcat', g.cat));
      const ul = el('ul', 'plan-stops');
      g.items.forEach((it) => { const li = el('li'); li.appendChild(mapLink(it.name, it.query)); ul.appendChild(li); });
      maps.appendChild(ul);
    });
    root.appendChild(maps);

    // 교통비 계산기
    const t = el('section', 'gcard');
    t.appendChild(el('h2', null, '💴 예상 교통비 계산기'));
    const pr = el('div', 'plan-people');
    pr.appendChild(el('label', null, '인원수 '));
    const input = el('input', 'plan-people-input');
    input.type = 'number'; input.min = '1'; input.max = '9'; input.value = String(state.people);
    input.addEventListener('input', () => { state.people = Math.max(1, parseInt(input.value, 10) || 1); render(); });
    pr.appendChild(input);
    pr.appendChild(el('span', null, ' 명 기준'));
    t.appendChild(pr);

    const table = el('table', 'plan-table');
    const thead = el('tr');
    ['구간', '1인', state.people + '인'].forEach((h) => thead.appendChild(el('th', null, h)));
    table.appendChild(thead);
    let total = 0;
    data.transit.segments.forEach((s) => {
      const sub = s.fare * state.people;
      total += sub;
      const tr = el('tr');
      tr.appendChild(el('td', null, s.label + (s.perTrip ? ' (' + s.perTrip + ')' : '')));
      tr.appendChild(el('td', null, yen(s.fare)));
      tr.appendChild(el('td', null, yen(sub)));
      table.appendChild(tr);
    });
    const totRow = el('tr', 'plan-total-row');
    totRow.appendChild(el('td', null, '합계 (예상)'));
    totRow.appendChild(el('td', null, ''));
    totRow.appendChild(el('td', null, yen(total) + ' (≈' + won(total * 9) + ')'));
    table.appendChild(totRow);
    t.appendChild(table);
    if (data.transit.note) t.appendChild(el('p', 'plan-tip', data.transit.note));
    root.appendChild(t);

    // 가족 예산표
    const b = el('section', 'gcard');
    b.appendChild(el('h2', null, '🧾 가족 예산표'));
    const bt = el('table', 'plan-table');
    const bh = el('tr'); ['항목', '예상 금액'].forEach((h) => bh.appendChild(el('th', null, h))); bt.appendChild(bh);
    let bsum = 0;
    data.budget.items.forEach((it) => {
      bsum += it.amount;
      const tr = el('tr');
      tr.appendChild(el('td', null, it.label));
      tr.appendChild(el('td', null, won(it.amount)));
      bt.appendChild(tr);
    });
    const br = el('tr', 'plan-total-row');
    br.appendChild(el('td', null, '총 예산 (예상)'));
    br.appendChild(el('td', null, won(bsum)));
    bt.appendChild(br);
    b.appendChild(bt);
    if (data.budget.note) b.appendChild(el('p', 'plan-tip', data.budget.note));
    root.appendChild(b);

    // 비상연락처
    const em = el('section', 'gcard');
    em.appendChild(el('h2', null, '🆘 비상 연락처'));
    const eul = el('ul', 'plan-emergency');
    data.emergency.forEach((c) => {
      const li = el('li');
      li.appendChild(el('b', null, c.label));
      if (c.tel) {
        const a = el('a', 'plan-tel'); a.href = 'tel:' + c.tel; a.textContent = '📞 ' + c.value;
        li.appendChild(a);
      } else {
        li.appendChild(el('span', 'plan-tel-plain', c.value));
      }
      eul.appendChild(li);
    });
    em.appendChild(eul);
    root.appendChild(em);

    // 공항 이동 가이드
    const ap = el('section', 'gcard');
    ap.appendChild(el('h2', null, '✈️ 공항 이동 가이드'));
    data.airport.forEach((a) => {
      ap.appendChild(el('h3', 'plan-mapcat', a.title));
      ap.appendChild(el('p', 'plan-airport-body', a.body));
    });
    root.appendChild(ap);

    // 팁
    if (data.tips && data.tips.length) {
      const tp = el('section', 'gcard');
      tp.appendChild(el('h2', null, '✅ 출발 전 체크 & 팁'));
      const ul = el('ul', 'bullets');
      data.tips.forEach((x) => ul.appendChild(el('li', null, x)));
      tp.appendChild(ul);
      root.appendChild(tp);
    }

    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated + ' · 요금·영업정보는 변동될 수 있으니 출발 전 확인하세요.'));
  }

  function badge(text) {
    const s = el('span', 'plan-badge', text);
    return s;
  }
  // 인터넷 없이도 보이는 간단 약도(전철 노선도 형태, 순수 HTML/CSS)
  function routeMap(dg) {
    const wrap = el('div', 'route-map');
    (dg.stops || []).forEach((s, i) => {
      const stop = el('div', 'rm-stop');
      stop.appendChild(el('span', 'rm-dot', s.icon || '•'));
      const txt = el('span', 'rm-text');
      txt.appendChild(el('span', 'rm-name', s.name));
      if (s.sub) txt.appendChild(el('span', 'rm-sub', s.sub));
      stop.appendChild(txt);
      wrap.appendChild(stop);
      const leg = (dg.legs || [])[i];
      if (leg) {
        const lg = el('div', 'rm-leg' + (leg.walk ? ' walk' : ''));
        if (leg.color) lg.style.borderLeftColor = leg.color;
        lg.appendChild(el('span', 'rm-line', (leg.walk ? '🚶 ' : '🚆 ') + leg.line));
        if (leg.mins) lg.appendChild(el('span', 'rm-mins', leg.mins));
        wrap.appendChild(lg);
      }
    });
    if (dg.total) wrap.appendChild(el('div', 'rm-total', '🕒 ' + dg.total));
    return wrap;
  }
  function toggleRow(label, opts, active, onPick) {
    const row = el('div', 'plan-toggle');
    row.appendChild(el('span', 'plan-toggle-label', label));
    const grp = el('div', 'plan-toggle-btns');
    opts.forEach((o) => {
      const btn = el('button', 'plan-toggle-btn' + (o.k === active ? ' active' : ''), o.label);
      btn.type = 'button';
      btn.addEventListener('click', () => onPick(o.k));
      grp.appendChild(btn);
    });
    row.appendChild(grp);
    return row;
  }

  fetch('./data/plan.json')
    .then((r) => r.json())
    .then((d) => { data = d; state.people = d.transit.peopleDefault || 3; render(); })
    .catch(() => { root.innerHTML = '<p class="disclaimer">여행 계획을 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>'; });
})();
