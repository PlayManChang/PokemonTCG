'use strict';
// 위치 한눈에 페이지: data/locations.json 의 좌표로 지역별 약식 지도(SVG)를 그린다.
// 점 = 번호, 아래 목록과 번호가 일치. 위쪽이 북쪽(실제 방위 유지). 내용은 JSON만 수정.
(function () {
  const root = document.getElementById('locRoot');
  if (!root) return;

  const TYPES = {
    hotel:   { e: '🏨', c: '#d6336c', ko: '호텔' },
    station: { e: '🚉', c: '#3b5bdb', ko: '기준 역' },
    venue:   { e: '🏟️', c: '#7048e8', ko: '대회장' },
    poke:    { e: '🔴', c: '#e8400c', ko: '포켓몬' },
    gundam:  { e: '🤖', c: '#1c7ed6', ko: '건담' },
    donki:   { e: '🐧', c: '#f08c00', ko: '돈키호테' },
    shop:    { e: '🛍️', c: '#2f9e44', ko: '쇼핑' },
    food:    { e: '🍜', c: '#c92a2a', ko: '맛집' },
    sight:   { e: '📷', c: '#1098ad', ko: '관광' }
  };
  const typeOf = (t) => TYPES[t] || { e: '📍', c: '#555', ko: '' };
  const isAnchorType = (t) => t === 'hotel' || t === 'venue' || t === 'station';

  const enc = encodeURIComponent;
  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  // 출발지 생략 → 구글 지도가 '현재 위치'를 자동 출발지로 사용
  const dirUrl = (q, mode) => 'https://www.google.com/maps/dir/?api=1&destination=' + enc(q) + '&travelmode=' + (mode || 'walking');
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // 기준점(앵커): 호텔 > 대회장 > 무게중심. 호텔을 지도 한가운데 두고 나머지를 둘러 배치.
  function pickAnchor(points) {
    const a = points.find((p) => p.t === 'hotel') || points.find((p) => p.t === 'venue') || points.find((p) => p.t === 'station');
    if (a) return { lat: a.lat, lon: a.lon, real: true };
    const la = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lo = points.reduce((s, p) => s + p.lon, 0) / points.length;
    return { lat: la, lon: lo, real: false };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // 두 좌표 사이 직선거리(m)
  function haversine(la1, lo1, la2, lo2) {
    const R = 6371000, t = Math.PI / 180;
    const dLa = (la2 - la1) * t, dLo = (lo2 - lo1) * t;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  let gid = 0;
  function svgFor(points) {
    const n = points.length;
    const a = pickAnchor(points);
    const off = points.map((p) => ({ dx: (p.lon - a.lon) * 90.5, dy: (p.lat - a.lat) * 111 }));
    // 방사형 압축: 가까운 점은 더 펴고 먼 점은 끌어와 지도에 고르게 분포(방향·순서 유지)
    const comp = off.map((o) => {
      const r = Math.sqrt(o.dx * o.dx + o.dy * o.dy);
      if (r < 1e-9) return { dx: 0, dy: 0 };
      const k = Math.pow(r, 0.58) / r;
      return { dx: o.dx * k, dy: o.dy * k };
    });
    const maxAbsX = Math.max(1e-6, ...comp.map((o) => Math.abs(o.dx)));
    const maxAbsY = Math.max(1e-6, ...comp.map((o) => Math.abs(o.dy)));

    // 지도 비율: 남북/동서 퍼짐에 맞추되 너무 길지 않게, 점 수가 적으면 더 작게
    const W = 340, pad = 28;
    let ratio = clamp(maxAbsY / maxAbsX, 0.55, 1.1);
    let H = Math.round(W * ratio);
    H = Math.min(H, 140 + n * 20);   // 점 적으면 작게(2점≈180, 12점=상한)
    H = clamp(H, 170, 330);
    const cx = W / 2, cy = H / 2;

    // 마커 크기: 점 많은 지도일수록 작게
    const R = points.map((p) => isAnchorType(p.t) ? 13 : (n >= 10 ? 10 : (n >= 5 ? 11 : 13)));
    const RB = R.map((r) => Math.max(6, r * 0.58));        // 번호 배지 반지름
    // 충돌용 유효 반지름: 우상단 번호 배지가 튀어나오는 만큼 더해 배지끼리도 안 겹치게
    const Reff = R.map((r, i) => r + RB[i] * 0.85);
    const ai = points.findIndex((p) => isAnchorType(p.t));

    let scale = Math.min((W - 2 * pad) / 2 / maxAbsX, (H - 2 * pad) / 2 / maxAbsY);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    const pos = comp.map((o) => ({ x: cx + o.dx * scale, y: cy - o.dy * scale }));
    const orig = pos.map((p) => ({ x: p.x, y: p.y }));

    // 겹침 방지: 가까운 마커끼리 밀어내고, 원래 위치로 약하게 당김(방향 유지)
    for (let it = 0; it < 240; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const min = Reff[i] + Reff[j] + 3;
          if (d < min) {
            const push = (min - d) / 2, ux = dx / d, uy = dy / d;
            if (i === ai) { pos[j].x += ux * push * 2; pos[j].y += uy * push * 2; }
            else if (j === ai) { pos[i].x -= ux * push * 2; pos[i].y -= uy * push * 2; }
            else { pos[i].x -= ux * push; pos[i].y -= uy * push; pos[j].x += ux * push; pos[j].y += uy * push; }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        if (i === ai) continue;
        pos[i].x += (orig[i].x - pos[i].x) * 0.03;
        pos[i].y += (orig[i].y - pos[i].y) * 0.03;
      }
      if (ai >= 0) { pos[ai].x = cx; pos[ai].y = cy; }
      for (let i = 0; i < n; i++) {
        pos[i].x = clamp(pos[i].x, pad + R[i], W - pad - Reff[i]);
        pos[i].y = clamp(pos[i].y, pad + Reff[i], H - pad - R[i]);
      }
    }

    const id = 'lg' + (gid++);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="loc-svg" role="img" aria-label="약식 위치도">';
    s += '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="72%">'
      + '<stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e3edf6"/></radialGradient></defs>';
    s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="14" fill="url(#' + id + ')" class="loc-bg"/>';

    // 옅은 격자
    const stepX = (W - 2 * pad) / 6, stepY = (H - 2 * pad) / 5;
    for (let gx = pad; gx <= W - pad + 0.1; gx += stepX) s += '<line x1="' + gx.toFixed(0) + '" y1="' + pad + '" x2="' + gx.toFixed(0) + '" y2="' + (H - pad) + '" class="loc-grid"/>';
    for (let gy = pad; gy <= H - pad + 0.1; gy += stepY) s += '<line x1="' + pad + '" y1="' + gy.toFixed(0) + '" x2="' + (W - pad) + '" y2="' + gy.toFixed(0) + '" class="loc-grid"/>';

    // 기준점 중심 옅은 동심원(장식)
    if (ai >= 0) {
      const span = Math.min(W, H) / 2 - pad;
      [0.34, 0.67, 1].forEach((k) => { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (span * k).toFixed(0) + '" class="loc-ring"/>'; });
    }
    s += '<text x="' + (W - 16) + '" y="22" class="loc-n">N▲</text>';

    // 마커: 흰 원 + 색 테두리 + 아이콘, 우상단 색 배지에 번호
    points.forEach((p, i) => {
      const x = pos[i].x, y = pos[i].y, isA = (i === ai);
      const r = R[i], col = typeOf(p.t).c;
      const xs = x.toFixed(1), ys = y.toFixed(1);
      const rb = RB[i];                                   // 번호 배지 크기(충돌계산과 동일)
      const emoji = isA ? 13 : (r >= 13 ? 12 : (r >= 11 ? 11 : 10)); // 아이콘 크기
      if (isA) s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + (r + 6) + '" fill="' + col + '" class="loc-halo"/>';
      s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + r + '" fill="#fff" stroke="' + col + '" stroke-width="' + (isA ? 3 : 2.5) + '"/>';
      s += '<text x="' + xs + '" y="' + (y + 1).toFixed(1) + '" class="loc-ic" font-size="' + emoji + '">' + typeOf(p.t).e + '</text>';
      const bx = (x + r * 0.72).toFixed(1), by = (y - r * 0.72).toFixed(1);
      s += '<circle cx="' + bx + '" cy="' + by + '" r="' + rb.toFixed(1) + '" fill="' + col + '" stroke="#fff" stroke-width="1.5"/>';
      s += '<text x="' + bx + '" y="' + by + '" class="loc-bnum" font-size="' + (rb >= 7.5 ? 10 : 9) + '">' + (i + 1) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  function render(data) {
    if (data.intro) root.appendChild(el('p', 'guide-legend', data.intro));

    (data.regions || []).forEach((reg) => {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, reg.name));
      if (reg.sub) sec.appendChild(el('p', 'shop-note', reg.sub));

      const mapWrap = el('div', 'loc-map');
      mapWrap.innerHTML = svgFor(reg.points);
      sec.appendChild(mapWrap);

      // 거리 기준점: 호텔이 있으면 호텔, 없으면 지하철역(기준 역)
      const base = reg.points.find((p) => p.t === 'hotel') || reg.points.find((p) => p.t === 'station');
      const ol = el('ol', 'loc-legend');
      reg.points.forEach((p, i) => {
        const li = el('li', isAnchorType(p.t) ? 'loc-anchor-row' : null);
        const badge = el('span', 'loc-badge', String(i + 1));
        badge.style.background = typeOf(p.t).c;
        li.appendChild(badge);
        const body = el('div', 'loc-item-body');
        // 한 행: 이름(왼쪽) + [지도|길찾기] 버튼(오른쪽), 높이 정렬
        const row = el('div', 'loc-row');
        row.appendChild(el('div', 'loc-name', typeOf(p.t).e + ' ' + p.n));
        const far = base && p !== base;
        let mode = 'walking';
        if (p.transit || (far && haversine(base.lat, base.lon, p.lat, p.lon) > 1200)) mode = 'transit';
        const seg = el('div', 'loc-seg');
        const mapA = el('a', 'loc-seg-map');
        mapA.href = mapUrl(p.q); mapA.target = '_blank'; mapA.rel = 'noopener';
        mapA.textContent = '🗺️ 지도';
        const dirA = el('a', 'loc-seg-dir');
        dirA.href = dirUrl(p.q, mode); dirA.target = '_blank'; dirA.rel = 'noopener';
        dirA.textContent = '🧭 길찾기';
        seg.append(mapA, dirA);
        row.appendChild(seg);
        body.appendChild(row);
        if (base) {
          const dl = el('div', 'loc-dist');
          if (p === base && p.t === 'hotel') {
            dl.innerHTML = '<b>📍 기준점 (우리 호텔)</b>';
          } else if (p === base && p.t === 'station') {
            dl.innerHTML = '<b>🚉 기준 역</b>' + (p.fromHotel ? ' · 🏨 호텔에서: ' + p.fromHotel : '');
          } else {
            const m = haversine(base.lat, base.lon, p.lat, p.lon);
            const walk = Math.max(1, Math.round(m * 1.2 / 80));
            const distTxt = m < 950 ? (Math.round(m / 10) * 10) + 'm' : (m / 1000).toFixed(1) + 'km';
            const fromWord = base.t === 'station' ? '역에서 ' : '';
            let t = '🚶 ' + fromWord + '도보 약 ' + walk + '분 · 직선 ' + distTxt;
            if (p.transit) t += ' · 🚉 ' + p.transit;
            else if (m > 1200) t += ' · 🚉 전철 권장';
            dl.textContent = t;
          }
          body.appendChild(dl);
        }
        li.appendChild(body);
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      root.appendChild(sec);
    });

    {
      const lg = el('section', 'gcard');
      lg.appendChild(el('h2', null, '🏷️ 색상·아이콘 안내'));
      const chips = el('div', 'loc-chips');
      const used = new Set();
      (data.regions || []).forEach((r) => (r.points || []).forEach((p) => used.add(p.t)));
      Object.keys(TYPES).filter((k) => used.has(k)).forEach((k) => {
        const t = TYPES[k];
        const chip = el('span', 'loc-chip');
        chip.style.background = t.c;
        chip.textContent = t.e + ' ' + t.ko;
        chips.appendChild(chip);
      });
      lg.appendChild(chips);
      if (data.legendNote) lg.appendChild(el('p', 'loc-legendnote', '지도의 점 색이 위 분류와 같아요. 큰 점(테두리 굵음)이 호텔·대회장이에요.'));
      root.appendChild(lg);
    }
    if (data.disclaimer) root.appendChild(el('p', 'disclaimer', data.disclaimer));
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated));
  }

  const eventId = new URLSearchParams(location.search).get('event') || 'yokohama';
  eventChrome(eventId, '위치 한눈에');
  fetch('./data/locations/' + eventId + '.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      root.innerHTML = notReadyHtml('위치 한눈에');
    });
})();
