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

  // 위경도 → SVG 좌표 (방위 유지, 박스 안에 맞춰 중앙정렬)
  function projector(points, W, H, pad) {
    const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
    const minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    const minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
    const cLat = (minLat + maxLat) / 2, cLon = (minLon + maxLon) / 2;
    const latKm = (maxLat - minLat) * 111;
    const lonKm = (maxLon - minLon) * 90.5; // 도쿄·요코하마 위도 보정
    const usableW = W - 2 * pad, usableH = H - 2 * pad;
    let scale;
    if (latKm < 1e-6 && lonKm < 1e-6) scale = 1;
    else scale = Math.min(usableW / Math.max(lonKm, 1e-6), usableH / Math.max(latKm, 1e-6));
    return (p) => {
      const dxKm = (p.lon - cLon) * 90.5;
      const dyKm = (p.lat - cLat) * 111;
      return [W / 2 + dxKm * scale, H / 2 - dyKm * scale]; // y 반전(북쪽 위)
    };
  }

  function svgFor(points) {
    const W = 320, H = 220, pad = 30;
    const proj = projector(points, W, H, pad);
    const r = points.length > 9 ? 9 : 11;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="loc-svg" role="img" aria-label="약식 위치도">';
    s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="12" class="loc-bg"/>';
    // 북쪽 표시
    s += '<text x="' + (W - 14) + '" y="20" class="loc-n">N▲</text>';
    points.forEach((p, i) => {
      const xy = proj(p);
      const x = Math.round(xy[0]), y = Math.round(xy[1]);
      const col = typeOf(p.t).c;
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '" stroke="#fff" stroke-width="2"/>';
      s += '<text x="' + x + '" y="' + (y + 0.5) + '" class="loc-num" dominant-baseline="middle">' + (i + 1) + '</text>';
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
        const li = el('li');
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

    if (data.legendNote) {
      const lg = el('section', 'gcard');
      lg.appendChild(el('h2', null, '🏷️ 색상·아이콘 안내'));
      lg.appendChild(el('p', 'loc-legendnote', data.legendNote));
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
