'use strict';
// 2026 대회 일정(지난 대회 기록) 페이지: data/past-events.json 을 읽어
// 다녀온 대회를 카드로 렌더한다. 각 카드에서 그때의 여행 기록으로 이동.
// 대회를 다녀올 때마다 past-events.json 에 한 건씩 추가하면 된다(코드 수정 불필요).
(function () {
  const root = document.getElementById('pastRoot');
  if (!root) return;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render(data) {
    if (data.title) document.title = data.title;

    if (data.intro) {
      const intro = el('section', 'gcard ev-intro');
      intro.appendChild(el('p', null, data.intro));
      root.appendChild(intro);
    }

    (data.events || []).forEach((ev) => {
      const sec = el('section', 'gcard plan-archive');

      const top = el('div', 'ev-top');
      const city = el('div', 'ev-city');
      city.appendChild(el('span', 'ev-cityname', (ev.icon || '📸') + ' ' + ev.city));
      if (ev.cityJa) city.appendChild(el('span', 'ev-cityja', ev.cityJa));
      top.appendChild(city);
      top.appendChild(el('span', 'ev-badge ev-badge-past', '다녀옴'));
      sec.appendChild(top);

      sec.appendChild(el('h2', 'plan-archive-title', ev.name));
      if (ev.nameJa) sec.appendChild(el('div', 'ev-cityja', ev.nameJa));
      if (ev.dateLabel) sec.appendChild(el('div', 'ev-date', '🗓️ ' + ev.dateLabel));
      if (ev.venue) sec.appendChild(el('div', 'ev-venue', '🏟️ ' + ev.venue));
      if (ev.league) sec.appendChild(el('div', 'ev-league', '👥 ' + ev.league + ' 리그'));
      if (ev.note) sec.appendChild(el('p', 'plan-intro', ev.note));

      (ev.links || []).forEach((l) => {
        const item = el('div', 'plan-archive-item');
        const a = el('a', 'plan-link-btn');
        a.href = l.url;
        a.textContent = (l.icon || '📸') + ' ' + l.label;
        item.appendChild(a);
        if (l.desc) item.appendChild(el('p', 'plan-route-note', l.desc));
        sec.appendChild(item);
      });

      root.appendChild(sec);
    });

    // 다가오는 시즌으로 돌아가기
    const back = el('section', 'gcard');
    back.appendChild(el('h2', null, '🏆 다가오는 대회'));
    back.appendChild(el('p', 'plan-intro', '2027 시즌 대회 일정과 준비 중인 원정 가이드를 보려면 아래로.'));
    const b = el('a', 'plan-link-btn');
    b.href = './index.html';
    b.textContent = '🏆 2027 대회 일정으로';
    back.appendChild(b);
    root.appendChild(back);

    if (data.footer) root.appendChild(el('p', 'disclaimer', data.footer));
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated));
  }

  fetch('./data/past-events.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => {
      root.innerHTML = '<p class="disclaimer">지난 대회 기록을 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>';
    });
})();
