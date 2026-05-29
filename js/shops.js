'use strict';
// 현지 카드 구매처 페이지: data/shops.json 을 읽어 지역별 가게 목록을 렌더한다.
// 가게는 shops.json 만 고치면 자동 반영된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('shopList');
  if (!root) return;

  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  fetch('./data/shops.json')
    .then((r) => r.json())
    .then((data) => {
      if (data.intro) {
        const p = document.createElement('p');
        p.className = 'guide-legend';
        p.textContent = data.intro;
        root.appendChild(p);
      }

      (data.areas || []).forEach((area) => {
        const sec = document.createElement('section');
        sec.className = 'gcard';

        const h2 = document.createElement('h2');
        h2.textContent = '📍 ' + area.name;
        sec.appendChild(h2);

        if (area.note) {
          const note = document.createElement('p');
          note.className = 'shop-note';
          note.textContent = area.note;
          sec.appendChild(note);
        }

        const ul = document.createElement('ul');
        ul.className = 'shop-list';
        (area.shops || []).forEach((s) => {
          const li = document.createElement('li');
          li.className = 'shop-item';

          const a = document.createElement('a');
          a.className = 'shop-name';
          a.href = mapUrl(s.map || s.name_ja || s.name_ko);
          a.target = '_blank';
          a.rel = 'noopener';
          a.innerHTML = '🗺️ ' + s.name_ko + ' <span class="shop-go">지도 ↗</span>';
          li.appendChild(a);

          if (s.name_ja) {
            const ja = document.createElement('span');
            ja.className = 'shop-ja';
            ja.textContent = s.name_ja;
            li.appendChild(ja);
          }
          if (s.type) {
            const t = document.createElement('span');
            t.className = 'shop-type';
            t.textContent = s.type;
            li.appendChild(t);
          }
          if (s.desc) {
            const d = document.createElement('p');
            d.className = 'shop-desc';
            d.textContent = s.desc;
            li.appendChild(d);
          }
          ul.appendChild(li);
        });
        sec.appendChild(ul);

        if (area.mapAll) {
          const all = document.createElement('a');
          all.className = 'shop-mapall';
          all.href = mapUrl(area.mapAll);
          all.target = '_blank';
          all.rel = 'noopener';
          all.textContent = '👉 이 지역 가게 한 번에 지도에서 보기 ↗';
          sec.appendChild(all);
        }
        root.appendChild(sec);
      });

      if (data.tip) {
        const tip = document.createElement('p');
        tip.className = 'disclaimer';
        tip.textContent = '💡 ' + data.tip;
        root.appendChild(tip);
      }
      if (data.updated) {
        const upd = document.createElement('p');
        upd.className = 'disclaimer';
        upd.textContent = '최종 업데이트: ' + data.updated;
        root.appendChild(upd);
      }
    })
    .catch(() => {
      root.innerHTML = '<p class="disclaimer">가게 정보를 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>';
    });
})();
