'use strict';
// 맛집 페이지: data/food/<eventId>.json 을 읽어 지역별로 렌더한다.
// 해당 파일이 없으면 data/restaurants.json 의 대회별 목록으로 대체한다(구 데이터 호환).
// 내용 수정은 데이터 파일만 고치면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('foodRoot');
  if (!root) return;

  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function shopItem(s) {
    const li = el('li', 'shop-item');
    const a = el('a', 'shop-name');
    a.href = mapUrl(s.map || s.name_ja || s.name_ko);
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = '🍽️ ' + (s.pick ? '⭐ ' : '') + s.name_ko + ' <span class="shop-go">지도 ↗</span>';
    li.appendChild(a);
    if (s.name_ja) li.appendChild(el('span', 'shop-ja', s.name_ja));
    const tags = el('span', 'shop-tags');
    if (s.type) tags.appendChild(el('span', 'shop-type', s.type));
    if (s.dist) tags.appendChild(el('span', 'shop-dist', '📍 ' + s.dist));
    if (s.type || s.dist) li.appendChild(tags);
    if (s.desc) li.appendChild(el('p', 'shop-desc', s.desc));
    if (s.addr) li.appendChild(el('p', 'shop-addr', '📮 ' + s.addr));
    if (s.near) li.appendChild(el('p', 'shop-near', '🚶 ' + s.near));
    if (s.hours) li.appendChild(el('p', 'shop-meta', '🕒 ' + s.hours));
    if (s.tel) {
      const p = el('p', 'shop-meta');
      p.appendChild(el('span', null, '☎ '));
      const t = el('a', 'shop-tel', s.tel);
      t.href = 'tel:' + s.tel.replace(/[^0-9+]/g, '');
      p.appendChild(t);
      li.appendChild(p);
    }
    return li;
  }

  function render(data) {
    if (data.intro) root.appendChild(el('p', 'guide-legend', data.intro));

    (data.areas || []).forEach((area) => {
      const sec = el('section', 'gcard');
      const h = el('h2', null, '📍 ' + area.name);
      sec.appendChild(h);
      if (area.when) sec.appendChild(el('span', 'food-when', '🗓️ ' + area.when));
      if (area.note) sec.appendChild(el('p', 'shop-note', area.note));
      const ul = el('ul', 'shop-list');
      (area.shops || []).forEach((s) => ul.appendChild(shopItem(s)));
      sec.appendChild(ul);
      if (area.mapAll) {
        const all = el('a', 'shop-mapall');
        all.href = mapUrl(area.mapAll);
        all.target = '_blank';
        all.rel = 'noopener';
        all.textContent = area.mapAllLabel || '👉 이 지역 지도에서 보기 ↗';
        sec.appendChild(all);
      }
      root.appendChild(sec);
    });

    if (data.tip) root.appendChild(el('p', 'disclaimer', '💡 ' + data.tip));
    if (data.disclaimer) root.appendChild(el('p', 'disclaimer', data.disclaimer));
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated));
  }

  // 구 형식(restaurants.json) → 지역 하나로 묶어 렌더
  function renderLegacy(list) {
    render({
      intro: '이 대회 도시의 맛집입니다. 가게 이름을 누르면 구글 지도가 열려요.',
      areas: [{
        name: '맛집',
        shops: list.map((r) => ({
          name_ko: r.name, name_ja: r.nameJa, map: r.map || r.nameJa || r.name,
          type: r.genre, dist: r.near, desc: r.note,
        })),
      }],
      disclaimer: '영업시간·정보는 변동될 수 있어요. 방문 전 확인하세요.',
    });
  }

  const eventId = new URLSearchParams(location.search).get('event') || 'yokohama';
  eventChrome(eventId, '맛집');
  fetch('./data/food/' + eventId + '.json')
    .then((r) => { if (!r.ok) throw new Error('no food data'); return r.json(); })
    .then(render)
    .catch(() =>
      fetch('./data/restaurants.json')
        .then((r) => r.json())
        .then((all) => {
          const list = all[eventId];
          if (list && list.length) renderLegacy(list);
          else root.innerHTML = notReadyHtml('맛집');
        })
        .catch(() => { root.innerHTML = notReadyHtml('맛집'); })
    );
})();
