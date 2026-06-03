# 여행 가이드 프레임워크 (Travel Guide Framework)

데이터(JSON)만 바꾸면 **어떤 여행이든** 똑같이 쓸 수 있는 **모바일 여행 가이드 PWA**예요.
일정·약식 지도·실시간 길찾기·교통비 계산기·예산·비상연락처·공항 가이드·맛집 추천을 한 페이지에서.

## 폴더 구조

```
config.js                  ← ⭐ 전역 설정(활성 여행·제목·테마색·메뉴·모듈 on/off)
index.html, plan.html …    ← 화면(껍데기). 내용은 JSON에서 읽음
js/                        ← 공용 엔진(여행이 바뀌어도 안 건드림)
  plan.js        일정·교통비·예산·공항가이드 렌더
  locations.js   지역별 약식 지도(좌표→미니맵·거리·길찾기)
  shops.js       구매처
  shopping.js    쇼핑/면세
  nav.js         메뉴(config 기반)
  cards.js, app.js   포켓몬 모듈(카드검색·용어집) — 일반 여행에선 꺼도 됨
css/style.css              ← 디자인
trips/                     ← ⭐ 여행별 데이터(여기만 바꾸면 새 여행)
  tokyo-pjcs-2026/         예시 여행(도쿄)
    plan.json  locations.json  shops.json  shopping.json  docs/*.pdf
  _template/               빈 여행 양식(복사해서 시작)
```

## 🧳 새 여행 만들기 (5단계)

1. **폴더 복사**: `trips/_template` → `trips/내여행이름` (영문·소문자·하이픈 권장, 예: `osaka-2027`)
2. **데이터 채우기**: 그 폴더의 JSON을 우리 여행에 맞게 수정
   - `plan.json` — 일정·항공·호텔·교통비·예산·비상연락처·공항가이드 (필수)
   - `locations.json` — 지역별 주요 위치(위경도 좌표) (필수)
   - `shops.json` / `shopping.json` — 구매처·쇼핑 (선택)
3. **설정 변경**: `config.js` 에서
   - `id` → 새 폴더명 (`'osaka-2027'`)
   - `title` → 여행 제목
   - `theme` → 헤더 색
   - `modules` → 안 쓰는 페이지 `false` (포켓몬 여행이 아니면 `terms/cards/guide`를 끄세요)
4. **(선택) 좌표 얻기**: `locations.json`의 `lat/lon`은 구글 지도에서 장소 우클릭 → 좌표 복사, 또는 무료 지오코딩(OpenStreetMap Nominatim) 사용
5. **확인·배포**: `npm test` 로 점검 후, 그대로 웹에 올리면 끝 (GitHub Pages 등)

## 📋 데이터 작성 팁

- **지도 검색어(`map`/`q`/`query`)**: 구글 지도에서 바로 찾히는 현지 이름이 정확해요(현지어 권장).
- **일정 `stops`**: `{ "label": "장소", "map": "검색어" }`. 메인 위치 아래에 `"spots": [...]`(가볼만한 곳·맛집)을 넣으면 **접기**로 표시돼요. 맛집은 `"food": true`.
- **위치 `points`의 `t`(종류)**: `hotel`(호텔)·`station`(기준 역)·`venue`(행사장)·`sight`(관광)·`shop`(쇼핑)·`food`(맛집)·`poke`(포켓몬). 호텔/역을 첫 점에 두면 지도 중앙·거리 기준이 돼요. 역엔 `"fromHotel": "호텔→역 가는 법"`을 적을 수 있어요.
- 자세한 형식은 **`trips/tokyo-pjcs-2026/`(완성 예시)** 를 그대로 참고하세요.

## 🔌 모듈(페이지) 켜고 끄기 — `config.js`

| 모듈 | 페이지 | 설명 |
|---|---|---|
| `plan` | 🗺️ 여행 가이드 | 일정·교통비·예산·공항 (여행 핵심) |
| `locations` | 📌 위치 한눈에 | 지역별 약식 지도 |
| `shops` | 🏪 구매처 | 가게 지도 |
| `shopping` | 🛍️ 쇼핑 | 쇼핑/면세 |
| `terms` | 📖 용어집 | 회화/용어 (포켓몬 대회용) |
| `cards` | 🃏 카드 검색 | 포켓몬 카드 (대회용) |
| `guide` | 📋 대회 안내 | 행사 규칙·PDF (대회용) |

`modules`에서 `false`로 끄면 메뉴·페이지에서 사라져요. **일반 가족여행이면 `plan/locations/shops/shopping`만 켜면 충분**합니다.

## 개발

```
npm install
npm test      # 헤드리스 Chrome E2E 스모크 테스트
npm run build # dist/ 생성(배포용)
```

> 이 프레임워크는 **PJCS 2026 도쿄 여행**(`trips/tokyo-pjcs-2026/`)을 만들며 정리한 것이에요. 그 폴더가 가장 완성된 실제 예시입니다.
