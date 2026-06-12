'use strict';
// 면세 쇼핑 페이지: data/shopping.json 을 읽어 면세 가이드 + 동선 돈키호테 위치를 렌더한다.
// 내용 수정은 data/shopping.json 만 고치면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('shopRoot');
  if (!root) return;

  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render(data) {
    if (data.intro) root.appendChild(el('p', 'guide-legend', data.intro));

    const tf = data.taxfree || {};

    // 면세 기본
    if (tf.summary && tf.summary.length) {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '💴 면세 기본'));
      const ul = el('ul', 'bullets');
      tf.summary.forEach((s) => ul.appendChild(el('li', null, s)));
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // 두 종류 (일반물품 / 소모품)
    if (tf.categories) {
      const c = tf.categories;
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '🛍️ 면세 두 종류 (합산 주의)'));
      if (c.note) sec.appendChild(el('p', 'shop-note', c.note));
      const tbl = el('table', 'plan-table');
      const hr = el('tr');
      ['구분', '예시', '특징'].forEach((h) => hr.appendChild(el('th', null, h)));
      tbl.appendChild(hr);
      (c.rows || []).forEach((r) => {
        const tr = el('tr');
        tr.appendChild(el('td', 'tf-kind', r.kind));
        tr.appendChild(el('td', null, r.ex));
        tr.appendChild(el('td', null, r.feat));
        tbl.appendChild(tr);
      });
      sec.appendChild(tbl);
      if (c.warn) sec.appendChild(el('p', 'tf-warn', c.warn));
      root.appendChild(sec);
    }

    // 가게별 면세 방식
    if (tf.stores && tf.stores.length) {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '🏬 가게별 면세 방식'));
      const ul = el('ul', 'bullets');
      tf.stores.forEach((s) => {
        const li = el('li');
        li.appendChild(el('b', null, s.name + ' — '));
        li.appendChild(el('span', null, s.how));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // 한국 입국 면세 한도
    if (tf.korea) {
      const sec = el('section', 'gcard warn-box');
      sec.appendChild(el('h2', null, '🇰🇷 한국 입국 면세 한도'));
      if (tf.korea.note) sec.appendChild(el('p', 'shop-note', tf.korea.note));
      const ul = el('ul', 'bullets');
      (tf.korea.rows || []).forEach((r) => ul.appendChild(el('li', null, r)));
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // 면세 카운터 일본어
    if (tf.phrases && tf.phrases.length) {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '🗣️ 면세 카운터 일본어'));
      const ul = el('ul', 'tf-phrases');
      tf.phrases.forEach((p) => {
        const li = el('li');
        li.appendChild(el('span', 'tf-jp', p.jp));
        li.appendChild(el('span', 'tf-pron', p.ko));
        li.appendChild(el('span', 'tf-mean', p.mean));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // 동선별 쇼핑·맛집 (호텔 가까운 순)
    const donki = el('section', 'gcard');
    donki.appendChild(el('h2', null, '🛍️ 동선별 쇼핑·맛집 (호텔 가까운 순)'));
    if (data.spotsIntro) donki.appendChild(el('p', 'shop-note', data.spotsIntro));
    root.appendChild(donki);

    (data.areas || []).forEach((area) => {
      const sec = el('section', 'gcard');
      sec.appendChild(el('h2', null, '📍 ' + area.name));
      if (area.note) sec.appendChild(el('p', 'shop-note', area.note));
      const ul = el('ul', 'shop-list');
      (area.shops || []).forEach((s) => {
        const li = el('li', 'shop-item');
        const a = el('a', 'shop-name');
        a.href = mapUrl(s.map || s.name_ja || s.name_ko);
        a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = '🗺️ ' + s.name_ko + ' <span class="shop-go">지도 ↗</span>';
        li.appendChild(a);
        if (s.name_ja) li.appendChild(el('span', 'shop-ja', s.name_ja));
        const tags = el('span', 'shop-tags');
        if (s.type) tags.appendChild(el('span', 'shop-type', s.type));
        if (s.dist) tags.appendChild(el('span', 'shop-dist', '📍 ' + s.dist));
        if (s.type || s.dist) li.appendChild(tags);
        if (s.desc) li.appendChild(el('p', 'shop-desc', s.desc));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      if (area.mapAll) {
        const all = el('a', 'shop-mapall');
        all.href = mapUrl(area.mapAll);
        all.target = '_blank'; all.rel = 'noopener';
        all.textContent = '👉 이 지역 돈키호테 지도에서 보기 ↗';
        sec.appendChild(all);
      }
      root.appendChild(sec);
    });

    if (data.tip) root.appendChild(el('p', 'disclaimer', '💡 ' + data.tip));
    if (data.disclaimer) root.appendChild(el('p', 'disclaimer', data.disclaimer));
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated));
  }

  const eventId = new URLSearchParams(location.search).get('event') || 'yokohama';
  eventChrome(eventId, '면세 / 쇼핑');
  fetch('./data/shopping/' + eventId + '.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      root.innerHTML = notReadyHtml('면세 / 쇼핑');
    });
})();
