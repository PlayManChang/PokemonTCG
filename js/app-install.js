'use strict';
// 모든 페이지 공통: PWA '앱 설치' 버튼 + 서비스워커 등록.
//
// 예전에는 페이지마다 <button id="installBtn">을 직접 넣어야 해서 index·glossary 외에는
// 설치 버튼도, 서비스워커 등록도 빠져 있었다(= 그 페이지로 바로 들어오면 오프라인 캐싱이 안 됨).
// 이제 이 파일 하나만 불러오면 버튼이 없으면 헤더에 만들어 넣고 SW도 등록한다.
(function () {
  if (window.__pjcsInstall) return; // 중복 로드 방지
  window.__pjcsInstall = true;

  // 버튼이 이미 마크업에 있으면 그걸 쓰고, 없으면 헤더에 만들어 넣는다.
  function ensureButton() {
    const existing = document.getElementById('installBtn');
    if (existing) return existing;
    const row = document.querySelector('.app-header .title-row');
    if (!row) return null;

    const btn = document.createElement('button');
    btn.id = 'installBtn';
    btn.className = 'install-btn';
    btn.type = 'button';
    btn.textContent = '앱 설치';
    btn.hidden = true;

    const wrap = document.createElement('span');
    wrap.className = 'header-actions';
    wrap.appendChild(btn);

    // 하위 페이지는 제목을 가운데 맞추려고 .header-spacer 를 두고 있다 → 그 자리를 대신한다.
    const spacer = row.querySelector('.header-spacer');
    if (spacer) row.replaceChild(wrap, spacer);
    else row.appendChild(wrap);
    return btn;
  }

  let deferredPrompt = null;
  let installBtn = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn = installBtn || ensureButton();
    if (installBtn) installBtn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
  });

  // 클릭은 위임으로 받는다(버튼이 나중에 만들어져도 동작).
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t || t.id !== 'installBtn') return;
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (err) { /* 사용자가 닫음 */ }
    deferredPrompt = null;
    t.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
