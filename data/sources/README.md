# 자료 추가 방법 (data ingestion)

이 폴더는 용어집의 **원본 자료**가 모이는 곳입니다.
앱이 실제로 읽는 파일은 상위 폴더의 `data/terms.json` 하나이며,
이 폴더의 소스들을 합쳐서 자동 생성됩니다.

## 새 자료를 추가하려면

### 방법 A) 이미지/사진 자료 (가장 쉬움)
1. 용어가 적힌 사진·캡처를 `Data/` 폴더(이 폴더의 상위)에 넣는다.
2. Claude에게 "자료 추가했어, 반영해줘" 라고 말한다.
3. Claude가 이미지를 읽어 `data/sources/batchN.json` 으로 전사하고, 병합 스크립트를 실행한다.

### 방법 B) 직접 JSON 작성
`data/sources/` 에 아래 형식의 `.json` 파일을 새로 추가한다.
```json
[
  { "ja": "ありがとう", "reading": "", "ko_pron": "아리가토", "ko": "고마워요", "section": "기본 인사" }
]
```
- `ja`(일본어)는 필수.
- 카테고리는 `category`(아이디 직접 지정) 또는 `section`(한글 구역명, 자동 매핑) 중 하나로.
  - 사용 가능한 category 아이디: `greetings, match, check, effect, evolution, energy, trainer, pokecheck, side, dice, judge, numbers`
- `reading`(가나 읽기), `ko_pron`(한글 발음), `ko`(뜻), `note`(설명), `important`(중요 여부)는 선택.

그다음 병합:
```
node scripts/merge-terms.js
```

## 동작 방식
- `merge-terms.js` 는 `data/sources/*.json` 을 **전부** 읽어 합치고,
  `ja + ko` 가 같은 항목은 중복 제거한 뒤 `data/terms.json` 을 다시 만든다.
- **멱등(idempotent)**: 여러 번 실행해도 결과가 같다. 자료가 늘면 다시 실행만 하면 된다.
- 데이터를 고치고 싶으면 `terms.json` 이 아니라 **이 폴더의 소스 파일**을 고쳐야 한다
  (terms.json 은 재생성되며 직접 수정은 덮어쓰기됨).

## 현재 소스 파일
- `base.json` — 초기 손수 작성한 핵심 용어
- `batch1~4.json` — 사용자 제공 이미지(카카오톡 용어 시트) 전사물
- `daily.json` — 일상·여행 용어(번역 완료본). `daily.txt`에서 생성

## 일상·여행 용어 추가 (가장 쉬운 방법)
1. `data/sources/daily.txt` 에 **한국어 문장**을 한 줄에 하나씩 추가한다.
2. Claude에게 "일상용어 반영해줘"라고 말한다.
3. Claude가 새 줄을 일본어+읽는법+한글발음으로 번역해 `daily.json`(category: `daily`)에 추가하고,
   `node scripts/merge-terms.js` 로 `terms.json`을 재생성한다 → 용어집의 "일상·여행" 카테고리에 표시.

---

# 카드 데이터 (cards.json) 갱신 방법

`data/cards.json`은 **재생성물**입니다. 직접 고치면 다음 빌드 때 사라집니다.
아래 소스만 고치고 `node scripts/merge-cards.js`를 돌리세요.

## 소스 구성
| 폴더/파일 | 내용 | 만드는 법 |
|---|---|---|
| `sources/decks/<덱ID>.json` | 덱 1개의 카드 목록(ID·세트·매수) | `node scripts/scrape-deck.js <공식 덱 URL>` |
| `sources/sets/<세트>.json` | 세트 1개의 카드 ID 목록 | `node scripts/scan-set.js <세트> <시작ID> <끝ID>` |
| `sources/cards/*.json` | 카드 상세 + **한국어 번역** | `node scripts/scrape-card.js <출력.json> <id...>` 로 일본어 원문을 긁고, 번역은 사람/Claude가 채움 |
| `sources/kana.json` | 한자 섞인 이름의 **가나 읽기** | 손으로 추가 |
| `sources/energy.json` | 기술 에너지 비용 교정 | `node scripts/scrape-energy.js` |
| `scripts/merge-cards.js`의 `DECKS` | 덱 이름·티어·설명 | 손으로 편집 |

## 환경이 바뀌었을 때 (새 세트 발매 / 티어표 갱신)
1. **티어표에서 덱 URL 뽑기** — `node scripts/scrape-page.js <티어표 기사 URL>`
2. **덱 스크랩** — 나온 URL마다 `node scripts/scrape-deck.js <URL>`
3. **`merge-cards.js`의 `DECKS` 갱신** — id·이름·tier·file·deckId·note.
   티어표에서 빠진 옛 덱은 지우지 말고 `tier: 4`로 남긴다(카드 풀 유지).
4. **새 세트 스캔** — `node scripts/scan-set.js M6 50330 50465`
5. **신규 카드 상세 수집·번역** — `scrape-card.js`로 긁고 `sources/cards/`에 번역본 작성
6. `node scripts/merge-cards.js` → `npm test`

## 발음(read)이 안 나오는 이유
`read`는 카드 이름을 **가나→한글**로 자동 변환해 만듭니다. 그래서

- 이름에 **한자·영문이 섞이면** 변환이 안 됩니다 → `sources/kana.json`에
  `"夜の鉱山": "よるのこうざん"` 처럼 가나 표기를 넣어 주세요.
- 발음이 **한국어 이름과 똑같으면** 중복이라 일부러 표시하지 않습니다
  (예: `マンタイン` → 만타인 = 만타인).
