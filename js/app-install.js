'use strict';
// 메인(홈) 페이지용: PWA 설치 버튼 + 서비스워커 등록.
// 용어집(app.js)·카드검색(cards.js) 외 페이지에서 SW가 등록되도록 홈에서도 처리한다.
(function () {
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
