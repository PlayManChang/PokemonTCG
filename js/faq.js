'use strict';
// FAQ 페이지: data/faq/<event>.json 의 items[{q,a}]를 접기(아코디언)로 렌더.
// 내용 수정은 data/faq/<event>.json 만 고치면 된다.
(function () {
  const root = document.getElementById('faqRoot');
  if (!root) return;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render(data) {
    if (data.title) document.title = data.title;
    if (data.intro) root.appendChild(el('p', 'guide-legend', data.intro));
    (data.items || []).forEach((it) => {
      const d = el('details', 'gcard faq-item');
      const sum = el('summary', 'faq-q');
      sum.appendChild(el('span', 'faq-qmark', 'Q'));
      sum.appendChild(el('span', 'faq-qtext', it.q));
      d.appendChild(sum);
      d.appendChild(el('p', 'faq-a', it.a));
      root.appendChild(d);
    });
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated + ' · 공식 정보가 변경될 수 있으니 출발 전 다시 확인하세요.'));
  }

  const eventId = new URLSearchParams(location.search).get('event') || '';
  if (eventId) eventChrome(eventId, 'FAQ');
  fetch('./data/faq/' + (eventId || 'naic-chicago') + '.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => { root.innerHTML = notReadyHtml('FAQ'); });
})();
