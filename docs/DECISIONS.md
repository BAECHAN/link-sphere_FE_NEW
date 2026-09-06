# Link-Sphere FE — 설계·UX 의사결정 기록

되돌리기 어렵거나 "왜 이렇게 했는지"가 코드만으로 드러나지 않는 설계·UX 결정을 기록합니다.
무엇을 바꿨는지는 [CHANGELOG.md](../CHANGELOG.md), 날짜별 자동 변경 로그는 [HISTORY.md](./HISTORY.md)를 참고하세요.
이 문서는 **"왜"** 를 남기는 곳입니다. 형식은 가볍게: 배경 / 결정 / 이유 / 상태.

---

## 2026-09-06 — 검색창 헤더 통합 + 모바일 칩 높이 되돌림

**배경**

필터 카드의 검색창 placeholder 잘림 문제를 고치려던 중, 코드를 추적해보니
데스크톱 헤더(`NavbarSearch.tsx`)와 모바일 헤더 검색(`MobileNavbarSearch.tsx`

- `Navbar.tsx`의 `handleSearchSubmit`)이 이미 있고, 제출하면 이 필터 카드의
  검색창과 **완전히 동일하게** `/post?q=<검색어>`로 이동한다는 걸 확인했다.
  검색창이 사실상 2곳에 중복 존재하던 것이다.

**검토 — 문제 발생 가능성 (Impact Check)**

검색 입력행을 없애기 전, 아래를 코드로 직접 확인했다(자세한 표는
`CHANGELOG.md`의 해당 항목 참고):

- 카테고리 칩(`@라벨`)의 태그 병합 로직이 로컬 `searchInput`(URL과 동기화된
  즉시 반영용 사본)을 기준으로 하고 있어, 그 상태를 없애고 URL만 기준으로
  삼으면 `setSearchParams`의 라우터 `startTransition` 때문에 칩이 늦게
  반응하는 것처럼 보일 위험이 있었다 → 범위 필터 칩이 이미 쓰고 있는
  `flushSync` 낙관적 미러 패턴을 카테고리에도 그대로 적용해 해소.
- `PostListSearch.test.tsx` 3케이스, `TEXTS.buttons.search`(→
  `BookmarkSearch.tsx`가 별도 사용 중이라 고아 아님), `id="search-input"`
  (다른 참조 없음), `.group` Tailwind 유틸(참조 없음) — 전부 grep·코드
  리딩으로 안전 확인.
- 동작이 실질적으로 바뀌는 지점 2가지를 사용자에게 미리 밝혔다: ① 지금까지
  헤더에서만 기록되던 "최근 검색"이 이제 모든 키워드 검색에 적용됨(의도한
  통합의 자연스러운 결과) ② 카테고리 칩 클릭 시 자유 검색어가 사라지는 기존
  동작(원래도 있던 동작)이 입력 지점이 멀어지며 더 눈에 띌 수 있음.

**결정**

- `PostListSearch.tsx`에서 검색 입력행(입력창 + 모바일 "검색" 버튼)을
  완전히 제거. 헤더 검색만 남긴다.
- 카테고리 칩의 `@`토큰 병합 기준을 `searchInput`→`searchQuery`(URL)로 옮기고,
  `optimisticCategoryTags` 낙관적 미러를 신규 추가(범위 필터 칩과 동일 패턴).
- 부수 효과: 모바일 placeholder 잘림 문제가 이 카드에서는 원천적으로 사라짐
  (헤더 검색창은 폭이 넉넉해 애초에 문제없었음 — 별도 `postSearchCompact`
  같은 키를 만들 필요가 없어짐).

**칩 높이 44px → 28px 되돌림**

지난 세션(같은 날짜, 위 항목)에서 모바일 터치 타깃을 28px→44px로 키운 걸
사용자 확인 후 다시 되돌렸다. "웹(데스크톱)처럼 해달라"는 요청 — 데스크톱은
원래 `md:min-h-0`(자동 높이, ~28px)였는데 모바일만 44px라 57% 더 커 보였다.
이건 접근성 기준을 낮추는 트레이드오프이기도 해서(WCAG 2.5.8 AA의 24px
최소 기준은 여전히 만족, 44px 권장 기준·이 레포 `responsive-ux` 스킬의 자체
규약은 포기) 텍스트로 설득하지 않고 실제 두 높이를 Artifact로 나란히
비교시켜 확인받았다(바로 아래 "화면 먼저, 그다음 반영" 원칙 적용).

**상태**

적용 완료. 관련 파일: `PostListSearch.tsx`, `FilterChip.tsx`.

---

## 2026-09-06 — 게시글 검색 필터 영역: 기능별 행 분리, 가로 스크롤 대신 세로 wrap

**배경**

`PostListSearch`의 필터 영역(카테고리 칩·범위 필터 칩 3개·봇 글 숨기기 스위치·초기화
버튼)이 세로 구분선 2개만 사이에 두고 한 줄 `flex-wrap`에 평평하게 나열돼 있었다.
줄바꿈되면 구분선이 줄 끝/시작에 걸려 그룹 경계 역할을 잃고, 초기화 버튼 위치도
앞 요소들의 wrap 결과에 따라 매번 바뀌었다. 카테고리 칩은 실제로는 검색어에
`@라벨` 토큰을 넣는 방식(필터가 아님)인데 범위 필터 칩과 시각적으로 동일했다.

**검토 — 다른 서비스 사례**

| 사례                                                                                | 방식                                                                                                          | 채택 여부                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Linear Label Groups](https://linear.app/changelog/2022-11-10-label-groups)         | 그룹 라벨 아래 칩을 wrapping flex로 줄바꿈, 가로 스크롤 없음                                                  | 그룹 분리 아이디어 채택                                |
| GitHub Issues                                                                       | 속성별로 얇은 회색 구분선 블록 분리                                                                           | 라벨 없는 구분선 방식 채택                             |
| GitLab                                                                              | 검색 토큰이 가로 스크롤 — [wrap 요청 이슈](https://gitlab.com/gitlab-org/gitlab/-/issues/17431)가 반복 제기됨 | 가로 스크롤 기각                                       |
| [Material Design 3 Chips](https://m3.material.io/components/chips/accessibility)    | 한 줄에 안 들어가면 아래로 밀며 펼치는 방식을 가로 스크롤보다 우선 권장                                       | 모바일 카테고리 접기(+N) 방식 채택                     |
| [Baymard — Applied Filters](https://baymard.com/blog/how-to-design-applied-filters) | 사이트의 28%가 적용 필터 개요를 안 보여주고 42%가 눈에 띄게 배치 안 함. 전체 해제는 적용 필터 표시 옆에       | "조건 N개 적용 중" + 초기화를 같은 줄 고정 위치로 채택 |

가로 스크롤(사용자가 명시적으로 배제 요청)과 텍스트 그룹 라벨(카테고리/범위 필터
구분이 이미 색·형태로 드러나 중복이라 판단)은 검토 후 기각했다.

**결정**

- 필터 영역을 검색바 → 카테고리 → 범위 필터(북마크한/내가 작성한/나만 볼 수
  있는) → 봇 글 숨기기 → 요약줄(조건 N개 적용 중 + 초기화) 순 행으로 분리하고,
  경계는 텍스트 라벨 없이 `border-t`만 사용(GitHub Issues 방식).
- 카테고리 칩 라벨에 `@`를 노출(`@백엔드`)해 검색어 토큰임을 드러내고, 선택 판정을
  기존 부분문자열 매칭에서 `parseSearchQuery` 토큰 비교로 바꿔 `@AI개발` 같은
  입력에 `@AI` 칩이 오탐으로 켜지던 문제도 함께 없앴다.
- 모바일에서만 카테고리를 앞 4개로 접고 `+N` 버튼으로 펼침(데스크톱은 전부 노출).
  펼침 여부는 `useState` 대신 `categories`·`searchInput`에서 파생시켜, 비-suspense
  쿼리라 첫 렌더에 카테고리가 아직 없어도 깜빡이지 않게 했다.
- "봇 글 숨기기"는 스위치 유지, 단독 행 + `justify-between`으로 분리.
- "조건 N개 적용 중" 카운트는 봇 글 숨기기(localStorage 개인 설정, 초기화가
  건드리지 않음)를 제외하고 URL에 실제 적용된 값(`searchQuery`) 기준으로 세어,
  옛 `?filter=excludeBots` 링크나 미제출 타이핑 중인 검색어가 잘못 잡히지 않게
  했다. 요약줄은 카운트 0에서도 렌더(텍스트만 비움)해 `aria-live` 전환이 끊기지
  않고 초기화 버튼 위치가 고정되게 했다.
- 반응형은 전부 CSS `md:`로 통일하고 `useIsMobile()`은 쓰지 않았다 — 이 훅은
  UA 검사와 `matchMedia`를 OR로 묶어 iPad 가로모드(1024px)에서도 모바일로
  판정하므로, 같은 파일의 다른 `md:` 분기와 기준이 어긋난다.
- `FilterChip` 모바일 터치 타깃을 28px → 44px로 확대(`min-h-11 md:min-h-0`).

**배포 후 보정 (2026-09-06)**

배포하고 실제로 보니 간격이 너무 멀고 구분선도 불필요해 보인다는 피드백을
받았다. 원인은 이중 계산 — 바깥 `gap-3 md:gap-4`(12/16px)와 각 줄의
`border-t pt-3 md:pt-4`(12/16px)가 겹쳐 경계마다 약 25~33px가 쌓였다. 이번엔
텍스트로 설득하지 않고 후보 3개(여백만 / 옅은 구분선 / 행동줄 앞에만 구분선)를
실제 색 토큰 그대로 재현한 Artifact 목업으로 나란히 비교해 사용자가 직접 보고
고르게 했다(아래 "화면 먼저, 그다음 반영" 항목 참고). "여백만"이 선택됐다 —
`border-t`를 전부 제거하고 바깥 여백을 `gap-2 md:gap-3`(8/12px)로 더 줄였다.
같은 자리에서 두 가지를 추가로 받았다: "봇 글 숨기기" 라벨을 스위치 반대편으로
벌리던 `justify-between`을 버리고 라벨+스위치를 하나로 붙였고(터치 타깃 44px는
유지), 카테고리는 8개뿐이라 모바일 접기(`+N`/`useToggle`)가 과했다고 보고
제거해 항상 전부 노출한다.

**상태**

적용 완료(보정 반영).

---

## 2026-09-06 — "화면 먼저, 그다음 반영": 시각적 취향 판단을 다루는 방식

**배경**

바로 위 항목(검색 필터 간격·구분선)에서, 배포까지 마친 UI를 텍스트 설명만으로
설득하고 반영한 뒤 "간격이 너무 멀다"는 피드백을 배포 후에야 받았다. 간격 값이나
구분선 유무처럼 정답이 명확하지 않은 시각적 판단을, 코드를 먼저 쓰고 배포한
뒤에야 사람이 보고 고치는 순서로 다루고 있었다는 게 근본 문제였다.

**검토 — 다른 사람들은 이 문제를 어떻게 다루나**

- Percy·Chromatic류 시각 회귀 도구: "PR마다 스크린샷을 찍어 베이스라인과
  비교하고, 사람이 검토 대시보드에서 승인/반려한다"는 4단계 루프가 표준이다 —
  [Visual Regression Testing 2026 Guide](https://lastest.cloud/blog/visual-regression-testing-design-systems-2026).
  베이스라인 자체를 "디자인·프로덕트 팀의 승인을 거친 뒤에만" 갱신한다는 점이
  핵심이다.
- AI 코딩 에이전트 맥락에서도 같은 원칙 — "에이전트에게 눈을 주되 운전대는 주지
  말라": 에이전트가 UI를 고치는 건 되지만, 의도한 결과인지는 사람이 스크린샷으로
  직접 봐야 한다
  ([DEV Community](https://dev.to/igrlk/your-coding-agent-can-write-the-ui-it-cant-see-that-it-broke-it-3bi)).
  `ReviewFlow`는 "스크린샷 + 자연어 코멘트"를 에이전트에게 넘기는 루프를
  제품화했다 ([reviewflow.review](https://reviewflow.review/)).
- Dow·Klemmer(Stanford HCI)의 **Parallel Prototyping** 연구: 시안을 하나씩
  순차로 만들고 매번 피드백을 받는 것보다, 여러 개를 동시에 만든 뒤 한 번에
  비교하는 쪽이 결과물 품질·다양성·자기효능감 모두 유의미하게 높았다(클릭률·
  전문가 평가 기준)
  ([Stanford HCI 논문 PDF](https://hci.stanford.edu/publications/2010/parallel-prototyping/ParallelPrototyping2010-submitted.pdf),
  [ACM ToCHI](https://dl.acm.org/doi/10.1145/1879831.1879836)).

**결정**

간격·정렬·구분선·색처럼 텍스트 설명만으로는 결과를 예측하기 어려운 시각적
변경은, 코드를 실제 컴포넌트에 반영하기 전에 후보(1개든 여러 개든)를 실제 색
토큰·클래스값 그대로 재현한 정적 목업(Tailwind Play CDN 또는 스크린샷)으로
만들어 Artifact 하나에 담아 보여주고, 사용자가 화면을 보고 선택/승인한 뒤에만
반영한다. 후보가 둘 이상이면 나란히 배치해 비교 가능하게 한다(Parallel
Prototyping 근거). 이 원칙은 FE `CLAUDE.md`(Critical Rules + §8 옆)에도
명문화해 세션이 바뀌어도 지켜지게 했다 — memory에만 남기면 팀 공용 문서에
반영하는 걸 잊을 수 있다는 우려가 있었다.

**상태**

적용 완료. 바로 위 필터 간격 보정이 이 원칙의 첫 적용 사례.

---

## 2026-09-03 — 클릭 가능한 요소의 커서: Tailwind v4 preflight 회귀 수정 + 규칙 일원화

**배경**

Tailwind v4(현재 버전 4.1.18)의 preflight에는 v3에 있던
`button, [role="button"] { cursor: pointer }`가 없다(`node_modules/tailwindcss/preflight.css`
소스 확인 — cursor 규칙 자체가 없음). 그 결과 `<button>`이 브라우저 기본 커서(`default`)를
쓰게 됐고, 컴포넌트마다 개별적으로 `cursor-pointer` 유틸을 손으로 붙여 대응해왔다(12곳).
raw `<button>` 20곳과 Radix가 `div` + `role`로 렌더링하는 메뉴·옵션 항목들은 그마저도
빠져 있었다 — 새 컴포넌트를 만들 때마다 놓치기 쉬운 구조였다.

**검토**

1. 개별 컴포넌트에 `cursor-pointer`를 계속 붙임 — 기각. 이미 반복되고 있었고 근본 수정이
   아니라 대증 요법이다.
2. `@layer base`에 `button` 요소만 커버 — 기각. `DropdownMenuItem`/`CheckboxItem`/
   `RadioItem`/`SelectItem` 등 Radix가 `div` + `role`로 렌더링하는 요소가 빠진다. ARIA
   역할까지 포함하기로 하고(`role="button"`부터 `role="option"`까지), 지금은 쓰이지 않는
   role(`link`/`tab`/`switch`)도 미리 넣어 해당 컴포넌트가 나중에 추가될 때 또 개별
   대응하지 않게 했다.
3. shadcn 기본값(`DropdownMenuItem`/`SelectItem` 등의 `cursor-default`)을 그대로 둠 —
   기각. utilities 레이어가 base보다 우선이라 base 규칙만으로는 안 바뀌고, "메뉴 항목만
   예외"라는 의도치 않은 불일치가 남는다. "clickable = pointer" 원칙을 예외 없이 적용하기로
   하고 `cursor-default`를 제거했다. 단, 이건 shadcn 기본값에서 의도적으로 이탈하는
   것이라 **다음에 해당 컴포넌트를 shadcn CLI로 재생성하면 되돌아간다** — 재생성 시
   다시 제거해야 한다.
4. `Select`의 스크롤 버튼(`SelectScrollUpButton`/`DownButton`)도 pointer로 통일 — 기각.
   Radix 소스 확인 결과 이 둘은 role 없는 `Primitive.div`이고, 클릭이 아니라 포인터가
   위/아래 가장자리에 머무르면 자동 스크롤되는 어포던스라 "클릭 가능 = pointer" 원칙의
   대상이 아니다. `cursor-default`를 그대로 뒀다.

**결정**

`globals.css`에 `@layer base` 규칙을 한 번 추가해 `button`·`summary`·`select`·체크박스/
라디오/파일 `input`과 위 ARIA role 전체에 `cursor: pointer`를 적용하고, 비활성
(`:disabled`/`aria-disabled`/`data-disabled`)은 제외했다. 체크박스·라디오의 형제
`label`도 같은 클릭 대상이라 형제 결합자(`~`)로 포함했다 — 이 코드베이스의 체크박스는
label의 자식이 아니라 형제라 `:has()`는 마크업과 맞지 않는다. 기존 12곳의 수동
`cursor-pointer`는 제거해 규칙을 한 곳으로 모았다. 앞으로의 회귀를 막기 위해 ESLint
커스텀 룰(`custom-a11y/clickable-needs-interactive-element`)을 추가해 `onClick`만 달린
`div`/`span`/아이콘 컴포넌트 등을 차단한다(`role="button"` 또는 `aria-hidden="true"`가
있으면 통과).

부수 변경: 검색바 아이콘(닫기 X, 뒤로가기 화살표) 3곳은 `<svg onClick>`으로 직접 클릭을
받고 있어 새 ESLint 룰에도 걸리고 키보드로 도달할 수 없었다 → `<button>`으로 감쌌다
(위치·크기는 그대로, aria-label은 기존 `TEXTS.ariaLabels.*` 재사용). 클릭 영역 크기
자체는 전후 동일해 터치 타깃 44px 기준(`responsive-ux` 스킬)은 이번 변경의 범위가
아니다 — 세 지점 모두 이전부터 그 기준에 못 미쳤다는 점만 확인하고 별도 이슈로 남겼다.

**상태**

적용 완료. 관련 파일: `src/app/globals.css`, `shared/ui/atoms/button.tsx`,
`shared/ui/atoms/dropdown-menu.tsx`, `shared/ui/atoms/select.tsx`,
`shared/ui/elements/modal/image-viewer/ImageViewer.tsx`,
`shared/ui/elements/MarkdownContent.tsx`, `shared/ui/elements/ImageAttachmentField.tsx`,
`shared/ui/elements/form/FormCheckboxGroup.tsx`, `entities/user/ui/UserAvatar.tsx`,
`features/auth/profile/ui/UpdateProfileForm.tsx`, `widgets/layout/navbar/ui/NavbarSearch.tsx`,
`widgets/layout/navbar/ui/MobileNavbarSearch.tsx`, `eslint.config.js`. 선택자 목록과
예외는 `docs/FE-ARCHITECTURE.md`의 "클릭 가능한 요소와 커서 규칙" 섹션 참고.

---

## 2026-08-13 — 게시글 등록 진행 표시: 상단바 배지 → 하단 진행 토스트

**배경**

모바일에서 게시글 등록/수정 중 `등록 중...` 배지(`Navbar` 우측)가 두 줄로 개행되는 제보.
원인을 추적해보니 이 배지(`PostMutationLoadingBadge.tsx`)는 순수 `div`로,
공통 `Badge` atom(`shared/ui/atoms/badge.tsx`)이 가진 `whitespace-nowrap shrink-0 w-fit`이
없었다. 게다가 `Navbar` 우측 그룹(메뉴·검색·테마·프로필과 한 줄)은 375~390px 화면에서
배지에 남는 폭이 실측 46~68px밖에 안 되는데 배지 자체 필요 폭은 ~99px — **공간 자체가
부족한 게 근본 원인**이었다. 한글은 글자 사이 줄바꿈이 가능해 `등록`/`중...`으로 쪼개졌다.

**검토**

1. `whitespace-nowrap shrink-0`만 추가 — 기각. 공간 부족이 원인이라 개행이 375px
   가로 스크롤로 형태만 바뀐다(`responsive-ux` 스킬의 "375px에서 가로 스크롤 0" 점검
   항목 위반).
2. 모바일에서 라벨을 `sr-only`로 숨기고 스피너만 노출 — 기각. [NN/g](https://www.nngroup.com/articles/progress-indicators/)는
   2–10초 대기에 스피너+설명 텍스트를 권장하고, [Shopify Polaris](https://polaris.shopify.com/components/feedback-indicators/spinner)/[Mobbin](https://mobbin.com/glossary/loading-indicator)은
   "4초 초과 + 사용자가 화면을 이탈"하는 경우 라벨을 유지하라고 명시한다. 이 플로우는
   `useCreatePost.ts`가 제출 직후 목록으로 `navigate`하고 BE `PostService.createPost`가
   URL 크롤링(`UrlMetadataExtractor`)을 동기로 수행해 대기 시간이 수 초대라, 컨텍스트
   이탈이 설계상 기본값이다 — 라벨을 빼는 근거가 약하다.
3. 모바일에서 배지 자체를 숨김 — 기각. [NN/g 시스템 상태 가시성](https://www.nngroup.com/articles/visibility-system-status/)
   원칙 위반(피드백 있는 대기가 11~15% 더 빠르게 느껴진다는 연구 결과 존재).
4. 하단에 별도 fixed pill을 새로 만듦 — 기각. safe-area·z-index·
   `--toast-offset-bottom` 오프셋을 손으로 다시 계산해야 하는데, 이미 그 문제를 풀어둔
   토스트 시스템을 놔두고 중복 구현하는 셈이다.

**결정**

상단바 배지를 없애고, 같은 진행 상태를 **완료 토스트와 동일한 자리(하단)** 인
`toast.loading`으로 발행한다. Gmail의 `Sending… → Message sent`와 같은 형태 —
진행과 완료가 한 곳에서 교대된다. `shared/lib/toast/toast.ts`의 위치 정책은 기기가
아니라 **알림 종류**로 위치를 정한다(성공/진행 = 하단, 오류/경고 = 상단이며 화면 크기별
분기는 없다) — 등록 완료 토스트(`toast.success`)가 데스크톱에서도 하단이므로, 진행
토스트를 하단에 두면 데스크톱도 함께 자연스럽게 통일된다(사용자 확인 완료).
[SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/interaction/wrapping-and-truncation)의
"툴바처럼 한 줄·제한 폭 컨트롤엔 wrapping이 아니라 truncation을 쓰라"는 지침과,
[모바일 내비 UX 가이드](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)의
"상단바 항목 수를 늘리지 말라"는 지침도 상단바에 라벨 달린 상태 표시를 유지하지 않는
방향을 지지한다.

기존 타이밍 로직(500ms 지연 → 노출, 400ms 최소 노출, mutation 종류별 라벨 latch)은
그대로 이관했고, 배지의 2초 하이라이트 효과는 토스트 자체가 그 역할을 하므로 제거했다.

**상태**

적용 완료. 관련 파일: `shared/ui/elements/PostMutationLoadingToast.tsx`(신규,
`PostMutationLoadingBadge.tsx` 대체), `shared/lib/toast/toast.ts`(`toast.loading` 추가),
`app/App.tsx`(마운트 위치를 라우터 트리 밖 최상단으로 이동 — 화면 전환마다
리마운트되지 않아 500ms 지연이 mutation 시작 시점 기준으로 정확해지는 부수 효과 있음),
`widgets/layout/navbar/ui/Navbar.tsx`(배지 제거).

---

## 2026-08-10 — 댓글 이미지 다중 첨부 확장: 저장 방식 유지, 5장/30MB 근거, 클라이언트 압축 유지

**배경**

댓글에 이미지 여러 장을 붙여넣기(Ctrl+V)로만 첨부할 수 있어 첨부 버튼이 없다는 사실 자체가
사용자에게 안 보였고, 모바일에서는 클립보드 붙여넣기가 사실상 불가능해 아예 쓸 수 없었다.
첨부 버튼·드래그앤드롭을 추가하고 5장 상한을 두는 작업에서 네 가지를 결정했다.

**검토 1 — 저장 방식: `comment_images` 테이블 분리 vs 현행 유지**

이미지는 `comments.content` 텍스트 끝에 URL을 줄바꿈으로 이어붙이는 방식이다
(`CommentService.buildFinalContent` ↔ FE `splitContentImages`가 정확한 역함수). 테이블로
분리하면 정규식 기반 SQL 백필 + `CommentResponse.images` 필드 추가 + "BE 먼저 배포" 순서
제약이 따라온다. 5장 제한은 BE의 `images.size` 검증만으로 완전히 강제되므로 테이블 분리가
있어야만 이번 기능이 되는 게 아니다 → **현행 유지**, 테이블 분리는 별도 작업으로 미룬다.

**검토 2 — 최대 장수**

GitHub은 개수 제한 없음(파일당 10MB), Discord 10장, Slack 20장, X 4장. X(4)와 Discord(10)
사이에서 **5장**으로 정했다.

**검토 3 — 크기 상한 통일**

붙여넣기 경로만 10MB 하드코딩이 있었고 실제 업로드 검증(`resizeImage.ts`)은 30MB(리사이즈
대상)/15MB(SVG·GIF)로 서로 어긋나 있었다. GitHub·Discord의 10MB는 원본을 서버에 올린 뒤
서버가 재압축하는 전제인데, 우리는 브라우저에서 먼저 1024px(→1600px로 상향) WebP로 줄인
뒤 올린다 — 30MB는 "저장 용량"이 아니라 "고를 수 있는 원본" 상한이고, 실제 저장은 수백KB다.
`getImageFileSizeError()`로 통일했다.

**검토 4 — 압축 지점을 서버로 옮길지**

WAF `SizeRestrictions_BODY`가 요청 바디를 8KB로 막아(BE 0.6.0) 이미지 바이트가 애초에
서버를 지나가지 않는다 — 서버 압축(GitHub·Discord 방식)도, 원본을 저장해두고 표시 시점에
변환하는 방식(Cloudinary·imgix 방식)도 이 제약 때문에 선택지에서 빠진다. 클라이언트 리사이즈
유지가 유일한 실질 선택지였다. 대가: 원본이 영구 소실되고(1024→1600px가 되돌릴 수 없는
화질 상한), 서버 측 업로드 크기 검증이 없어(Supabase 버킷 설정이 유일한 백스톱) 5장 확장으로
노출이 커진다.

**결정**

- 저장 방식(content-append) 유지, `comment_images` 테이블 분리는 보류
- 최대 5장, 크기 상한 30MB(SVG·GIF 15MB)로 통일
- 클라이언트 단독 리사이즈 유지, 화질 상한 1024→1600px 상향
- 서버 측 크기 미검증 노출을 낮추기 위해 Supabase 버킷 파일 크기 제한을 배포 체크리스트에 추가
- 서명 URL 미제출 고아 이미지 정리는 admin/role 개념이 없는 이 코드베이스에서 REST
  엔드포인트로 노출하지 않고, `@Profile` 가드된 로컬 전용 `CommandLineRunner`로 구현

**상태**

적용 완료. 관련 파일: `shared/hooks/useImageAttachments.ts`,
`shared/ui/elements/ImageAttachmentField.tsx`, `entities/upload/api/upload.api.ts`,
`entities/comment/api/comment.api.ts` (BE `CommentService.kt`, `UploadService.kt`,
`tools/OrphanImageCleanupRunner.kt`).

---

## 2026-08-07 — 프로덕션 배포 파이프라인 장애: 수정사항 3개가 반영 안 된 채 테스트하고 있었다

**배경**

바로 아래 "뒤로가기 정책" 작업을 마치고 실기기(안드로이드 Chrome)·프로덕션
(CloudFront)에서 검증하던 중, 로그인모달이 뒤로가기 한 번에 두 단계를 소모하고
마이페이지 모달은 아예 안 닫히는 등 로컬 dev 서버에서는 재현되지 않는 증상이
나왔다. 처음엔 Radix Dialog의 포커스/이벤트 처리가 모바일에서만 다르게
동작하는 코드 버그로 의심하고 Playwright로 여러 재현을 시도했으나(연속 탭
클릭 레이스, 레이아웃 그룹 경계 넘기 등) 전부 로컬에서는 실패했다.

**원인**

프로덕션에 대해 직접 Playwright로 같은 시나리오를 돌려보니 재현됐고,
`history.pushState`를 계측해보니 `openMyPage()`가 호출한 `navigate()`가
**`pushState`를 아예 트리거하지 않고 있었다** — 즉 그날 세션에서 만든
`useHistoryOverlay` 기반 T1 오버레이 코드 자체가 프로덕션에 없었다.
`gh api .../actions/runs`로 확인한 결과:

- 그날 만든 첫 수정 커밋(`7bb1f89`, T1 오버레이 히스토리화)의 "Frontend
  Deploy" 워크플로우가 `The job was not acquired by Runner of type hosted
even after multiple attempts`로 실패.
- 이후 push된 커밋 2개(`26dcd40`, `3e1ca51`)는 `src/**`를 건드려 배포
  조건을 만족했는데도 워크플로우 실행 자체가 안 잡혔다.
- 사용자가 [GitHub 공식 상태 페이지](https://www.githubstatus.com)에서
  직접 확인: 같은 날짜에 "Incident with Actions"(resolved)가 있었다 —
  우리 쪽 설정 문제가 아니라 GitHub Actions 인프라 장애였다.

BE 레포도 하루 전날 같은 장애로 커밋(`fbd32eb`)의 Lambda 배포를 놓친 적이
있었고, 그날 아침 이미 `deploy.yml`에 `workflow_dispatch`(수동 재실행
트리거)를 추가해 대응해뒀다는 게 커밋 메시지로 확인됐다 — FE만 아직
같은 대응이 안 돼 있었다.

**부수 사고**

장애 복구 여부를 확인하려고 빈 커밋을 push하던 중 cwd가 BE 레포로 되돌아가
있는 걸 놓쳐, BE main에 FE용 커밋 메시지를 단 빈 커밋(`91613d3`)이 실수로
들어갔다. 파일 변경이 없어 BE의 `deploy.yml`/`history-dispatch.yml`(둘 다
`src/**` 등 paths 필터 있음)은 트리거되지 않았음을 `gh api`로 확인했고,
사용자 확인 하에 그대로 둔다(git 히스토리에 맥락 안 맞는 메시지 하나 외엔
영향 없음).

**해결**

- FE `.github/workflows/deploy.yml`에 `workflow_dispatch:` 추가(BE와 동일
  패턴 — `push` 트리거·`paths` 필터는 그대로 유지).
- FE·BE 양쪽 `docs/DEPLOY.md`에 "GitHub Actions 수동 재실행" 절 추가.
  FE는 기존 "수동 배포(로컬 AWS CLI로 직접 build+sync+invalidation)" 절과
  헷갈리지 않도록 용도를 구분해뒀다 — 이건 AWS 자격증명이 필요한 별개의
  기존 수단이고, 새로 추가한 쪽은 자격증명 없이 CI 파이프라인 자체를
  재실행하는 것이다.
- `gh workflow run deploy.yml`로 최신 커밋 기준 배포를 수동 트리거, 성공
  확인 후 프로덕션에서 같은 시나리오를 재검증 — 정상(모달만 닫힘, 페이지
  안 튐)으로 확인됐다.

**일반화되는 교훈**

- 실기기·프로덕션에서만 재현되고 로컬 dev에서는 재현 안 되는 증상을 만나면,
  코드 로직 차이를 의심하기 전에 **"그 수정사항이 실제로 배포됐는가"부터
  확인**한다. `gh api repos/<owner>/<repo>/actions/runs`로 대상 커밋의
  워크플로우 실행 여부·결론을 바로 확인할 수 있다.
- push 트리거만 있는 배포 워크플로우는 GitHub 자체 장애 등으로 트리거가
  누락되면 **재시도할 방법이 없다** — `workflow_dispatch`를 항상 같이
  열어둔다(이번에 FE·BE 둘 다 확보).
- 이 세션 내내 BE 레포가 Bash 기본 cwd였고, FE 작업 중간중간 cwd가 조용히
  BE로 되돌아가는 일이 반복됐다(관련: `feedback_git_cwd_fe_be` 메모리) —
  이번엔 실제로 잘못된 레포에 push까지 됐다. git 명령 직전엔 `pwd`와
  `git remote -v`를 습관적으로 찍어 확인한다.

**상태**: 완료. 관련 파일: `.github/workflows/deploy.yml`, `docs/DEPLOY.md`
(FE·BE 둘 다).

---

## 2026-08-07 — 뒤로가기 정책: 오버레이는 히스토리로, 대화상자는 아니다

**배경**

모바일 사이드바·마이페이지 모달·이미지뷰어·로그인 모달을 연 상태에서 뒤로가기를 누르면
오버레이가 닫히는 대신 페이지가 통째로 바뀌었다. 이 오버레이들은 zustand `isOpen`
불리언일 뿐 히스토리에 존재하지 않았기 때문이다. 별개로, 글쓰기 제출 후 목록으로
`navigate()`(PUSH)하는 바람에 뒤로가기를 누르면 방금 제출을 끝낸 빈 폼이 다시 떴다.

**검토**

"모든 오버레이를 히스토리에 넣는다"와 "아무것도 안 넣는다" 둘 다 아니고, 업계 사례는
3단으로 갈렸다.

- NN/g 사용성 리서치는 화면을 덮는 오버레이에 대해 "브라우저·폰 뒤로가기로 닫을 수 있게
  하라"고 명시하면서, 동시에 **오버레이 중첩**을 실패 패턴으로 지목했다(월마트·링크드인·
  인스타그램에서 X 버튼 한 번에 스택 전체가 닫혀 사용자가 길을 잃는 사례).
- "대화상자는 URL·히스토리에 넣지 말라"는 UX 컨벤션은 Alert/Confirm처럼 한 번의 결정만
  받고 사라지는 것에 대한 이야기였다 — 화면을 덮는 오버레이와는 대상이 다르다.
- Pairs(eureka) 엔지니어링의 `backdropLocation` 패턴(모달을 URL로 만드는 방식)은 저자
  스스로 "단순 모달 하나만 지원, 웹 히스토리는 선형이라 분기 컨텍스트는 복잡해진다"고
  한계를 밝혔다 — 공유가 필요 없는 우리 오버레이엔 과한 해법.
- 토스페이먼츠 Flow 모듈(`pageCount`로 다단계 퍼널 관리)도 저자가 깨짐·가독성 저하를
  인정한 무거운 해법이었다 — 우리 퍼널은 1스텝이라 `replace: true`로 충분.

**결정**

오버레이를 3계층으로 나눈다.

| 계층                    | 대상                                                                     | 히스토리                                                    |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **T0 순간적**           | Alert/Confirm, 토스트, 드롭다운, 툴팁                                    | ❌ 넣지 않음                                                |
| **T1 화면 덮는 상태**   | 모바일 사이드바 드로어, 마이페이지, 이미지뷰어, 로그인 모달, 모바일 검색 | ✅ `location.state` push (URL 불변)                         |
| **T2 공유 가능 콘텐츠** | 게시글 상세 등                                                           | ✅ 실제 URL 경로 (이미 페이지로 분리돼 있어 추가 작업 없음) |

T1은 `useHistoryOverlay(key)`(`shared/hooks/useHistoryOverlay.ts`) 공통 훅으로 처리한다.
`Navbar`의 모바일 검색 패널이 이미 이 패턴(열 때 `state`로 push, 닫을 때 `navigate(-1)`)을
쓰고 있었고, 그 로직을 키 기반으로 일반화한 것이다. 오버레이의 부가 데이터(이미지 뷰어의
`image`, 마이페이지의 `restoreValues`, 로그인 모달의 `onSuccess` 콜백)는 `location.state`에
못 싣는 값(File 객체·함수)이라 zustand 스토어에 그대로 남기고, `isOpen`만 훅으로 이관했다.

글쓰기 제출 후 이동은 `navigate(path, { replace: true })`로 바꿔 폼 엔트리를 결과 화면으로
대체한다.

**적용 중 발견한 두 가지 함정**

1. `GlobalImageViewer`가 `App.tsx`에서 `<RouterProvider />`의 형제로 렌더되고 있었다 —
   `useHistoryOverlay`가 필요로 하는 라우터 컨텍스트 밖이라 그대로 두면 크래시난다.
   `RootLayout.tsx`(`<LoginModal />`이 이미 있던 자리)로 옮겼다.
2. `ProtectedRoute`가 비로그인 접근 시 로그인 모달을 여는 지점은 `<Navigate replace>`
   리다이렉트와 **같은 렌더에서 동시에** 일어난다. 여기서 별도로 `navigate(path, {state})`를
   호출하면 리다이렉트의 `replace`와 순서가 겹쳐 레이스(모달이 열린 채 URL이 도로
   보호 페이지로 돌아가는 루프 위험)가 생긴다. `<Navigate>`의 `state` prop에
   `{ loginModalOpen: true }`를 실어 리다이렉트와 원자적으로 처리해 해결했다. 단, 이
   분기는 로그아웃/세션만료 시에도 타므로 `hasBeenAuthenticated` 조건으로 그 경우엔
   `state`를 비워, 로그아웃할 때마다 로그인 모달이 뜨는 회귀를 막았다.

**금지 사항**

- `popstate`에서 `history.go(1)`로 되돌리기 — 무한루프.
- raw `popstate` 리스너 의존 — 크롬은 사용자 인터랙션 없이 `popstate`를 쏘지 않는다.
- 오버레이 중첩 — `useHistoryOverlay`는 "닫는 오버레이가 스택 최상단"을 전제로 한다.
- Navigation API로 "롱프레스 다단계 뒤로가기 점프"를 가로채 1단계로 제한하는 것 미도입
  — 브라우저 미지원 때문이 아니다(Safari 26.2+/Firefox 147+ 둘 다 지원, 2026-01
  Baseline 진입 — caniuse.com 실측 완료). 진짜 이유는 [WICG 스펙](https://github.com/WICG/navigation-api/blob/main/README.md)
  자체가 user-initiated traversal의 취소를 막아놨다는 것: `event.preventDefault()`는
  "consumable activation"(페이지 자체와의 클릭 등에서 생기는 수 초짜리 토큰)이 남아있을
  때만 먹히는데, 마우스 뒤로가기 버튼 롱프레스는 브라우저 크롬 안에서만 일어나 페이지
  DOM과 무관하다 — 즉 된다/안 된다가 아니라 클릭-뒤로가기 사이 시간차에 따라 랜덤하게
  동작해 신뢰할 수 없다. 업계 사례 재검색(Vue Router 가드·Bootstrap 모달·Pairs/eureka·
  Next.js 디스커션 등)에서도 이 클래스의 시도를 해결한 사례가 전무했고, 오히려 이런 시도를
  "back button hijacking"으로 보고 브라우저가 [적극적으로 막는 방향](https://www.techradar.com/news/chrome-will-soon-protect-against-malicious-websites-breaking-your-back-button)임을 확인했다.

**추가 발견 — T0(Alert/Confirm)의 별도 결함**

배포 전 실브라우저 검증(Playwright)에서, 상세페이지에서 삭제 확인 모달을 띄운 뒤
뒤로가기를 누르면 **모달은 열린 채로 배경 페이지만 목록으로 바뀌는** 현상을 발견했다.
T0로 분류해 히스토리에 안 묶은 것 자체는 옳은 결정이었지만(§ 위 "검토" 참고 —
`useUnsavedChangesGuard`의 `useBlocker`와 얽힘), 그 대가로 Alert/Confirm은 **어떤
네비게이션에도 무관심**해진다는 걸 놓쳤다 — 뒤로가기든 다른 링크 클릭이든, 열려 있던
페이지를 벗어나도 계속 떠 있는다.

해결: `GlobalAlerts`(→ 라우터 컨텍스트가 필요해 `App.tsx`에서 `RootLayout.tsx`로 이동,
`GlobalImageViewer`와 동일한 이유)의 `Alert` 컴포넌트가 `useLocation()`으로 pathname을
지켜보다가, 열려 있던 pathname과 달라지면 취소(`onCancel`)로 간주하고 닫는다.
`useUnsavedChangesGuard`의 confirm은 `useBlocker`가 이동을 막고 있는 동안 pathname이
실제로 안 바뀌므로 이 로직과 충돌하지 않는다(직접 재확인함).

**추가 발견 — 마우스 뒤로가기 버튼 클릭 한 번이 히스토리를 두 단계 소모하는 문제**

"길게 누르지도 않았는데 뒤로가기 한 번에 라이트박스가 닫히면서 페이지도 더 멀리
이동한다"는 제보. §0(Navigation API 조사)의 "롱프레스로 다단계를 의도적으로 고르는
경우"와는 다른 현상이라 별도로 원인을 추적했다.

**원인**: 마우스 뒤로가기(X1) 버튼 클릭은 브라우저 내비게이션만 트리거하는 게 아니라
페이지에도 `pointerdown` 이벤트를 발생시킨다(`PointerEvent.button === 3`). 클릭 좌표는
(다이얼로그 바깥) 커서가 있던 자리이므로, Radix Dialog의 "바깥 클릭 시 닫기"
(`onPointerDownOutside`)가 이를 일반 바깥 클릭으로 오인해 `onOpenChange`를 먼저
실행시킨다. `useHistoryOverlay`처럼 `close()`가 `navigate(-1)`을 호출하는 오버레이는
이 시점에 이미 한 단계를 스스로 소모하고, 그 직후 브라우저가 진짜 back navigation을
별도로 처리하며 popstate가 한 번 더 발생한다 — 클릭 한 번에 실제로는 두 번의
navigate가 겹쳐 발생하는 것.

임시 계측(`console.log` + `popstate` 카운터)으로 실제 로그를 확인해 검증했다:
`close()`가 정확히 1회만 호출됐음에도(중복 호출 아님) `popstate`가 2번 찍혔고,
1번째(같은 경로, 우리 `navigate(-1)`이 만든 것)와 2번째(다른 경로, 브라우저 자체
처리, 약 130ms 후) 타이밍이 뚜렷이 분리되어 있었다. Alert/Confirm에서도 동일하게
`handleClose()`가 popstate보다 먼저 호출되는 패턴이 재현되어, 특정 오버레이만의
문제가 아니라 공유 `Dialog` 컴포넌트 전체에 걸친 문제임을 확인했다.

**해결**: 오버레이마다 고치지 않고 `shared/ui/atoms/dialog.tsx`의 `DialogContent`
한 곳에서 `onPointerDownOutside`를 가로채, 클릭한 버튼이 뒤로가기/앞으로가기
(`button === 3 || button === 4`)면 `preventDefault()`로 무시한다. Alert·
이미지뷰어·마이페이지·로그인모달 등 이 컴포넌트를 쓰는 모든 다이얼로그가 한 번에
해결된다.

**추가 발견 — 모바일 사이드바 드로어에서 보호된 메뉴 클릭 시 로그인 모달이 바로 닫혀버리는 문제**

위 Dialog 수정 후 체크리스트를 돌리다 발견. 모바일 드로어가 열린 상태에서 로그인
없이 보호된 메뉴(Bookmark 등)를 클릭하면, 로그인 모달이 뜨는 순간 자기 스스로
닫혀버리고 페이지도 이동하지 않았다 — 이건 마우스 뒤로가기와 무관한 **순수 레이스
컨디션**이었다.

**원인**: `NavItem.handleClick`이 `onClick?.()`(드로어 `close()` → `navigate(-1)`,
**비동기** `history.go(-1)`)를 호출한 직후 곧바로 `protectedNavigate(to)`(비로그인 시
로그인모달 `open()` → `navigate(path, {state})`, **동기** `pushState`)를 호출했다.
동기 push가 먼저 스택에 반영된 뒤, 뒤늦게 처리되는 비동기 `go(-1)`이 그 시점의
"현재 위치" 기준으로 실행되면서 방금 push한 로그인모달 엔트리를 엉뚱하게
pop해버렸다. 계측 로그로 정확히 이 순서(`close()` 호출 → 같은 ms에 `open()` 호출 →
popstate → `state: null`로 착지)를 확인했다.

**해결**: 드로어를 별도로 닫을 필요가 없다는 점에 착안했다 — 어차피 두 분기(일반
네비게이션·보호된 메뉴) 모두 새 위치로 navigate하고, 그 위치의 `location.state`엔
`sidebarOpen`이 없으니 드로어는 자연히 사라진다. 레이스를 만드는 `close()` 호출
자체를 `NavItem`과 `SidebarHeader`의 로고 링크(둘 다 같은 패턴)에서 제거했다.
**일반화되는 교훈**: `navigate(-1)`(비동기)과 다른 `navigate()`(동기 push/replace)를
같은 동기 핸들러 안에서 연달아 호출하지 않는다 — 처리 순서가 뒤바뀌어 엉뚱한
엔트리를 조작하는 레이스가 생긴다.

**추가 발견 (오진 → 정정) — "마우스 뒤로가기 버튼이 모바일 드로어 상태에서 반응 없음"은 앱 버그가 아니라 DevTools 기기 에뮬레이션 아티팩트였다**

모바일 드로어가 열린 상태에서는 마우스 뒤로가기 버튼을 눌러도 반응이 없다는 제보.
`window` 캡처 단계에 `pointerdown`/`mousedown`/`mouseup`/`click`/`auxclick`/
`contextmenu`를 전부 잡는 계측을 깔고 재현했는데 **어떤 이벤트도 페이지에
도달하지 않았다** — `popstate`조차 발생하지 않음. 반면 키보드 Alt+방향키는 같은
상태에서 정상적으로 뒤로가기로 인식되어 드로어를 닫았다. 이 시점엔 "브라우저/OS/
드라이버가 이 조합의 입력을 페이지에 전달하지 않는다"고 결론 내리고 대응하지
않기로 했었다.

**그런데 이 결론이 틀렸다.** 모바일 드로어는 `md:hidden`이라 재현하려면 반드시
DevTools의 "기기 툴바 토글"(모바일 기기 에뮬레이션)을 켜야 했는데, 반면 앞서
정상 동작을 확인했던 이미지뷰어 등은 에뮬레이션 없이 일반 데스크톱 뷰포트에서
테스트했었다 — 즉 "안 되는 경우"만 매번 에뮬레이션을 거쳤다는 공통점을 놓치고
있었다. 실제로 DevTools 에뮬레이션 대신 **브라우저 창 자체를 768px 이하로
좁혀서**(`md:hidden`은 순수 CSS 미디어쿼리라 이걸로도 동일한 모바일 레이아웃이
뜬다) 같은 걸 재현했더니 마우스 뒤로가기 버튼이 정상 작동했다.

기기 에뮬레이션은 마우스 입력을 터치 이벤트로 변환해 시뮬레이션한다 — 실제
모바일 기기엔 애초에 "마우스 옆면 버튼"이라는 입력 자체가 없으니, 에뮬레이터가
이 조합을 실제와 동일하게 재현해야 할 이유가 없다. 즉 이건 실사용(진짜 데스크톱
좁은 창이든 진짜 모바일 기기든)에서는 애초에 나타나지 않는, **테스트 방법론
자체의 함정**이었다. 재발 방지용 체크리스트를 `docs/TESTING.md`에 남겼다.

**추가 발견 — T0(Alert/Confirm)이 열려있어도 뒤로가기가 페이지를 이동시켜버리는 문제**

위 "T0(Alert/Confirm)의 별도 결함" 수정(pathname/key 감시로 자동 닫기)은 **사후
정리**일 뿐이었다 — 뒤로가기를 누르면 페이지는 이미 이동해버린 뒤에야 Alert가
그 사실을 알아채고 닫힌다. 삭제 확인창이 열려 있는 채로 뒤로가기를 누르면 T1
오버레이(모달만 닫히고 페이지는 그대로)와 달리 **페이지 자체가 목록 등으로
이동해버리는** 차이가 사용자 눈에 보였다.

이건 "히스토리에 안 묶었다"는 기술적 선택이 낳은 **부수적인 UX 결과**였는데,
처음엔 이걸 NN/g 리서치가 뒷받침하는 의도된 설계인 것처럼 설명했다 — 잘못이었다.
NN/g 리서치는 T1(화면 덮는 오버레이)에 대한 권고이지 T0(Alert/Confirm)를 다룬
게 아니다. "페이지까지 이동해버리는" 동작은 `useUnsavedChangesGuard`의
`useBlocker`와 안 겹치려고 내가 선택한 결과였을 뿐, 근거 있는 결정이 아니었다.
이 일을 계기로 `.claude/CLAUDE.md`에 "§7 User-Facing Tradeoffs Need Sign-Off"
원칙을 추가했다 — 기술적 제약에서 나온 부수 효과라도 사용자가 체감하는 UX라면
독단으로 정하지 말고 확인받는다.

**결정**: 삭제 확인창도 T1처럼 "뒤로가기 한 번 = 모달만 취소, 페이지는 그대로"
동작하도록 구현한다(사용자 확인 후 진행).

**구현**: react-router는 앱 전체에서 `useBlocker` 인스턴스를 하나만 유효하게
평가한다 — `useUnsavedChangesGuard`가 이미 그 자리를 쓰고 있어 별도 blocker를
더 달 수 없다. 그 자리를 확장해 Alert/Confirm이 열려 있으면(`getOpenAlertId()`)
pathname 일치 여부와 무관하게 모든 네비게이션을 막고, 막힌 시점에 "저장하지 않은
변경사항" 확인 모달을 새로 띄우는 대신 열려 있던 Alert를 취소 처리
(`alert.store.ts`의 `cancelAlert`)하고 `blocker.reset()`한다. `Alert.tsx`의 취소
버튼 클릭과 동일한 결과라 로직을 스토어 액션으로 합쳤다.

**직접 잡은 회귀 위험**: 로그아웃/세션만료로 `ProtectedRoute`가 강제
리다이렉트하는 분기는 원래도 blocker가 막지 않는 예외였다. Alert 체크를
그보다 앞에 두면, 마침 Alert가 열려 있는 상태에서 세션이 만료됐을 때 강제
리다이렉트까지 막혀버려 사용자가 갇힌다 — 반드시 인증 체크를 Alert 체크보다
먼저 평가하도록 순서를 잡았다.

**검증**: Playwright로 회원가입 → 게시글 작성 → 삭제 확인창 오픈 → 뒤로가기
1회를 재현. URL 불변, 모달만 닫힘을 확인(코드 리뷰가 아니라 실제 브라우저
동작으로 검증).

**추가 발견(2026-08-11) — T1 오버레이에서 ESC 한 번이 `navigate(-1)`을 두 번
보내 배경 페이지까지 넘기는 문제**

프로필 수정 모달에서 닉네임에 한글을 입력하던 중(IME 조합 중) ESC를 누르면
모달만 닫히지 않고 배경 페이지까지 뒤로 이동했다. `useHistoryOverlay`의
`close()`는 `isOpen`을 가드로 쓰는데, `navigate(-1)`은 popstate를 거쳐
**비동기로** 반영된다 — 그 사이 `close()`가 한 번 더 불리면 가드를 그냥
통과해 `navigate(-1)`이 두 번 나간다. `7bb1f89`의 Sidebar 레이스, 이 문서
바로 위 섹션의 마우스 back 버튼발 `pointerdown` 중복과 같은 계열(비동기
`navigate(-1)`을 동기 가드로만 막으려던 것)의 세 번째 재발이다.

두 번째 keydown이 왜 발생하는지는 실브라우저 IME 세션으로 직접 재현·측정하지
못했다 — 대신 이 레포가 이미 같은 문제를 겪고 고친 흔적(`FolderSelector.tsx`,
`FolderTree.tsx`, `MobileFolderList.tsx`의 인라인 입력창들이 전부
`if (e.nativeEvent.isComposing) return;`로 Escape를 가드하고 있음)을 정황
근거로 삼았다 — **코드 추적으로 확인한 사실이 아니라 기존 패턴에 근거한
추정**이다. 다만 이 추정이 틀리더라도(원인이 IME가 아니라 다른 경로의 중복
keydown이더라도) 아래 수정 1은 "엔트리당 back 1회"를 무조건 보장하므로
증상 자체는 해결된다.

**결정 및 구현**

1. `useHistoryOverlay.close()`에 엔트리별 1회 래치(`backSentRef`)를 추가해
   `isOpen`이 아직 갱신되지 않은 구간에도 중복 `navigate(-1)`을 막는다.
   `myPageOpen`·`loginModalOpen`·`imageViewerOpen`·`sidebarOpen` 4개
   오버레이 전부에 한 번에 적용된다.
2. 공유 `Dialog`(`shared/ui/atoms/dialog.tsx`)에 `onEscapeKeyDown` 가드를
   추가해 IME 조합 중(`event.isComposing`) ESC는 dismiss로 처리하지 않는다.
   같은 파일의 `onPointerDownOutside` 가드(마우스 back 버튼 무시)와 동일한
   형태. 이 컴포넌트를 쓰는 Alert·이미지뷰어·마이페이지·로그인모달에 함께
   적용된다.

**검증 범위**: 사용자가 실브라우저(로컬 `npm run dev`)에서 마이페이지 모달
기준으로 재현 → 수정 후 정상 동작을 직접 확인했다. `useHistoryOverlay`는
4개 오버레이가 완전히 같은 코드 경로를 공유하므로 로그인 모달·이미지뷰어·
모바일 사이드바도 동일하게 고쳐졌을 것으로 판단하지만, 이 3곳은 개별
재현·재확인을 거치지 않았다 — 회귀 테스트(아래)와 코드 추적으로만
뒷받침된 상태다.

**상태**

적용 완료(Dialog 수정, NavItem 레이스 수정, T0 blocker 확장, T1 ESC 중복
navigate(-1) 래치). 마지막 "DevTools 에뮬레이션 아티팩트" 발견 건은 앱
버그가 아님을 확인, 조치 불필요. 관련 파일:
`shared/hooks/useHistoryOverlay.ts`,
`shared/store/{sidebar,mypage,loginModal,imageViewer}.store.ts`,
`app/routes/ProtectedRoute.tsx`, `shared/lib/router/navigation.ts`,
`shared/ui/elements/modal/alert/{Alert.tsx,alert.store.ts}`, `shared/ui/atoms/dialog.tsx`,
`widgets/layout/sidebar/ui/Sidebar.tsx`, `shared/hooks/useUnsavedChangesGuard.ts`.

---

## 2026-08-06 — 폼 이탈 시 저장하지 않은 내용 보호: 전역 blocker 레지스트리

**배경**

게시글 등록/수정, 댓글·답글 작성, 댓글 수정 폼에서 입력 중인 내용이 있어도 경고 없이
페이지를 벗어날 수 있었다(사이드바 클릭, 뒤로가기, 새로고침 등). 실수로 이탈하면 작성
중이던 내용이 그대로 사라졌다.

**검토**

react-router의 `useBlocker`는 동시에 하나만 등록 가능하다(`@remix-run/router`가 마지막
등록분만 평가하고 "A router only supports one blocker at a time" 경고를 낸다). 상세
페이지에는 댓글 폼 + 답글 폼 + 수정 폼이 동시에 여러 개 열릴 수 있어, 폼마다 개별
`useBlocker`를 다는 방식은 성립하지 않는다(나중에 연 폼이 먼저 연 폼의 감지를 덮어씀).

**결정**

- 각 폼은 자기 dirty 상태를 전역 레지스트리(zustand `unsavedChanges.store.ts`)에 키로만
  등록한다.
- 실제 네비게이션 차단·확인 모달은 `RootLayout` 한 곳에서 도는 단일 가드
  (`useUnsavedChangesGuard`)가 담당한다. 등록된 키가 하나라도 있으면 앱 내 이동은 확인
  모달로, 새로고침·탭 닫기는 브라우저 기본 `beforeunload` 경고로 막는다.
- 정상 제출 성공 시에는 이동 직전 `clearNow()`로 동기적으로 dirty를 해제해 모달이 뜨지
  않게 한다.
- 로그아웃·세션 만료 상태에서는 검사하지 않는다 — 그렇지 않으면 `ProtectedRoute`의 강제
  리다이렉트까지 막혀 폼에 갇힌다.

**구현 중 발견한 버그**

`useAlert()`가 매 렌더마다 `openConfirm`을 새 함수로 감싸 반환하는데, 이를
`useEffect` 의존성에 넣었더니 "openConfirm 호출 → store 갱신 → 재렌더 → 새 참조 →
effect 재실행"이 반복되는 무한 루프(`Maximum update depth exceeded`)가 발생했다.
`useAlertStore((state) => state.openConfirm)` 셀렉터로 안정적인 참조를 직접
구독하도록 수정해 해결했다.

**결과**

동작 상세는 [docs/UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md) 참고.

**상태**: 완료 (2026-08-06)

---

## 2026-08-04 — 게시글 제목 말줄임: 글자수 제한·툴팁 대신 3줄 노출 + 상세 전문

**배경**

제목이 길면 카드에서 말줄임표로 잘리는데, 직접 입력이든 크롤링(`og:title`)이든 글자수 제한이
전혀 없어 **어느 글자부터 잘리는지 예측할 수 없다**는 제보. 조사해보니 `PostCard.tsx`의
`isDetail` 플래그가 본문 설명의 줄 제한만 풀고 제목엔 적용되지 않아, **상세페이지조차 제목이
2줄로 잘려 전문을 볼 방법이 없는** 상태였다(실질적 버그). AI는 제목을 만들지 않는다 —
자동 제목의 출처는 URL 크롤링(`og:title`/`<title>`/YouTube oEmbed)뿐이다.

**검토**

처음엔 "직접 입력만 60자로 제한 + 입력폼 카운터"를 검토했으나 두 가지 이유로 폐기:

1. **캡이 카드에 보이는 글자 수를 전혀 늘리지 못한다.** 데스크톱 3단 그리드 2줄 기준 한글
   28자가 한계인데, 60자 캡을 걸어도 카드에는 여전히 28자만 보인다. 말줄임 문제를 하나도
   해결하지 못하면서 카운터 UI·BE 검증만 늘어난다.
2. **크롤링 제목까지 캡을 걸 수는 없다**(원본 손실) — 그런데 직접 입력만 60자로 막으면,
   og:title 120자로 저장된 게시글의 수정 화면은 열자마자 초과 상태이고, **제목에서 한
   글자만 지워도(119자) 저장이 막힌다.** 사용자에게 설명 불가능한 규칙이 된다.

호버 툴팁(`title` 속성)도 검토했으나 채택하지 않았다. [GitHub Primer의 truncation
패턴](https://primer.style/accessibility/patterns/truncation/)이 명시적으로 비권장하는
안티패턴이다 — 호버 전용이라 터치·키보드 사용자를 배제하고 스크린리더도 기본적으로 읽지
않는다. Primer가 권장하는 대체안은 "전문이 다른 곳에서 접근 가능할 것" = 상세페이지에서
클램프를 푸는 것 그 자체다.

**결정**

- 글자수 제한은 FE·BE 어디에도 두지 않는다(직접 입력·크롤링 모두 현행 무제한 유지).
- 카드 제목 클램프를 2줄 → 3줄로 늘린다(한글 노출 약 28자 → 42자).
- 상세페이지는 제목 클램프를 해제해 **항상 전문을 노출**한다.
- 툴팁은 쓰지 않는다.
- BE는 크롤링 **실패** 폴백(`title = url`)만 100자로 절삭 — 긴 URL 원문이 그대로 제목이
  되는 쓰레기 케이스만 막고, 정상 크롤링된 제목은 원본 그대로 저장한다.

**상태**

적용 완료. 관련 파일: `widgets/post/post-card/ui/PostCard.tsx`(FE),
`UrlMetadataExtractor.kt`(BE).

---

## 2026-08-03 — 댓글 이미지 첨부: 제출 직후 X(취소) 버튼 처리 검토, 조치 안 함

**배경**

댓글·답글 등록을 낙관적 업데이트로 전환한 직후(FE 커밋 `595b678`, BE 커밋 `91ed26f`),
"제출 버튼을 누른 직후 서버 응답이 오기 전에 붙여넣은 이미지의 X(제거) 버튼을 누르면
어떻게 처리해야 하는가"라는 질문이 나옴 — 응답 대기 창이 사라지면서 이 인터랙션의
의미가 바뀐 게 아닌지 확인 필요.

**검토**

`images: pastedImages`는 `createComment(...)`/`createReply(...)` **호출 시점에 값으로
평가**되어 뮤테이션에 전달된다. 그 뒤 X를 눌러 `pastedImages` state를 필터링해도
`setPastedImages(prev => prev.filter(...))`는 새 배열을 만들 뿐, 이미 전달된 옛 배열을
바꾸지 못한다.

즉 **낙관적 업데이트 도입 전에도** "응답 대기 중 X 클릭"은 화면상 썸네일만 사라지고
실제 서버로 나간 요청엔 그 이미지가 그대로 포함되는 **죽은 UI**였다(X 버튼에
`disabled={isPending}`도 걸려 있지 않아 클릭 자체는 항상 가능했음 —
`features/comment/create/ui/CommentForm.tsx`).

낙관적 업데이트로 제출 클릭 즉시 `reset()`/`clearAllImages()`가 동기 실행되면서, 응답을
기다리는 동안 이미지 미리보기·X 버튼이 화면에 남아있는 시간 자체가 사라졌다. 죽은 UI가
노출될 창이 없어진 것뿐이라 **회귀가 아니라 개선**으로 판단.

**결정**

코드 변경 없음. "등록 직후 낙관적으로 뜬 댓글의 이미지를 그 자리에서 취소"하는 기능은
이번 검토 범위 밖의 **별개의 새 기능**(낙관적 댓글에 취소 인터랙션 추가)으로, 필요해지면
그때 별도로 설계.

**상태**

검토 완료, 조치 없음(현행 유지). 관련 파일: `entities/comment/api/comment.queries.ts`,
`features/comment/create/hooks/useCreateComment.ts`, `shared/hooks/useImagePaste.ts`.

---

## 2026-07-25 — 첫 로딩: 인증 게이팅 제거, 셸 우선 렌더

**배경**

첫 화면 로딩이 3~4초 걸린다는 제보. BE(Lambda) 콜드스타트가 근본 원인이었지만
(BE 레포 `docs/PERFORMANCE.md`), FE가 그걸 직렬로 증폭하고 있었다.

`AuthProvider`가 인증 복원이 끝날 때까지 `SpinnerOverlay`를 반환하면서 **`RouterProvider`
자체를 감싸고** 있었다. 그래서 라우터가 만들어지지 않았고 → 라우트 청크 다운로드가 시작되지
않았고 → 목록 조회도 시작되지 않았다. 완전 직렬:

```
번들 로드 → POST /auth/refresh (콜드면 3.5초) → 라우트 청크 → 목록 조회 → 첫 콘텐츠
```

게다가 `auth.store`가 persist가 아니라 새로고침마다 `accessToken`이 항상 null이었고,
**로그인한 적 없는 방문자도 매번** `/auth/refresh`를 호출하고 그 응답을 기다렸다.

**결정**

1. `AuthProvider`는 렌더를 막지 않는다. 셸을 즉시 그리고 인증 복원은 백그라운드로 돌린다.
   → 라우트 청크 다운로드와 목록 조회가 인증과 **병렬**로 시작된다.
2. 인증 복원 완료 여부를 `auth.store`의 `isAuthResolved`로 승격하고,
   **`ProtectedRoute`가 이 값을 기다린다.**
3. localStorage에 세션 존재 플래그(`linksphere:auth:has-session`)를 두고, 그 흔적이 있을 때만
   `/auth/refresh`를 호출한다.

**이유 / 주의점**

- **`ProtectedRoute`의 대기는 선택이 아니라 필수다.** 라우터 블로킹만 걷어내면 첫 페인트
  시점엔 복원이 끝나기 전이라 `isAuthenticated`가 아직 `false`다. 이때 기다리지 않으면
  **로그인 사용자가 보호 페이지를 새로고침할 때 피드로 튕기고 로그인 모달까지 뜬다.**
  둘은 반드시 같이 가야 한다 — 하나만 되돌리면 회귀한다.
- **왜 플래그를 쓰나**: 리프레시 토큰은 httpOnly 쿠키라 JS가 존재 여부를 읽을 수 없다.
  "세션이 있을 가능성"을 알 방법이 이것뿐이었다.
- **무엇을 저장하나**: 불리언 하나뿐. **토큰 등 민감정보는 저장하지 않는다.**
  플래그는 "확신"이 아니라 "힌트"다.
- **어긋나면**: 플래그만 남고 쿠키가 만료된 경우 refresh가 401을 내고 `clearAuth`가
  플래그를 지운다(자가 복구). 반대로 플래그가 없는데 쿠키가 살아있는 경우(수동 삭제 등)는
  한 번 로그인하면 복구된다. 이 비대칭은 의도된 것이다 — 비로그인 다수의 첫 로딩을
  희생하지 않는 쪽을 택했다.
- 플래그 갱신은 `auth.store`의 `setAuth`/`clearAuth` **한 곳에서만** 한다(단일 소유).
  호출부마다 흩뿌리면 로그아웃 경로가 여러 개라 반드시 하나를 빠뜨린다.

**상태**

적용 완료. 목록 로딩 자리는 스피너 대신 `PostCardSkeleton`으로 교체.

---

## 2026-07-14 — 모바일 내비게이션: 스와이프 철회, 하단 탭바 채택

**배경**
모바일에서 메뉴 이동을 빠르게 하려 함. 처음엔 좌우 스와이프로 메뉴를 전환하는 기능을
구현·배포함(커밋 `51c0515`).

**스와이프를 철회한 이유**

1. 3개 메뉴 중 **링크 등록(`/post/submit`)은 브라우징 화면이 아니라 작성 폼(액션)** —
   좌우로 넘겨 둘러보는 대상이 아니라 순서 흐름이 끊김.
2. 이 앱은 하단 탭바가 아니라 **숨은 햄버거 드로어** 패턴 → 스와이프의 공간감·발견성이 없음.
3. 세로 스크롤 리스트(피드·북마크)와 **가로 제스처 충돌** → 북마크 페이지에서 오작동.

**결정**

- 스와이프 제거(커밋 `1e14e17`). 모바일에 **항상 보이는 하단 탭바**(`BottomTabBar`) 도입.
- 햄버거 드로어는 **일단 유지** — 같은 3개 메뉴가 드로어·탭바에 중복 노출됨(후속에서 일원화 검토).
  => 며칠간 테스트 후 햄버거 드로어 제거 예정
- 탭 목록은 `src/shared/config/nav-items.ts`의 `NAV_ITEMS` **단일 소스(SSOT)** 로
  Sidebar와 BottomTabBar가 공유.

**메뉴 순서 관련 검토**

- 자주 쓰는 링크 등록을 "오른쪽 끝"으로 옮길지 검토했으나, 하단 탭바에서 가장 도달성 좋은
  곳은 **중앙**(왼손·오른손 모두 편함). 오른쪽 끝은 오른손잡이만 유리.
- 현재 순서(**홈 · 링크 등록 · 북마크**)가 이미 링크 등록을 중앙에 두므로 **순서 유지가 최적**.
- 빈도 강조는 순서 변경보다 **중앙 버튼 시각 강조**(악센트/FAB형)가 더 적합 → 후속 과제.

---
