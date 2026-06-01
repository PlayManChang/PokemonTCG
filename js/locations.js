'use strict';
// 위치 한눈에 페이지: data/locations.json 의 좌표로 지역별 약식 지도(SVG)를 그린다.
// 점 = 번호, 아래 목록과 번호가 일치. 위쪽이 북쪽(실제 방위 유지). 내용은 JSON만 수정.
(function () {
  const root = document.getElementById('locRoot');
  if (!root) return;

  const TYPES = {
    hotel:  { e: '🏨', c: '#d6336c', ko: '호텔' },
    venue:  { e: '🏟️', c: '#7048e8', ko: '대회장' },
    poke:   { e: '🔴', c: '#e8400c', ko: '포켓몬' },
    gundam: { e: '🤖', c: '#1c7ed6', ko: '건담' },
    donki:  { e: '🐧', c: '#f08c00', ko: '돈키호테' },
    shop:   { e: '🛍️', c: '#2f9e44', ko: '쇼핑' },
    food:   { e: '🍜', c: '#c92a2a', ko: '맛집' },
    sight:  { e: '📷', c: '#1098ad', ko: '관광' }
  };
  const typeOf = (t) => TYPES[t] || { e: '📍', c: '#555', ko: '' };

  const enc = encodeURIComponent;
  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // 기준점(앵커): 호텔 > 대회장 > 무게중심. 호텔을 지도 한가운데 두고 나머지를 둘러 배치.
  function pickAnchor(points) {
    const a = points.find((p) => p.t === 'hotel') || points.find((p) => p.t === 'venue');
    if (a) return { lat: a.lat, lon: a.lon, real: true };
    const la = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lo = points.reduce((s, p) => s + p.lon, 0) / points.length;
    return { lat: la, lon: lo, real: false };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let gid = 0;
  function svgFor(points) {
    const n = points.length;
    const a = pickAnchor(points);
    const off = points.map((p) => ({ dx: (p.lon - a.lon) * 90.5, dy: (p.lat - a.lat) * 111 }));
    const maxAbsX = Math.max(1e-6, ...off.map((o) => Math.abs(o.dx)));
    const maxAbsY = Math.max(1e-6, ...off.map((o) => Math.abs(o.dy)));

    // 지도 비율: 데이터의 남북/동서 퍼짐에 맞춰 세로 길이 자동 조절 → 안 겹치게
    const W = 340, pad = 30;
    let ratio = clamp(maxAbsY / maxAbsX, 0.6, 1.7);
    let H = clamp(Math.round(W * ratio), 250, 470);
    // 점 개수가 많으면 면적 확보(겹침 완화)
    const cell = 40 * 40;
    while (W * H < n * cell * 1.15 && H < 560) H += 20;
    const cx = W / 2, cy = H / 2;

    const R = points.map((p) => (p.t === 'hotel' || p.t === 'venue') ? 16 : (n > 10 ? 13 : 15));
    const ai = points.findIndex((p) => p.t === 'hotel' || p.t === 'venue');

    let scale = Math.min((W - 2 * pad) / 2 / maxAbsX, (H - 2 * pad) / 2 / maxAbsY);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    const pos = off.map((o) => ({ x: cx + o.dx * scale, y: cy - o.dy * scale }));
    const orig = pos.map((p) => ({ x: p.x, y: p.y }));

    // 겹침 방지: 가까운 마커끼리 밀어내고, 원래 위치로 약하게 당김(방향 유지)
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const min = R[i] + R[j] + 7;
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
        pos[i].x = clamp(pos[i].x, pad + R[i], W - pad - R[i]);
        pos[i].y = clamp(pos[i].y, pad + R[i], H - pad - R[i]);
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
      if (isA) s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + (r + 7) + '" fill="' + col + '" class="loc-halo"/>';
      s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + r + '" fill="#fff" stroke="' + col + '" stroke-width="' + (isA ? 4 : 3) + '"/>';
      s += '<text x="' + xs + '" y="' + (y + 1).toFixed(1) + '" class="loc-ic" font-size="' + (isA ? 17 : 15) + '">' + typeOf(p.t).e + '</text>';
      const bx = (x + r * 0.78).toFixed(1), by = (y - r * 0.78).toFixed(1);
      s += '<circle cx="' + bx + '" cy="' + by + '" r="8.5" fill="' + col + '" stroke="#fff" stroke-width="1.5"/>';
      s += '<text x="' + bx + '" y="' + by + '" class="loc-bnum">' + (i + 1) + '</text>';
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

      const ol = el('ol', 'loc-legend');
      reg.points.forEach((p, i) => {
        const li = el('li', (p.t === 'hotel' || p.t === 'venue') ? 'loc-anchor-row' : null);
        const badge = el('span', 'loc-badge', String(i + 1));
        badge.style.background = typeOf(p.t).c;
        li.appendChild(badge);
        const a = el('a', 'loc-link');
        a.href = mapUrl(p.q);
        a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = typeOf(p.t).e + ' ' + p.n + ' <span class="loc-go">지도 ↗</span>';
        li.appendChild(a);
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      root.appendChild(sec);
    });

    {
      const lg = el('section', 'gcard');
      lg.appendChild(el('h2', null, '🏷️ 색상·아이콘 안내'));
      const chips = el('div', 'loc-chips');
      Object.keys(TYPES).forEach((k) => {
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

  fetch('./data/locations.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      root.innerHTML = '<p class="disclaimer">위치 정보를 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>';
    });
})();
