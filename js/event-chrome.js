'use strict';
// 대회별 하위 페이지(구매처·쇼핑·위치·여행) 공용 크롬:
// - 헤더 부제목에 도시명 표시  - 상단에 '‹ {도시} 대회로' 뒤로가기  - 자료 없을 때 '준비 중' 안내
(function () {
  function getCity(eventId, cb) {
    fetch('./data/events.json')
      .then((r) => r.json())
      .then((d) => { const ev = (d.events || []).find((e) => e.id === eventId); cb(ev || null); })
      .catch(() => cb(null));
  }

  window.eventChrome = function (eventId, pageLabel) {
    getCity(eventId, function (ev) {
      const city = ev ? ev.city : null;
      const sub = document.querySelector('.guide-sub');
      if (sub && city) sub.textContent = '📍 ' + city + (ev.name ? ' · ' + ev.name : '');
      const main = document.querySelector('main.guide');
      if (main && city) {
        const p = document.createElement('p');
        const back = document.createElement('a');
        back.className = 'ev-back';
        back.href = './event.html?id=' + encodeURIComponent(eventId);
        back.textContent = '‹ ' + city + ' 대회로';
        p.appendChild(back);
        main.insertBefore(p, main.firstChild);
        if (pageLabel) document.title = city + ' ' + pageLabel;
      }
    });
  };

  window.notReadyHtml = function (pageLabel) {
    return '<section class="gcard ev-notready">' +
      '<h2>🛠️ 준비 중이에요</h2>' +
      '<p>이 대회의 <b>' + pageLabel + '</b> 정보는 아직 준비 중입니다. 자료가 모이면 채워질 예정이에요.</p>' +
      '<p><a class="plan-link-btn" href="./index.html">🏆 대회 일정으로</a></p>' +
      '</section>';
  };
})();
