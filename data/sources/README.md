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
