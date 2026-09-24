---
name: motion-ux
description: Link-Sphere FE 트랜지션·애니메이션 규약(지속시간·easing·transition-all 지양·prefers-reduced-motion·exit 애니메이션 동기화). 애니메이션·트랜지션 클래스를 붙이거나 exit 애니메이션이 있는 컴포넌트를 만들 때 사용.
when_to_use: 애니메이션·트랜지션 클래스를 붙일 때, 지속시간(duration)이나 easing을 정할 때, 사라지는(exit) 애니메이션이 있는 컴포넌트를 만들 때.
paths: src/**/*.tsx
---

2026-09-22, 외부 프론트엔드 스킬 도입을 조사하던 중 이 레포의 모션 영역이
`design-tokens`(색상·반경·z-index·타이포그래피)와 달리 **토큰이 전혀 없는
공백**임을 실측으로 확인해 신설했다 — 아래 "실측 현황" 참고. 다른 skill처럼
CLAUDE.md 본문에서 옮겨온 게 아니라 이번에 처음 만든 문서다.

## Duration 규약

지금 레포엔 duration 토큰이 없고, 혼용 중인 값 3종(150/200/300ms)엔 선택
근거가 없다(아래 실측 참고). 새 코드부터 아래 기준을 적용한다:

> "Rule: UI animations should stay under 300ms." 같은 문서의 지속시간 표는
> 용도별로 버튼 프레스 피드백 100-160ms, 툴팁·작은 팝오버 125-200ms,
> 드롭다운·셀렉트 150-250ms, 모달·드로어 200-500ms를 제시한다. "A 180ms
> dropdown feels more responsive than a 400ms one."
>
> — emil-design-eng skill(Emil Kowalski), https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md

이 기준에 비춰보면 기존 `duration-200`(플로팅 버튼 등, 팝오버급)·`duration-300`
(모달급)은 범위 안이지만 `duration-150`은 어느 용도 범주에도 명확히 안 든다 —
새로 쓸 때 참고만 하고, 기존 3곳을 이번에 일괄 교정하지는 않는다.

## Easing 규약

레포 전체에 `ease-*` 클래스 사용이 0건이다(전부 브라우저 기본 easing에 의존).
앞으로는:

> "Never use ease-in for UI animations. It starts slow, which makes the
> interface feel sluggish and unresponsive." 진입/퇴장 요소는 `ease-out`
> ("starts fast, feels responsive"), 화면 안에서 이동·변형하는 요소는
> `ease-in-out`, hover·색상 전환은 기본 `ease`를 쓴다.
>
> — 위와 같은 출처

- 진입/퇴장(fade·slide in/out): `ease-out`
- 화면 안 이동/변형: `ease-in-out`
- hover/색상 전환: `ease`(Tailwind 기본값)
- `ease-in`은 쓰지 않는다

## hover 트랜지션 컨테이너 안에 드롭다운·팝오버가 있을 때

카드·행에 `hover:` 트랜지션을 붙였는데 그 안에 드롭다운·셀렉트 같은 포털 팝업
트리거가 있다면, `responsive-ux` skill의 "hover와 밀도" 절(`hover-or-open` variant)을
먼저 읽는다 — 팝업이 열려 있는 동안 트랜지션이 풀리는 문제이지 duration·easing
문제가 아니라 이 문서 범위 밖이다.

## `transition-all` 지양

`transition-all`이 12건 있다 — 레이아웃까지 포함한 모든 속성 변화를 감시해
불필요한 리페인트 비용이 든다. 새 코드는 실제로 바뀌는 속성만 지정한다
(`transition-colors`/`transition-opacity`/`transition-transform` — 레포에
이미 각각 10/4/3건 선례가 있다). 기존 12건은 이번 skill 도입만으로 일괄
리팩터링하지 않는다.

## `prefers-reduced-motion` 미대응

레포 전체에 `prefers-reduced-motion` 대응이 0건이다(WCAG 2.3.3 Animation
from Interactions 미충족). 이 skill은 그 공백을 기록만 하고 전역 대응 코드는
추가하지 않는다 — 별도 작업으로 남긴다.

## exit 애니메이션 동기화 함정

CSS만으로 exit(사라짐) 애니메이션을 만들 때 "화면에서 사라지는 순간까지 DOM에
남겨두는" 시간(JS `setTimeout`)과 실제 CSS transition 시간이 어긋나면,
애니메이션이 끝나기 전에 언마운트되거나 반대로 다 끝난 뒤에도 빈 시간이 남는다.
이 값이 지금 코드 두 군데에 **매직넘버로 중복**돼 있다 — 하나를 고치면 다른
쪽은 그대로 남는 함정이다.

| 값                     | 위치                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSITION_MS = 200`  | `src/shared/ui/elements/ScrollToTop.tsx:10`, `src/features/comment/create/ui/ScrollToCommentFormButton.tsx:9` — 각자 독립 선언, CSS `duration-200`과 수동 동기화 |
| `setTimeout(..., 300)` | `src/shared/ui/elements/modal/alert/alert.store.ts:67`, `src/shared/ui/elements/modal/alert/Alert.tsx:49`                                                        |

같은 패턴(exit 애니메이션 + `shouldRender` 상태 + `setTimeout`)을 새로 만들
때는 이 값이 실제 CSS `duration-*` 클래스와 정확히 일치해야 한다는 걸 놓치지
않는다. 값을 `globals.css` 토큰으로 중앙화해 중복 자체를 없애는 리팩터링은
이번 범위 밖 — 후속 과제로 남긴다.

## 실측 현황 (직접 측정, 2026-09-22)

| 항목                     | 값                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `duration-*`             | 150×1, 200×7, 300×3                                                                          |
| `ease-*`                 | 0건                                                                                          |
| `prefers-reduced-motion` | 0건                                                                                          |
| `transition-all`         | 12건(`transition-colors` 10, `transition-opacity` 4, `transition-transform` 3 — 속성별 선례) |
| `globals.css` 모션 토큰  | 0개(색상·반경·z-index·타이포그래피는 있음)                                                   |

## 점검 항목

- 새 트랜지션에 위 duration 표를 근거로 댈 수 있는가
- `ease-in`을 쓰지 않았는가
- `transition-all` 대신 실제로 바뀌는 속성만 지정했는가
- exit 애니메이션이 있다면 `setTimeout` 값과 CSS `duration-*`가 정확히 일치하는가
