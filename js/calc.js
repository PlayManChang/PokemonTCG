'use strict';
// 비용 계산기: 인원·숙박일수·쇼핑예산을 입력하면 항목별 예상 비용과 총합을 계산한다.
// 단가 기준값은 data/calc/<event>.json 의 rates/labels 에서 읽는다(코드 수정 불필요).
(function () {
  const root = document.getElementById('calcRoot');
  if (!root) return;

  const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render(data) {
    if (data.title) document.title = data.title;
    const rates = data.rates || {};
    const labels = data.labels || {};
    const state = Object.assign({ people: 3, nights: 5, shopping: 1000000, players: 0 }, data.defaults || {});

    if (data.intro) root.appendChild(el('p', 'guide-legend', data.intro));

    // 입력 카드
    const inForm = el('section', 'gcard');
    inForm.appendChild(el('h2', null, '✏️ 조건 입력'));
    const mkInput = (key, label, min, max, step, suffix) => {
      const row = el('div', 'calc-row');
      row.appendChild(el('label', 'calc-label', label));
      const input = el('input', 'calc-input');
      input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step || 1);
      input.value = String(state[key]);
      input.addEventListener('input', () => { state[key] = Math.max(min, parseFloat(input.value) || min); compute(); });
      row.appendChild(input);
      if (suffix) row.appendChild(el('span', 'calc-suffix', suffix));
      return row;
    };
    inForm.appendChild(mkInput('people', '👥 인원수', 1, 20, 1, '명'));
    inForm.appendChild(mkInput('nights', '🏨 숙박일수', 1, 30, 1, '박'));
    // 대회 참가비가 있는 대회만: 참가자수 입력
    if (rates.entryPerPlayer) inForm.appendChild(mkInput('players', '🎮 대회 참가자수', 0, 20, 1, '명'));
    inForm.appendChild(mkInput('shopping', '🛍️ 쇼핑예산', 0, 100000000, 100000, '원'));
    root.appendChild(inForm);

    // 결과 카드
    const out = el('section', 'gcard');
    out.appendChild(el('h2', null, '💰 예상 비용'));
    const table = el('table', 'plan-table');
    out.appendChild(table);
    root.appendChild(out);

    if (data.note) root.appendChild(el('p', 'plan-tip', '💡 ' + data.note));
    if (data.updated) root.appendChild(el('p', 'disclaimer', '최종 업데이트: ' + data.updated + ' · 환율·시기에 따라 달라져요.'));

    function compute() {
      const p = state.people, n = state.nights, days = n + 1;
      const rows = [
        { label: labels.flight || '항공', amount: (rates.flightPerPerson || 0) * p },
        { label: labels.hotel || '호텔', amount: (rates.hotelPerNight || 0) * n },
        { label: labels.food || '식비', amount: (rates.foodPerPersonPerDay || 0) * p * days },
        { label: labels.transport || '교통', amount: (rates.transportPerTrip || 0) },
        { label: labels.attraction || '관광', amount: (rates.attractionPerPerson || 0) * p },
        { label: labels.shopping || '쇼핑', amount: state.shopping }
      ];
      // 대회 참가비(참가자수 × 1인 참가비)
      if (rates.entryPerPlayer) {
        rows.splice(1, 0, { label: labels.entry || '🎮 대회 참가비', amount: (rates.entryPerPlayer || 0) * (state.players || 0) });
      }
      let total = 0;
      table.innerHTML = '';
      const hr = el('tr');
      ['항목', '예상 금액'].forEach((h) => hr.appendChild(el('th', null, h)));
      table.appendChild(hr);
      rows.forEach((r) => {
        total += r.amount;
        const tr = el('tr');
        tr.appendChild(el('td', null, r.label));
        tr.appendChild(el('td', null, won(r.amount)));
        table.appendChild(tr);
      });
      const tot = el('tr', 'plan-total-row');
      tot.appendChild(el('td', null, '총 예상 비용 (' + p + '인 · ' + n + '박)'));
      tot.appendChild(el('td', null, won(total)));
      table.appendChild(tot);
    }
    compute();
  }

  const eventId = new URLSearchParams(location.search).get('event') || '';
  if (eventId) eventChrome(eventId, '비용 계산기');
  fetch('./data/calc/' + (eventId || 'naic-chicago') + '.json')
    .then((r) => r.json())
    .then(render)
    .catch(() => { root.innerHTML = notReadyHtml('비용 계산기'); });
})();
