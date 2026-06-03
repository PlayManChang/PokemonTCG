'use strict';
// ─────────────────────────────────────────────────────────────
// 여행 프레임워크 전역 설정 (모든 페이지가 가장 먼저 읽음)
// 새 여행을 만들 땐: ① trips/<새폴더>/ 에 데이터(JSON) 작성
//                  ② 아래 id 를 새 폴더명으로 바꾸고 title·theme·modules 수정
// ─────────────────────────────────────────────────────────────
window.TRIP = {
  id: 'tokyo-pjcs-2026',                 // trips/ 안의 폴더명
  title: 'PJCS 2026 가족여행',            // 헤더·메뉴 제목
  theme: '#1b5e20',                      // 테마색(헤더 등)
  base: './trips/tokyo-pjcs-2026',       // 데이터 경로(자동: ./trips/{id})

  // 켤 페이지(모듈). false 로 끄면 메뉴·페이지에서 사라짐
  modules: {
    terms: true,      // 📖 용어집 (여행 회화/용어) — data/terms.json
    cards: true,      // 🃏 카드 검색 (포켓몬 전용 모듈) — data/cards.json
    guide: true,      // 📋 대회/행사 안내 (PDF 포함)
    shops: true,      // 🏪 카드/쇼핑 구매처
    shopping: true,   // 🛍️ 면세/쇼핑
    locations: true,  // 📌 위치 한눈에
    plan: true,       // 🗺️ 여행 가이드(일정)
  },

  // 메뉴 구성 (모듈이 켜진 항목만 표시). external=외부 링크
  menu: [
    { key: 'terms',     href: 'index.html',     label: '📖 용어집',     desc: '인사·게임 용어' },
    { key: 'cards',     href: 'cards.html',     label: '🃏 카드 검색',  desc: '메타 덱·세트 카드 (한국어)' },
    { key: 'guide',     href: 'guide.html',     label: '📋 대회 안내',  desc: 'PJCS 2026 참가 주의사항' },
    { key: 'shops',     href: 'shops.html',     label: '🏪 카드 구매처', desc: '요코하마·도쿄 카드샵 지도' },
    { key: 'shopping',  href: 'shopping.html',  label: '🛍️ 면세 / 쇼핑', desc: '면세 가이드·쇼핑·돈키호테' },
    { key: 'locations', href: 'locations.html', label: '📌 위치 한눈에', desc: '주요 장소 지역별 약식 지도' },
    { key: 'plan',      href: 'plan.html',      label: '🗺️ 여행 가이드', desc: '일정·지도·교통비·예산' },
    { key: '_ext1', external: true, href: 'https://pokecabook.com/',   label: '📊 포케카북',   desc: '환경·티어·덱레시피 (외부)' },
    { key: '_ext2', external: true, href: 'https://pokeka-win-decks.jp/', label: '🏆 윈덱스',  desc: '티어표·우승덱 분석 (외부)' },
    { key: '_ext3', external: true, href: 'https://pokekameshi.com/',  label: '🍚 포케카메시', desc: '덱·카드리스트 (외부)' },
  ],
};

// 데이터 경로 헬퍼: dataUrl('plan.json') → './trips/tokyo-pjcs-2026/plan.json'
window.TRIP.dataUrl = function (name) { return window.TRIP.base + '/' + name; };

// 테마색을 CSS 변수로 주입(헤더 그라데이션 등에서 사용 가능)
try { document.documentElement.style.setProperty('--theme', window.TRIP.theme); } catch (e) {}
