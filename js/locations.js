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
  const kmLabel = (km) => (km < 1 ? Math.round(km * 1000) + 'm' : km + 'km');

  let gid = 0;
  function svgFor(points) {
    const W = 320, H = 240, pad = 34, cx = W / 2, cy = H / 2;
    const a = pickAnchor(points);
    const off = points.map((p) => ({ dx: (p.lon - a.lon) * 90.5, dy: (p.lat - a.lat) * 111 }));
    const maxAbsX = Math.max(1e-6, ...off.map((o) => Math.abs(o.dx)));
    const maxAbsY = Math.max(1e-6, ...off.map((o) => Math.abs(o.dy)));
    let scale = Math.min((W - 2 * pad) / 2 / maxAbsX, (H - 2 * pad) / 2 / maxAbsY);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    const maxR = Math.max.apply(null, off.map((o) => Math.sqrt(o.dx * o.dx + o.dy * o.dy)).concat(0));
    const id = 'lg' + (gid++);

    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="loc-svg" role="img" aria-label="약식 위치도">';
    s += '<defs><radialGradient id="' + id + '" cx="50%" cy="50%" r="72%">'
      + '<stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e3edf6"/></radialGradient></defs>';
    s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="14" fill="url(#' + id + ')" class="loc-bg"/>';

    // 옅은 격자
    const stepX = (W - 2 * pad) / 6, stepY = (H - 2 * pad) / 5;
    for (let gx = pad; gx <= W - pad + 0.1; gx += stepX) s += '<line x1="' + gx.toFixed(0) + '" y1="' + pad + '" x2="' + gx.toFixed(0) + '" y2="' + (H - pad) + '" class="loc-grid"/>';
    for (let gy = pad; gy <= H - pad + 0.1; gy += stepY) s += '<line x1="' + pad + '" y1="' + gy.toFixed(0) + '" x2="' + (W - pad) + '" y2="' + gy.toFixed(0) + '" class="loc-grid"/>';

    // 호텔/대회장 기준 거리 링
    if (a.real && maxR > 0.05) {
      [0.25, 0.5, 1, 2, 3, 5].forEach((km) => {
        const rpx = km * scale;
        if (km > maxR * 1.12 || rpx < 12) return;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rpx.toFixed(0) + '" class="loc-ring"/>';
        s += '<text x="' + cx + '" y="' + (cy - rpx - 3).toFixed(0) + '" class="loc-ringlbl">' + kmLabel(km) + '</text>';
      });
    }
    // 북쪽
    s += '<text x="' + (W - 16) + '" y="22" class="loc-n">N▲</text>';

    // 점
    points.forEach((p, i) => {
      const x = (cx + off[i].dx * scale), y = (cy - off[i].dy * scale);
      const isA = (p.t === 'hotel' || p.t === 'venue');
      const r = isA ? 13 : (points.length > 9 ? 9 : 11);
      const col = typeOf(p.t).c;
      const xs = x.toFixed(0), ys = y.toFixed(0);
      if (isA) s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + (r + 7) + '" fill="' + col + '" class="loc-halo"/>';
      s += '<circle cx="' + xs + '" cy="' + ys + '" r="' + r + '" fill="' + col + '" stroke="#fff" stroke-width="' + (isA ? 3 : 2) + '"/>';
      s += '<text x="' + xs + '" y="' + (y + 0.5).toFixed(0) + '" class="loc-num" dominant-baseline="middle"' + (isA ? ' font-size="13"' : '') + '>' + (i + 1) + '</text>';
      if (isA) s += '<text x="' + xs + '" y="' + (y - r - 5).toFixed(0) + '" class="loc-anchorlbl">' + typeOf(p.t).e + ' ' + typeOf(p.t).ko + '</text>';
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
