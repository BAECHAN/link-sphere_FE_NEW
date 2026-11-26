---
name: motion-ux
description: Link-Sphere FE 트랜지션·애니메이션 규약(지속시간·easing·transition-all 지양·prefers-reduced-motion·exit 애니메이션 동기화). 애니메이션·트랜지션 클래스를 붙이거나 exit 애니메이션이 있는 컴포넌트를 만들 때 사용.
when_to_use: 애니메이션·트랜지션 클래스를 붙일 때, 지속시간(duration)이나 easing을 정할 때, 사라지는(exit) 애니메이션이 있는 컴포넌트를 만들 때.
paths: src/**/*.tsx
---

2026-09-22, 외부 프론트엔드 스킬 도입을 조사하던 중 이 레포의 모션 영역이
`design-tokens`(색상·반경·z-index·타이포그래피)와 달리 **토큰이 전혀 없는
공백**임을 실측으로 확인해 신설했다 — 아래 "실측 현황" 참고. 다른 skill처럼
CLAUDE.md 본문에서 옮겨온 게 아니라 이번에 처음 만든 문서다. 2026-11-26 디자인 시스템 2단계 PR 3에서 시간·곡선 토큰이
생겼다. 값과 쓰는 곳은 [토큰 표](../../../docs/DESIGN-TOKENS.md) "시간"·"가속 곡선"이, 정한 이유는
`docs/DESIGN-SYSTEM.md` §5 "시간과 곡선"이 정본이고, 여기에는 고르는 법과 함정만 둔다.

## 시간 토큰

시간은 토큰 클래스로만 쓴다 — `duration-d3`(150ms), `duration-d4`(200ms), `duration-d6`(300ms), `duration-d12`(600ms).
숫자, Tailwind 기본 이름, 대괄호 값은 ESLint `custom-tailwind/no-raw-motion`이 막는다. 필요한 값이 없으면
`packages/ui/tokens/duration.tokens.json`에 토큰을 더하고 `pnpm tokens`를 돌린다.

- `transition-*`만 붙이고 시간을 적지 않으면 Tailwind 기본 시간이 역할 토큰 `color-transition`(→ d3, 150ms)을 가리킨다.
  hover·색 전환은 시간을 따로 적지 않는다.
- `animate-in`·`animate-out`(`tw-animate-css`)은 Tailwind 기본값을 읽지 않고 자기 기본값(150ms, `ease`)을 쓴다. 시간을
  안 적으면 토큰 밖 값으로 움직이고, 린트도 이것은 못 잡는다(아래 "딤과 패널" 함정).

고를 때는 아래 기준을 본다:

> "Rule: UI animations should stay under 300ms." 같은 문서의 지속시간 표는
> 용도별로 버튼 프레스 피드백 100-160ms, 툴팁·작은 팝오버 125-200ms,
> 드롭다운·셀렉트 150-250ms, 모달·드로어 200-500ms를 제시한다. "A 180ms
> dropdown feels more responsive than a 400ms one."
>
> — emil-design-eng skill(Emil Kowalski), https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md

이 기준에 비춰보면 d4(대화상자·선택 상자·맨 위로 버튼 등, 팝오버급)·d6(모바일 시트, 댓글 폼 강조 그림자, 카드
썸네일 hover 확대 — 중앙 모달에는 쓰지 않는다)는 범위 안이다. d12는 이 기준을 넘는데, 해시로 이동한 댓글의 강조가
흐려지는 시간이라 반응 속도와는 다른 쓰임이다(고른 경위는 `docs/COMMENT.md` "해시 이동").

## 곡선 토큰

곡선도 토큰 클래스로만 쓴다. 곡선을 직접 붙인 곳은 4곳이고(아래 실측), 나머지는 기본 곡선을 쓴다. 고를 때는:

> "Never use ease-in for UI animations. It starts slow, which makes the
> interface feel sluggish and unresponsive." 진입/퇴장 요소는 `ease-out`
> ("starts fast, feels responsive"), 화면 안에서 이동·변형하는 요소는
> `ease-in-out`, hover·색상 전환은 기본 `ease`를 쓴다.
>
> — 위와 같은 출처

위 인용의 이름은 Tailwind 기본 곡선이고, 우리 토큰으로는 이렇게 고른다:

- 진입/퇴장(fade·slide in/out): `ease-enter`(처음에 빠르고 끝에서 감속)
- 화면 안 이동/변형: `ease-easing`
- hover/색상 전환: 곡선을 적지 않는다. `transition-*`의 기본 곡선이 `ease-easing`을 가리킨다
- 처음에 느린(가속하는) 곡선은 토큰이 없다 — 위 인용대로 UI에 쓰지 않는다
- 모바일 하단 시트와 그 딤: `SHEET_TIMING`(`SheetDialogContent.tsx`)의 `duration-d6 ease-sheet`.
  처음에 빠르고 끝에서 감속하는 곡선이다. [vaul](https://github.com/emilkowalski/vaul/tree/main/src)(`style.css`)이
  드로어와 딤에 함께 쓰는 값이고, 값을 고른 근거와 기각한 값은 `docs/DECISIONS.md` 2026-11-03에 있다

## hover 트랜지션 컨테이너 안에 드롭다운·팝오버가 있을 때

카드·행에 `hover:` 트랜지션을 붙였는데 그 안에 드롭다운·셀렉트 같은 포털 팝업
트리거가 있다면, `responsive-ux` skill의 "hover와 밀도" 절(`hover-or-open` variant)을
먼저 읽는다 — 팝업이 열려 있는 동안 트랜지션이 풀리는 문제이지 duration·easing
문제가 아니라 이 문서 범위 밖이다.

## `transition-all` 지양

`transition-all`이 10건 있다 — 레이아웃까지 포함한 모든 속성 변화를 감시해
불필요한 리페인트 비용이 든다. 새 코드는 실제로 바뀌는 속성만 지정한다
(`transition-colors`/`transition-opacity`/`transition-transform` — 레포에
이미 각각 10/5/4건 선례가 있다). 기존 10건은 이번 skill 도입만으로 일괄
리팩터링하지 않는다.

## `prefers-reduced-motion` — 전역 대응

"동작 줄이기"를 켠 사용자에게는 움직임(이동·확대·회전)만 빼고 페이드·색 변화는 남긴다
(WCAG 2.3.3 Animation from Interactions). 줄이기는 없애기가 아니라는 근거는 Val Head의
[Smashing Magazine 글](https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/),
스피너를 끄지 않고 느리게 하는 선례는 [Bootstrap 접근성 문서](https://getbootstrap.com/docs/5.3/getting-started/accessibility/)다.

- **스크롤**(2026-10-14) — `behavior: ScrollUtil.getBehavior()`(`src/shared/utils/scroll.util.ts`)가
  "동작 줄이기"면 즉시 이동을 준다. `behavior: 'smooth'` 리터럴은 ESLint가 막는다(`docs/FE-ARCHITECTURE.md` §25).
- **CSS 애니메이션·트랜지션**(2026-10-15) — 토큰 CSS(`packages/ui/src/styles/tokens.css`) 끝의 `@media (prefers-reduced-motion: reduce)`
  블록 하나가 전역으로 처리한다. 컴포넌트마다 `motion-reduce:`를 붙이지 않는다 — 특히
  `motion-reduce:animate-none`은 스피너를 멈추고 페이드까지 없애 이 규칙과 어긋난다(#390이 필터 대기
  표시에 붙였던 2곳을 2026-10-15에 걷어냈다).
  - `tw-animate-css`의 `animate-in`/`animate-out`(zoom·slide)은 이동·확대·회전·흐림 변수(`--tw-enter-*`·`--tw-exit-*`)를
    덮어 페이드만 남는다 — 다이얼로그·하단 시트·드롭다운·툴팁.
  - 투명도 시작·끝값(`--tw-enter-opacity`·`--tw-exit-opacity`)도 0으로 둔다(2026-11-03). 모바일 시트를 밀기만 하게
    바꾸면서, 이동이 빠지는 이 설정에서는 흐려지지도 않고 툭 사라지게 되기 때문이다 — 고치기 전처럼 흐려지며 닫히게
    유지한다. 다른 `animate-in`/`animate-out`은 이미 `fade-*-0`·`fade-in`이라 바뀌지 않는다. 회귀는
    `e2e/bookmark-sheet-motion.mobile.spec.ts`가 잡는다.
  - `transition-property`를 색·투명도·그림자로 고정해(`!important`, `transition-all`·인라인 style까지) `translate`·`scale`·`rotate`·높이
    변화는 애니메이션 없이 바로 바뀐다 — 사이드바 드로어, 카드 hover, 떠 있는 버튼.
  - `animate-spin`은 2초에 한 바퀴(기본 1초)로 느리게 돌고, `animate-pulse`(스켈레톤)는 그대로다.
  - 숨김 상태에 `scale`·`translate`를 함께 쓰는 버튼(`BackToTopButton`)은 사라질 때
    크기·위치가 바로 바뀐 뒤 흐려진다. 2026-10-15 녹화로 보고 그대로 두기로 했다(사용자 결정).
  - 회귀는 `e2e/reduced-motion.spec.ts`가 잡는다.
- **새 코드** — `tw-animate-css` 클래스나 Tailwind `translate-*`·`scale-*`·`rotate-*` + `transition-*`로 만들면
  할 일이 없다. `@keyframes`를 직접 만들거나 JS(Web Animations API 등)로 움직이면 이 블록이 못 잡으므로
  `motion-reduce:` 변형이나 같은 미디어 쿼리를 함께 넣는다.

## exit 애니메이션 동기화 함정

CSS만으로 exit(사라짐) 애니메이션을 만들 때 "화면에서 사라지는 순간까지 DOM에
남겨두는" 시간(JS `setTimeout`)과 실제 CSS transition 시간이 어긋나면,
애니메이션이 끝나기 전에 언마운트되거나 반대로 다 끝난 뒤에도 빈 시간이 남는다.
2026-11-26부터 JS는 숫자를 적지 않고 생성된 토큰 값 `DURATION_MS`(`@baechan/ui/tokens`)를 읽는다. 토큰 값을 바꾸면
클래스와 타이머가 함께 바뀐다.

| JS 타이머                                | 위치                                                                                                                                         | 맞춰 둔 클래스                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `TRANSITION_MS = DURATION_MS.d4`         | `src/shared/ui/elements/BackToTopButton.tsx:14`                                                                                              | 같은 파일의 `duration-d4`                            |
| `setTimeout(..., DURATION_MS.d6)`        | `src/shared/ui/elements/dialog/alert-dialog/alertDialog.store.ts:71`, `src/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs.tsx:60` | `alert-dialog.tsx`의 `duration-d4`보다 길게 기다린다 |
| `window.setTimeout(..., DURATION_MS.d6)` | `src/shared/ui/elements/dialog/image-viewer/ImageViewer.tsx:107`                                                                             | `dialog.tsx`의 `duration-d4`보다 길게 기다린다       |
| `setTimeout(..., DURATION_MS.d12)`       | `src/widgets/comment/comment-list/ui/CommentList.tsx:106`                                                                                    | 같은 effect의 `duration-d12`                         |

d6으로 기다리는 세 곳이 왜 닫힘 시간(d4)보다 100ms 더 기다리는지는 기록에 없다. 클래스와 같은 토큰을 읽는 곳은
값이 같아야 하고, 더 길게 기다리는 곳은 클래스 토큰보다 큰 토큰이어야 한다.

같은 패턴(exit 애니메이션 + `shouldRender` 상태 + `setTimeout`)을 새로 만들 때는 타이머가 클래스와 같은 토큰을 읽게
한다. 클래스 이름은 Tailwind가 파일에서 찾아 CSS를 만들 수 있게 글자 그대로 적어야 해서 클래스와 타이머를 한 값에서
만들 수는 없다. 둘이 같은 토큰 이름인지는 사람이 본다(린트가 못 잡는다).

**등장(enter)도 따로 챙긴다.** 이 패턴은 보이는 상태 그대로 마운트되므로, 마운트한 뒤 상태가
바뀌지 않으면 트랜지션이 일어나지 않는다. framer-motion을 CSS로 옮긴 2026-09-21(`2c126c68`)에
`initial`이 빠져, 맨 위로·댓글 폼 버튼의 등장 애니메이션이 2026-10-15까지 사라져 있었다. 숨김 상태
클래스를 `starting:`(CSS `@starting-style`)으로도 붙여, 처음 그려질 때 그 상태에서 출발시킨다
(`BackToTopButton.tsx`). 회귀는 `e2e/reduced-motion.spec.ts`의 "맨 위로 버튼 등장 트랜지션"이 잡는다.

**딤과 패널처럼 따로 사라지는 형제 요소에는 같은 시간·곡선을 둘 다 붙인다.** Radix Dialog는 Overlay와
Content를 각자 Presence로 감싸 각자의 애니메이션이 끝날 때 내린다. 형제라서 한쪽에 붙인 `duration-*`는 다른
쪽에 가지 않고, 안 붙인 쪽은 `tw-animate-css` 기본값(150ms `ease`)으로 먼저 사라진다. 모바일 북마크 시트가
이 때문에 딤만 먼저 밝아졌다(2026-11-03, `SheetDialogContent.tsx`의 `SHEET_TIMING`이 둘에 같이 붙는다).
그리고 `cn`(tailwind-merge)은 `tw-animate-css` 클래스를 몰라 `fade-out-0` 위에 `slide-out-to-bottom`을 더해도
앞의 것을 지우지 않는다. 다른 움직임이 필요하면 기존 모션 클래스를 덮어쓰지 말고 처음부터 따로 조립한다
(`dialog.tsx`의 `DIALOG_CONTENT_MOTION`).

**Tailwind v4의 `translate-*`·`scale-*`·`rotate-*`는 `transform`이 아니라 같은 이름의 개별 속성이다.**
`transition-[transform,...]`로는 움직이지 않으니 `transition-transform`(넷 다 포함)이나
`transition-[translate,...]`를 쓴다. 게시글 카드 hover 들림이 이 문제로 처음부터 애니메이션 없이
바로 바뀌었다(`PostCard.tsx`, 2026-10-15 수정).

**부모의 `visibility`를 바꾸면 자식의 `transition-all`도 함께 돈다.** `visibility`는 상속되므로, 부모에 `invisible`을
주고 빼면 `Button`처럼 `transition-all`을 가진 자식이 물려받은 값까지 자기 트랜지션으로 바꾼다. 진행률 0에서는 아직
`hidden`이라 여는 순간 부른 `focus()`가 실패한다. 부모의 트랜지션에서 `visibility`를 빼도 소용없다 — 모바일 메뉴의 X가
이 때문에 포커스를 못 받았다(2026-11-06, `getAnimations()`로 직접 측정). 그 자식의 트랜지션을 실제로 바뀌는 속성으로
좁힌다(`Sidebar.tsx`). 회귀는 `e2e/sidebar-drawer-focus.mobile.spec.ts`가 잡는다.

## 실측 현황 (직접 측정, 2026-11-26)

`src`의 `.ts`·`.tsx` 371개(테스트·스토리 제외)에서 앞뒤가 클래스 경계인 토큰만 셌다(변형이 붙은 것 포함). 2026-11-03 표
(362개)를 시간·곡선 토큰을 넣으며 다시 쟀다. 공용 UI 패키지(`packages/ui/src`)의 부품에는 시간·곡선 클래스가 없다.

| 항목                     | 값                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시간 클래스              | d4×11, d6×4, d12×2, d3×1(주석 속 글자 d4 4곳·d12 1곳은 뺐다). 숫자·대괄호 값 0                                                                                                     |
| 곡선 클래스              | 4건(`select.tsx`의 `ease-easing`, `CommentItemSkeleton.tsx`·`CommentList.tsx`의 `ease-enter`, `SheetDialogContent.tsx`의 `ease-sheet`). Tailwind 기본 이름·대괄호 값 0             |
| `prefers-reduced-motion` | 토큰 CSS 전역 블록 1곳, 코드 1곳(`scroll.util.ts`), 컴포넌트 `motion-reduce:` 0곳                                                                                                  |
| `transition-all`         | 10건, 공용 UI 패키지 1건(`button.tsx`). 속성별 선례: `transition-colors` 10, `transition-shadow` 6, `transition-opacity` 5, `transition-transform` 3, 임의값 `transition-[...]` 10 |
| CSS 모션 토큰            | 시간 5개(눈금 4, 역할 1), 곡선 3개(토큰 표 "시간"·"가속 곡선")                                                                                                                     |

측정 스크립트는 커밋하지 않았다. 같은 수를 다시 내려면 위 범위의 파일에서 클래스 이름 앞뒤에 글자·하이픈이 붙지 않은 것만
센다(앞의 변형 `md:` 등은 허용). 정규식을 이 문서에 적지 않는 것은 Tailwind가 이 파일도 훑어 클래스로 읽을 수 있어서다.

## 점검 항목

- 새 트랜지션에 위 시간 기준을 근거로 댈 수 있는가
- `animate-in`·`animate-out`에 시간을 적었는가(안 적으면 토큰 밖 150ms)
- `transition-all` 대신 실제로 바뀌는 속성만 지정했는가
- exit 애니메이션이 있다면 JS 타이머가 `DURATION_MS`에서 클래스와 같은 토큰(더 길게 기다리면 더 큰 토큰)을 읽는가
