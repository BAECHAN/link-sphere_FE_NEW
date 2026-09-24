# Changelog

이 프로젝트(Link-Sphere FE)의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
버전 표기는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 사용합니다.

각 항목은 `스코프` + 한 줄 요약이며, 배경·구현은 접힌 `배경·구현` 블록에 있습니다.

## [Unreleased]

### Changed

- `shared` Select가 열리면 트리거의 화살표가 위로 뒤집히게 변경
  <details><summary>배경·구현</summary>

  지금까지는 Select가 열려 있어도 화살표가 계속 아래를 향해, 다시 누르면 어떻게 되는지 화면이 알려주지 않았다. 트리거를 다시 탭하면 닫히도록 고친 뒤(#183) 그 동작을 알리도록, 열리면 화살표가 180° 뒤집히게 했다. 근거는 NN/g [Accordion Icons](https://www.nngroup.com/articles/accordion-icons/)의 _"펼친 뒤에는 캐럿이 (짧고 보기 좋은 애니메이션으로) 뒤집히는 것이 일반적이다. (...) 방금 펼친 내용을 다시 접는 반대 동작을 알려주는 신호가 된다"_ (번역)다. 아코디언에 관한 글이라 Select에 대한 직접 연구는 아니다. 회전은 `motion-ux` 규약의 드롭다운·셀렉트 범위에 맞춰 `duration-200 ease-in-out`이고, 트리거의 `data-state`를 Tailwind v4 `in-data-[state=open]:` 변형으로 참조한다. 열린 상태를 스토리로 고정하면 Radix가 나머지 화면에 거는 `aria-hidden` 때문에 a11y 게이트(`aria-hidden-focus`)에 걸려, 게이트를 약하게 만들지 않으려고 스토리는 추가하지 않았다.
  (`src/shared/ui/atoms/select.tsx`, [PR #185](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/185))

  </details>

- `shared` 드롭다운 메뉴가 열려 있어도 스크롤되고, 스크롤하면 닫히게 변경
  <details><summary>배경·구현</summary>

  계정 메뉴 등 드롭다운이 열려 있는 동안 페이지 스크롤이 막혔다 — Radix `DropdownMenu`의 기본값 `modal={true}`가 `react-remove-scroll`을 걸기 때문이다. 공용 래퍼의 `modal` 기본값을 `false`로 바꿔 스크롤을 허용하고, 스크롤하면 메뉴가 닫히게 했다(메뉴 내부 스크롤은 제외, 스크롤로 닫힐 때는 트리거로 포커스를 돌리지 않음). 바깥 첫 클릭·탭은 투명 오버레이가 받아 메뉴만 닫고 아래 게시글 카드 등으로 전달하지 않는다 — 게시글 ⋮ 메뉴도 이 동작으로 통일된다. A(첫 클릭은 닫기만)와 B(클릭 통과)의 근거 비교는 `docs/DECISIONS.md` 2026-09-24 항목 참고. 북마크 정렬 `Select`는 Radix가 스크롤 잠금을 조건 없이 걸어 이번 범위에서 제외했다.
  (`src/shared/ui/atoms/dropdown-menu.tsx`, `e2e/dropdown-menu-scroll.spec.ts`(신규), `e2e/dropdown-menu-scroll.mobile.spec.ts`(신규), `e2e/bookmark-folder-menu-press-drag.spec.ts`, `docs/DECISIONS.md`, `docs/plans/2026-09-24-dropdown-scroll-dismiss.md`(신규), [PR #178](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/178))

  </details>

- `shared` React Query 전역 에러 핸들러 중복 제거, 로그아웃 레이스 처리 통일
  <details><summary>배경·구현</summary>

  `queryClient.ts`의 mutation/query 전역 에러 핸들러 두 벌이 EDGE_BLOCKED·401·403·기타 ApiError 판정을 중복으로 갖고 있었고, 그 둘이 따로 진화하며 로그아웃 레이스 가드 위치와 `manualErrorHandling` 지원 여부가 서로 달라져 있었다. 판정 로직을 순수 함수 `resolveErrorToast()`(신규 `error-toast.ts`)로 추출하고 mutation/query는 `ErrorToastPolicy`(404 처리·비-ApiError 토스트 여부만 다름)만 다르게 넘기도록 통일했다. 동작이 실제로 바뀌는 지점 둘: (1) `meta.errorMessage`를 쓰는 mutation이 로그아웃 유예 구간(2초)에 401을 받으면 이제 조용히 종료한다(기존엔 "게시글 등록에 실패했어요" 같은 오탐 토스트가 떴다), (2) query도 `meta.manualErrorHandling`을 지원한다(현재 사용처는 0개). EDGE_BLOCKED가 errorMessage보다 우선하는 순서, query의 404·비-ApiError 무음 계약은 그대로 유지했고 단위 테스트 14건으로 고정했다. 참조 0곳이던 데드 코드 `react-query/utils/hooks.ts`(`useAppMutation`)도 함께 제거했다.
  (`src/shared/lib/react-query/config/error-toast.ts`(신규), `src/shared/lib/react-query/config/error-toast.test.ts`(신규), `src/shared/lib/react-query/config/queryClient.ts`, `src/shared/lib/react-query/utils/hooks.ts`(삭제), `docs/plans/2026-09-22-queryclient-error-handler-dedupe.md`(신규))

  </details>

- `shared` 브랜드 컬러 도입을 철회하고 원래 무채색 `--primary`로 복원
  <details><summary>배경·구현</summary>

  색·타이포 토큰 개편(#166) 이후 브랜드 hue를 블루→틸로 두 번 조정했지만(#168, #169), 사용자가 재검토 끝에 브랜드 컬러 자체를 쓸 생각이 없었다고 확인해 도입을 철회한다. `--primary`/`--primary-foreground`를 원래 무채색 리터럴(라이트 `oklch(0.205 0 0)`/`oklch(0.985 0 0)`, 다크 `oklch(0.922 0 0)`/`oklch(0.205 0 0)`)로 복원하고, 더 이상 아무도 참조하지 않는 `--brand`/`--brand-2`/`--brand-foreground` 토큰 정의를 삭제했다. Submit Link 버튼의 그라데이션도 제거하고, 파비콘 6종도 재색칠 이전 검정 원본(커밋 `b252646`)으로 복원했다. 카테고리 8색 팔레트·상세 제목 확대·그림자 기반 입체감·좌측 정렬은 브랜드 색상과 무관한 별개 결정이었으므로 그대로 유지한다.
  (`src/app/globals.css`, `src/pages/post/index.tsx`, `public/favicons/*`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `docs/DESIGN-SYSTEM.md`, `.claude/skills/design-tokens/SKILL.md`, `docs/plans/2026-09-21-brand-color-revert.md`(신규))

  </details>

- `shared` 브랜드 색상(hue)을 블루에서 틸로 교체
  <details><summary>배경·구현</summary>

  색·타이포 토큰 개편(#166) 당시 브랜드 hue를 사용자가 명시적으로 고르지 않아 블루를 기본값으로 가정하고 배포했다. 이후 파비콘을 먼저 틸로 재색칠(#168)했는데, 실제 배포 화면에서 Log in·Submit Link 버튼 등 `--primary` 사용처는 여전히 블루로 남아있다는 지적을 받았다 — 파비콘 작업에 집중하다 정작 `globals.css`의 `--brand` 원본 값을 안 바꿔서 생긴 누락이었다. `--brand`/`--brand-2`를 라이트 `oklch(0.48 0.09 200)`(`#006c72`)/`oklch(0.55 0.14 250)`, 다크 `oklch(0.72 0.11 200)`/`oklch(0.75 0.12 250)`로 교체했다 — `--primary: var(--brand)` 구조 덕분에 이 4줄만으로 22개 파일·38지점이 자동 반영된다. 빌드 CSS와 실제 브라우저(라이트/다크)로 재검증, Storybook a11y 게이트(157개) 재통과 확인.
  (`src/app/globals.css`)

  </details>

- `shared` 파비콘 색상을 브랜드 틸로 교체
  <details><summary>배경·구현</summary>

  색·타이포 토큰 개편으로 `--primary`가 브랜드 틸(`oklch(0.48 0.09 200)` = `#006c72`)을 참조하게 됐지만, 파비콘 6종(ico 포함)은 여전히 기존 무채색(검정) 북마크 아이콘이었다. Pillow로 각 PNG의 불투명 픽셀 RGB만 `#006c72`로 치환하고 알파(형태·안티앨리어싱)는 그대로 유지했다 — 벡터 재작업 없이 순수 재색칠이라 형태 변화는 없다. `favicon.ico`는 재색칠한 512px 원본을 16/32/48px로 리샘플링해 재생성했다(기존과 동일한 3개 해상도 구성).
  (`public/favicons/favicon-16x16.png`, `public/favicons/favicon-32x32.png`, `public/favicons/favicon.ico`, `public/favicons/android-chrome-192x192.png`, `public/favicons/android-chrome-512x512.png`, `public/favicons/apple-touch-icon.png`)

  </details>

- `shared` 색·타이포·입체감 디자인 토큰 개편 — 브랜드 컬러 도입, 카테고리 배지 색상 분리, 상세 제목 확대
  <details><summary>배경·구현</summary>

  `--primary`/`--secondary`/`--accent`가 전부 채도 0(무채색)이라 브랜드 컬러가 코드에 0개였고, 카테고리 8종이 전부 같은 보라색(`--category`)이라 구분 기능을 못 했으며, 상세 페이지 제목(18px/700)이 바로 아래 댓글 섹션 제목(18px/600)과 크기가 같아 위계가 안 서고, AI 요약·링크 프리뷰·URL 바가 전부 같은 1px 테두리로 3겹 중첩되는 문제를 Artifact 미리보기(https://claude.ai/artifact/1Gp7sG9rRhhACeicUwZQLi)로 여러 방향안을 나란히 비교한 뒤 반영했다. `--primary`를 브랜드 블루(`oklch(0.52 0.20 255)`)로 전면 교체해 22개 파일·38지점(버튼·툴팁·체크박스·필터칩·FAB 등)이 두 줄만으로 자동 반영되게 했고, 카테고리는 BE 응답에 color 필드가 없고 개수가 가변이라 `category.id % 8`로 8개 팔레트 중 하나를 배정(라이트는 색/12% 틴트+진한 글자, 다크는 솔리드 L 0.75+어두운 글자 — 비대칭 설계)했으며, 상세 페이지 제목은 `isDetail` 분기로 모바일 24px·데스크톱 28px까지 키우고, AI 요약·URL 바의 중첩 테두리는 제거하고 카드·링크 프리뷰는 `shadow-lg`/`shadow-sm` 기반 레이어로 대체했다. "Submit Link" 버튼에는 브랜드 2색 그라데이션을 얹었다.
  (`src/app/globals.css`, `src/entities/category/config/category.const.ts`(신규), `src/widgets/post/post-card/ui/PostCard.tsx`, `src/pages/post/index.tsx`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `docs/DESIGN-SYSTEM.md`, `.claude/skills/design-tokens/SKILL.md`, `docs/plans/2026-09-21-design-tokens-refresh.md`(신규), [PR #166](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/166))

  </details>

- `shared` entities 레이어의 교차 참조에 FSD `@x` 표기 도입
  <details><summary>배경·구현</summary>

  `auth`가 `account`를, `bookmark/folder`·`comment`·`interaction`이 `post`를 참조하는 등 entities 레이어 안에서 서로 다른 엔티티를 참조하는 곳이 이미 10곳 넘게 있었는데, 전부 대상 엔티티의 `api/`·`model/` 파일을 직접 깊게 import하고 있었다. [FSD 공식 문서](https://feature-sliced.design/docs/reference/public-api#the-x-notation)가 권장하는 대로 참조받는 엔티티마다 `@x/<참조하는-엔티티>.ts` 파일을 두고, 그 파일에 실제로 쓰는 것만 재export하도록 바꿨다 — `grep -r "@x" src/entities`만으로 엔티티 간 결합 지점 전체가 한눈에 보이게 하기 위함이다. ESLint로 강제하지는 않는다(기존 3-layer API 컨벤션이 이미 barrel 역할을 하고 있어 실제 사고가 없었음). 응답 조립 로직·쿼리 키·캐시 무효화 동작은 한 글자도 안 바꾸고 import 경로만 옮겼다.
  (`src/entities/account/@x/auth.ts`(신규), `src/entities/post/@x/{account,auth,bookmark,comment,interaction}.ts`(신규), `src/entities/comment/@x/{account,interaction}.ts`(신규), `src/entities/bookmark/folder/@x/{account,interaction,post}.ts`(신규), `docs/FE-ARCHITECTURE.md`, `.claude/CLAUDE.md`)

  </details>

- `shared` 버튼·메뉴·탭 등 클릭 가능한 요소를 드래그해도 라벨 텍스트가 선택되지 않게 변경
  <details><summary>배경·구현</summary>

  북마크 페이지 정렬 드롭다운("최신 북마크순")과 폴더 이름을 드래그하면 텍스트가 선택되는 게 어색하다는 지적에서 시작해 전수 조사한 결과, `select.tsx`의 옵션 목록(`SelectItem`)에는 이미 shadcn 기본값으로 `select-none`이 있었지만 정작 트리거는 빠져 있었고 레포 전체로도 사람이 직접 붙인 곳이 4곳뿐이었다. 컴포넌트마다 개별로 붙이면 새 컴포넌트를 추가할 때마다 빠뜨리는 회귀가 반복될 것으로 보여, 같은 문제를 이미 전역으로 푼 커서 규칙(`globals.css`의 `cursor: pointer` `@layer base` 블록) 선례를 그대로 따라 `button`/`summary`/`label`과 `role=button|link|menuitem|option|tab|switch|checkbox|radio`에 `select-none`을 전역 적용했다. `<a>`(`Link`) 네비게이션은 댓글 본문을 감싸는 구조와 충돌할 수 있어 전역 대상에서 빼고 `BottomTabBar`·`Sidebar` NavItem에만 개별로 붙였고, 같은 이유로 `badge.tsx`·`tooltip.tsx`·북마크 폴더 이름 `<h1>`도 개별 적용했다. 본문·제목·입력값은 대상에서 제외해 복사가 계속 가능하다.
  (`src/app/globals.css`, `src/shared/ui/atoms/badge.tsx`, `src/shared/ui/atoms/tooltip.tsx`, `src/widgets/layout/bottom-tab-bar/ui/BottomTabBar.tsx`, `src/widgets/layout/sidebar/ui/Sidebar.tsx`, `src/pages/bookmark/BookmarkPage.tsx`, `docs/FE-ARCHITECTURE.md`, `.claude/skills/design-tokens/SKILL.md`, `docs/plans/2026-09-21-select-none-global.md`(신규))

  </details>

- `shared` framer-motion을 CSS transition으로 교체해 번들 크기 감소
  <details><summary>배경·구현</summary>

  framer-motion 사용처가 `ScrollToTop`·`ScrollToCommentFormButton`·`PostList`(pull-to-refresh 인디케이터) 3곳뿐인데, 번들 실측 결과(`dist/stats.html`) 앱 코드 다음으로 큰 덩어리(gzip 122KB, motion-dom 포함)를 차지하고 있었다. 세 곳 모두 fade+scale+slide 또는 height 애니메이션으로 CSS만으로 표현 가능해 라이브러리 전체를 제거했다. `AnimatePresence`의 exit 애니메이션은 `isVisible`이 꺼진 뒤에도 전환(200ms)이 끝날 때까지 DOM에 남겨두는 `shouldRender` 상태로 대체했고, opacity/scale(0.8)/translate-y(20px) 값은 기존과 동일하게 맞췄다. Storybook으로 등장/퇴장/클릭 스크롤을 검증했다(`pnpm dev`의 실제 앱 페이지는 이 작업과 무관한 기존 Firebase 설정 오류로 렌더되지 않아 격리 검증으로 대체).
  (`src/shared/ui/elements/ScrollToTop.tsx`, `src/features/comment/create/ui/ScrollToCommentFormButton.tsx`, `src/widgets/post/post-list/ui/PostList.tsx`, `package.json`, [PR #143](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/143))

  </details>

### Added

- `shared` 데스크톱 헤더 검색에 최근 검색어 드롭다운 추가
  <details><summary>배경·구현</summary>

  최근 검색어는 모바일 전용 UI였다 — 데스크톱에서는 검색해도 기록되지 않고(`addRecentSearch` 미호출), 쌓였더라도 보여줄 화면이 없었다. 포커스 시(입력값 유무와 무관) 열리고, 입력을 시작하면 닫히고, 다 지우면 다시 열리는 드롭다운을 새로 만들었다. ESC는 [WAI-ARIA APG Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) 규격대로 2단계로 동작한다 — 열려 있으면 닫기만, 닫혀 있으면 입력만 비운다(URL은 그대로). 항목 삭제·모두 지우기는 [APG "Editable Combobox with Grid Popup"](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/grid-combo/) 패턴을 따라 `role="grid"`로 구현해 ↓/↑/←/→/Enter로 완전히 키보드만으로 조작할 수 있다 — 실제 DOM 포커스는 항상 입력창에 머물고 `aria-activedescendant`로만 가상 포커스를 표시하므로, 셀을 마우스로 클릭해도 blur로 클릭이 유실되지 않는다. "모두 지우기"는 모바일과 같은 자리(상단 고정)에 두되, 시각적 위치와 무관하게 화살표 순환의 논리적 마지막 자리에 있어 Down 첫 클릭은 여전히 첫 검색어로 간다. 같은 작업으로 데스크톱 제출이 기존 게시글 범위 필터(`filter`)를 지우던 문제도 함께 고쳤다 — `useSearchParamsDraft`를 거쳐 `q`만 갱신한다. `useRecentSearches()`는 `Navbar`에서 한 번만 구독해 모바일 패널과 데스크톱 드롭다운에 props로 내려준다(`useAppLocalStorage`의 탭 간 동기화가 다른 탭 전용이라 같은 탭에서 두 번 구독하면 서로 어긋나기 때문).
  (`src/widgets/layout/navbar/ui/NavbarSearch.tsx`, `src/widgets/layout/navbar/ui/RecentSearchDropdown.tsx`(신규), `src/widgets/layout/navbar/ui/Navbar.tsx`, `src/widgets/layout/navbar/ui/NavbarSearch.test.tsx`, `src/widgets/layout/navbar/ui/Navbar.test.tsx`, `docs/SEARCH.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-21-desktop-recent-search-dropdown.md`(신규), [PR #165](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/165))

  </details>

- `bookmark` 새 폴더 만들기 인라인 폼(저장 모달·데스크톱 사이드바·모바일 카드)에 취소 버튼 추가
  <details><summary>배경·구현</summary>

  이름을 한 글자라도 입력하면 그만둘 방법이 없었다 — 세 곳이 공유하는 `handleBlur`가 입력이 있으면 no-op이라 blur로도 안 닫히고, 화면에는 취소 버튼이 없었다. [NN/g "Cancel vs Close"](https://www.nngroup.com/articles/cancel-vs-close/)의 취소 버튼 필요성 근거와 [NN/g "Reset and Cancel Buttons"](https://www.nngroup.com/articles/reset-and-cancel-buttons/)의 버튼 위계 경고를 함께 반영해, `variant="ghost"`로 생성 버튼 왼쪽에 두고 확인창 없이 즉시 입력을 버린다. 데스크톱 사이드바(`w-60`=240px)는 1줄로는 placeholder가 잘려 입력 위·버튼 행 아래의 2줄로 바꿨고, 모바일 카드는 버튼을 세로 대신 가로로 나열해 카드 높이가 늘어나지 않게 했다. 취소 버튼에는 `onMouseDown` preventDefault를 걸어, 빈 입력에서 취소를 누를 때 blur가 click보다 먼저 발생해 핸들러가 유실되는 경합을 막았다.
  (`src/features/bookmark/select/hooks/useBookmarkFolderSelect.ts`, `src/features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `src/widgets/bookmark/folder-tree/hooks/useFolderTree.ts`, `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `src/widgets/bookmark/folder-tree/hooks/useMobileFolderList.ts`, `src/widgets/bookmark/folder-tree/ui/MobileFolderList.tsx`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-21-bookmark-create-folder-cancel.md`(신규), [PR #151](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/151))

  </details>

- `post` 게시물 공개/비공개 전환 시 방향별 성공 토스트 표시
  <details><summary>배경·구현</summary>

  나만 보기 토글은 성공해도 아무 피드백이 없었다 — 실패 시에만 에러 토스트가 떴다. 시각적 피드백은 카드 우상단 자물쇠 아이콘 하나뿐인데 렌더 조건이 `isOwner && post.isPrivate`라 공개로 전환하면 아이콘이 아예 사라지고, 낙관적 업데이트도 없어 재조회가 끝나야 반영되며 주 진입점인 드롭다운은 그 전에 닫힌다 — "토글은 아이콘 전환으로 즉시 보인다"는 기존 전제가 이 케이스엔 맞지 않았다. 방향별 문구(`postSetToPrivate`/`postSetToPublic`)를 추가하고, `meta.successMessage`가 정적 문자열만 지원해 분기가 불가능한 점과 목록이 가상 스크롤(`PostList`, `BookmarkPostList`)이라 위젯 훅의 `mutate(vars, { onSuccess })`는 카드가 화면 밖으로 스크롤되면 언마운트로 스킵될 수 있는 점을 근거로, entities mutation의 `onSuccess(data, variables)`에서 직접 `toast.success`를 호출했다.
  (`src/entities/post/api/post.queries.ts`, `src/shared/config/texts.ts`, `src/entities/post/api/post.queries.test.ts`, `e2e/post-visibility.spec.ts`, `.claude/skills/texts-conventions/SKILL.md`, `docs/FE-ARCHITECTURE.md`, `docs/TESTING.md`, `docs/plans/2026-09-21-post-visibility-toast.md`(신규))

  </details>

### Fixed

- `shared` 모바일에서 Select 트리거를 다시 탭하면 닫혔다가 다시 열리던 문제 수정
  <details><summary>배경·구현</summary>

  모바일 실기기에서 북마크 정렬 `Select`를 닫으려고 트리거를 다시 탭하면, 닫혔다가 곧바로 다시 열린다는 제보가 있었다. 크롬 에뮬레이션에서는 재현되지 않았다(열려 있는 동안 body에 `pointer-events: none`이 걸려 두 번째 탭이 `HTML`에 떨어짐). 유력한 원인은 Radix Select가 한 번의 탭을 바깥 감지(닫기)와 트리거 click(열기)으로 따로 받는 것이다. `select.tsx`의 `Select`를 제어형 래퍼로 바꿔 닫힌 뒤 400ms 안의 열기 요청은 무시하게 했다(닫기는 항상 반영). 400ms는 `useClickGuard`와 같은 기준(무의식적 중복과 의식적 재입력의 구분)이라 상수 `CLICK_GUARD_MS`로 추출해 함께 쓴다. `DropdownMenu`와 합치거나 네이티브 `<select>`로 바꾸지 않은 이유는 `docs/DECISIONS.md` 2026-09-24 "드롭다운 컨트롤 구분" 항목 참고.
  (`src/shared/ui/atoms/select.tsx`, `src/shared/ui/atoms/select.test.tsx`(신규), `src/shared/hooks/useClickGuard.ts`, `docs/plans/2026-09-24-select-reopen-guard.md`(신규), [PR #183](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/183))

  </details>

- `shared` 카드·폴더 행 드롭다운이 열려 있는 동안 hover 스타일이 풀리던 문제 수정
  <details><summary>배경·구현</summary>

  PostCard에 마우스를 올리면 카드가 들리는데(`hover:shadow-lg hover:-translate-y-0.5`), ⋮ 드롭다운을 열고 커서를 메뉴 항목으로 옮기면 들림이 풀렸다 — `DropdownMenuContent`(`shared/ui/atoms/dropdown-menu.tsx`)가 Portal로 `<body>`에 렌더돼 커서가 메뉴로 들어가는 순간 카드는 더 이상 `:hover` 상태가 아니게 되기 때문이다. 북마크 폴더 행(`hover:bg-accent`)에도 같은 버그가 있었다. `globals.css`에 `hover-or-open` custom variant를 추가해 `:hover` 또는 `:has([aria-haspopup][aria-expanded="true"])`를 함께 보게 했다 — 컨테이너 안의 트리거가 열려 있으면 스타일이 유지되고, `@media (hover: hover)` 안에서만 적용돼 모바일 동작은 그대로다. e2e 회귀 테스트 2개를 추가했는데, FolderTree의 드롭다운은 기본값이 modal(PostCard는 `modal={false}`)이라 열려 있는 동안 Radix가 배경 콘텐츠에 `aria-hidden`을 걸어 `getByRole` 기반 locator가 행을 못 찾는 걸 실측해 CSS locator로 우회했다. 재발 방지를 위해 `responsive-ux`·`motion-ux` skill에 이 패턴을 문서화했다.
  (`src/app/globals.css`, `src/widgets/post/post-card/ui/PostCard.tsx`, `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `e2e/post-card-hover-menu.spec.ts`(신규), `e2e/bookmark-folder-hover-menu.spec.ts`(신규), `.claude/skills/responsive-ux/SKILL.md`, `.claude/skills/motion-ux/SKILL.md`, `.claude/CLAUDE.md`, `docs/plans/2026-09-24-hover-or-open-variant.md`(신규), [PR #179](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/179))

  </details>

- `shared` 세션 만료(401) 시 SPA 이동 직후 페이지가 한 번 더 강제 새로고침되던 중복 동작 제거
  <details><summary>배경·구현</summary>

  dependency-cruiser로 의존성 그래프를 확인하던 중 `queryClient.ts` ↔ `auth.util.ts` 순환 참조를 발견해 원인을 추적했다. `client.ts`의 401 인터셉터가 이미 `AuthUtil.clearAll()`(세션 정리 + SPA 이동)을 호출하는데도, `queryClient.ts`의 전역 에러 핸들러가 같은 걸 또 호출하고 `window.location.href` 하드 리로드까지 얹고 있었다 — "토스트는 queryClient가 단일 소유"라는 기존 주석의 의도와 실제 코드가 어긋나 있었다. bulletproof-react 등 실제 오픈소스 사례와 TanStack Query 공식 입장(구조를 강제하지 않음, [TanStack/query #3253](https://github.com/TanStack/query/discussions/3253))을 확인한 뒤, 세션 정리는 `client.ts` 하나가 전담하고 `queryClient.ts`는 토스트만 담당하도록 역할을 나눴다. 로그아웃 유예 창 상태(`isLoggingOut`)는 `queryClient`에 의존하지 않는 별도 파일로 분리해 순환 참조 자체를 없앴다. `NavigationService`가 SPA 라우팅 미준비 시 `window.location.href`로 대체하는 폴백을 이미 갖고 있어, 하드 리로드를 지워도 최종 안전망은 유지된다.
  (`src/shared/lib/react-query/config/queryClient.ts`, `src/shared/utils/auth.util.ts`, `src/shared/utils/logout-grace.util.ts`(신규))

  </details>

- `shared` 다크모드 토글·검색 필터 칩이 무의식적인 빠른 재클릭에 두 번 토글되던 문제 방지
  <details><summary>배경·구현</summary>

  다크모드 버튼·필터 칩을 눌렀는데 "안 반영된 것처럼" 보인다는 제보를 실제 화면 녹화 영상으로 받아 20fps로 프레임을 뜯어 배경색을 픽셀 단위로 직접 측정했다 — 2초 안에 7번 토글이 찍혔는데, 알고 보니 그 클릭들은 사용자가 문제 재현을 위해 의도적으로 빠르게 여러 번 누른 것이었다(짝수 번 누르면 원래 상태로 되돌아가는 토글의 정의 그 자체). 처음엔 마우스 스위치 채터링(사람이 낼 수 없는 속도)만 걸러내는 8ms 가드로 좁혀 잡았으나, 사용자가 원한 건 "사람이 손으로 하는 무의식적인 빠른 재클릭"을 막는 것이었다 — 요구사항 자체가 하드웨어 결함 방지에서 "의식적으로 결과를 인지하고 다시 누른 것과 무의식적으로 두 번 눌린 것을 구분"하는 쪽으로 바뀌었다. 이 구분에 쓰이는 업계 표준값을 확인해 Windows의 더블클릭 속도 기본값(500ms, [Wikipedia](https://en.wikipedia.org/wiki/Double-click) 인용 Microsoft MSDN)으로 올린 뒤, 응답성을 더 살려 400ms로 재조정했다 — 사람의 단순 시각 반응시간(평균 200~273ms, [관련 리서치 종합](https://www.orangeneurosciences.ca/guide/reaction-time-average))보다는 여전히 충분히 크다. 이 변경으로 "즉시 재클릭하면 정확히 취소된다"는 기존 테스트 2개(`Navbar.test.tsx`, `usePostList.test.tsx` 시나리오 C)의 기대값 자체가 "즉시 재클릭 = 무시, 400ms 이후 재클릭 = 취소"로 바뀌었다 — 사용자가 이 트레이드오프를 명시적으로 승인했다. 각 테스트에 "충분한 시간 뒤 재클릭하면 정상 취소된다"는 동반 테스트를 추가했고, 실제 브라우저로 200ms 재클릭(무시됨)·450ms 뒤 재클릭(정상 취소)을 실측 확인했다.
  (`src/shared/hooks/useClickGuard.ts`(신규), `src/shared/hooks/useClickGuard.test.ts`(신규), `src/shared/ui/elements/FilterChip.tsx`, `src/widgets/layout/navbar/ui/Navbar.tsx`, `src/widgets/layout/navbar/ui/Navbar.test.tsx`, `src/widgets/post/post-list/hooks/usePostList.test.tsx`, `docs/DECISIONS.md`)

  </details>

- `post` 검색어에서 `@카테고리`·`#닉네임` 태그를 붙여 쓰면(`@a@b`) 결과가 0건이 되던 문제 수정
  <details><summary>배경·구현</summary>

  `@라이프스타일 @데이터`처럼 띄어 쓰면 정상 동작하는데 붙여 쓴 `@라이프스타일@데이터`는 결과가 0건이라는 사용자 제보로 발견했다. 원인은 `search-parser.ts`의 옛 정규식 `/@(\S+)/`·`/#(\S+)/`가 다음 `@`/`#`에서 멈추지 않고 `라이프스타일@데이터` 전체를 하나의 카테고리 값으로 읽었기 때문이다 — 그런 카테고리는 DB에 없어 BE가 `200 OK` + 0건을 돌려줬다(검증 애노테이션 없는 순수 FE 파싱 버그). "제출 시 자동으로 띄워주기"(사용자 입력을 정규화해 URL에 반영)도 검토했으나, 사용자가 친 검색어를 제품이 고쳐 쓰는 선례를 찾지 못해(GitHub·Twitter는 공백을 요구하고 어기면 평문 폴백/미추출) 입력은 그대로 두고 파서만 태그 경계("문자열 시작이나 공백 뒤에서 시작, 다음 공백 또는 다음 `@`/`#`에서 끝")를 명확히 해 고쳤다. 같은 규칙으로 `hong@example.com`이 `category: 'example.com'`으로, `a#b`가 `nickname: 'b'`로 잘못 잡히던 기존 오탐도 함께 해소됐다.
  (`src/widgets/post/post-list/utils/search-parser.ts`, `src/widgets/post/post-list/utils/search-parser.test.ts`, `src/widgets/post/post-list/ui/PostListSearch.tsx`, `docs/SEARCH.md`, `docs/plans/2026-09-21-search-tag-boundary.md`(신규), [PR #159](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/159))

  </details>

- `shared` 다크모드에서 필터 칩 등 ghost 버튼 9곳에 호버하면 의도한 색이 아니라 회색으로 덮이던 문제 수정
  <details><summary>배경·구현</summary>

  2026-09-14(PR #85)에 "필터 칩은 호버해도 색이 안 변한다"로 확정된 디자인이 다크모드에서만 지켜지지 않고 있었다. 당시 방식은 호출부(`PostListSearch.tsx`)의 `activeClassName`에 `hover:bg-X hover:text-X-foreground`를 넣어 `Button`의 ghost variant가 주는 호버 클래스를 twMerge로 덮어쓰는 것이었는데, ghost의 `dark:hover:bg-accent/50`은 modifier 그룹이 달라(`dark:hover:` vs `hover:`) twMerge가 지우지 못하고 그대로 남는다(tailwind-merge로 직접 확인). CSS 특이성도 `@custom-variant dark (&:is(.dark *))`가 만드는 `:is(.dark *)` 때문에 다크 쪽이 이겨서, 다크모드 활성 칩이 호버 시 흰 배경(`--primary`)에서 회색(`accent/50`)으로 덮이고 글자(`--primary-foreground`, 검정)와 거의 구분이 안 됐다. 같은 구조의 버그를 가진 ghost 버튼 8곳(`FolderTree` 칩, `PostCard` AI 요약 토글·댓글 수 버튼, `BookmarkFolderSelectModal` 삭제 행, `LikePostButton`, `CommentForm` 프리뷰 토글, `RecentSearchPanel`, `UserAvatar`)도 함께 조사해 고쳤다. 덮어쓰기로 지우는 대신 호버 스타일이 애초에 없는 `none` variant를 `button.tsx`에 추가해 9곳 전부 해소했다 — 호출부의 중복 hover 클래스는 삭제하고, `FilterChip`·`FolderTree` 비선택 분기처럼 호버 배경의 출처가 ghost뿐이던 곳만 `hover:bg-accent`/`hover:text-foreground`를 명시로 보완했다. 라이트 모드 렌더링은 대부분 변하지 않으며, `BookmarkFolderSelectModal`·`FolderTree` 선택된 칩은 호버 시 의도한 색(빨강/흰 글자)을 되찾는 부수 개선이 있었다.
  (`src/shared/ui/atoms/button.tsx`, `src/shared/ui/atoms/button.stories.tsx`, `src/shared/ui/elements/FilterChip.tsx`, `src/widgets/post/post-list/ui/PostListSearch.tsx`, `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `src/widgets/post/post-card/ui/PostCard.tsx`, `src/features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `src/features/post/like/ui/LikePostButton.tsx`, `src/features/comment/create/ui/CommentForm.tsx`, `src/widgets/layout/navbar/ui/RecentSearchPanel.tsx`, `src/entities/user/ui/UserAvatar.tsx`, `docs/DESIGN-SYSTEM.md`, [PR #157](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/157))

  </details>

- `bookmark` 데스크톱 사이드바에서 스크롤바 폭 때문에 "내 폴더" 개수 숫자가 밀려 보이던 문제 수정
  <details><summary>배경·구현</summary>

  사이드바는 상단 고정 블록(전체·미분류·최근 저장한 폴더 등)과 "내 폴더" 목록이 서로 다른 스크롤 컨테이너였다. classic 스크롤바(마우스를 연결한 macOS·Windows)에서는 아래 목록 블록에만 스크롤바가 붙어 그 컨테이너의 콘텐츠 폭만 스크롤바 폭(≈15px)만큼 좁아지고, 폴더 개수 숫자의 오른쪽 끝이 위쪽 "최근 저장한 폴더" 숫자보다 왼쪽으로 밀려 보였다. 실제 Tailwind 클래스·`globals.css` 토큰을 그대로 쓴 정적 목업으로 세 가지 안(단일 스크롤+sticky 헤더 / 양쪽에 `scrollbar-gutter: stable` / 스크롤바 숨김)을 나란히 비교한 뒤, 사이드바 스크롤 구조([`docs/DECISIONS.md`](https://github.com/BAECHAN/link-sphere_FE_NEW/blob/main/docs/DECISIONS.md) 2026-09-21/09-22 결정)를 그대로 두고 두 컨테이너 모두 스크롤바 자리를 예약하는 안을 택했다. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter)에 따르면 `overflow: hidden`에도 거터가 생기고 오버레이 스크롤바 환경(트랙패드만 쓰는 macOS)에서는 거터가 안 생겨 원래도 문제가 없었다 — 대가로 스크롤이 필요 없을 때도 사이드바 오른쪽에 ~15px 여백이 상시 생긴다.
  (`src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `docs/BOOKMARK.md`, `docs/plans/2026-09-21-folder-sidebar-scrollbar-gutter.md`(신규))

  </details>

- `shared` Firebase 초기화 실패 시 앱 전체 렌더가 죽지 않도록 방어 코드 추가
  <details><summary>배경·구현</summary>

  PR #143 작업 중 `browser_evaluate`로 `main.tsx`를 강제로 재-import하는 비정상적인 방식으로 `"Missing App configuration value: projectId"` 에러를 관찰해 클린 HEAD에서도 재현되는 버그로 기록했으나, 이후 정상적인 `pnpm dev` 로드로는 재현되지 않았고 로컬 `.env` 값도 Firebase 콘솔 값과 일치함이 확인돼 그 진단은 오진이었을 가능성이 높다(정정: 기존 버그가 아니라 관찰 방식의 부작용이었을 수 있음). 다만 `firebase.ts`가 브라우저 환경에서 `getMessaging(app)`을 조건 없이 호출하고 있고, `main.tsx`에는 `<App/>`을 감싸는 ErrorBoundary가 없어 향후 Firebase 설정값이 실제로 비거나 잘못되면 이 호출이 동기적으로 throw해 React 렌더 트리 전체가 무너질 여지는 남아 있다. 근본 원인 확정 여부와 무관하게 `getMessaging(app)` 호출을 try/catch로 감싸 실패 시 `messaging`을 `null`로 남기도록 방어 코드를 추가했다 — 호출부(`fcm.ts`, `useFcmForegroundMessage.ts`)는 이미 `messaging`이 `null`이면 그대로 return하는 기존 방어 로직을 갖고 있어 FCM 기능만 조용히 비활성화되고 앱은 정상 렌더된다.
  (`src/shared/lib/firebase/firebase.ts`, [PR #153](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/153))

  </details>

- `shared` ⋮ 메뉴를 누른 채 손이 밀리면 항목이 오발동해 메뉴가 그냥 사라지던 문제 수정
  <details><summary>배경·구현</summary>

  Radix `DropdownMenuTrigger`가 `onPointerDown`(누르는 순간, 떼기 전)에서 즉시 메뉴를 열어, 트리거를 누른 채 손이 몇 px만 밀려도 이미 열린 메뉴의 첫 항목 위에서 `pointerup`이 발생해 `MenuItem`이 그 항목을 강제로 `click()`했다(`react-menu`의 `onPointerUp: if (!isPointerDownRef.current) event.currentTarget?.click()`) — 북마크 폴더 ⋮ 메뉴에서는 "이름 수정"이 오발동돼 행이 `Input`으로 바뀌었다가 이름이 그대로라 조용히 원복되며 "메뉴가 떴다 그냥 사라진" 것처럼 보였다. WCAG 2.2 SC 2.5.2(Pointer Cancellation)가 요구하는 "떼기 전에 포인터를 치워 취소할 기회"를 Radix가 down-event 실행으로 이미 무너뜨린 상태였다. `shared/ui/atoms/dropdown-menu.tsx`의 `DropdownMenu`/`DropdownMenuTrigger`를 감싸 open 상태를 직접 들고, 트리거의 `onPointerDown`은 항상 `preventDefault()`로 Radix의 내부 열기 핸들러를 막고 `onClick`(=pointerup 후)에서만 열도록 바꿨다 — 키보드(Enter/Space/ArrowDown)는 Radix가 그 자리에서 `preventDefault()`를 호출해 클릭 합성과 중복되지 않으므로 그대로 둔다. `asChild`와 제어형(`open`/`onOpenChange` + `modal={false}`, `PostCard.tsx`) 사용 모두 그대로 지원한다. 이 컴포넌트를 쓰는 폴더 메뉴(데스크톱·모바일)·게시글 카드 메뉴·계정 메뉴 4곳이 함께 낫는다. 수정 전 실패·수정 후 통과를 실제 Playwright로 확인한 뒤(마우스로 트리거를 누른 채 "이름 수정" 항목까지 이동했다 떼도 그 항목이 클릭되지 않는지, `document`의 `click` 이벤트를 직접 관찰) 회귀 테스트로 고정했다.
  (`src/shared/ui/atoms/dropdown-menu.tsx`, `src/shared/ui/atoms/dropdown-menu.stories.tsx`, `e2e/bookmark-folder-menu-press-drag.spec.ts`(신규), `docs/BOOKMARK.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-21-dropdown-trigger-click.md`(신규))

  </details>

- `bookmark` 새 폴더 만들기 입력 중 ESC를 누르면 폼이 아니라 모달 전체가 닫히던 문제 수정
  <details><summary>배경·구현</summary>

  Radix `Dialog`는 `document`에 capture 단계로 ESC 리스너를 걸어(`react-use-escape-keydown`), 생성 입력의 `onKeyDown`에서 `stopPropagation()`을 호출해도 이미 늦은 뒤라 모달이 먼저 닫혔다. `SheetDialogContent`가 그대로 통과시키는 `onEscapeKeyDown` 콜백에서 생성 폼이 열려 있을 때만 `preventDefault()`로 dismiss를 막고 폼을 접도록 옮겼다 — 폼이 닫혀 있을 때의 기존 "ESC로 모달 닫기"는 그대로 유지된다.
  (`src/features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`, [PR #151](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/151))

  </details>

- `shared` 토큰 갱신 재시도에 상한을 두어 무한 루프 가능성 제거
  <details><summary>배경·구현</summary>

  `client.ts`의 401 TOKEN_EXPIRED 처리에서 `retryCount`가 선언·전달만 되고 실제 상한 검사를 받지 않고 있었다(`docs/AUTH.md` §11에 알려진 이슈로 기록돼 있었음). refresh가 성공한 뒤 재시도한 요청이 다시 TOKEN_EXPIRED를 받으면(서버 시계 오차 등 회복 불가능한 상황) 상한 없이 재귀 호출이 반복될 수 있었다. `retryCount > 0`이면(이미 한 번 재시도한 요청이 또 만료됐다면) refresh를 다시 호출하지 않고 기존 refresh-실패 경로와 동일하게 `clearAll()` + 영구 pending으로 합류하도록 가드를 추가했다. 같은 세션에서 BE 소스를 확인해 `docs/AUTH.md` §11의 다른 항목(만료된 Authorization 헤더로 `/auth/refresh`를 호출하는 것)도 무해함이 확정돼 함께 갱신했다.
  (`src/shared/api/client.ts`, `src/shared/api/client.test.ts`, `docs/AUTH.md`, [PR #143](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/143))

  </details>

- `post` 카드 제목이 소유자 액션 아이콘에 가려 일찍 줄바꿈되던 문제 수정
  <details><summary>배경·구현</summary>

  내 비공개 글 카드에서 제목이 오른쪽 자물쇠·케밥 아이콘 그룹과 별도 컬럼으로 상단 고정돼 있어, 아이콘 아래 66~76px가 빈 채로 남고 제목만 그만큼 좁아진 폭으로 일찍 줄바꿈됐다. 헤더를 2열 그리드(`grid-cols-[1fr_auto]`)로 바꿔 제목에 `col-span-2`를 줘 카드 가로폭을 온전히 쓰게 하고, 자물쇠·케밥은 작성자 메타 행과 같은 첫 행 우측 칸으로 옮겼다 — 아이콘은 음수 마진으로 헤더 높이 기여분을 상쇄해 카드 높이 증가를 막았다. 자물쇠를 아이콘 버튼 그대로 위치만 옮기는 안과 "나만 보기" 텍스트 배지로 바꾸는 안을 실제 Tailwind 클래스로 나란히 비교해 전자를 채택했다 — 원클릭 토글과 `title`/`aria-label`/`h3` 등 기존 e2e 계약을 하나도 건드리지 않기 때문이다. 소유자가 아닌 카드는 아이콘 컬럼 자체가 렌더되지 않아 기존에 낭비되던 8px 여백도 함께 없어졌다.
  (`src/widgets/post/post-card/ui/PostCard.tsx`, `src/widgets/post/post-list/ui/PostCardSkeleton.tsx`, `docs/plans/2026-09-21-postcard-header-title-width.md`(신규), [PR #150](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/150))

  </details>

- `bookmark` 사이드바·모바일 그리드의 최근 저장한 폴더가 저장 후 새로고침 전까지 갱신 안 되던 문제 수정
  <details><summary>배경·구현</summary>

  폴더를 새로 만들고 미분류 글을 그 폴더로 옮겨도, 데스크톱 사이드바(`FolderTree`)와 모바일 폴더 그리드(`MobileFolderList`)의 "최근 저장한 폴더" 구획이 새로고침 전까지 옛 순서 그대로였다. React Query 무효화는 정상이었고, 원인은 `useRecentBookmarkFolders`의 세션 스냅샷 — 두 화면이 스냅샷을 다시 찍을 `sessionKey`를 넘기지 않아 세션 경계 자체가 생기지 않았던 것이었다. 모달(`BookmarkFolderSelectModal`)은 열림 상태를 `sessionKey`로 넘겨 원래부터 정상이었다. 두 화면만 스냅샷 없이 `pickRecentFolders`를 매 렌더 직접 호출하도록 바꿨다 — 모달은 순서 고정(split menu 공간기억)을 그대로 유지한다. 세 화면 전부 해제하거나 mutation cache 기반으로 "저장 직후에만" 재배열하는 대안도 검토했으나 각각 등록 폼 모달의 오탭 위험, mutation cache GC로 인한 재발 위험이 있어 채택하지 않았다.
  (`src/widgets/bookmark/folder-tree/hooks/useFolderSections.ts`, `src/entities/bookmark/folder/hooks/useRecentBookmarkFolders.ts`, `src/widgets/bookmark/folder-tree/hooks/useFolderSections.test.ts`(신규), `docs/BOOKMARK.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-21-bookmark-folder-sidebar-fixes.md`(신규))

  </details>

- `bookmark` 사이드바에서 폴더가 많으면 아랫부분에 스크롤로 도달할 수 없던 문제 수정
  <details><summary>배경·구현</summary>

  데스크톱 사이드바에서 폴더가 많으면 "내 폴더" 아랫부분을 보려면 페이지 전체 스크롤을 끝까지 내려야 했다 — `sticky` 포지셔닝만 있고 자체 스크롤이 없었기 때문이다. `BookmarkFolderSelectModal`이 2026-09-11에 같은 문제를 겪고 정한 선례(목록만 스크롤, 상시 노출돼야 할 행은 고정)를 그대로 재사용했다: 전체·미분류·최근 저장한 폴더는 상단 고정, "내 폴더" 목록만 자체 스크롤, "새 폴더 만들기"는 하단 고정. 실제 Tailwind 클래스를 그대로 쓴 정적 목업으로 "패널 전체 스크롤" 안과 나란히 비교한 뒤 이 구조로 확정했다. 구현 중 사이드바의 `sticky top-4`가 상단 내비게이션 바와 44px 겹치는 기존 버그(이번 변경으로 만든 게 아님)를 Playwright 실측으로 발견해 `top` 오프셋도 함께 조정했다.
  (`src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `src/pages/bookmark/BookmarkPage.tsx`, `.claude/skills/responsive-ux/SKILL.md`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-21-bookmark-folder-sidebar-fixes.md`(신규))

  </details>

- `bookmark` 폴더 선택 모달에서 선택된 행만 개수 숫자가 밀리던 문제 수정
  <details><summary>배경·구현</summary>

  `FolderRow`가 체크 아이콘을 선택된 행에만 렌더해, `gap-3`(12px) + 아이콘(16px)만큼 그 행의 개수 숫자만 왼쪽으로 밀려 다른 행과 어긋나 보였다. 모든 행에 체크 자리(`h-4 w-4`)를 항상 렌더하고 내용만 조건부로 바꾸는 방식으로 고쳤다 — 이 레포의 기존 선례인 `shared/ui/atoms/select.tsx`의 `SelectItem`(`pr-8` + `absolute right-2`)과 같은 "자리 미리 확보" 접근이다.
  (`src/features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, [PR #148](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/148))

  </details>

### Changed

- `bookmark` 최근 저장한 폴더 노출 조건을 "폴더 6개 이상"에서 "본 목록과 완전 일치하지 않을 때"로 변경
  <details><summary>배경·구현</summary>

  기존 노출 조건 중 하나였던 "전체 폴더 6개 이상"의 근거를 다시 확인한 결과, 코드 주석 한 줄이 유일한 설명이고 비교·확정한 문서가 없어 출처 미상이었다. 최근 구획은 최대 3개까지만 보여주므로 "최근 구획 = 본 목록"이 되는 지점은 전체 폴더가 정확히 3개일 때뿐이라는 점을 확인하고, 그 완전 일치 케이스만 예외로 숨기도록 바꿨다 — 같은 항목이 정렬 순서만 다르게 두 번 노출되면 사용자가 중복임을 알아차리지 못해 두 목록을 모두 훑게 된다는 NN/g 연구를 근거로 삼았다. 결과적으로 폴더 3개 이하는 안 뜨고 4개부터(그중 3개 이상 저장 이력이 있으면) 뜬다 — 이전(6개부터)보다 이른 시점부터 노출되는 부수 효과가 있다.
  (`src/entities/bookmark/folder/config/bookmark-folder.const.ts`, `src/entities/bookmark/folder/utils/bookmark-folder.util.ts`, `src/entities/bookmark/folder/utils/bookmark-folder.util.test.ts`(신규), `src/entities/bookmark/folder/hooks/useRecentBookmarkFolders.test.ts`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`)

  </details>

- `bookmark` 사이드바 "내 폴더" 라벨을 상단 고정, "새 폴더 만들기"를 하단에서 상단으로 이동
  <details><summary>배경·구현</summary>

  "내 폴더" 라벨이 스크롤 영역 안에 있어 스크롤하면 폴더 행과 함께 밀려 올라갔고, "새 폴더 만들기"는 하단에 있어 폴더가 많으면 끝까지 스크롤해야 눌렀다. 폴더 선택 모달(`BookmarkFolderSelectModal.tsx`)이 2026-09-11에 이미 같은 고민을 하고 "새 폴더 만들기"를 헤더 바로 아래(상단)에 두기로 결정했는데("생성 발견성 최상" 근거, 하단 안은 모바일 파괴 액션 엄지 노출 때문에 기각), 사이드바 스크롤을 만들 때는 이 구조만 가져오고 정확한 위치는 따로 비교하지 않은 채 하단으로 뒀었다. Shopify Polaris 디자인 시스템도 스크롤되는 긴 목록에서는 add 액션을 헤더에 두라고 권고해([근거](https://github.com/Shopify/polaris-react/pull/11796/files)) 상단으로 재배치했다. "내 폴더" 라벨도 상단 고정 블록으로 옮기고 스크롤 영역엔 폴더 행만 남겼다.
  (`src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`)

  </details>

- `infra` doc-drift 트래킹 이슈 하트비트 댓글 제거, 본문을 상태 대시보드로 재구성
  <details><summary>배경·구현</summary>

  `doc-drift-check.yml` 트래킹 이슈([#99](https://github.com/BAECHAN/link-sphere_FE_NEW/issues/99))에서 push마다 달리던 "확인함 — 누적 N/5" 하트비트 댓글이 댓글 44개 중 37개(84%)를 차지해 최신 감사 결과를 보려면 매번 끝까지 스크롤해야 했다. 임계값 미달 구간에서는 댓글을 달지 않고 이슈 본문만 갱신하도록 바꾸고, 매 실행 덮어쓰면서도 마커 2줄뿐이던 본문을 "현재 상태"(다음 감사까지 진행도·마지막 확인 커밋·갱신 시각)와 "마지막 경량 감사"(확인 범위·`pnpm check:docs` 결과·dangling 건수·리포트 댓글 링크) 두 표로 구성된 대시보드로 재구성했다. 경량 감사가 실제로 도는 임계값(5회) 도달 시점의 리포트 댓글은 처음엔 통과해도 항상 남기도록 정리했으나, 이 레포 평균 병합 속도(최근 17일 하루 ~6.3개)로는 그 방식도 3년 뒤 약 1,380개 댓글로 같은 스크롤 문제를 재발시킨다는 걸 확인해, `openapi-drift-check.yml`과 같은 "check:docs 실패 또는 dangling 발견 시에만 댓글" 패턴으로 다시 정리했다(minimize한 댓글도 GitHub에서 줄 하나를 그대로 차지해 스크롤을 줄이지 못한다는 점도 이 과정에서 확인했다). grep 기반 감사 로직·워크플로 트리거(`doc-drift-check.yml`)는 그대로 둔다.
  (`scripts/check-doc-drift.js`)

  </details>

### Removed

- `bookmark` 사용되지 않는 폴더 순서 재정렬(reorder) API 제거
  <details><summary>배경·구현</summary>

  `bookmarkFolderApi.reorderBookmarkFolders`와 `ReorderBookmarkFoldersRequest` 타입이 `PATCH /bookmark/folders/reorder` BE 엔드포인트에 대응해 존재했지만, 이걸 호출하는 mutation 훅이나 드래그 정렬 같은 UI가 이 레포 어디에도 없었다(이전에 죽은 export였던 `useReorderBookmarkFoldersMutation`을 별도로 제거했을 때도 이 API 함수 자체는 실제 BE 엔드포인트와 대응돼 남겨뒀던 것). 앞으로도 이 기능을 쓸 계획이 없어 FE의 `api.ts`/`schema.ts`/`API_ENDPOINTS.bookmark.reorder`와 대응하는 BE 엔드포인트(`BookmarkFolderController.reorderFolders`, `BookmarkFolderService.reorderFolders`)까지 함께 제거했다.
  (`src/entities/bookmark/folder/api/bookmark-folder.api.ts`, `src/entities/bookmark/folder/model/bookmark-folder.schema.ts`, `src/entities/bookmark/folder/model/bookmark-folder.schema.test.ts`, `src/shared/config/api.ts`, `docs/BOOKMARK.md`, `docs/FE-ARCHITECTURE.md`)

  </details>

## [0.15.0] - 2026-09-21

### Added

- `infra` 배포 반영 확인 `/version` 화면과 배포 파이프라인 자동 검증 신설
  <details><summary>배경·구현</summary>

  배포 워크플로우가 success로 끝난 것과 실제로 사용자 화면에 반영된 것은 다른 사건인데, 그 둘을 구분할 수단이 앱에도 CI에도 없었다. `vite.config.ts`의 `define`으로 커밋 sha를 번들 상수(`__BUILD_INFO__`)에 심고, 별도 플러그인으로 배포 시각·workflow run 번호까지 담은 `dist/version.json`을 함께 만든다 — 두 값을 분리한 이유는 번들 상수는 "지금 이 탭이 실행 중인 코드"를, `version.json`은 "지금 서버에 올라간 코드"를 답해야 서로 다른 두 원인("배포 자체가 안 됨" vs "탭이 캐시를 잡음")을 구분할 수 있기 때문이다. `builtAt`·`runNumber`처럼 빌드마다 달라지는 값은 번들 상수에 넣지 않았다 — 넣으면 무변경 재배포에도 entry 청크 해시가 바뀌어 기존 `useAppVersionCheck`가 열려 있는 모든 탭을 강제 리로드시킨다(두 번 연속 빌드해 entry 해시가 동일함을 직접 확인). `/version` 페이지는 이 둘을 대조해 배너로 보여준다 — 최초에는 Vercel 대시보드의 점+라벨 패턴(제목 옆 작은 배지)으로 만들었으나 "이 페이지의 주 컨텐츠가 동기화 확인 자체"라는 피드백을 받아 카드보다 먼저, 페이지 최상단의 큰 배너로 재구성했다(두 안 모두 Artifact로 나란히 미리보기해 비교). 일치(초록)·불일치(주황, compare 링크+새로고침 버튼)·서버 조회 실패(회색, 배포 실패와 구분)의 세 상태를 색으로 구분한다. `/version`은 403/404/500과 같은 성격의 공개+비연결 라우트다 — 이 레포가 이미 Public이라 노출 정보가 새로 늘지 않고, 로그인에 묶으면 정작 인증이 깨진 순간 진단이 안 되기 때문이다. 배포 파이프라인에는 invalidation 직후 실제 CloudFront를 curl로 때려 ①`version.json`의 sha 일치 ②`index.html`의 `no-store` 캐시 헤더 회귀 ③entry 청크 해시 일치를 확인하는 검증 스텝과, 실패 시 GitHub 이슈를 자동 생성하는 `notify-failure` job을 추가했다. 운영 CloudFront를 직접 curl로 실측한 결과 `x-cache: RefreshHit`(매 요청 오리진 재검증)로 동작 중임을 확인해, 평범한 새로고침이 강력 새로고침과 실질적으로 동일하게 동작함도 함께 검증했다.
  (`vite.config.ts`, `src/vite-env.d.ts`, `src/shared/config/build-info.ts`(신규), `src/shared/utils/build-info.util.ts`(신규), `src/shared/hooks/useDeployedBuildInfo.ts`(신규), `src/pages/version/VersionPage.tsx`(신규), `src/app/routes/index.tsx`, `src/shared/config/route-paths.ts`, `src/shared/config/texts.ts`, `src/main.tsx`, `.github/workflows/deploy.yml`, `docs/BUILD-VERSION.md`(신규), `docs/DEPLOY.md`, `docs/CI-CHECK-GATE.md`, `docs/SYSTEM-ARCHITECTURE.md`, `docs/NEW-VERSION-RELOAD.md`, `docs/plans/2026-09-20-build-version.md`(신규), [PR #134](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/134))

  </details>

- `infra` Storybook을 기존 S3+CloudFront 배포로 공개 호스팅
  <details><summary>배경·구현</summary>

  `shared/ui` 43개 컴포넌트가 이미 Storybook 스토리 100%(153개 케이스)를 갖추고 CI에서 axe a11y 게이트까지 통과하고 있었지만, 이를 배포하는 워크플로가 없어 로컬 `pnpm storybook`으로만 볼 수 있었다. 기존 S3 버킷의 `storybook/` 접두사 + 같은 CloudFront 배포를 재사용해 `/storybook/` 경로에 공개했다. `deploy.yml`에 job을 얹지 않고 별도 워크플로(`deploy-storybook.yml`)로 분리했다 — `paths` 필터가 워크플로 단위라, 합치면 `.storybook/**` 변경만으로도 앱 프로덕션 배포와 전역(`/*`) 캐시 무효화가 함께 돌기 때문이다. 기존 `deploy.yml`의 `--delete` sync가 이 접두사를 지우지 않도록 `--exclude`를 추가했고(가드 없이 두면 다음 FE 배포 때 방금 올린 Storybook이 통째로 삭제된다), `infra/cloudfront-functions/spa-fallback.js`(SPA 라우팅 폴백)에 `/storybook` 분기를 추가했다 — 이 함수는 확장자 없는 모든 요청을 `/index.html`로 리라이트해서, 분기가 없으면 공개 URL 전체가 앱 화면으로 리다이렉트된다. 계획 단계에서는 `vite.config.ts`의 `base: '/'`가 Storybook 빌드에 상속돼 `/storybook/` 하위에서 자산 경로가 깨질 것으로 가정했으나, 실제로 `.storybook/main.ts`가 그 설정 파일을 import하지 않아 상속되지 않고 Storybook 10.1의 정적 빌드가 기본적으로 상대경로(`./assets/...`)를 생성한다는 걸 로컬 정적 서버로 `/storybook/` 서빙을 재현해 확인해, 계획에 있던 `base` 오버라이드 코드는 추가하지 않았다. Figma 토큰 이식은 이번 범위에서 제외했다 — 무료 Starter 플랜이 변수 모드(variable modes)를 지원하지 않아 이 레포의 라이트/다크 2모드 토큰을 무료로 이식할 수 없기 때문이다. Chromatic·GitHub Pages도 검토했으나 각각 "화면 먼저, 그다음 반영"(사후 시각 회귀 미채택) 결정과의 충돌, 배포 경로 이원화를 이유로 기각했다(`docs/DECISIONS.md` 2026-09-20 항목).
  (`.github/workflows/deploy-storybook.yml`(신규), `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `infra/cloudfront-functions/spa-fallback.js`, `package.json`, `docs/DEPLOY.md`, `docs/CI-CHECK-GATE.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-20-storybook-public-deploy.md`(신규), `README.md`, [PR #131](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/131))

  </details>

- `shared` 빈 상태 문구를 위한 `EmptyState` 컴포넌트 신설
  <details><summary>배경·구현</summary>

  목록/검색 결과가 비어있을 때 보여주는 안내 문구(`text-center py-* text-muted-foreground`)를 5곳(`PostList.tsx`, `BookmarkPostList.tsx`, `MyCommentList.tsx`, `CommentList.tsx`, `RecentSearchPanel.tsx`)이 각자 중복 구현하면서 세로 여백이 `py-8`/`py-12`로 갈려 있었다. `ErrorState.tsx`(`AsyncBoundary`의 `errorFallback` 기본형)와 대칭 구조로 `EmptyState`를 신설해 5곳 전부를 이 컴포넌트로 옮겼다. Tailwind v4의 `--spacing`은 단일 배수 변수라 색상/z-index처럼 CSS 토큰 + `no-raw-*` 룰로 강제할 수 없다(`--spacing: initial`로 잠그면 591개 className이 무너진다) — 대신 반복되는 패턴을 컴포넌트 하나로 통합하는 쪽으로 풀었다. 스크린샷 전/후 비교를 사용자에게 보여준 뒤 "다수(4곳)의 `py-12`가 아니라 소수(1곳)의 `py-8`이 더 낫다"는 피드백을 받아 그 값으로 통일했다 — 4곳은 48px→32px로 줄어들고, `RecentSearchPanel.tsx`는 원래 값(32px) 그대로 유지된다.
  (`src/shared/ui/elements/EmptyState.tsx`(신규), `src/shared/ui/elements/EmptyState.stories.tsx`(신규), `src/widgets/post/post-list/ui/PostList.tsx`, `src/widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`, `src/widgets/comment/my-comment-list/ui/MyCommentList.tsx`, `src/widgets/comment/comment-list/ui/CommentList.tsx`, `src/widgets/layout/navbar/ui/RecentSearchPanel.tsx`)

  </details>

- `shared` 텍스트 크기+굵기 조합을 잡는 ESLint 룰 도입, 역할 토큰 2종 추가
  <details><summary>배경·구현</summary>

  `text-{크기} font-{semibold|bold}` 조합(사실상 제목·라벨)이 22곳(2026-09-16 `git grep`으로 `origin/main` 기준 실측 — 당초 계획의 "26곳"은 이미 정리된 12곳을 포함한 이전 실측치였다) lint를 통과한 채 남아있었다. `custom-tailwind/no-raw-title` ESLint 룰을 추가해 앞으로 이런 조합이 생기면 역할 토큰을 쓰거나 이유를 남긴 예외 주석을 달도록 강제한다. 실측 22곳을 분류해 시각 변경이 있는 4개 그룹만 [Artifact 미리보기](https://claude.ai/artifact/HFhnbYBfxXTYL2HmbQQY12)로 사용자 승인을 받아 처리했다: Dialog 제목(`dialog.tsx`, 모든 Dialog에 영향 — `leading-none` 18px/18px → 기존 `text-section-title` 18px/24px), 포스트 카드 제목(`PostCard.tsx`, 새 토큰 `text-card-title` 14px/19px/bold + 반응형은 선례대로 `md:text-t6` 조합), 폴더 그룹 라벨 4곳(`FolderTree.tsx`·`BookmarkFolderSelectModal.tsx`, 새 토큰 `text-group-label` 12px/16px — Tailwind 기본 `text-xs`와 계산값이 같아 화면 변화 없음), 최근 검색 라벨(`RecentSearchPanel.tsx`, 같은 토큰으로 통일하며 14px→12px로 줄어듦). 나머지 15곳(브랜드 워드마크·배지·마크다운 렌더링 헤딩·외부 링크 메타데이터·Storybook)은 제목이 아니라는 이유를 남긴 `eslint-disable-next-line` 예외로 처리했다. 룰 도입 직후 `ErrorLayout.tsx`의 60px 에러 페이지 타이틀이 추가로 걸렸는데, 기존 역할 토큰 어느 것과도 안 맞고 이번 Artifact 승인 범위 밖이라 예외 주석만 달고 별도 라운드로 미뤘다(`docs/DESIGN-SYSTEM.md` §11 참고).
  (`eslint.config.js`, `src/app/globals.css`, `src/shared/ui/atoms/dialog.tsx`, `src/widgets/post/post-card/ui/PostCard.tsx`, `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `src/features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `src/widgets/layout/navbar/ui/RecentSearchPanel.tsx`, `src/features/auth/signup/ui/SignUpForm.tsx`, `src/pages/auth/LoginPage.tsx`, `src/widgets/layout/navbar/ui/Navbar.tsx`, `src/widgets/layout/sidebar/ui/Sidebar.tsx`, `src/features/comment/update/ui/CommentEditForm.tsx`, `src/widgets/comment/comment-list/ui/CommentItem.tsx`, `src/shared/ui/elements/FilterChip.tsx`, `src/shared/ui/elements/MarkdownContent.tsx`, `src/shared/ui/layouts/ErrorLayout.tsx`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `.claude/skills/design-tokens/SKILL.md`, [PR #116](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/116))

  </details>

- `shared` Storybook a11y 검사를 CI 게이트로 배선
  <details><summary>배경·구현</summary>

  `@storybook/addon-a11y`·`@storybook/addon-vitest`가 설치·등록만 되고 CI에서 전혀 돌지 않고 있었다(`.storybook/vitest.setup.ts` 없음, `vitest.config.ts`가 스토리 파일을 아예 제외, CI 워크플로 0건). `.storybook/vitest.setup.ts`를 신설해 a11y addon annotations를 등록하고, `vitest.config.ts`를 `unit`/`storybook` 2개 프로젝트로 분리했다(`pnpm test`는 기존과 동일하게 unit만 빠르게 돌고, `pnpm test:storybook`이 새 storybook 프로젝트를 담당). `.storybook/preview.tsx`에 `parameters.a11y.test: 'error'`를 전역으로 켜자 스토리 파일 43개·151개 story export 중 14개가 실패했다(계획이 추정했던 "42개 스토리"는 실측 결과 파일 수 기준 오집계였다 — 실제 판정 단위인 export 개수는 그 3.5배). 1건(아이콘 버튼 `aria-label` 누락)을 고치고, 나머지 12건은 앱 전역에 쓰이는 색상 토큰(`--muted-foreground`/`--info`/`--category`/`--success`)의 대비 부족이거나 Radix Select 트리거의 접근 가능한 이름 부재(원인 미상)라 `parameters.a11y.test: 'todo'` + 사유 주석으로 낮추고 `docs/DESIGN-SYSTEM.md` §11에 잔여 목록을 남겼다. 색상 토큰 대비를 WCAG AA까지 올리는 건 앱 전역 시각 변경이라 별도 승인이 필요하다. 이 과정에서 `DesignTokens.stories.tsx`의 `ColorSwatch`가 2026-09-13부터 갖고 있던 실제 버그(`--color-<name>` 간접 변수가 대부분 존재하지 않아 모든 `-foreground` 스와치 글자색이 조용히 `--foreground`로 폴백되던 것)도 발견해 원본 변수명을 직접 읽도록 고쳤다. `GlobalImageViewer`가 마운트 즉시 `useNavigate`를 호출해 Router 컨텍스트 없이 크래시하는 것도 addon-vitest가 실제로 렌더링을 실행하면서 처음 드러나 `ImageViewer.stories.tsx`에 `MemoryRouter` 데코레이터를 추가했다. `composite` 모드인 `tsconfig.app.json`이 `.storybook/**/*.ts`만 포함해 신설 `vitest.setup.ts`가 import하는 `preview.tsx`(`.tsx`)가 프로젝트 파일 목록 밖이라는 타입체크 에러가 나서 패턴을 `.storybook/**/*.{ts,tsx}`로 넓혔다. `ci.yml`의 `e2e` job에는 `pnpm test:storybook` 스텝을 추가했다(기존 Playwright 브라우저 설치 재사용).
  (`.storybook/vitest.setup.ts`, `.storybook/preview.tsx`, `vitest.config.ts`, `package.json`, `tsconfig.app.json`, `.github/workflows/ci.yml`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `src/shared/ui/atoms/button.stories.tsx`, `src/shared/ui/atoms/kbd.stories.tsx`, `src/shared/ui/atoms/select.stories.tsx`, `src/shared/ui/elements/AsyncBoundary.stories.tsx`, `src/shared/ui/elements/FilterChip.stories.tsx`, `src/shared/ui/elements/MarkdownContent.stories.tsx`, `src/shared/ui/elements/ScrollToTop.stories.tsx`, `src/shared/ui/elements/form/_base/FormField.stories.tsx`, `src/shared/ui/elements/modal/image-viewer/ImageViewer.stories.tsx`)

  </details>

- `shared` Storybook 디자인 토큰 카탈로그에 타이포그래피 역할 토큰 추가
  <details><summary>배경·구현</summary>

  타이포그래피 역할 토큰(`--text-screen-title` 등, PR #110)이 실제 화면 12곳에 적용됐지만 Storybook 카탈로그(`Colors`/`Radius`/`ZIndex`/`Typography`)엔 없어, 색상·radius·z-index·스케일은 한눈에 보이는데 정작 이번 작업의 핵심 결과물은 실제 앱 페이지를 열어야만 확인할 수 있었다(2026-09-16 감사). 기존 `TypographyCatalog`/`ZIndexCatalog`와 같은 패턴(CSS 변수를 `var()`로 인라인 style에서 직접 읽기)으로 `RoleTokens` 스토리를 추가했다. 같은 감사에서 `design-tokens` skill의 `description`/`when_to_use`가 색상·커서·다크모드만 언급하고 타이포그래피를 빠뜨린 것과, `ci.yml`의 `pull_request` 트리거가 base 브랜치를 `main`으로 제한해 스택 PR(다른 PR 브랜치를 base로 하는 PR)에서 CI가 자동으로 안 도는 것, `pnpm build`가 CI에 없어 디자인 토큰의 CSS 생성 실패를 머지 전에 못 잡는 것도 함께 발견해 고쳤다.
  (`src/shared/ui/tokens/DesignTokens.stories.tsx`, `.claude/skills/design-tokens/SKILL.md`, `.github/workflows/ci.yml`)

  </details>

- `shared` 타이포그래피 스케일 토큰(`--text-t1`~`--text-t14`) 신설
  <details><summary>배경·구현</summary>

  당근마켓 SEED 디자인 시스템 기준으로 디자인 시스템 현황을 실측 비교한 결과, 색상·radius·z-index 토큰(`docs/DESIGN-SYSTEM.md`, 2026-09-13)은 이미 있지만 타이포그래피 축만 토큰이 0개였다. `text-sm`·`text-xs` 두 클래스가 전체 텍스트 크기 사용의 81%(134회 중 108회)를 차지하면서도 페이지 제목(h1)이 `text-xl font-semibold`/`text-xl md:text-2xl font-bold` 두 가지로 갈리는 등 불일치가 실측됐다. [SEED Typography](https://seed-design.io/foundations/typography)의 `$font-size.t1`~`t14`/`$line-height.t1`~`t14` 값을 [Tailwind v4 `--text-*--line-height` 문법](https://tailwindcss.com/docs/font-size)으로 그대로 옮겨 스케일 층만 추가했다 — 이번 PR은 화면에 아무 영향이 없다(어떤 컴포넌트도 아직 `t1`~`t14`를 참조하지 않음). 역할 토큰(`--text-screen-title` 등)과 실제 화면 치환은 미리보기 승인 후 별도 PR로 진행한다.
  (`src/app/globals.css`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `docs/plans/2026-09-16-typography-tokens-a11y-gate.md`, [PR #108](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/108))
  (`src/app/globals.css`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `docs/plans/2026-09-16-typography-tokens-a11y-gate.md`)

  </details>

### Changed

- `shared` 피드·북마크 목록에 가상 스크롤 도입, 렌더링 최적화
  <details><summary>배경·구현</summary>

  게시글이 하루 평균 3.7개씩 늘고 있어(2026-09-18 실측 195개, `createdAt` 최근 100건 집계) 몇 달 안에 DOM이 수만 노드까지 불어날 것으로 보여, `PostList`·`BookmarkPostList`에 `@tanstack/react-virtual` 기반 가상 스크롤을 선제 도입했다(195개 로드 시 DOM 14,330노드 → Lighthouse "오류" 기준 1,400개의 10배, 강제 레이아웃 재계산 30.2ms 실측). 게시글을 열 수만큼 행으로 묶어 행 단위로 가상화하고(라이브러리의 `lanes` 옵션은 쓰지 않았다 - 공식 문서 확인 결과 카드 높이가 제각각인 메이슨리 배치로 바뀌어 지금 화면과 달라지기 때문), 각 행 안쪽은 기존과 동일한 CSS Grid(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)를 그대로 써서 화면은 픽셀 단위로 동일하게 유지된다. 가상화하면 문서 높이가 추정치가 되어 `<ScrollRestoration/>`이 상세→뒤로가기 시 정확한 위치로 스크롤하지 못하는 문제가 생기는데, TanStack Virtual이 공식 제공하는 `takeSnapshot()`/`initialMeasurementsCache`/`initialOffset`(공식 문서가 스크롤 복원 용도로 명시)을 `location.key` 단위 sessionStorage 스냅샷으로 감싸 해결했다 - `useGoBack`과 `<ScrollRestoration/>` 자체는 손대지 않았다. IntersectionObserver 센티넬은 가상화기의 마지막 렌더 행 인덱스 기반 트리거로 대체했다. 같은 작업에서 발견한 부수 문제도 함께 정리했다: `LinkThumbnail`에 `loading="lazy" decoding="async"` 추가, `PostCard`에 `memo` 적용(좋아요·북마크 낙관적 업데이트가 변경 안 된 글의 객체 아이덴티티를 보존하므로 효과가 있다), `usePostList`의 이중 flatMap 제거(오프셋 페이지네이션 중 새 글이 끼어들면 같은 글이 두 번 렌더되던 버그이기도 했다), `useIntersectionObserver`의 observer 매 렌더 재생성·`disconnect()` 누락 수정(이 훅은 가상화하지 않는 `MyCommentList`가 계속 쓴다). `MyCommentCard`는 노드 수가 적어(~10개, 이미지 없음) 가상화 대상에서 제외했다. 배포 당시엔 로컬에 BE가 없어 실제 데이터로 브라우저 상호작용 검증(스크롤 복원 등)은 못 했고, 유닛 테스트(65개 파일 403개)·e2e(Playwright, 45개 전부 통과)·정적 검증(`type-check`/`lint`/`format`)으로만 확인했다. 이후 [PR #128](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/128)로 가상화 실동작을 결정적으로 증명하는 e2e 4개(목 데이터 최대 200개, `overscan`/스냅샷 복원을 임시로 꺼서 정확히 실패하는 것까지 확인)를 추가했고, 배포된 프로덕션(게시글 195개)에서 직접 재확인(2026-09-20, Playwright로 직접 측정)한 결과 끝까지 스크롤해 195개를 전부 로드해도 DOM 노드 수가 827→960개로 유지됐다(가상화 전 실측 14,330개 대비 약 93% 감소), 스크롤 위치 복원은 화면 좌표·`scrollY` 둘 다 오차 0px로 정확했다.
  (`src/shared/ui/atoms/link-thumbnail.tsx`, `src/widgets/post/post-list/hooks/usePostList.ts`, `src/widgets/post/post-card/ui/PostCard.tsx`, `src/shared/hooks/useIntersectionObserver.ts`, `src/shared/hooks/useWindowGridVirtualizer.ts`(신규), `src/shared/lib/virtual/virtual-snapshot.ts`(신규), `src/shared/config/storage-keys.ts`, `src/widgets/post/post-list/config/post-grid.const.ts`(신규), `src/widgets/bookmark/bookmark-post-list/config/bookmark-grid.const.ts`(신규), `src/widgets/post/post-list/ui/PostList.tsx`, `src/widgets/bookmark/bookmark-post-list/hooks/useBookmarkPostList.ts`, `src/widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`, `docs/plans/2026-09-19-virtualize-post-list.md`(신규), `docs/plans/2026-09-19-virtualize-post-list-e2e-verification.md`(신규), [PR #127](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/127), [PR #128](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/128))

  </details>

- `shared` 색상 토큰 4종의 라이트 모드 대비를 WCAG AA로 개선
  <details><summary>배경·구현</summary>

  Storybook a11y 게이트(PR #112)가 라이트 모드에서 WCAG AA(4.5:1) 미달로 잡아낸 `--muted-foreground`(4.34:1)·`--info`(4.42:1)·`--category`(4.47:1)·`--success`(3.29:1, 가장 크게 미달)를 [Artifact 미리보기](https://claude.ai/artifact/UfsZXFcvR1CXPQY5o5sjiB)로 사용자에게 보여주고 승인받아 고쳤다. OKLCH→sRGB 변환 후 WCAG 상대 휘도 공식으로 직접 계산해, 색상(H)·채도(C)는 그대로 두고 명도(L)만 낮춰 4.60:1(반올림 오차 여유 포함)을 넘기는 최소값을 찾았다. `--muted-foreground`/`--info`/`--category` 3개는 명도를 1~2%p만 낮춰 육안으로 거의 구분 안 되고(`#737373`→`#6f6f6f`, `#226eff`→`#1e6aff`, `#8d4fff`→`#8a4cff`), `--success`만 원래 대비가 가장 낮았던 만큼 눈에 띄게 진해진다(`#2ba321`→`#008900`). 다크 모드 값은 전부 7:1~9.4:1로 이미 통과라 손대지 않았다(직접 계산 확인 — a11y 게이트 자체는 라이트 모드만 검사한다). 이 4개 토큰이 원인이던 `parameters.a11y.test: 'todo'` 7건(kbd·FilterChip·MarkdownContent·FormField·DesignTokens Colors 스토리)을 제거했다 — 남은 `'todo'` 2건(`AsyncBoundary`의 `/10` 틴트 조합, `select`의 Radix 접근성 이름 이슈)은 이 토큰들과 무관해 그대로 뒀다.
  (`src/app/globals.css`, `src/shared/ui/tokens/DesignTokens.stories.tsx`, `src/shared/ui/atoms/kbd.stories.tsx`, `src/shared/ui/elements/FilterChip.stories.tsx`, `src/shared/ui/elements/ScrollToTop.stories.tsx`, `src/shared/ui/elements/MarkdownContent.stories.tsx`, `src/shared/ui/elements/form/_base/FormField.stories.tsx`)

  </details>

- `shared` 타이포그래피 역할 토큰 신설, 페이지 제목·섹션 제목·마이크로 라벨 12곳 치환
  <details><summary>배경·구현</summary>

  스케일 토큰(PR #108)을 재료로, SEED 기준 Artifact 미리보기(현재/제안 A/제안 B)를 사용자에게 나란히 보여주고 A(페이지 제목 두께를 semibold로 통일)를 승인받았다. `--text-screen-title`(t7·semibold)/`--text-section-title`(t6·semibold)/`--text-subsection-title`(t4·semibold)/`--text-micro`(t1, 두께 미지정) 4개 역할 토큰을 추가하고, 페이지 제목(h1) 5곳·섹션 제목(h2) 3곳·10px 임의값 라벨 4곳 = 12곳에 적용했다. 실제로 화면이 바뀌는 곳은 두 종류다 — (1) `pages/post/index.tsx`의 "Recent Links"가 유일하게 `font-bold`+데스크톱에서 커지는(`md:text-2xl`) 스타일이었는데, 다른 4개 페이지 제목과 같은 고정 크기·두께(semibold)로 통일됐다. (2) SEED의 line-height가 Tailwind 기본값보다 짧아 각 역할 크기의 줄 높이가 미세하게 줄었다(예: 섹션 제목 18px 텍스트가 28px→24px로 -4px, 가장 큰 차이). 마이크로 라벨은 10px→11px로 커지고 줄 높이가 처음으로 명시된다(기존엔 부모에서 상속). `no-raw-text-size` ESLint 룰을 추가해 앞으로 px 임의값 폰트 크기를 막는다 — 기존 `text-sm`/`text-xs` 다수(97곳)는 역할이 섞여 있어 이번 치환 대상에서 제외했다.
  (`src/app/globals.css`, `eslint.config.js`, `pages/mycomment/MyCommentPage.tsx`, `pages/bookmark/BookmarkPage.tsx`, `pages/post/index.tsx`, `widgets/comment/comment-list/ui/CommentList.tsx`, `widgets/bookmark/folder-tree/ui/MobileFolderList.tsx`, `widgets/layout/navbar/ui/NavbarSearch.tsx`, `widgets/comment/comment-list/ui/CommentItem.tsx`, `features/post/like/ui/LikePostButton.tsx`, `widgets/post/post-card/ui/PostCard.tsx`, `docs/plans/2026-09-16-typography-tokens-a11y-gate.md`, [PR #109](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/109))

  </details>

- `post` `/post` 목록 요소 간 세로 간격 축소
  <details><summary>배경·구현</summary>

  `/post` 목록에서 필터 카드 아래에 pull-to-refresh 인디케이터(`motion.div`, 평소 height 0)가 만드는 화면에 안 보이는 24px 마진이 `space-y-6`와 겹쳐 항상 붙어 있었다(`docs/DECISIONS.md`의 "`space-y-*` 컨테이너 안 조건부 렌더 요소" 패턴과 같은 종류) — 이 마진을 형제 요소별 개별 마진으로 옮겨 제거했다. 또한 `/post`만 레포에서 유일하게 쓰던 `space-y-8` 페이지 리듬을 다른 페이지(`/post/:id`, `/mycomment`)가 쓰는 `space-y-6` 계열(`space-y-4 md:space-y-6`)로 맞추고, 필터 카드 바깥 패딩(`p-5 md:p-6`)도 `p-4`로 줄였다. Artifact로 현재/약/중/강 4안을 나란히 보여주고 사용자가 중(B)안을 선택했다.
  (`pages/post/index.tsx`, `widgets/post/post-list/ui/PostList.tsx`, `widgets/post/post-list/ui/PostListSearch.tsx`, [PR #105](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/105))

  </details>

- `post` 상세 돌아가기 버튼과 카드 사이 간격 축소
  <details><summary>배경·구현</summary>

  데스크톱 전용 돌아가기 버튼과 그 아래 게시글 카드 사이 간격이 부모 컨테이너의 `space-y-6`(24px)에서 나와 너무 넓다는 피드백을 받았다. [PR #106](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/106)에서 버튼에 `md:-mb-3`(-12px) 음수 마진을 더해 24px→12px로 줄였다고 기록했지만, 배포 후 "너무 딱 붙었다"는 재피드백을 받아 Playwright로 실측한 결과 그 서술 자체가 틀렸다는 걸 발견했다 — 실제로는 24px→**3px**이었다. 원인은 버튼(`shadcn Button`)의 실제 `display`가 `inline-flex`라 음수 `margin-bottom`이 선언한 값대로 반영되지 않고 상쇄되는 CSS 함정이었다(Tailwind 공식 업그레이드 가이드·W3C CSS Working Group Issue #8182가 명시적으로 경고하는 상황, `docs/DECISIONS.md` 2026-09-15 참고). margin 오버라이드를 완전히 버리고, 버튼과 카드를 감싸는 중첩 `flex flex-col gap-*` 컨테이너로 바꿔 24px→16px로 재조정했다 — `gap`은 flex 아이템 단위로 적용돼 이 문제 자체가 생기지 않고, 선언값이 실제값과 정확히 일치함을 실측으로 확인했다. 카드→댓글 구간(24px)과 모바일 레이아웃은 영향 없음.
  (`pages/post/PostDetailPage.tsx`, `docs/DECISIONS.md`, [PR #106](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/106), [PR #107](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/107))

  </details>

### Fixed

- `shared` MSW 기본 핸들러(post·comment·bookmark-folder)가 `/api` 접두사 누락으로 실제 요청과 매칭되지 않던 문제 수정
  <details><summary>배경·구현</summary>

  `post.handlers.ts`·`comment.handlers.ts`·`bookmark-folder.handlers.ts`가 등록한 MSW 핸들러가 실제 요청과 한 번도 매칭되지 않고 있었다 — Vitest 하에서는 `import.meta.env.DEV`가 `true`로 평가돼 `API_BASE_URL`이 `/api`로 고정되는데(`.env.test`의 `VITE_API_BASE_URL`은 이 분기에 가려 읽히지 않는 죽은 설정이었다), 세 파일은 이 접두사 없이 경로를 등록해 정확히 `/api` 한 구간이 빠져 있었다. `auth`·`account`·`upload` 핸들러와 동일한 로컬 `url()` 헬퍼를 추가해 통일했다. 이 경로를 타는 테스트 대부분은 자체 `server.use()` 오버라이드로 우회하고 있어 영향이 없었지만, 유일하게 영향받은 `useUpdatePost.test.tsx`는 배경 재조회가 항상 실패해 시드 데이터가 그대로 유지되는 상태에 우연히 의존하고 있었다 — 핸들러를 고치자 재조회가 성공하면서 응답 객체 참조가 바뀌어 폼이 다시 초기화되는 문제가 새로 드러나, `createTestQueryClient`에 `staleTime` 오버라이드를 추가해 배경 재조회 자체를 끄는 방식으로 함께 막았다.
  (`src/mocks/handlers/post.handlers.ts`, `src/mocks/handlers/comment.handlers.ts`, `src/mocks/handlers/bookmark-folder.handlers.ts`, `src/test/utils.tsx`, `src/features/post/update/hooks/useUpdatePost.test.tsx`, `docs/TESTING.md`, `docs/plans/2026-09-21-msw-handler-prefix-fix.md`(신규))

  </details>

- `shared` 다크모드 토글이 next-themes를 우회해 새로고침하면 풀리고 토스트 테마가 어긋나던 문제 수정
  <details><summary>배경·구현</summary>

  Navbar 테마 토글 버튼이 `next-themes`의 `setTheme()` 대신 `document.documentElement.classList.toggle('dark')`로 DOM을 직접 조작하고 있었다. `next-themes` 0.4.6 번들을 직접 디코드해 확인한 결과 이 우회로 세 가지 문제가 있었다: ① `localStorage['linksphere:theme']`에 저장되지 않아 새로고침하면 시스템 기본값으로 풀림, ② `sonner.tsx`가 `useTheme()`으로 읽는 내부 상태는 여전히 `'system'`이라 sonner가 OS를 따라가 토스트만 반대 테마로 렌더됨, ③ (조사 중 추가로 발견) 내부 상태가 `'system'`으로 남아 OS 테마가 바뀌면 수동으로 켠 다크가 아무 조작 없이 풀림. `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')`로 교체했다 — `defaultTheme="system"`이라 `theme`은 신규 사용자에게 항상 `'system'`이라서, `theme` 기준으로 판정하면 OS가 다크인 사용자의 첫 클릭이 다크→다크로 무반응처럼 보인다(두 번 눌러야 라이트로 감). 이 레포는 Vite SPA(SSR 없음)이고 아이콘 전환이 Tailwind `dark:` variant(순수 CSS)라 next-themes 공식 문서가 권장하는 `mounted` hydration 가드는 근거([next-themes README](https://github.com/pacocoursey/next-themes) — _"we cannot know the `theme` on the server"_)가 SSR 한정이라 넣지 않았다. 이 수정으로 다크 선택이 새로고침 후에도 남게 되면서 새로 드러나는 흰 화면 번쩍임(FOUC)을 막기 위해 `index.html` head에 `localStorage`를 동기적으로 읽어 `<html>`에 `.dark`를 미리 붙이는 인라인 스크립트를 추가했다 — 그 안의 스토리지 키 문자열은 `STORAGE_KEYS.THEME`과 별도로 하드코딩되므로, `storage-keys.test.ts`가 두 값의 일치를 가드한다.
  (`src/widgets/layout/navbar/ui/Navbar.tsx`, `src/widgets/layout/navbar/ui/Navbar.test.tsx`(신규), `src/shared/config/storage-keys.test.ts`(신규), `index.html`, `docs/plans/2026-09-20-navbar-theme-toggle-next-themes.md`(신규), [PR #132](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/132))

  </details>

- `shared` og:image 썸네일 로드 실패 시 재마운트마다 재요청돼 콘솔 에러 누적·외부 rate limit 소진하던 문제 수정
  <details><summary>배경·구현</summary>

  배포 사이트 콘솔에 `opengraph.githubassets.com` 429 에러가 찍혀 조사한 결과, 원인은 GitHub OG 서버의 IP당 100건 rate limit이었지만 이를 계속 소진시키는 증폭 루프가 FE에 있었다. `LinkThumbnail`의 `hasError`가 컴포넌트 로컬 `useState`라 가상 스크롤로 카드가 언마운트·재마운트될 때마다 사라졌는데, 성공 응답(`cache-control: immutable`)은 브라우저 캐시를 타 재요청이 없지만 실패 응답(429/415/404)은 캐시되지 않아 재마운트마다 실제 네트워크 요청이 나갔다 — 프로덕션에서 직접 측정한 결과 피드를 6회 왕복시키자 실패 URL 2개가 9번 재요청돼 콘솔 에러가 2→9건 누적됐다. 이번 세션에서 실패한 URL을 모듈 레벨 `Map<string, number>`(`failedImageCache.ts`)에 기록해, 2회 실패한 URL은 재마운트 시 `<img>`를 아예 만들지 않고 바로 폴백 아이콘을 보여주도록 했다 — `<img>`의 `onError`가 상태 코드를 주지 않아 일시적 실패(429)와 영구적 실패(415/404)를 구분할 수 없으므로, TTL 대신 세션 한정(새로고침 시 초기화)으로만 기억하고 회복 기회를 한 번(2회째부터 차단) 남겼다. Storybook에서 동일 스토리를 두 번 이상 재마운트해 세 번째부터 네트워크 요청 없이 폴백이 뜨는 것을 직접 확인했다.
  (`src/shared/lib/image/failedImageCache.ts`(신규), `src/shared/lib/image/failedImageCache.test.ts`(신규), `src/shared/ui/atoms/link-thumbnail.tsx`, `src/shared/ui/atoms/link-thumbnail.test.tsx`, `src/shared/ui/atoms/link-thumbnail.stories.tsx`, `src/test/setup.ts`, `docs/plans/2026-09-20-thumbnail-failure-session-cache.md`(신규))

  </details>

- `shared` 화면을 덮는 모바일 오버레이(검색 패널·사이드바 드로어) 배경 스크롤 잠금 추가
  <details><summary>배경·구현</summary>

  `RecentSearchPanel`·`Sidebar` 모바일 드로어는 `fixed`로 배경을 덮지만 `overscroll-behavior` 방지 장치가 없어, 오버레이 안 목록을 끝까지 스크롤한 뒤 계속 스와이프하면 그 아래 가려진 배경(document)으로 스크롤이 체이닝됐다 — 닫으면 게시글 목록 위치가 조용히 튀는 시나리오가 가능했다. 같은 부류인 마이페이지·이미지뷰어·로그인모달은 전부 Radix `Dialog` 기반이라 내부적으로 `react-remove-scroll`이 걸려 이미 잠겨 있었다(`modal` 기본값 `true`) — 그 라이브러리를 두 컴포넌트에 직접 적용했다(`dialog.tsx`의 `DialogOverlayImpl`과 같은 `RemoveScroll as={Slot}` 패턴). 대안(커스텀 스크롤락 훅 직접 구현, `useHistoryOverlay`에 통합)을 검토하고 기각한 이유는 `docs/DECISIONS.md` 참고.
  (`package.json`, `pnpm-lock.yaml`, `src/widgets/layout/navbar/ui/RecentSearchPanel.tsx`, `src/widgets/layout/navbar/ui/RecentSearchPanel.test.tsx`(신규), `src/widgets/layout/sidebar/ui/Sidebar.tsx`, `src/widgets/layout/sidebar/ui/Sidebar.test.tsx`(신규), `e2e/mobile-search-scroll-lock.mobile.spec.ts`(신규), `e2e/sidebar-drawer-scroll-lock.mobile.spec.ts`(신규), `docs/DECISIONS.md`, `.claude/skills/responsive-ux/SKILL.md`, [PR #125](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/125))

  </details>

- `shared` 검색 placeholder 말줄임표 제거, 모바일 검색바 아이콘-입력창 간격 정리
  <details><summary>배경·구현</summary>

  검색 placeholder(`postSearch`·`bookmarkSearch`)에만 말줄임표(`...`)가 붙어 다른 placeholder(예: `message`)와 톤이 달랐다 — 제거해 통일했다. 같은 커밋에서 `MobileNavbarSearch.tsx`의 뒤로가기 버튼과 입력창 사이 `gap-2`(8px)도 걷어냈다 — 뒤로가기 버튼이 이미 `relative -left-1.5`로 시각적으로 왼쪽에 붙어 있는데(바로 아래 "모바일 헤더 왼쪽 아이콘" 항목) `gap-2`까지 남아있으면 입력창이 그만큼 오른쪽으로 밀려 아이콘-입력창 간격이 다른 헤더 요소보다 벌어져 있었다.
  (`src/shared/config/texts.ts`, `src/widgets/layout/navbar/ui/MobileNavbarSearch.tsx`, [PR #126](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/126))

  </details>

- `shared` 모바일 헤더 왼쪽 아이콘(햄버거·뒤로가기) 2곳을 컨테이너 가장자리에 시각적으로 정렬
  <details><summary>배경·구현</summary>

  [PR #121](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/121)에서 뒤로가기를 햄버거와 같은 위치(22px)로 맞췄지만, 그 22px 자체가 `size="icon"`(36×36 박스)에 24×24 아이콘이 들어가며 생기는 6px 인셋이라 두 아이콘 모두 컨테이너 왼쪽 여백(16px)보다 안쪽에서 시작하고 있었다. [Flutter Material 공식 문서](https://api.flutter.dev/flutter/material/IconButton-class.html)가 명시하는 _"To keep a button's visual sizes small with larger touchable areas, set the hitAreaInsets to a negative value"_ 원칙과 이 레포에 이미 있던 선례([BookmarkPage.tsx](https://github.com/BAECHAN/link-sphere_FE_NEW/blob/main/src/pages/bookmark/BookmarkPage.tsx)의 `-ml-2`, [PostDetailPage.tsx](https://github.com/BAECHAN/link-sphere_FE_NEW/blob/main/src/pages/post/PostDetailPage.tsx)의 `-ml-2`)를 따라, 두 버튼에 `relative -left-1.5`(-6px)를 추가해 아이콘을 16px에 정확히 맞췄다. 기존 선례는 `margin`을 써서 형제 요소(제목 등)까지 같이 끌려오지만, 여기서는 `relative` 오프셋을 써서 탭 영역(36×36)과 옆 검색 입력창·"LinkSphere" 워드마크의 레이아웃에는 영향을 주지 않고 아이콘만 시각적으로 이동시켰다 — 실측으로 입력창 위치(60px)가 그대로 유지됨을 확인했다.
  (`src/widgets/layout/navbar/ui/Navbar.tsx`, `src/widgets/layout/navbar/ui/MobileNavbarSearch.tsx`)

  </details>

- `post` 모바일 상세에서 검색 패널이 열려도 하단 댓글 작성바가 그대로 비치던 문제 수정
  <details><summary>배경·구현</summary>

  모바일 포스트 상세에서 헤더 검색을 열면 `RecentSearchPanel`이 화면을 덮어야 하는데, `MobileCommentBar`(접힘 상태)가 같은 z층(`z-panel`=40)이라 DOM 순서만으로 패널 위에 그대로 남아 있었다. 탭바(`z-nav`=50)가 검색 중에도 보이는 건 `Navbar.tsx:228`이 명시한 의도된 설계라 그대로 두고, 댓글바만 `useHistoryOverlay('mobileSearchOpen')`로 같은 열림 상태를 구독해 `hidden`을 붙였다. 언마운트하지 않은 이유는 이탈 가드(`useUnsavedChangesGuard.ts`)가 `pathname`이 같은 이동은 통과시켜, 검색 열기가 그 가드를 우회하기 때문이다 — 언마운트하면 작성 중이던 본문·첨부 이미지가 경고 없이 사라진다. 같은 조사에서 `RecentSearchPanel`에 스크림·포커스 트랩이 없어 Tab 키로 배경 게시글·댓글에 포커스가 새는 것도 함께 발견해, `AppLayout`의 `main`에 `inert`를 걸어 막았다(React 18.2라 JSX `inert` prop 대신 ref로 DOM 프로퍼티를 직접 설정).
  (`src/features/comment/create/ui/MobileCommentBar.tsx`, `src/features/comment/create/ui/MobileCommentBar.test.tsx`(신규), `src/app/layouts/app-layout/AppLayout.tsx`, `e2e/post-detail-search-overlay.mobile.spec.ts`(신규), `docs/SEARCH.md`, `.claude/skills/responsive-ux/SKILL.md`, [PR #123](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/123))

  </details>

- `shared` 모바일 검색 헤더 아이콘 버튼 3곳의 좌우 정렬 어긋남 수정
  <details><summary>배경·구현</summary>

  Button의 size `default`가 가진 `has-[>svg]:px-3`가 modifier 그룹이 달라 `p-0` 오버라이드로 tailwind-merge에서 지워지지 않고 CSS 명시도에서도 이겨, `MobileNavbarSearch.tsx`의 뒤로가기·트레일링 지우기 버튼과 `NavbarSearch.tsx`의 데스크톱 지우기 버튼 3곳 모두 의도한 여백 제거가 실제로 적용되지 않고 있었다(이 레포 tailwind-merge로 직접 실행해 확인) — 특히 뒤로가기 아이콘은 형제 햄버거 버튼(`size="icon"`)보다 6px 오른쪽에서 시작해 검색을 열고 닫을 때마다 위치가 튀었다. `p-0`으로 우회하는 대신 shadcn이 아이콘 전용으로 제공하는 `size="icon"`/`"icon-sm"` variant로 바꿔 padding 충돌 자체를 없앴다(레포 안에 이미 18곳의 선례가 있고, `input.tsx`·`PasswordInput.tsx`의 클리어 버튼이 정확히 같은 형태다). 뒤로가기는 아이콘도 `size-5`에서 `size-6`으로 키워 햄버거와 정확히 같은 위치(22px)에 오도록 맞췄다. hover 배경도 개별 `hover:bg-transparent` 오버라이드를 걷어내 ghost variant 기본값(다른 navbar 아이콘 버튼과 동일)을 쓰도록 통일했다. 탭 영역은 가로가 44px에서 36px로 줄지만 세로가 20px에서 36px로 늘어 두 축 모두 36px 이상이 된다(880px²에서 1,296px²). 아이콘 크기·hover 배경·X 버튼 가로 위치 3가지 결정은 [Artifact 미리보기](https://claude.ai/artifact/5phgRdqLb3djpD8KBYdGNB)로 사용자 승인을 받았다.
  (`src/widgets/layout/navbar/ui/MobileNavbarSearch.tsx`, `src/widgets/layout/navbar/ui/NavbarSearch.tsx`, [PR #121](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/121))

  </details>

- `comment` 내 댓글 카드 패딩을 다른 카드와 동일하게 통일
  <details><summary>배경·구현</summary>

  `PostCard`·`MobileFolderList`의 폴더 카드는 `p-3`(12px)인데 `MyCommentCard`만 `p-4`(16px)였다. [Artifact 미리보기](https://claude.ai/artifact/B2V5ovgE93iggx8WqEYRoe)로 실제 콘텐츠(댓글 본문+원글 배지)가 `p-3`에서 어떻게 보이는지 사용자에게 먼저 보여주고 승인받은 뒤 반영했다. `MyCommentCardSkeleton.tsx`도 같은 값으로 맞췄다 — 그 파일 자체 주석이 "로딩→렌더 전환에서 레이아웃이 안 튀려면 MyCommentCard와 동일해야 한다"고 이미 명시하고 있었다.
  (`src/widgets/comment/my-comment-list/ui/MyCommentCard.tsx`, `src/widgets/comment/my-comment-list/ui/MyCommentCardSkeleton.tsx`)

  </details>

- `post` 카드 조회수 gap 반응형 통일, 검색 필터 카드를 공용 `Card` 컴포넌트로 정리
  <details><summary>배경·구현</summary>

  `PostCard.tsx` 안에서 좋아요/댓글/북마크/공유 등 "아이콘+숫자" 액션은 전부 `gap-1 md:gap-1.5`를 쓰는데 조회수 줄만 반응형 변형 없이 `gap-1`로 남아있었다 — 같은 파일 안에서만도 하나가 어긋나 있었다. 같은 역할끼리 맞춰 `gap-1 md:gap-1.5`로 통일했다(데스크톱에서 4px→6px, 다른 액션과 동일). `PostListSearch.tsx`의 최상위 필터 카드는 `bg-card rounded-2xl border shadow-sm` 등 공용 `Card` 컴포넌트의 스타일을 raw `div`로 직접 재구현하고 있었다 — `Card`로 교체하고 원래 값(`p-4`/`rounded-2xl`/`gap-2 md:gap-3`/`hover:shadow-md`)은 `className`으로 그대로 얹어 계산값이 완전히 동일함을 확인했다(순수 컴포넌트 재사용 전환, 화면 영향 없음).
  (`src/widgets/post/post-card/ui/PostCard.tsx`, `src/widgets/post/post-list/ui/PostListSearch.tsx`)

  </details>

- `bookmark` 정렬 Select에 스크린리더용 접근성 이름 추가
  <details><summary>배경·구현</summary>

  Storybook a11y 게이트가 `select.stories.tsx`에서 `button-name` 위반으로 잡았던 것을 원인 조사한 결과, `role="combobox"`는 ARIA 스펙상 "name from content"를 지원하지 않는 역할이라(버튼과 달리) 화면에 보이는 placeholder/값 텍스트를 접근성 이름으로 자동 인식하지 않는다는 게 원인이었다. 스토리에만 있는 문제가 아니라 실제 앱의 유일한 사용처인 `BookmarkPage.tsx`의 정렬 Select(모바일·데스크톱 레이아웃 2곳)에도 같은 버그가 있었다 — `aria-label` 없이 screen reader 사용자에게 "combobox"라고만 안내되고 무엇을 정렬하는지 알 수 없었다. `TEXTS.ariaLabels.bookmarkSortSelect`("북마크 정렬 기준 선택")를 추가해 두 곳 모두에 적용했다. 같은 조사에서 `AsyncBoundary.stories.tsx`의 데모 전용 남은 `'todo'`(`/10` 틴트 배경 조합 대비 부족)도 틴트를 걷어내 해결했다 — 화면 영향 없음. 이로써 a11y 게이트가 실측한 위반 14건이 전부 해소됐다.
  (`src/shared/config/texts.ts`, `src/pages/bookmark/BookmarkPage.tsx`, `src/shared/ui/atoms/select.stories.tsx`, `src/shared/ui/elements/AsyncBoundary.stories.tsx`)

  </details>

- `post` 상세 돌아가기 버튼: 모바일은 제거, 데스크톱은 sticky 해제
  <details><summary>배경·구현</summary>

  PR #100에서 돌아가기 버튼을 Navbar 아래 sticky로 고정했더니, 스크롤할 때마다 두 바가 함께 고정돼 모바일 390px 기준 124px를 항상 차지해 답답하다는 피드백을 받았다. dev 서버에서 모바일·데스크톱 실측(124px/112px)과 오버레이 버튼·스크롤 방향 자동 숨김 등 대안을 비교한 끝에, 모바일은 `BottomTabBar`가 라우트와 무관하게 항상 떠 있어 Feed 탭이 이미 대체 수단이고 일반 브라우저 탭에서는 OS·브라우저 뒤로가기가 `navigate(-1)`과 동등하게 동작한다는 점에 착안해 모바일에서는 버튼 자체를 없앴다(`hidden md:inline-flex`). 데스크톱은 Navbar와 나란히 쌓일 이유가 없어 sticky만 걷어내고 평범한 위치로 되돌렸다. `useGoBack`의 이동 로직과 유입 경로별 라벨(`resolveBackLabel`)은 그대로 유지된다 — 유일한 예외는 standalone PWA로 설치한 모바일 사용자로, 이 경우 정확한 위치 복귀 대신 Feed 탭(목록 최상단)으로 대체된다.
  (`pages/post/PostDetailPage.tsx`, `docs/DECISIONS.md`, [PR #103](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/103))

  </details>

## [0.14.0] - 2026-09-14

### Fixed

- `post` 상세 페이지 돌아가기 버튼이 내 댓글 유입 시 화면 밖에 있고, 라벨이 유입
  경로 일부에서 부정확하던 문제 수정
  <details><summary>배경·구현</summary>

  내 댓글 목록에서 댓글 위치로 스크롤된 채 상세에 진입하면 돌아가기 버튼이 페이지
  최상단에만 있어 화면 밖에 있었다. `Navbar` 바로 아래 `sticky`로 고정해 스크롤해도
  항상 보이게 했다. 라벨도 항상 "목록으로"였는데 북마크·내 댓글·외부(FCM·공유링크)
  유입에서는 부정확했다 — 피드/검색·외부 유입만 "목록으로", 그 외(북마크 등 화면이
  매번 달라 이름을 약속할 수 없는 경우)는 중립적인 "뒤로가기"로 나눴다(동작인
  `navigate(-1)`은 그대로, 라벨만 정직해졌다). 근거와 채택하지 않은 대안(북마크·내
  댓글 전용 라벨)은 `docs/DECISIONS.md` 2026-09-14 항목 참고.
  (`pages/post/PostDetailPage.tsx`, `shared/config/texts.ts`,
  `widgets/post/post-card/ui/PostCard.tsx`, `widgets/post/post-list/ui/PostList.tsx`,
  `widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`,
  [PR #100](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/100))

  </details>

### Added

- `comment` 내가 쓴 댓글을 모아보는 화면 추가
  <details><summary>배경·구현</summary>

  자기가 단 댓글을 다시 찾을 방법이 없어, 아바타 드롭다운의 "프로필 수정" 아래에 "내 댓글" 항목을 추가하고 새 페이지(`/my/comments`)에서 최신순 무한 스크롤로 보여준다. 카드는 원글 제목보다 내가 쓴 댓글 내용을 먼저 보여주는 쪽을 택했다(Artifact 목업으로 진입점 2안·카드 레이아웃 2안을 나란히 비교한 뒤 사용자가 선택 — 근거는 `docs/plans/2026-09-14-my-comments.md` 참고). 카드를 클릭하면 원글로 이동하면서 그 댓글 위치까지 스크롤하고 잠시 링으로 강조한다(`CommentList`가 URL 해시 `#comment-<id>`를 읽어 처리) — 댓글이 많은 글에서 "내가 어디에 달았는지"를 다시 찾지 않아도 된다. 삭제된(톰스톤) 댓글과, 댓글을 단 뒤 원글이 비공개로 전환된 경우는 BE 쪽 필터로 목록에서 제외된다.
  (`entities/comment/api/comment.api.ts`, `entities/comment/api/comment.keys.ts`, `entities/comment/api/comment.queries.ts`, `entities/comment/model/comment.schema.ts`, `widgets/comment/my-comment-list/`(신규), `widgets/comment/comment-list/ui/CommentList.tsx`, `widgets/comment/comment-list/ui/CommentItem.tsx`, `pages/mycomment/MyCommentPage.tsx`(신규), `widgets/layout/navbar/ui/Navbar.tsx`, `shared/config/route-paths.ts`, `app/routes/index.tsx`, [PR #90](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/90))

  </details>

- `user` 프로필(닉네임·이미지) 수정 성공 시 토스트 알림 표시
  <details><summary>배경·구현</summary>

  문서-코드 정합성 감사 중, CLAUDE.md의 "성공 토스트 표시 기준" 표가 프로필 수정을 "화면에 결과가 바로 반영돼 불필요"로 분류하고 있었는데 실제로는 그런 토스트 자체가 없었다. 다시 검토해보니 "수정"(Update)은 본문처럼 스크롤 밖에 있거나 다른 화면으로 이동한 뒤에야 반영되는 필드가 있어, "생성"·"삭제"·"토글"류와 달리 결과가 바로 눈에 안 띌 수 있다는 게 드러나 판단 기준을 "필요"로 재분류하고 실제로 토스트를 추가했다.
  (`shared/config/texts.ts`, `entities/account/api/account.queries.ts`, [PR #59](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/59))

  </details>

- `shared` 배포 후 새 버전이 감지되면 다음 페이지 이동에 맞춰 자동으로 새로고침
  <details><summary>배경·구현</summary>

  배포 후에도 이미 열려 있던 탭은 계속 구 버전 JS 번들을 썼다. 기존엔 청크 로드가 실제로 실패해야만(`AppErrorFallback`) 사후 대응했는데, 그 앞 단계를 채우기 위해 탭 포커스가 돌아올 때마다(5분 스로틀) 서버의 최신 `index.html`을 다시 받아 entry script 해시가 바뀌었는지 확인하도록 했다. 바뀌었으면 화면엔 아무 표시도 하지 않고 플래그만 남겨두다가, 사용자가 실제로 다음 페이지로 이동하는 순간에 맞춰 그 이동을 전체 새로고침으로 바꿔치기한다 — 지금 보던 화면은 건드리지 않는다. `sessionStorage`에 마지막으로 감지한 값을 남겨 CloudFront 엣지가 잠시 옛 `index.html`을 돌려주는 전파 지연 구간에서 재감지·재로드가 반복되지 않게 막았다.
  (`shared/hooks/useAppVersionCheck.ts`(신규), `shared/hooks/useNewVersionReload.ts`(신규), `shared/store/appVersion.store.ts`(신규), `shared/utils/version.util.ts`(신규), `app/routes/layouts/RootLayout.tsx`, `docs/NEW-VERSION-RELOAD.md`(신규), [PR #51](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/51))

  </details>

### Changed

- `auth` 로그아웃 시 화면이 곧 바뀔 때(보호 경로·세션 만료)는 그 화면의 쿼리를 재요청하지 않음
  <details><summary>배경·구현</summary>

  로그아웃하면 화면에 떠 있던 모든 쿼리를 토큰이 지워진 채로 배경 재요청했는데, 보호 경로 로그아웃이나 세션 만료처럼 어차피 다른 화면으로 바로 이동하는 경우엔 그 재요청이 401만 받고 버려지는 100% 낭비였다. 로그아웃을 "화면이 곧 이동하는가"로 나눠, `AuthUtil.clearAll()`(보호 경로·세션 만료)은 재요청 없이 캐시만 버리는 새 처리(`removeQueries()`)를 쓰고, 제자리 로그아웃(비보호 경로)은 기존 방식(`resetQueries()`, 화면에 남은 좋아요·북마크 표시를 비로그인 상태로 갱신)을 그대로 유지했다. `resetQueries()`에는 재요청을 끄는 옵션이 없어 `removeQueries()`로 갈아탔는데, 이게 클릭 전에 지워지지 않았던 이전 사용자 데이터 문제(clear()를 피했던 이유)와 같은 특성을 갖지만 뒤따르는 페이지 이동이 그 화면을 통째로 언마운트시켜서 무해하다. 로그아웃 직후 구간 판정(`isLoggingOut()`)도 기존 Promise 기반 플래그 대신 타임스탬프 유예 창으로 확장해 두 경로 모두에 적용했다.
  (`shared/utils/auth.util.ts`, `shared/utils/auth.util.test.ts`, `shared/api/client.test.ts`, `e2e/logout.spec.ts`, `e2e/session-expired.spec.ts`, `docs/AUTH.md`, `docs/FE-ARCHITECTURE.md`, `docs/MYPAGE.md`, `docs/DECISIONS.md`, [PR #98](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/98))

  </details>

- `shared` 빠르게 끝나는 조회에는 로딩 인디케이터를 아예 띄우지 않도록 지연 게이트 일관 적용
  <details><summary>배경·구현</summary>

  빠르게 응답이 오는 화면에서 로딩 인디케이터가 잠깐 보였다 사라지는 깜빡임 제보. 조사해보니 지연 게이트(`useDelayedLoading`)는 이미 있었고 조회 로딩의 절반(상세·댓글·lazy 청크·세션 복원)은 500ms 지연으로 보호되고 있었는데, 나머지 절반(피드 목록 스켈레톤, 북마크 목록·폴더 트리·폴더 선택 모달의 스피너, 로그인 필요 페이지 진입, 라우터 최상위 스피너)은 0ms로 즉시 떴다. 공통 래퍼 `DelayedFallback`을 새로 만들어 Suspense fallback과 `isLoading` 분기 양쪽에 동일하게 적용했다. Suspense fallback은 구조상 최소 노출 시간을 걸 수 없어(경계가 수명을 소유) 대신 CSS 페이드인으로 하드 엣지를 없앴다. `isLoading` 조기 반환 가드는 그대로 유지해 지연 구간에 빈 상태 문구가 잠깐 뜨는 회귀를 막았다. 상수도 이름과 값을 일치시켜 `LOADING_INDICATOR_DELAY_MS`(조회, 500ms)와 `MUTATION_PROGRESS_DELAY_MS`(mutation 진행 표시, 500ms)로 분리했다.
  (`shared/config/const.ts`, `shared/ui/elements/DelayedFallback.tsx`(신규), `shared/ui/elements/SpinnerOverlay.tsx`, `app/ui/PostMutationLoadingToast.tsx`, `widgets/post/post-card/hooks/usePostCard.ts`, `widgets/post/post-list/ui/PostList.tsx`, `widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`, `widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `widgets/bookmark/folder-tree/ui/MobileFolderList.tsx`, `features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `app/routes/ProtectedRoute.tsx`, `app/providers/RouterProvider.tsx`, `docs/FE-ARCHITECTURE.md`, `docs/DECISIONS.md`, [PR #61](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/61))

  </details>

- `post` 검색 실행 후에도 헤더 검색창에 검색어가 그대로 유지됨
  <details><summary>배경·구현</summary>

  지금까지는 헤더 검색창에서 검색을 실행하면 입력값이 즉시 비워졌는데, 이는 데스크톱 33%·모바일 42%만 검색어를 비우는 소수파 관행이었고([Baymard 가이드라인 #346](https://baymard.com/blog/persist-search-queries)) 같은 앱의 북마크 검색과도 동작이 달랐다. 헤더 검색창이 게시글 목록(`/post`) URL의 검색어(`q`)를 되비추도록 동기화 훅을 추가했다. 북마크 페이지도 같은 이름의 `q` 파라미터를 쓰기 때문에 `/post`에 있을 때만 미러하도록 경로를 가렸고, `@카테고리`·`#닉네임` 태그가 섞인 원본 검색어를 그대로 보여준다. 데스크톱 제출에는 trim을 추가했고, `/` 단축키로 포커스할 때 기존 검색어가 전체 선택되도록 해 새 검색을 바로 시작할 수 있게 했다. X 버튼은 [Google](https://9to5google.com/2019/11/12/google-search-clear-text-desktop/)·네이티브 `<input type="search">` 관행을 따라 입력값만 비우고 검색 결과는 그대로 둔다.
  (`widgets/layout/navbar/hooks/useNavbarSearch.ts`(신규), `NavbarSearch.tsx`, `MobileNavbarSearch.tsx`, `docs/SEARCH.md`(신규), [PR #24](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/24))

  </details>

- `post` 글 수정 화면에서 제목을 비우면 정말로 링크에서 제목을 다시 가져오도록 BE가 수정됨(FE는 안내 문구만 추가)
  <details><summary>배경·구현</summary>

  수정 폼 placeholder는 원래부터 "제목 (비워두면 자동으로 가져와요)"라고 약속하고 있었지만, BE `PostService.updatePost`는 URL이 바뀔 때만 재크롤링해 제목만 비운 수정은 조용히 무시되고 기존 제목이 그대로 남아 있었다. BE가 재수집 트리거를 "URL 변경 OR 제목 비움"으로 넓혔고(제목만 비운 경우는 설명·태그·AI 요약을 덮지 않는 순수 폴백), 곁들여 YouTube 크롤링이 껍데기 페이지를 받았을 때 제목이 "- YouTube"로 오염되던 문제도 함께 고쳤다. FE는 로직 변경이 없고, 제목을 비우면 "제목을 비우면 링크에서 제목을 다시 가져와요. 가져오지 못하면 기존 제목이 유지돼요"라는 안내를 입력창 아래에 띄워 재수집이 또 실패해도 사용자가 헤매지 않게 했다(URL을 바꾼 경우엔 기존 `urlChangedNotice`가 이미 있어 중복 노출하지 않는다).
  (`features/post/update/ui/UpdatePostForm.tsx`, `shared/config/texts.ts`, [PR #31](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/31))

  </details>

- `infra` HISTORY.md의 PR 참조(#NN)를 클릭 가능한 링크로 변경
  <details><summary>배경·구현</summary>

  `docs/HISTORY.md`의 항목 끝에 붙는 `(#61)` 같은 참조가 평문이라 클릭해도 아무 데도 가지 않았다. GitHub squash merge가 만드는 커밋 제목(`feat: ... (#61)`) 꼬리표가 `generate-history.js`의 Gemini 요약에 그대로 실려 오는데, 프롬프트에는 PR 참조를 링크로 만들라는 지시가 없었기 때문이다. 요약 생성 후처리 단계에 `(#NN)` → `([#NN](repo/pull/NN))` 정규식 치환을 추가했다(출처 레포가 FE/BE 중 어느 쪽인지에 따라 링크 대상 레포를 분기). 같은 치환을 일회성 스크립트로 돌려 기존 21건도 백필했다.
  (`scripts/generate-history.js`, `docs/HISTORY.md`, [PR #65](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/65))

  </details>

- `bookmark` 북마크가 폴더 1곳에만 있을 때 그 폴더에서 빼면 미분류로 남기지 않고 북마크 자체를 완전 삭제(되돌리기 제공)
  <details><summary>배경·구현</summary>

  폴더 1곳에만 속한 북마크를 그 폴더에서 빼면 미분류로 남는 게 이상하다는 사용자 제보로 조사를 시작했다. 완전 삭제 수단(`북마크 제거` 행)은 이미 있었지만 낙관적 갱신 버그(바로 아래 Fixed 항목)로 반응이 없어 보였고, 이를 계기로 "마지막 폴더는 미분류로 남기지 말고 그 자리에서 완전 삭제하자"로 방향을 정했다. 폴더 탭이 파괴적 조작이 된 만큼 성공 토스트에 "되돌리기" 액션(8초)을 붙였다 — 같은 폴더로 다시 추가하는 것과 정확히 같아 BE 변경 없이 원복된다. 하단 `북마크 제거` 행도 소속이 0~1개였을 때는 동일하게 되돌리기를 제공한다(2개 이상은 일괄 복원 범위 밖). 등록 폼도 마지막 폴더 해제 시 "북마크 안 함"으로 대칭화했다. [NN/g(Jakob Nielsen, 2018)](https://www.nngroup.com/articles/confirmation-dialog/)가 파괴적 조작엔 확인창보다 되돌리기를 우선하라고 권고하는 것에 근거했다. 미분류 재탭 no-op 규칙은 유지하되 근거를 갱신했다 — 되돌릴 소속 row가 없는 파생 상태라 Undo가 불가능한 파괴적 조작이 되므로 막는다.
  (`features/bookmark/toggle/hooks/useBookmarkFolders.ts`, `features/bookmark/toggle/hooks/usePostCardBookmarkFolderModal.ts`, `features/bookmark/select/hooks/useBookmarkFolderSelect.ts`, `features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `features/post/create/hooks/usePostCreateBookmarkFolderField.ts`, `shared/config/const.ts`, `shared/config/texts.ts`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`, [PR #79](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/79))

  </details>

- `bookmark` 이미 미분류인 상태에서 미분류 행을 다시 탭해도 no-op이 아니라 북마크 자체를 완전 삭제(되돌리기 제공), 새 폴더 만들기·북마크 제거 행을 스크롤 밖에 고정
  <details><summary>배경·구현</summary>

  바로 위 항목(#79)에서 "이미 미분류인 상태에서 미분류 행을 다시 탭하면 no-op"으로 남겨두고 근거를 "되돌릴 소속 row가 없어 Undo가 불가능하다"로 적었는데, 이 전제가 틀렸었다 — 하단 `북마크 제거` 행이 이미 같은 상태(소속 0개)에서 되돌리기를 제공하고 있었다(`restoreBookmark([])` → 토글로 재생성). 새 메커니즘을 만들지 않고 그 경로에 위임해, 폴더 행의 "마지막 폴더 탭"과 동일하게 완전 삭제 + 되돌리기(8초)로 바꿨다. 등록 폼도 대칭으로 "북마크 안 함"으로 되돌아가도록 맞췄다. 같은 작업에서 새 폴더 만들기·북마크 제거 행이 폴더 목록과 같은 스크롤 영역에 있어 폴더가 많으면(6개 이상) 화면 밖으로 밀리던 문제도 함께 고쳐, 새 폴더 만들기는 헤더 바로 아래에, 북마크 제거/북마크 안 함은 하단에 고정했다 — [Material Design 다이얼로그 가이드라인](https://m1.material.io/components/dialogs.html)의 _"Actions always remain in place when content scrolls."_ 을 따른 것이다.
  (`features/bookmark/select/hooks/useBookmarkFolderSelect.ts`, `features/bookmark/toggle/hooks/useBookmarkFolders.ts`, `features/bookmark/toggle/hooks/usePostCardBookmarkFolderModal.ts`, `features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `features/post/create/hooks/usePostCreateBookmarkFolderField.ts`, `docs/BOOKMARK.md`, `docs/DECISIONS.md`)

  </details>

### Fixed

- `comment` 댓글 해시 이동 시 스크롤 도착 지점이 navbar에 딱 붙어 답답해 보이던 문제 수정
  <details><summary>배경·구현</summary>

  "내 댓글" 카드에서 원글로 이동하면 하이라이트된 댓글이 sticky navbar 바로 아래(여백 0px)에 붙어서 시작해, 가려지거나 잘리진 않지만 시각적으로 답답하다는 피드백을 받았다. 이 코드베이스에 "navbar 높이 + 여유분" 간격을 쓴 선례가 없어 임의로 정하는 대신, 실제 앱과 같은 색 토큰·컴포넌트 구조로 만든 목업으로 여백 0/12/16/24px 네 가지를 나란히 비교해 승인받은 뒤 24px로 정했다. `CommentItem` 루트의 `scroll-mt-(--navbar-height)`를 `scroll-mt-[calc(var(--navbar-height)_+_24px)]`로 바꿔, navbar 실제 높이(런타임 측정값)에 24px를 더한 만큼 스크롤 여백을 예약한다. 실제 사이트에서 `getBoundingClientRect().top`으로 재측정해 정확히 navbar 높이+24px(64+24=88px, 1px 미만 오차)에 도착함을 확인했다.
  (`widgets/comment/comment-list/ui/CommentItem.tsx`, [PR #95](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/95))

  </details>

- `auth` 로그아웃 후 다시 로그인해도 이전 화면이 계속 에러로 보이던 문제 수정
  <details><summary>배경·구현</summary>

  "내 댓글" 화면을 열어둔 채 로그아웃하면 그 화면이 계속 에러로 남아, 다시 로그인하고 재진입해도 "내 댓글을 불러오는데 실패했어요"만 보였다. 로그아웃 처리(`AuthUtil.clearQueries()`)가 토큰을 지운 직후 `resetQueries()`로 화면에 남아있던 쿼리를 배경 재요청시키는데, 그 요청이 401을 받아 캐시가 error 상태로 굳는 것이 원인이었다. TanStack Query의 Suspense 훅은 캐시가 error면 재마운트해도 새 요청을 아예 내지 않고(`retryOnMount`를 false로 강제) 캐시된 옛 에러를 그대로 다시 throw한다. 기존 로그인 성공 처리의 `invalidateQueries()`는 활성 쿼리만 다시 부르므로 이미 언마운트된 이 쿼리에는 닿지 못했다. 로그인 성공 시 에러 상태이면서 보여줄 데이터도 없는 쿼리만 골라 `resetQueries()`로 초기 상태로 되돌리도록 했다 — 데이터를 들고 있는 쿼리(배경 재요청만 실패한 경우)는 화면이 멀쩡하고 재마운트 시 정상 재요청되므로 건드리지 않는다. 모달을 통한 제자리 로그인에서 이미 떠 있던 게시글 목록이 깜빡이지 않게 하려는 의도다. 이 리셋은 기존 `invalidateQueries()` 앞에 둔다 — `resetQueries()`의 내부 재조회는 리셋 뒤 predicate가 더 이상 매칭되지 않아 아무것도 다시 부르지 않으므로, 화면에 떠 있는 쿼리의 재요청은 뒤이은 `invalidateQueries()`가 맡는다. `useLoginMutation` 전용 테스트가 없던 것도 이번에 함께 채웠다.
  (`entities/auth/api/auth.queries.ts`, `entities/auth/api/auth.queries.test.ts`, `docs/AUTH.md`, [PR #94](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/94))

  </details>

- `comment` 댓글 해시 이동 시 스크롤 정렬을 중앙에서 상단으로 변경해 긴 댓글도 시작부터 읽히게 함
  <details><summary>배경·구현</summary>

  "내 댓글" 카드에서 원글로 이동하면 `block: 'center'`로 스크롤해 댓글을 화면 중앙에 뒀는데, 댓글이 길면 시작부가 뷰포트 위로 잘려 나가 중간부터 읽히는 문제가 있었다. `scrollIntoView()`의 `block` 기본값 자체가 `'start'`([MDN](https://developer.mozilla.org/en/docs/Web/API/Element/scrollIntoView))이고 네이티브 앵커 링크(`#id`) 이동도 같은 정렬을 쓴다는 점에 맞춰 `'start'`로 바꿨다. 다만 `block: 'start'`만 쓰면 이번엔 sticky navbar가 댓글 상단을 가리므로, 같은 파일의 댓글 작성 폼 컨테이너에 이미 쓰이던 `scroll-mt-(--navbar-height)`를 앵커 요소(`CommentItem` 루트)에도 동일하게 적용했다. 두 요소(스크롤 정렬 없음 vs `scroll-mt` 없는 `start`)를 각각 정적 재현 페이지로 스크린샷 비교해 시작부가 잘리는 것과 navbar에 가려지는 것 둘 다 실제로 재현·수정됨을 확인했다.
  (`widgets/comment/comment-list/ui/CommentList.tsx`, `widgets/comment/comment-list/ui/CommentItem.tsx`)

  </details>

- `comment` 댓글 첨부 이미지가 로드되며 다른 댓글이 밀리던 레이아웃 시프트 수정
  <details><summary>배경·구현</summary>

  "내 댓글" 카드에서 특정 댓글로 스크롤·하이라이트해도, 위쪽 다른 댓글의 첨부 이미지가 뒤늦게 로드되면서 문서 높이가 늘어나 하이라이트 위치가 밀렸다. `MarkdownContent`의 댓글 이미지 `<img>`에 크기 예약이 없어 로드 전 높이 0에서 로드 후 240px로 순간 점프하는 게 원인이었다(`docs/DECISIONS.md` 2026-09-06 항목에서 다른 시프트 증상을 조사하다 발견했지만 그때 원인은 아니어서 유예해 둔 이슈). 이미지 요청 시 width와 height를 같은 값으로 넘기면(`resize=cover`) 원본이 그 값보다 작지만 않으면 응답이 항상 정확히 그 정사각으로 잘려 온다는 점(Supabase Storage 공식 문서의 cover 정의, 직접 측정으로 재확인)을 이용해, Supabase 변환을 타는 이미지는 로드 전부터 `LinkThumbnail`과 같은 방식(고정 비율 래퍼 + `bg-muted` 플레이스홀더)으로 정사각 자리를 미리 예약하도록 했다. `blob:`(작성 중 미리보기)·외부 이미지 링크는 비율을 알 수 없어 기존 렌더링을 그대로 유지한다.
  (`shared/ui/elements/MarkdownContent.tsx`, `shared/lib/image/supabaseImage.ts`, `shared/ui/elements/MarkdownContent.stories.tsx`, `shared/ui/elements/MarkdownContent.test.tsx`(신규), `docs/plans/2026-09-14-comment-image-cls.md`(신규), [PR #93](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/93))

  </details>

- `comment` 프로필 이미지가 있는 댓글에서 아바타가 세로 가운데로 처지던 문제 수정
  <details><summary>배경·구현</summary>

  본문이 길거나 이미지를 첨부했거나 대댓글이 달려 오른쪽 컬럼이 높아질수록 왼쪽 프로필 이미지가 닉네임 줄에서 점점 더 아래로 내려갔다. `CommentItem`의 루트가 `items-start` 없이 `flex`만 걸려 있어 기본값인 `align-items: stretch`가 적용됐고, `UserAvatar`의 zoomable 래퍼(`Button`)가 `h-auto`라 이 stretch를 그대로 받아 늘어난 뒤 `Button`의 `items-center`가 안의 아바타를 세로 중앙으로 밀어냈다 — 프로필 이미지가 없어 이니셜 폴백만 뜨는 댓글은 이 래퍼 자체가 없어 원래도 상단에 붙어 있었다. `UserAvatar`의 `Button`에 `self-start`를 더해 zoomable 여부와 무관하게 항상 고정 크기 상자로 동작하게 했고, `CommentItem` 루트에도 `items-start`로 스레드형 2열 레이아웃의 상단 정렬 의도를 명시했다.
  (`entities/user/ui/UserAvatar.tsx`, `widgets/comment/comment-list/ui/CommentItem.tsx`, [PR #92](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/92))

  </details>

- `shared` dev 서버 포트가 `vite.config.ts`·`playwright.config.ts` 두 곳에 리터럴로 중복돼 있던 것을 하나로 통합
  <details><summary>배경·구현</summary>

  "내 댓글" 기능 브라우저 검증 중 `localhost:31119` 하드코딩 위치를 전수 조사하다가, `vite.config.ts`의 `server.port`와 `playwright.config.ts`의 `baseURL`이 서로 참조 없이 각자 `31119` 리터럴을 들고 있는 걸 발견했다. 지금 당장 문제는 없지만 포트를 바꾸면 한쪽만 고치고 다른 쪽을 놓쳐 e2e가 조용히 옛 포트로 접속을 시도하게 될 수 있다. 새 파일 `dev-server.config.ts`에 `DEV_SERVER_PORT` 상수 하나로 정의를 모으고 두 설정이 그 값을 import해서 쓰도록 바꿨다. 두 tsconfig 프로젝트(`tsconfig.app.json`이 `vite.config.ts`를, `tsconfig.e2e.json`이 `playwright.config.ts`를 각각 include)가 이 신규 파일도 함께 include하도록 갱신했다 — 안 그러면 project reference 경계를 벗어난 import라 TS6307로 타입체크가 깨진다.
  (`dev-server.config.ts`(신규), `vite.config.ts`, `playwright.config.ts`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.e2e.json`, [PR #91](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/91))

  </details>

- `shared` 필터·정렬·검색 URL을 로딩 중 연달아 바꾸면 서로 유실되거나 방금 지운 값이 되살아나던 문제 수정
  <details><summary>배경·구현</summary>

  게시글 목록 필터 칩 클릭이 간헐적으로 URL·UI에 반영되지 않거나 되돌아간다는 제보를 Playwright로 재현해 원인을 추적했다. `usePostList.ts`의 `toggleFilter`/`setSearch`가 `useSearchParams()`가 돌려주는 공유 URLSearchParams 인스턴스를 `.set()`/`.delete()`로 직접 수정하고 있었는데, 라우터의 `v7_startTransition`으로 필터 변경이 목록 응답이 올 때까지 커밋되지 않는 구간(정지 구간) 안에서 또 조작하면 아직 반영 안 된 mutation이 남은 같은 인스턴스를 또 읽고 고쳤다. 같은 패턴이 `BookmarkPage.tsx`(folder/sort)·`useBookmarkSearch.ts`(q)에도 있었는데, 이 둘은 서로 다른 `useSearchParams()` 인스턴스를 각자 mutate해 한쪽의 아직 반영 안 된 변경이 다른 쪽에 보이지 않을 수 있었다. mutation을 제거하고, 새 공용 훅으로 "커밋된 URL 또는 아직 반영 안 된 pending 의도" 위에 사본을 만들어 그 사본만 고치는 구조로 바꿨다. pending 의도는 URL이 라우터당 하나뿐인 공유 자원이라는 전제로 모듈 스코프에 두어, 서로 다른 컴포넌트의 훅 인스턴스도 같은 pending을 공유한다. 정지 구간 안에서 같은 필터를 재클릭하면 취소되는 동작(토글의 정상 동작)은 고치지 않았다.
  (`shared/hooks/useSearchParamsDraft.ts`(신규), `widgets/post/post-list/hooks/usePostList.ts`, `pages/bookmark/BookmarkPage.tsx`, `widgets/bookmark/bookmark-search/hooks/useBookmarkSearch.ts`, `docs/SEARCH.md`, `docs/BOOKMARK.md`, `docs/TESTING.md`, `docs/DECISIONS.md`, `docs/plans/2026-09-14-filter-chip-pending-url.md`(신규), [PR #88](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/88))

  </details>

- `auth` 비로그인 상태로 북마크를 시도하면 로그인해도 아무 반응이 없던 문제 수정
  <details><summary>배경·구현</summary>

  `useAuthGuard`는 비로그인 시 액션을 실행하지 않고 버리는 게 원래 설계였다("로그인만 유도"). 하지만 첫 북마크를 시도한 사용자 입장에선 로그인 후에도 아무 일이 안 일어나는 것으로 보였다. 로그인 성공 콜백 채널(`onSuccess`)은 콜백이 스스로 navigate해 히스토리 엔트리를 벗어난다는 전제로 설계돼 있어(그래서 `LoginModal`이 `close()`를 안 부른다), `setOpen(true)`처럼 navigate하지 않는 콜백을 그대로 태우면 로그인 모달이 안 닫힌 채 폴더 모달이 위에 겹친다. navigate하지 않는 재개 액션 전용의 `pendingAction` 채널을 새로 만들어, 로그인 모달이 실제로 닫힌 뒤에만 실행하도록 했다. 좋아요·댓글은 재개 시 토글 반전·조용한 무반응 같은 부작용이 있어(자세한 근거는 `docs/DECISIONS.md` 참고) 재개하지 않고, 서버 쓰기가 없는 북마크에만 `resumeAfterLogin` opt-in을 켰다.
  (`shared/store/loginModal.store.ts`, `entities/auth/hooks/useAuthGuard.ts`, `features/auth/login/ui/LoginModal.tsx`, `features/bookmark/toggle/ui/BookmarkPostButton.tsx`, `docs/AUTH.md`, `docs/DECISIONS.md`)

  </details>

- `post` 게시글을 북마크하면 옆에 있는 공유 아이콘이 채워지던 문제 수정
  <details><summary>배경·구현</summary>

  공유 버튼의 `Share2` 아이콘 `fill-current` 조건이 `post.userInteractions.isBookmarked`에 묶여 있었다. 바로 옆 북마크 아이콘의 fill 로직을 복붙한 흔적으로 보이며, `userInteractions` 스키마엔 공유 관련 플래그 자체가 없어 애초에 채워질 이유가 없었다. 조건을 제거했다.
  (`widgets/post/post-card/ui/PostCard.tsx`)

  </details>

- `shared` 마우스를 가만히 둬도 게시글 카드·북마크 폴더에서 커서가 pointer/default로 반복 전환되던 문제 수정
  <details><summary>배경·구현</summary>

  대용량 다운로드 등으로 네트워크가 느릴 때만 재현된다는 제보를 Playwright로 직접 실측해 원인을 두 개로 좁혔다. (1) 게시글 카드: `LinkThumbnail`이 og:image 로드 실패 시 `aspect-video` 영역을 통째로 제거해, 마우스가 고정된 채 아래 카드들이 위로 밀리면서 그 자리의 요소가 바뀌었다(고정 좌표 41곳 스윕 중 30곳에서 이미지 성공/실패 조건만 바꿨을 때 전환 확인 — 이미지 실패가 잦은 네트워크 저하 상황에서만 눈에 띄는 이유). 실패해도 자리를 유지하고 `ImageOff` 아이콘으로 대체하도록 고쳤다. (2) 북마크 폴더 사이드바: 폴더 행 래퍼 `<div>`의 여백(`pl-3`/`pr-1`/`py-1`/`gap-2`)에는 `hover:bg-accent`로 하이라이트는 되면서 실제 클릭 영역(`<button>`)이 아니라 커서가 `default`로 풀리는 구멍이 있었다(부하와 무관하게 상시 존재하지만 평소엔 프레임마다 매끄럽게 갱신돼 눈에 안 띄다가 부하 상황에서 두드러진 것으로 추정). 버튼들이 그 여백을 흡수해 행 전체를 채우도록 해 없앴다.
  (`shared/ui/atoms/link-thumbnail.tsx`, `shared/ui/atoms/link-thumbnail.stories.tsx`, `shared/ui/atoms/link-thumbnail.test.tsx`, `widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `docs/plans/2026-09-11-cursor-flicker-fix.md`(신규))

  </details>

- `shared` 지금 보고 있는 북마크 폴더를 삭제하면 엉뚱한 "작성 중인 내용이 있어요" 확인창이 한 번 더 뜨던 문제 수정
  <details><summary>배경·구현</summary>

  북마크 폴더 삭제 e2e를 만들다 실측: 삭제 확인을 눌러도 폴더가 바로 사라지지 않고, 저장 안 한 변경사항 확인 모달이 튀어나와 사용자가 그걸 한 번 더 눌러야만 했다(이 페이지엔 저장할 폼 자체가 없다). 원인은 `Alert.tsx`의 `handleConfirm`이 `onConfirm()`을 먼저 실행하고 `close(id)`를 나중에 호출하던 순서였다 — 폴더 삭제 confirm의 `onConfirm`은 동기적으로 같은 경로(`/bookmark`, 쿼리 파라미터만 다름) 네비게이션을 트리거하는데, 그 순간 확인 모달이 아직 "열려있는" 상태라 `useUnsavedChangesGuard`가 "열린 대화상자가 있으니 막는다"고 판단해 이동을 막았다. 막힌 걸 정리하는 로직은 "열린 대화상자 때문이면 조용히 취소한다"는 분기를 갖고 있었지만, 그 로직이 실행되는 시점엔 이미 confirm이 스스로 닫힌 뒤라 그 분기를 타지 못하고 새 확인창을 띄워버렸다. `close(id)`를 `onConfirm()`보다 먼저 호출하도록 순서만 바꿔 해결했다 — confirm의 onConfirm이 같은 경로로 네비게이션하는 유일한 곳(폴더 삭제)이라 다른 흐름엔 영향이 없다.
  (`shared/ui/elements/modal/alert/Alert.tsx`, [PR #76](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/76))

  </details>

- `auth` 로그인 실패 시 서버 원문 에러 메시지가 그대로 노출되던 문제 수정
  <details><summary>배경·구현</summary>

  레포 전체 문서-코드 정합성 감사 중, `error.util.ts`가 "날것의 error.message는 절대 사용자에게 노출하지 않는다"는 정책의 모범 사례로 인용한 `auth.queries.ts`를 실제로 확인해보니, `useLoginMutation`의 401 처리가 정확히 그 정책을 어기고 서버가 내려준 `error.data.message`를 그대로 토스트에 띄우고 있었다. `account.queries.ts`가 이미 올바르게 지키고 있던 패턴(서버 상세를 노출하지 않고 일반 메시지로 감싼다)을 따라, 미사용 상태로 남아있던 `TEXTS.messages.error.loginFailedPasswordMismatch`를 대신 쓰도록 고쳤다.
  (`entities/auth/api/auth.queries.ts`, `shared/utils/error.util.ts`)

  </details>

- `post` 북마크 요청이 실패했을 때 목록 화면의 북마크 상태가 원복되지 않던 문제 수정
  <details><summary>배경·구현</summary>

  좋아요 mutation과 같은 종류의 구멍이었다(바로 아래 `postLikeRollback` 항목 참고) — `useBookmarkPostMutation`도 `onMutate`에서 메인 피드 목록 캐시(`postKeys.listRoot`)를 직접 패치하지만 `onError`는 그 스냅샷을 안 남겨 롤백하지 못했다. 이미 이 파일 안에 있던 폴더별 게시글 캐시(`bookmarkFolderKeys.postsRoot`) 롤백 패턴을 메인 피드 목록에도 똑같이 적용했다. 좋아요 mutation을 고치며 우연히 발견해, 같은 세션에서 이어서 수정했다.
  (`entities/interaction/api/interaction.queries.ts`, `entities/interaction/api/interaction.queries.test.ts`)

  </details>

- `post` 좋아요 요청이 실패했을 때 목록 화면의 좋아요 상태가 원복되지 않던 문제 수정
  <details><summary>배경·구현</summary>

  좋아요 mutation이 낙관적 갱신으로 상세·목록 캐시를 둘 다 즉시 패치하는데(`useLikePostMutation`), 실패 시 롤백(`onError`)은 상세 캐시만 되돌리고 목록 캐시는 되돌리지 않았다. 좋아요 API가 실패해도 목록 화면엔 낙관적으로 뒤집힌 좋아요 상태가 그대로 남아 있었다. 같은 파일의 `useBookmarkPostMutation`이 이미 쓰고 있던 패턴(패치 전 목록 스냅샷을 떠서 `onError`에서 복원)을 그대로 적용했다. e2e 흐름 추가 작업 중 발견했다.
  (`entities/interaction/api/interaction.queries.ts`, `docs/FE-ARCHITECTURE.md`)

  </details>

- `shared` FCM 토큰 등록·해제가 다른 API 요청처럼 액세스 토큰 자동 갱신의 혜택을 받도록 수정
  <details><summary>배경·구현</summary>

  FCM 토큰 등록·해제가 공통 `apiClient`를 거치지 않고 raw `fetch()`로 `/fcm/token`을 직접 호출하고 있었다. 그 결과 로그인 직후처럼 액세스 토큰이 막 만료된 시점에 401이 나도 다른 API 요청과 달리 자동 재시도 없이 조용히 실패했다. `shared/api/fcm.api.ts`를 새로 만들어 다른 엔티티와 같은 3-layer API 규약대로 `apiClient`를 거치게 정리했다. (`shared/api/fcm.api.ts`(신규), `shared/lib/firebase/fcm.ts`, `shared/config/api.ts`)

  </details>

- `shared` 로그인·에러 페이지가 다크 모드에서도 항상 밝은 배경으로 보이던 문제 수정
  <details><summary>배경·구현</summary>

  `AuthLayout`·`ErrorLayout`이 디자인 토큰이 아닌 고정 회색(`bg-gray-50` 등)을 써서 다크 모드에서도 배경이 항상 밝게 보였다. `bg-background`/`text-foreground`/`text-muted-foreground` 토큰으로 교체해 테마를 따라가게 했다. 검색창 단축키 배지(`SearchInput`, 헤더 검색창 `NavbarSearch`)의 하드코딩 회색도 `Kbd` 컴포넌트 기본 톤(`bg-muted`)을 그대로 쓰도록 정리했다. (`shared/ui/layouts/AuthLayout.tsx`, `shared/ui/layouts/ErrorLayout.tsx`, `shared/ui/elements/SearchInput.tsx`, `shared/ui/elements/ImageAttachmentField.tsx`, `widgets/layout/navbar/ui/NavbarSearch.tsx`)

  </details>

- `post` 링크 등록·수정 폼 URL 입력란의 브라우저 자동완성 제안 비활성화
  <details><summary>배경·구현</summary>

  URL 입력란에 포커스하면 브라우저가 폼 자동완성 기록(이전에 제출한 URL들)을 드롭다운으로 제안해 아래 필드를 가렸다. 링크 등록·수정은 매번 새 URL을 붙여넣는 흐름이라 제안이 도움이 되지 않아 `autoComplete="off"`로 끈다. 두 폼이 같은 `name="url"`을 써서 자동완성 기록을 공유하므로 양쪽 모두에 적용했다.
  (`features/post/create/ui/CreatePostForm.tsx`, `features/post/update/ui/UpdatePostForm.tsx`)

  </details>

- `bookmark` 북마크 페이지 제목 폰트 크기를 화면별로 통일(20px)
  <details><summary>배경·구현</summary>

  같은 페이지 안에서 제목 크기가 3가지(모바일 폴더 목록 18px, 모바일 게시글뷰 16px, 데스크톱 20px)로 흩어져 있었다. 실제 브라우저 검증(getComputedStyle)으로 3개 화면 전부 20px로 렌더링되는 것을 확인했다.
  (`pages/bookmark/BookmarkPage.tsx`)

  </details>

- `shared` 빈 상태·로딩 화면의 수직 패딩을 48px로 통일
  <details><summary>배경·구현</summary>

  북마크·댓글 빈 상태와 모바일 폴더 목록 로딩 화면의 수직 패딩이 4종(py-8/10/12/16)으로 흩어져 있었다. 가장 많이 쓰이던 py-12(48px)로 통일했다. 실제로 비어있는 폴더("미분류")에서 브라우저 검증(getComputedStyle)으로 48px 렌더링을 확인했다.
  (`widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`, `widgets/bookmark/folder-tree/ui/MobileFolderList.tsx`, `widgets/comment/comment-list/ui/CommentList.tsx`)

  </details>

- `post` 카테고리 필터 칩을 활성화한 뒤 마우스를 올리면 색이 바뀌던 문제 수정
  <details><summary>배경·구현</summary>

  범위 필터 칩(북마크한·내가 작성한·나만 볼 수 있는)은 이미 `hover:bg-*` 클래스로 활성 색을 고정해뒀는데, 카테고리 필터 칩(`@디자인` 등)의 `activeClassName`에는 그 클래스가 빠져 있어 활성 상태에서 호버하면 기본 호버 스타일로 되돌아갔다. 같은 파일의 다른 칩들과 동일하게 `hover:bg-primary hover:text-primary-foreground`를 추가했다.
  (`widgets/post/post-list/ui/PostListSearch.tsx`)

  </details>

- `auth` 로그인·회원가입 화면 높이 계산에서 실제 내비게이션 바 높이 대신 고정값(10rem)을 쓰던 문제 수정
  <details><summary>배경·구현</summary>

  `h-[calc(100vh-10rem)]`(160px)로 고정돼 있었는데 실제 내비게이션 바 높이는 `--navbar-height`(64px)라 96px 차이가 있었다. 다른 화면들처럼 `var(--navbar-height)`를 쓰도록 통일했다. 브라우저 검증으로 뷰포트 800px 기준 컨테이너 높이가 736px(800-64)로 정확히 일치하는 것을 확인했다.
  (`pages/auth/LoginPage.tsx`, `features/auth/signup/ui/SignUpForm.tsx`)

  </details>

- `bookmark` 메인 피드에서 북마크를 완전히 제거해도 반응이 없거나 되레 미분류로 옮겨간 것처럼 보이던 문제 수정
  <details><summary>배경·구현</summary>

  사용자가 실제로 재현: 미분류 상태에서 `북마크 제거`를 눌러도 아무 반응이 없어 보였고, 폴더 소속 상태에서 눌러도 완전 삭제가 아니라 미분류로 옮겨간 것처럼 보였다. 원인은 `useBookmarkPostMutation`의 낙관적 갱신이 현재 북마크 상태를 계산할 때 메인 피드 목록 캐시(`postKeys.listRoot`)를 조회만 하고 방향 계산에는 쓰지 않아서였다 — 상세 페이지나 `/bookmark` 페이지를 거치지 않고 메인 피드에서만 조작하면 두 캐시(`postKeys.detail`, `bookmarkFolderKeys.postsRoot`) 모두 비어 있어 항상 "추가" 방향으로 잘못 계산됐다. 서버(토글 API)는 정상적으로 완전 삭제를 처리했지만 잘못된 낙관적 패치가 화면에 남았다. 같은 종류의 방향 계산 로직이 있던 `bookmark-folder.queries.ts`의 `resolveCurrentBookmarkState`에 `postKeys.listRoot` 폴백을 추가하고 export해, `interaction.queries.ts`가 자체 계산 대신 이 함수를 쓰도록 통합했다.
  (`entities/interaction/api/interaction.queries.ts`, `entities/bookmark/folder/api/bookmark-folder.queries.ts`, `entities/interaction/api/interaction.queries.test.ts`, `docs/BOOKMARK.md`, [PR #79](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/79))

  </details>

- `auth` 회원가입 완료 후 이동 경로가 API 엔드포인트 상수에 우연히 의존하고 있던 문제 수정
  <details><summary>배경·구현</summary>

  e2e 시나리오 카탈로그를 조사하다 발견: `useCreateAccountMutation`의 `onSuccess`가 라우트 이동에 `ROUTES_PATHS.AUTH.LOGIN`이 아니라 `API_ENDPOINTS.auth.login`을 쓰고 있었다. 둘 다 `/auth/login`이라 지금까지는 우연히 동작했지만, 같은 네임스페이스의 회원가입 자체가 이미 API `/auth/signup`과 라우트 `/auth/sign-up`으로 갈라져 있어 `API_BASES.auth`가 바뀌면 이 코드만 조용히 깨질 수 있었다. `ROUTES_PATHS.AUTH.LOGIN`으로 교체하고, 착지 URL을 직접 단언하는 `signup.spec.ts`로 이 결합을 고정했다.
  (`entities/auth/api/auth.queries.ts`, `e2e/signup.spec.ts`(신규))

  </details>

### Tests

- `e2e` 게시글 등록, 상세 404, 회원가입, 세션 만료, 북마크 폴더 drill-down(모바일) 흐름 추가
  <details><summary>배경·구현</summary>

  `docs/TESTING.md` §13의 카탈로그를 다시 전수 조사해 14개 후보를 판정한 뒤(채택 4·보류 2·제외 8), 유닛/컴포넌트 테스트로 구조적으로 검증 불가능한 5개 흐름을 추가했다: (1) 게시글 등록 — 응답을 기다리지 않는 이동, 미저장 변경 가드 미발동, 요청 body 검증(원래 함께 만들려던 "in-flight 재조회 취소" 케이스는 `cancelQueries`의 `revert:true` 기본값과 `invalidateQueries`의 후속 활성 재조회가 얽히는 것으로 보이는 상호작용 때문에 e2e·유닛 양쪽에서 안정적으로 재현하지 못해 제외했다 — 별도 조사 필요), (2) 상세 404 — Suspense→ErrorBoundary→replace 체인, (3) 회원가입 — 착지 URL(위 Fixed 항목의 회귀 방지), (4) 세션 만료 — `AuthUtil.isLoggingOut()` 가드가 트리거 에러 자신에게도 적용돼 토스트 없이 조용히 이동하는 실측(계획 당시 예상과 다름), (5) 북마크 폴더 drill-down — 데스크톱에서 전혀 렌더되지 않는 모바일 전용 화면이라 `playwright.config.ts`에 `mobile-chrome`(Pixel 5) project를 신설해 `*.mobile.spec.ts`만 배타적으로 실행하게 했다(전 스펙을 모바일로 재실행하는 방식은 기존 3개 스펙이 데스크톱 뷰포트를 전제로 단언하고 있어 기각). 범위 밖에서 함께 드러난 유일한 완전 미커버 인증 경로(동시 401 → `refreshSubscribers` 큐)는 e2e보다 싼 유닛 1건으로 별도 커버했다.
  (`e2e/post-create.spec.ts`(신규), `e2e/post-detail-not-found.spec.ts`(신규), `e2e/signup.spec.ts`(신규), `e2e/session-expired.spec.ts`(신규), `e2e/bookmark.mobile.spec.ts`(신규), `e2e/mocks/auth.mock.ts`, `e2e/mocks/endpoints.ts`, `playwright.config.ts`, `shared/api/client.test.ts`, `docs/TESTING.md`)

  </details>

### Notes

- BE API 의존: `GET /comment/my` 신규 엔드포인트 필요. **배포 순서: BE 먼저** — 구버전 BE에는 이 경로가 없어 먼저 FE만 배포하면 "내 댓글" 화면 진입 시 404가 뜬다.

## [0.13.0] - 2026-09-06

### Added

- `post` 게시글 목록에 "봇 글 숨기기" 스위치 추가
  <details><summary>배경·구현</summary>

  BE가 봇 계정 명의로 RSS 피드 글을 매일 자동 등록하는 기능을 추가하면서, 원하는
  사용자는 그 글을 숨길 수 있게 했다. 기존 필터 3개(북마크한/내가 작성한/나만 볼
  수 있는)와 달리 칩이 아니라 별도 ON/OFF 스위치로 뒀다 — 기본이 무조건 켜지는
  칩들과 시각적으로 구분하고 싶었고, 기본 OFF(봇 글이 보이는 상태)를 유지해야
  URL에 `filter` 파라미터가 안 붙어 `post.queries.ts`의 낙관적 목록 삽입
  (`unfilteredListPredicate`)이 그대로 동작한다. `shared/ui`에 스위치류 컴포넌트가
  없어 shadcn 공식 레지스트리(`@radix-ui/react-switch`)를 새로 설치해 다른 atom
  13개와 같은 방식(radix 프리미티브 래핑)으로 추가했다.
  (`shared/ui/atoms/switch.tsx`(신규), `PostListSearch.tsx`, `TEXTS.buttons.hideBots`)

  </details>

- `comment` 댓글·답글 등록이 실패하면 입력했던 내용과 이미지가 폼에 복원됨
  <details><summary>배경·구현</summary>

  기존엔 서버 응답을 기다리지 않고 제출 즉시 폼을 비웠는데(낙관적 업데이트가 목록에
  바로 반영되므로), 등록이 실패하면 방금 쓴 내용이 그대로 사라졌다. `reset()`은
  지금처럼 즉시 실행해 비우는 UX는 유지하되, "폼을 닫는" `onSuccess`만 mutate
  콜백으로 미뤘다 — 답글 폼·모바일 바는 `onSuccess`에서 폼 컴포넌트를 언마운트하는데,
  React Query는 뮤테이션이 끝나기 전에 컴포넌트가 언마운트되면 `mutate()`의 스코프
  콜백(`onError` 포함)을 호출하지 않는다. 그 사이 사용자가 새로 입력을 시작했으면
  덮어쓰지 않는다.
  (`features/comment/create/hooks/useCreateComment.ts`)

  </details>

### Notes

- BE API 의존: `GET /post`의 `filter` 파라미터에 `excludeBots` 값 지원 필요.
  배포 순서 무관 — 구버전 BE는 모르는 filter 값을 조용히 무시한다.
- CloudFront WAF `CrossSiteScripting_BODY` 룰 완화(Block→Count)는 AWS 콘솔/CLI로
  적용한 **수동 인프라 변경**이라 이 코드 배포에 포함되지 않는다 — 이미 적용
  완료됐고, 코드는 그와 별개로 WAF 차단 시 안내 UX만 개선한다. `docs/DEPLOY.md`
  "CloudFront WAF (수동 관리)" 절 참고.

### Changed

- `post` 필터 카드 초기화 버튼을 조건이 없어도 항상 눌리게 변경
  <details><summary>배경·구현</summary>

  적용된 조건이 없으면 초기화 버튼을 `disabled`로 막고 `TooltipWrapper`로 이유를
  안내했는데, disabled 버튼은 탭 순서에서 빠져 키보드만 쓰는 사용자는 버튼도 이유도
  볼 수 없었다(`TooltipWrapper.tsx`가 `tabIndex={-1}`로 호버·터치 전용인 것과 맞물린
  구멍). 초기화는 "필터 없는 상태로 만든다"는 멱등한 동작이라 이미 그 상태에서
  눌러도 이상하지 않으므로, disabled 대신 버튼을 항상 활성으로 두고 조건이 없으면
  클릭 핸들러가 조용히 return하도록 바꿨다. `TooltipWrapper` 래핑과 안내 문구
  (`resetDisabledReason`)는 더 이상 필요 없어 제거했다.
  (`PostListSearch.tsx`, `texts.ts`)

  </details>

- `comment` 댓글·답글 본문 길이를 한글 기준 약 2,000자(UTF-8 6,000바이트)로 제한
  <details><summary>배경·구현</summary>

  긴 댓글을 등록하면 CloudFront WAF가 요청 바디 크기(8,192바이트) 초과라는 이유로
  앱에 닿기도 전에 403 HTML을 돌려줬다. 이 응답은 앱 에러 처리를 전혀 타지 않아
  사용자는 이유를 알 수 없었다. WAF의 이 차단은 건드리지 않았다 - 완화를 시도했으나
  대체 크기 제한 룰이 CloudFront Pro 플랜 전용이라 이 계정(Free 플랜)에서 만들 수
  없었고, 차단만 풀면 WAF의 바디 크기 방어가 완전히 사라져 비용·보안 노출이 생기므로
  원복했다(`docs/DECISIONS.md` 참고). 대신 앱이 그 8KB 벽 안쪽에서 여유 있게 동작하도록
  상한을 잡고, WAF 403 대신 앱이 먼저 제출을 막고 이유를 말하도록
  `commentContentFormSchema`(바이트 기준 zod refine)를 작성·수정 폼이 공유하게 했다.
  BE `CommentService.MAX_COMMENT_CONTENT_BYTES`와 반드시 같은 값이어야 한다.

  제출 버튼은 길이 초과로는 비활성화하지 않는다 - 비활성 버튼은 클릭 이벤트 자체가
  안 먹어 제출을 시도해도 안내가 뜨지 않는 문제가 있었다(구현 중 발견). 대신 텍스트
  영역 아래 상시 안내 문구(초과 시에만 표시)로 알리고, 실제 제출은 zod가 막아
  실패 시 토스트를 띄운다.
  (`entities/comment/config/const.ts`의 `MAX_COMMENT_CONTENT_BYTES`,
  `entities/comment/model/comment.schema.ts`의 `commentContentFormSchema`,
  `shared/lib/content/textBytes.ts`(신규))

  </details>

- `comment` 줄바꿈이 많거나 이미지를 여러 장 붙인 댓글이 실제 전송 바이트 기준으로
  WAF 벽을 넘던 문제 수정
  <details><summary>배경·구현</summary>

  위 항목의 `MAX_COMMENT_CONTENT_BYTES` 체크는 `content` 원본 UTF-8 바이트만 잰다.
  하지만 WAF가 실제로 재는 건 `JSON.stringify({content, images})`한 전송 바이트다 -
  JSON 문자열의 `\n`은 `\`+`n` 2바이트로 이스케이프되므로, 짧은 줄이 아주 많은 글은
  원본 바이트로는 상한 밑인데도 전송 시점엔 그보다 훨씬 커진다(실사용자 재현
  사례: 6,000바이트 밑인데 줄바꿈이 대부분이라 실제 전송량이 8,192바이트를 넘음).
  이미지 URL도 마찬가지로 `content` 필드만 보는 기존 체크에 안 잡힌다.

  제출 시점(줄바꿈·이미지 개수와 무관하게 마지막 관문)에 실제 전송될 JSON과 같은
  모양을 만들어 그 바이트를 재는 안전망을 추가했다 - 개행 개수를 세거나 JSON
  문법 오버헤드를 손계산하는 대신, 아직 업로드 전이라 URL을 모르는 이미지는
  추정 길이(Supabase 공개 URL 실측치에 여유를 둔 200바이트)의 자리표시자로 채워
  `JSON.stringify`를 그대로 재현한다. 8,192바이트 벽 대비 약 700바이트 여유(7,500)를
  뒀다. 넘으면 기존과 다른 문구("댓글 용량이 너무 커요")로 안내한다 - 원인이
  글자수가 아니라 줄바꿈·이미지 조합이라 "2,000자" 안내를 재사용하면 부정확하다.
  (`entities/comment/model/estimateCommentPayloadBytes.ts`(신규),
  `entities/comment/config/const.ts`의 `MAX_COMMENT_PAYLOAD_BYTES`,
  `ESTIMATED_IMAGE_URL_BYTES`)

  </details>

- `post` 게시글 검색 필터 영역을 기능별 행으로 재구성
  <details><summary>배경·구현</summary>

  카테고리 칩·범위 필터 칩 3개·봇 글 숨기기 스위치·초기화 버튼이 세로 구분선
  2개만 사이에 두고 한 줄 `flex-wrap`에 평평하게 나열돼 있어, 줄바꿈 위치에 따라
  구분선이 줄 끝/시작에 걸려 그룹 경계 역할을 잃고 초기화 버튼 위치도 매번
  달라졌다. GitHub Issues·Linear의 그룹 구분선 패턴([Baymard — Applied Filters](https://baymard.com/blog/how-to-design-applied-filters):
  적용 필터 개요를 상단에 명확히 두지 않는 사이트가 42%)을 참고해 검색바 → 카테고리 →
  범위 필터 → 봇 숨기기 → "조건 N개 적용 중"+초기화 순으로 행을 나누고, 경계는
  텍스트 라벨 없이 `border-t`만 사용했다. 가로 스크롤은 쓰지 않기로 하고
  (GitLab이 검색 토큰 가로 스크롤에 대해 반복적으로 wrap 요청을 받은 사례),
  모바일에서만 카테고리를 앞 4개로 접고 `+N` 버튼으로 펼치되([Material Design 3
  Chips](https://m3.material.io/components/chips/accessibility) 가이드), 그 값은
  `useState`가 아니라 `categories`·`searchInput`의
  파생값으로 계산해 카테고리 쿼리가 늦게 도착해도 깜빡이지 않게 했다. 카테고리
  칩 라벨에 `@`를 노출해 검색어 토큰(필터가 아님)임을 드러내면서, 선택 판정을
  기존 부분문자열 매칭(`@AI개발` 입력 시 `@AI` 칩이 오탐으로 켜지던 문제)에서
  `parseSearchQuery` 토큰 비교로 바꿨다. "조건 N개" 카운트는 봇 글 숨기기
  (localStorage 개인 설정, 초기화 대상 아님)를 제외하고 URL에 실제 적용된
  값(`searchQuery`) 기준으로 세어, 옛 `?filter=excludeBots` 공유 링크나 타이핑
  중인 미제출 검색어가 잘못 잡히지 않게 했다. `FilterChip`은 모바일 터치 타깃을
  44px로 키우며 shared 컴포넌트 스토리를 신규 추가했다.
  (`PostListSearch.tsx`, `FilterChip.tsx`, `FilterChip.stories.tsx`(신규),
  `texts.ts`, `docs/DECISIONS.md`)

  **배포 후 보정**: 실제로 보니 바깥 여백(`gap`)과 각 줄의 구분선 위쪽 여백
  (`border-t pt-*`)이 겹쳐 경계마다 이중으로 쌓여(약 25~33px) 간격이 과했고,
  색·모양으로 이미 구분되는 UI에 구분선까지 더한 것도 과했다. 후보 3개(여백만
  / 옅은 구분선 / 행동줄 앞에만 구분선)를 실제 색 토큰 그대로 재현한 정적
  Artifact 목업으로 나란히 비교해 선택받은 뒤 반영했다 — "여백만" 채택,
  `border-t` 전부 제거하고 바깥 여백을 `gap-2 md:gap-3`(8/12px)로 줄였다.
  "봇 글 숨기기"는 라벨을 스위치 반대편으로 벌리던 `justify-between`을 버리고
  라벨+스위치를 한 덩어리로 붙였다(`inline-flex gap-2`). 카테고리는 8개뿐이라
  모바일 접기(`+N`/`useToggle`)가 과한 추상화였다고 판단해 제거하고 항상 전부
  노출한다.
  (`PostListSearch.tsx`, `texts.ts`)

  **검색창을 헤더로 통합**: 코드를 추적해보니 데스크톱 헤더(`NavbarSearch`)와
  모바일 헤더 검색(`MobileNavbarSearch`)이 이미 있고, 제출하면 이 필터 카드의
  검색창과 완전히 동일하게 `/post?q=`로 이동해 — 검색창이 2곳에 중복돼 있었다.
  카드에서 검색 입력행(입력창+모바일 "검색" 버튼)을 완전히 제거하고 헤더
  검색만 남겼다. 카테고리 칩의 `@라벨` 토큰 병합 기준을 로컬 미입력 상태
  (`searchInput`)에서 URL(`searchQuery`)로 옮기면서, 범위 필터 칩과 같은 이유로
  (`setSearchParams`가 라우터 `startTransition`에 감싸여 있어 그대로 두면 칩이
  늦게 반응한다) 카테고리 전용 `flushSync` 낙관적 미러(`optimisticCategoryTags`)
  를 새로 추가해 반응성을 유지했다. 부수 효과로 지금까지 씨름하던 모바일
  placeholder 잘림 문제도 이 카드에서는 아예 사라졌다(헤더 검색창은 폭이
  넉넉함). 또한 지난 세션에서 승인했던 모바일 칩 터치 타깃 확대(28px→44px)를
  사용자 확인 후 28px로 되돌렸다 — 데스크톱과 시각적으로 통일하기 위한
  의도적 트레이드오프([WCAG 2.2 SC 2.5.8 Target Size Minimum, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)의
  24px는 여전히 만족, [SC 2.5.5 Target Size Enhanced, AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)의
  44px는 포기).
  (`PostListSearch.tsx`, `FilterChip.tsx`, `docs/DECISIONS.md`)

  **재보정**: 이 리팩터링에서 봇 스위치 행의 클래스를 건드리며 바로 위 "여백만"
  보정에서 승인받은 `inline-flex gap-2`(라벨+스위치 한 덩어리)를 의도치 않게
  `justify-between`으로 되돌렸다. `self-end inline-flex gap-2`로 다시 붙여 카드
  오른쪽 끝에 정렬했다. 같은 자리에서 "초기화" 버튼과 우측 세로 라인을 맞춰
  달라는 요청도 받았는데, 실측(Playwright `boundingBox()`)해 보니 ghost 버튼의
  내부 패딩은 텍스트만 안쪽으로 밀 뿐 버튼 박스 우측 끝은 이미 스위치 우측 끝과
  일치했다 — 추가 마진 없이 그대로 두었다.
  (`PostListSearch.tsx`, `docs/DECISIONS.md`)

  **세 번째 조정**: 봇 숨기기·초기화 행이 이미 줄바꿈으로 구분되는데 칩 행과
  동일한 간격까지 있어 카드가 넓어 보인다는 피드백. Artifact 목업으로 두 후보를
  비교해(A: 봇 숨기기↔초기화만 붙임 / B: 범위 필터 칩부터 전부 붙임) B를
  채택했고, 같은 자리에서 모바일 터치 타깃도 44px→28px로 줄이기로 했다(칩과
  동일 높이로 통일 — `FilterChip`이 같은 이유로 이미 28px로 정리된 전례를
  따름). 범위 필터 칩·봇 스위치·초기화 행을 gap 없는 `<div className="flex flex-col">`
  로 묶어 카테고리 칩과의 경계 gap만 바깥 컨테이너에 남겼다.
  (`PostListSearch.tsx`, `docs/DECISIONS.md`)

  **네 번째 조정**: 봇 스위치가 범위 필터 칩에 완전히 붙자 라벨 텍스트
  (`text-sm`, 14px)만 이 카드에서 유일하게 튀어 "폰트가 다르다"는 인상을 줬고,
  칩 영역과의 경계도 다시 필요해졌다. 봇 스위치를 "조건 N개 적용 중 + 초기화"
  행으로 옮겨 왼쪽 끝에 두고(카운트+초기화는 오른쪽으로 묶음 — 초기화가
  지우는 대상이 카운트가 집계하는 조건들이라 짝을 이루고, 봇 숨기기는 애초에
  카운트 계산에서 제외되는 별개 설정이라는 기존 구분과 일치), 세 번째
  조정에서 만든 gap-0 특수 래퍼를 제거해 범위 필터 칩을 다시 카드 최상위
  `flex flex-col`의 직계 자식으로 되돌렸다 — 카테고리 칩·범위 필터 칩·통합
  행 사이가 다시 카드 전체와 같은 `gap-2 md:gap-3`로 균일해지며 경계 문제도
  함께 해결됐다. 라벨은 `text-sm` → `text-xs`(옆 "조건 N개 적용 중"과 동일
  스타일)로 통일했다.
  (`PostListSearch.tsx`, `docs/DECISIONS.md`)

  </details>

- `post` "봇 글 숨기기" 스위치를 URL 파라미터 대신 기기별 localStorage 설정으로 변경
  <details><summary>배경·구현</summary>

  기존엔 `?filter=excludeBots` URL 쿼리가 유일한 저장소라, 홈 로고 클릭·사이드바
  이동처럼 쿼리가 없는 경로로 재진입하면 매번 OFF로 돌아갔다. 로그인 화면의
  "아이디 저장"(`useLogin.ts`)과 같은 성격의 기기별 개인 설정으로 보고 localStorage에
  옮겼다. 다만 스위치(`PostListSearch`)와 목록 조회(`usePostList`)가 형제 컴포넌트라
  `useAppLocalStorage`(다른 탭 전용 동기화)로는 같은 탭 안에서 값이 전달되지 않아,
  `auth.store.ts`의 "zustand + `LocalStorageUtil` 수동 동기화" 선례를 따라 신규
  `useHideBotsStore`를 추가했다. URL의 `filter`(북마크한/내가 작성한/비공개)는 그대로
  두고, `usePostList`가 그 값과 store의 `hideBots`를 합쳐 최종 필터를 만든다 — 옛
  `?filter=excludeBots` 링크가 남아 있어도 그 토큰은 무시한다. 초기화 버튼은 검색어·
  URL 필터만 되돌리고 봇 토글은 건드리지 않는다. store 갱신은 URL 갱신과 달리 라우터의
  `v7_startTransition` 보호를 받지 못해 그대로 두면 토글 때마다 목록이 스켈레톤으로
  떨어지므로, 기존 필터 칩과 같은 flushSync 낙관적 패턴 + `startTransition`으로 감쌌다.
  (`shared/store/hideBots.store.ts`(신규), `shared/config/storage-keys.ts`,
  `usePostList.ts`, `PostListSearch.tsx`)

  </details>

- `infra` PR·배포 파이프라인에 `pnpm check`(type-check·lint·format) 게이트 추가
  <details><summary>배경·구현</summary>

  `pnpm check`는 사람이 수동으로 실행할 때만 돌았다 — pre-commit(`lint-staged`)은
  staged 파일만, pre-push는 테스트만, `deploy.yml`은 테스트+빌드만 검사해 레포
  전체 lint/format을 도는 곳이 하나도 없었다. 그 결과 `eslint.config.js`의 ignore
  패턴(`'dist/**/*'`)이 중첩 경로(`.claude/worktrees/*/dist/`)를 못 잡는 버그를
  아무도 못 봤고, 방치된 Claude 워크트리의 빌드 산출물이 `pnpm check` 결과를 2,370건
  에러로 오염시켰다(실제 소스 문제는 warning 4건뿐이었음). ignore 패턴을 `**/dist/**`
  형태로 고치고, PR CI(`ci.yml`, 신규)와 `deploy.yml` 양쪽에 `pnpm check`를 게이트로
  추가했다. 남은 warning 4건도 원인 해결(누락된 `ImportMetaEnv` 타입 선언, 테스트
  mock의 암시적 `any` 반환)로 없앤 뒤 `--max-warnings 0`을 걸어 재발을 막는다.
  (`eslint.config.js`, `.prettierignore`, `src/vite-env.d.ts`,
  `src/entities/user/api/AuthQueries.test.tsx`,
  `src/features/post/bookmark/ui/FolderSelector.tsx`, `package.json`,
  `.github/workflows/ci.yml`(신규), `.github/workflows/deploy.yml`)

  </details>

- `post` 게시글 상세 상단을 클릭 가능한 "목록으로" 버튼으로 변경
  <details><summary>배경·구현</summary>

  화살표 아이콘만 클릭 가능하고 바로 옆 "Post Details" 제목은 텍스트일 뿐이라,
  사용자가 제목을 눌러보고 반응이 없어 헷갈리는 사례가 있었다. "Post Details"
  제목을 없애고 화살표와 "목록으로" 텍스트를 하나의 버튼으로 합쳐 클릭 가능
  영역을 넓혔다(모바일 44px 터치 타깃 기준 충족). 이동 동작(뒤로가기 이력이
  있으면 이전 화면, 없으면 링크 목록)은 기존 `useGoBack` 그대로 유지했다.
  (`PostDetailPage.tsx`, `texts.ts`)

  </details>

- `bookmark` 폴더 선택 목록에 "내 폴더" 구획 헤더 추가
  <details><summary>배경·구현</summary>

  북마크 버튼을 눌러 여는 폴더 선택 시트(`FolderSelector`)와 데스크탑 사이드바
  (`FolderTree`)에서, 상단 "최근 저장한 폴더" 구획엔 라벨이 있는데 그 아래 본
  목록엔 라벨 없이 바로 이어져 같은 폴더가 위아래에 중복 표시되는 게(의도된 split
  menu 설계) "목록이 깨졌다"로 오인되기 쉬웠다. 본 목록에 "내 폴더" 헤더를 상시
  추가해(폴더 1개 이상일 때, 최근 구획 노출 여부와 무관) 구분을 명확히 했다.
  모바일 폴더 목록 페이지(`MobileFolderList`)엔 이미 같은 헤더가 있어 화면마다
  표기가 갈리던 것도 함께 통일했다. 등록 폼의 `BookmarkFolderPicker`에도 동일 적용.
  (`FolderSelector.tsx`, `FolderTree.tsx`, `BookmarkFolderPicker.tsx`,
  `docs/BOOKMARK.md` §5)

  </details>

- `shared` 클릭 가능한 요소(버튼·메뉴·체크박스 등)의 커서를 pointer로 전역 통일
  <details><summary>배경·구현</summary>

  Tailwind v4 preflight엔 v3에 있던 `button, [role="button"] { cursor: pointer }`가
  없어(버전 확인: 4.1.18) `<button>`이 브라우저 기본 커서를 썼고, 컴포넌트마다
  `cursor-pointer`를 개별로 붙여 대응해왔다(12곳, raw `<button>` 20곳은 그마저도 누락).
  `globals.css`의 `@layer base`에 button·ARIA role 전체를 커버하는 규칙을 한 번
  추가하고, 흩어져 있던 수동 처리를 모두 제거했다. shadcn 기본값(`cursor-default`)이던
  드롭다운 메뉴 항목·셀렉트 옵션도 이번에 pointer로 통일했다(포인터 오버로 자동
  스크롤되는 셀렉트 스크롤 버튼은 클릭 대상이 아니라 제외). 앞으로의 회귀를 막기
  위해 `onClick`만 달린 `div`/`span`을 차단하는 ESLint 룰
  (`custom-a11y/clickable-needs-interactive-element`)도 추가했다.
  (`src/app/globals.css`, `shared/ui/atoms/button.tsx`, `shared/ui/atoms/dropdown-menu.tsx`,
  `shared/ui/atoms/select.tsx`, `eslint.config.js`, 상세 배경은 `docs/DECISIONS.md`
  2026-09-03 항목)

  </details>

### Added

- `bookmark` 게시글 목록에 "최근 열람순" 정렬 옵션 추가
  <details><summary>배경·구현</summary>

  북마크 폴더 목록에 붙인 "최근 저장한 폴더"의 연장선. 정렬 드롭다운에 `viewed`
  옵션을 추가했다 — `VALID_SORTS`/`SORT_LABELS`가 이미 배열 기반이라 `BookmarkPostList`는
  코드 변경 없이 새 값을 그대로 API에 전달한다. BE의 새 `sort=viewed` 값이 필요하다
  (BE `docs/VERSION-COMPATIBILITY.md` 확인 불필요 — 신규 옵션 추가라 하위 호환, 구 BE에서는
  해당 값이 `latest`로 폴백될 뿐 에러 없음).
  (`entities/folder/model/folder.schema.ts`, `pages/bookmark/BookmarkPage.tsx`,
  `shared/config/texts.ts`)

  </details>

- `bookmark` 등록 폼 폴더 선택기에도 "최근 저장한 폴더" 상단 구획 노출
  <details><summary>배경·구현</summary>

  보관함 모달(`FolderSelector`)에만 있던 "최근 저장한 폴더" 상단 구획(§5, split menu)이
  등록 폼(`BookmarkFolderPicker`)에는 없었다. 두 화면이 공통 프레젠테이션 컴포넌트
  (`entities/folder/ui/FolderPickerDialog`, 아래 Changed 항목)를 공유하도록 합치면서
  자동으로 확보됐다 — 노출 조건·개수·스냅샷 규칙은 기존과 동일.
  (`entities/folder/ui/FolderPickerDialog.tsx`(신규),
  `features/post/create/ui/BookmarkFolderPicker.tsx`)

  </details>

### Changed

- `bookmark` 등록 폼 폴더 선택기에 '북마크 안 함' 행 추가 및 미분류 재탭 규칙 통일
  <details><summary>배경·구현</summary>

  등록 폼에는 북마크를 끄는 전용 수단이 없어 '미분류' 행을 다시 탭하는 것이 곧
  해제였는데, 이는 보관함 모달(`FolderSelector`)의 "체크된 미분류 재탭 = no-op"과
  반대라 같은 모양의 UI가 화면마다 다르게 동작했다. 목록 맨 아래에 destructive
  '북마크 안 함' 행을 추가하고 미분류 재탭은 양쪽 모두 no-op으로 통일했다. 이 행은
  조건부로 감추면 탭할 때마다 나타났다 사라져 하단 '확인' 버튼 위치가 흔들리므로
  항상 노출한다. 폴더/미분류 행과 달리 더 고를 게 남지 않는 종결 동작이라(보관함
  모달의 '북마크 제거' 행과 동일한 성격) 누르면 선택을 비우고 바로 모달을 닫는다.
  함께, 두 화면이 각자 들고 있던 폴더 목록 다이얼로그 마크업을 공통 프레젠테이션
  컴포넌트로 합치고 저장 동작만 콜백으로 주입하도록 바꿨다(보관함 모달의 즉시 저장·
  토스트·행별 스피너 동작은 그대로). 이 과정에서 보관함 모달의 폴더 행에도 모바일
  최소 터치 높이(44px)를 등록 폼과 동일하게 맞춰, 보관함 모달의 모바일 행 높이가
  조금 커졌다.
  (`entities/folder/ui/FolderPickerDialog.tsx`(신규),
  `features/post/bookmark/ui/FolderSelector.tsx`,
  `features/post/create/ui/BookmarkFolderPicker.tsx`,
  `features/post/bookmark/hooks/useBookmarkFolders.ts`, `docs/BOOKMARK.md`)

  </details>

### Fixed

- `auth` 보호 라우트로 이동시키는 로그인 모달이 로그인 성공 후 안 닫히고 X·ESC도 무반응이던 문제 수정
  <details><summary>배경·구현</summary>

  사이드바 Bookmark·Submit처럼 인증이 필요한 페이지로 이동시키는 `useProtectedNavigate`
  경로에서, 로그인 성공 후 모달이 닫히지 않고 X·ESC·배경 클릭도 전혀 반응하지 않는다는
  보고가 들어와 운영서버에서 Playwright로 재현했다. 원인은 두 가지가 겹쳐 있었다.

  ① `useProtectedNavigate`의 `onSuccess`가 `navigate(to)`(push)로 원래 가려던 페이지로
  이동시키는데, 로그인 모달을 여는 `open()`도 push라 모달 엔트리 바로 위에 새 엔트리가
  쌓인다. 뒤이어 `close()`가 부르는 `navigate(-1)`은 그 새 엔트리에서 한 칸 뒤인 모달
  엔트리 자기 자신으로 되돌아가버려, 모달이 닫히기는커녕 같은 위치로 재확정된다.
  `location.key`가 처음 열었을 때와 같은 값으로 귀결되다 보니 `useHistoryOverlay`의
  `backSentRef` 재무장 effect가 "변화 없음"으로 판단해 실행되지 않고, 이후 `close()`를
  아무리 불러도 첫 줄에서 조용히 return — X·ESC·backdrop이 전부 죽는다.
  `ProtectedRoute.tsx`가 이미 쓰던 `{ replace: true }`로 통일해 모달 엔트리를 아예
  대체하도록 고쳤다.

  ② 로컬 재현 중 두 번째 버그를 추가로 발견했다: `LoginModal`의 로그인 성공 effect가
  `setOnSuccess(undefined)`를 부르면 zustand 구독으로 리렌더가 한 번 더 일어나는데, 그
  재실행 시점엔 `onSuccess`가 이미 비워진 뒤라 원래 안 타야 할 `close()` 분기로 잘못
  빠졌다. `handledSuccessRef`로 모달이 열려있는 한 주기당 분기를 한 번만 태우도록 막았다.

  onSuccess가 없는 경로(Navbar 로그인 버튼 등)는 기존 `close()` 로직 그대로라 영향 없다.
  (`entities/user/hooks/useProtectedNavigate.ts`, `features/auth/login/ui/LoginModal.tsx`)

  </details>

- `bookmark` "최근 열람순" 정렬이 방금 본 글을 반영하지 않고 새로고침해야만 보이던 문제
  <details><summary>배경·구현</summary>

  게시글 상세 조회가 BE `post_views`를 갱신해도(정렬 기준 데이터가 바뀌어도), 북마크
  목록의 `sort=viewed` 쿼리는 완전히 별개 캐시 키라 그 갱신을 알 방법이 없었다.
  React Query 기본 `staleTime`(3분) 안에서는 캐시를 그대로 서빙해 방금 본 글이 목록에
  반영되지 않고, 캐시가 초기화되는 강제 새로고침을 해야만 제대로 보였다.
  `PostDetailPage`가 게시글 상세를 보여줄 때마다 `folderInvalidateQueries.postsRoot()`를
  호출해 북마크 목록 캐시를 무효화하도록 했다 — 같은 패턴(폭넓은 무효화)을 이미
  `handleBookmarkToggleSuccess` 등 다른 cross-invalidation 지점에서도 쓰고 있다.
  (`pages/post/PostDetailPage.tsx`)

  </details>

- `bookmark` 게시글 삭제 후 북마크 페이지에서 폴더 카운트가 옛 값으로 남던 문제 수정
  <details><summary>배경·구현</summary>

  북마크된 게시글을 삭제하고 북마크 페이지로 이동하면, 새로고침 전까지 폴더의 게시글 개수와
  "최근 저장한 폴더" 구획이 삭제 전 값 그대로 보였다. 원인은 BE·React Query 무효화가 아니라
  `useRecentFolders`의 스냅샷 방식 — 세션 중 순서를 고정하려던 의도(split menu 공간기억)가
  `Folder` 객체 전체(카운트 포함)를 얼렸고, 스냅샷 시점도 `isLoading`(캐시가 없을 때만
  true) 기준이라 재방문 시 stale 캐시로 곧장 확정돼버려 뒤이은 refetch 결과가 반영되지
  않았다. 스냅샷 대상을 폴더 id 목록만으로 좁히고(순서는 고정, 값은 매 렌더 최신 `folders`에서
  재조회), 스냅샷 시점을 `isFetching`이 꺼지는 순간(재검증 완료 후)으로 옮겼다. 더불어
  `useDeletePostMutation`에만 없던 낙관적 폴더 카운트 감소를 다른 북마크 변경 mutation과
  동일한 패턴으로 추가해, invalidate 응답을 기다리는 동안의 순간적인 stale 노출도 없앴다.
  (`entities/folder/model/useRecentFolders.ts`,
  `widgets/bookmark/folder-tree/FolderTree.tsx`,
  `widgets/bookmark/folder-tree/MobileFolderList.tsx`,
  `features/post/bookmark/ui/FolderSelector.tsx`, `entities/post/api/post.queries.ts`)

  </details>

- `comment` 게시글 상세 화면에서 스크롤 중 댓글 작성 폼이 화면에 들고 날 때마다 본문이
  한 번씩 밀리던 문제 수정
  <details><summary>배경·구현</summary>

  데스크톱 전용 "댓글쓰기로 이동" 플로팅 버튼(`ScrollToCommentFormButton`)이
  `CommentList`의 실제 콘텐츠(댓글 목록 등)와 같은 `space-y-6` 형제 목록 안에서
  조건부 마운트되고 있었다. Tailwind v4의 `space-y-6`는 `:where(& > :not(:last-child))`
  선택자로 마진을 주는데, 이 선택자는 화면에 실제로 보이는지와 무관하게 DOM 순서만으로
  "마지막 자식"을 판단한다. 이 버튼은 `position: fixed`라 화면에는 안 보이지만 DOM에는
  실재하므로, 스크롤에 따라 마운트/언마운트될 때마다 그 앞의 댓글 목록이 "마지막 자식"인지
  아닌지가 바뀌면서 `margin-block-end: 24px`가 붙었다 떨어졌다 했다. 그 결과 페이지
  전체 높이가 스크롤 중 24px씩 흔들렸고, 사용자가 페이지 하단 근처에 있을 때 이 흔들림이
  일어나면 브라우저가 스크롤 위치를 새 문서 높이에 맞춰 보정하면서 본문이 살짝 밀리는
  것처럼 보였다 — 레이아웃 시프트가 아니라 스크롤 위치 보정이라 Chrome DevTools의
  Layout Shift 감지에는 잡히지 않았다. 실 배포 사이트에서 댓글 수가 다른 두 글로 각각
  재현하고 Chromium·Firefox(재현) / WebKit(미재현)까지 교차 확인해 메커니즘을 특정했다.
  같은 문제가 있던 모바일 전용 `MobileCommentBar`와 함께 `space-y-6` 형제 목록 밖으로
  옮겨 근본 원인을 제거했다. (`widgets/comment/comment-list/ui/CommentList.tsx`)

  </details>

- `infra` 게시글 상세 화면 폰트 preload 목록에 SemiBold(굵기 600) 누락 보완
  <details><summary>배경·구현</summary>

  이전 폰트 서빙 최적화(0.12.0 `Fixed` 항목 참고)가 실제 쓰는 굵기를
  400/500/600/700(Regular/Medium/SemiBold/Bold)이라고 명시했음에도, `index.html`
  preload 목록에는 Regular/Medium/Bold 세 개만 있고 SemiBold가 빠져 있었다.
  `font-semibold`가 필요한 시점(댓글 섹션 "댓글" 헤딩 등)에야 뒤늦게 요청되어
  `font-display: swap`으로 폴백 폰트가 잠깐 보이는 원인이 될 수 있었다. 위 댓글
  영역 레이아웃 시프트 조사 과정에서 발견한 별개의 이슈로, 다른 세 굵기와 같은
  preload `<link>`를 추가해 문서화된 의도와 실제 구현을 맞췄다. (`index.html`)

  </details>

- `comment` 댓글 수정 폼 미리보기에서 썸네일 로드 실패 시 깨진 이미지 아이콘 노출
  <details><summary>배경·구현</summary>

  게시글 카드·댓글 목록의 링크 썸네일은 공통 `LinkThumbnail`을 써서 로드 실패 시
  영역째 감추는데, 댓글 수정 폼(`CommentEditForm`)의 미리보기만 raw `<img>`를 직접
  렌더해 `onError` 폴백이 없었다. 외부 CDN이 핫링크를 차단하는 이미지(나무위키 등)를
  만나면 브라우저 기본 깨진 아이콘이 그대로 보였다. 다른 두 곳과 동일하게
  `LinkThumbnail`을 쓰도록 교체했다(`referrerPolicy="no-referrer"`·https 치환도
  함께 적용됨). (`CommentEditForm.tsx`)

  </details>

- `comment` 짧은 댓글도 태그·특수문자가 섞이면 원인 불명의 403으로 막히던 문제
  <details><summary>배경·구현</summary>

  기존 댓글 길이 제한(6,000바이트)을 훨씬 밑도는 짧은 댓글인데도 403 HTML이
  뜨는 재현 사례가 들어왔다. curl로 프로덕션에 직접 이분 탐색해보니 크기와
  무관했고, CloudFront WAF `AWSManagedRulesCommonRuleSet` > `CrossSiteScripting_BODY`
  룰의 오탐이었다 — `<META>` 태그 하나, 심지어
  `React에서 <Button onClick={x}>를 쓰면 됩니다` 같은 정상적인 개발 댓글까지
  XSS로 오판해 차단했다(CloudWatch
  `BlockedRequests` 지표로 확정). `POST /post`(게시글 등록)도 동일 조건에서
  막혀 댓글만의 문제가 아니었다.
  룰의 오탐이었다 — `<META>` 태그 하나, 심지어 `React에서 <Button onClick={x}>를 쓰면 됩니다` 같은 정상적인 개발 댓글까지 XSS로 오판해 차단했다(CloudWatch `BlockedRequests` 지표로 확정). `POST /post`(게시글 등록)도 동일 조건에서 막혀 댓글만의 문제가 아니었다.

  FE 전체에 `dangerouslySetInnerHTML`·마크다운 라이브러리·HTML sanitizer가 없어
  (댓글은 `MarkdownContent.tsx`가 HTML 문자열을 만들지 않는 자체 파서로 React
  엘리먼트를 직접 조립) 이 룰이 막던 실질 위험이 거의 없다고 보고, WAF의
  `CrossSiteScripting_BODY`만 Block에서 Count로 내렸다(`SizeRestrictions_BODY`
  등 나머지 룰은 그대로 유지 — 레포에 코드로 없는 수동 인프라 변경이라 코드
  배포와 무관하게 즉시 반영됨, `docs/DEPLOY.md`의 "CloudFront WAF" 절 참고).

  그와 별개로, WAF가 어떤 이유로든 앱보다 먼저 요청을 막았을 때(403 + 비-JSON
  HTML 응답 — 우리 앱의 403은 항상 JSON이라 이 조합은 WAF 차단의 안전한 신호로
  쓸 수 있다) 일반 "서버 오류가 발생했어요" 대신 전용 안내가 뜨도록 `EDGE_BLOCKED`
  에러 코드를 신설했다. 게시글 등록처럼 `meta.errorMessage`를 쓰는 mutation이
  이 원인을 삼키지 않도록, 전역 에러 핸들러에서 `errorMessage` 우선순위보다
  앞에 두었다.
  (`shared/config/error-code.ts`의 `EDGE_BLOCKED`, `shared/api/client.ts`,
  `shared/lib/react-query/config/queryClient.ts`, `docs/DECISIONS.md`
  2026-09-06 "크기가 아니라 WAF의 XSS 탐지 룰이 근본 원인이었다" 항목)

  </details>

- `common` PWA manifest 아이콘이 실제 파일 위치와 달라 404
  <details><summary>배경·구현</summary>

  `site.webmanifest`가 아이콘을 `/android-chrome-*.png`(루트)로 참조했는데 실제
  파일은 `public/favicons/` 아래에 있어 브라우저가 아이콘을 못 찾았다. 같은
  디렉토리의 `firebase-messaging-sw.js`는 이미 `/favicons/...`로 올바르게
  참조 중이라 그 경로에 맞춰 수정했다. (`public/favicons/site.webmanifest`)

  </details>

## [0.12.0] - 2026-08-13

### Added

- `comment` 작성 폼에 취소 버튼, 데스크톱에 플로팅 "댓글 작성" 버튼 추가
  <details><summary>배경·구현</summary>

  ① 답글·수정 폼과 달리 목록 맨 위에 항상 떠 있는 최상위 댓글 작성 폼에는 취소 버튼이
  없었다. 이 폼은 답글처럼 "닫히지" 않으므로, 입력 중이던 텍스트·이미지를 즉시 지우는
  용도의 취소 버튼을 추가했다(지울 내용이 있을 때만 노출, 확인 없이 즉시 초기화 — 답글
  취소와 동일한 방식). ② 데스크톱에서 댓글이 길어 작성 폼이 스크롤로 화면 밖에 나가면
  다시 위로 스크롤해야 했던 문제를, 게시글 목록의 `ScrollToTop`과 동일한 자리(우측 하단
  플로팅 버튼)에 "댓글 작성"으로 이동하는 버튼을 추가해 해결했다. 두 컴포넌트는 쓰이는
  페이지가 겹치지 않아(`ScrollToTop`은 상세 페이지에서 꺼짐) 자리 충돌이 없다. 클릭하면
  스크롤만 하지 않고 텍스트영역까지 포커스돼 바로 타이핑할 수 있다(포커스는
  `CommentForm`에 `forwardRef`+`useImperativeHandle`로 노출, `preventScroll: true`로
  브라우저 자동 스크롤과 충돌하지 않게 했다). ③ 댓글 미리보기가 입력 즉시 항상 펼쳐져
  화면을 많이 차지하던 것을 모바일 기본 접힘으로 바꾸고(데스크톱은 기존처럼 항상 펼침),
  펼침/접힘 토글 버튼도 헤더 줄 전체가 클릭 영역이 되도록 넓혔다.
  (`features/comment/create/ui/CommentForm.tsx`,
  `features/comment/create/ui/ScrollToCommentFormButton.tsx`(신규),
  `widgets/comment/comment-list/ui/CommentList.tsx`, `widgets/layout/navbar/ui/Navbar.tsx`,
  `shared/config/texts.ts`)

  </details>

- `auth` 회원가입 화면 이메일·닉네임 실시간 중복확인
  <details><summary>배경·구현</summary>

  지금까지는 가입 버튼을 눌러 409를 받아야만 중복 여부를 알 수 있었다. 마이페이지 닉네임
  중복확인(`useUpdateProfile.ts`)과 동일한 디바운스(500ms)·취소·상태머신 형태를 이메일에도
  함께 쓸 수 있도록 일반화한 `useAvailabilityCheck` 훅을 새로 만들어 적용했다. 형식이
  유효한 값에만 서버를 호출하고, 조회 자체가 실패(네트워크 오류 등)하면 확인됐다고 속이지
  않고 조용히 idle로 남아 제출을 막지 않는다 — 실제 중복이면 제출 시점에 서버가 409로 다시
  막아준다. 이메일 중복 시에는 로그인 페이지 링크를 함께 보여준다. BE에 새로 생긴
  `GET /auth/email-availability`와, 비로그인도 쓸 수 있게 확장된
  `GET /auth/account/nickname-availability`가 필요하다(BE `docs/VERSION-COMPATIBILITY.md`
  참고). (`features/auth/signup/hooks/useAvailabilityCheck.ts`,
  `features/auth/signup/hooks/useSignUp.ts`, `features/auth/signup/ui/SignUpForm.tsx`,
  `entities/user/api/auth.api.ts`)

  </details>

- `bookmark` 폴더 목록에 "최근 저장한 폴더" 상단 구획 추가 (split menu 방식)
  <details><summary>배경·구현</summary>

  폴더 순서를 고정할지 최근 사용순으로 올릴지 반복되던 고민에 대한 결론. [Sears &
  Shneiderman(1994)](https://dl.acm.org/doi/10.1145/174630.174632)의 split menu
  연구를 따라, 최근에 저장한 폴더 최대 3개를 상단에 별도로 보여주되 아래 본 목록
  순서는 절대 바꾸지 않는다(위치가 계속 바뀌는 전체 재정렬 방식은 [MS Office의
  개인화 메뉴](https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-end-of-personalized-menus)가
  예측 불가능성 때문에 Office 12(2007)에서 기본값이 꺼진 선례가 있어 기각). 상단
  폴더도 아래 본 목록에서 빼지 않고 그대로 중복 표시한다 — 빼면 본 목록의 나머지 위치가
  흔들려 공간기억이 깨지기 때문. 노출 조건은 폴더 6개 이상 + 저장 이력 있는 폴더 3개
  이상일 때만, 모달이 열려 있는 동안(또는 페이지 방문 동안)은 스냅샷을 고정해 재정렬
  애니메이션이 없다. BE의 새 `FolderResponse.lastUsedAt` 필드가 필요하다(BE
  `docs/VERSION-COMPATIBILITY.md` 확인 불필요 — nullable 추가 필드라 하위 호환, 구
  BE에서도 상단 구획만 안 뜰 뿐 정상 동작). (`entities/folder/model/useRecentFolders.ts`,
  `features/post/bookmark/ui/FolderSelector.tsx`,
  `widgets/bookmark/folder-tree/FolderTree.tsx`,
  `widgets/bookmark/folder-tree/MobileFolderList.tsx`)

  </details>

- `post` 등록 폼에서 북마크 폴더 선택 가능
  <details><summary>배경·구현</summary>

  지금까지는 등록 후 목록에서 방금 올린 카드를 찾아 북마크 버튼을 다시 눌러야 했다.
  카테고리 선택 아래에 북마크 필드를 추가해, 탭하면 `FolderSelector`와 같은
  모달(데스크탑)/바텀시트(모바일) 선택기가 뜬다. 다만 여기는 "지연 선택"이다 — 행을
  탭해도 즉시 저장하지 않고 폼의 `bookmark`/`folderIds` 값만 바꾸고, 실제 북마크 생성은
  등록 제출(`POST /post`) 한 번에 BE가 함께 처리한다 — BE API 의존, BE 먼저 배포 필요
  (구 BE는 `bookmark`/`folderIds` 필드를 조용히 무시해 등록은 되지만 북마크만 안 생김).
  모바일 바텀시트 전환 className은 `FolderSelector`에서 처음 쓰인 패턴을
  `SheetDialogContent` 공통 컴포넌트로 추출해 재사용했다. 아무 폴더도 고르지 않으면
  기존과 동일하게 북마크가 생기지 않는다. (`features/post/create/ui/BookmarkFolderPicker.tsx`
  (신규), `shared/ui/elements/modal/SheetDialogContent.tsx`(신규),
  `features/post/bookmark/ui/FolderSelector.tsx`, `features/post/create/hooks/useCreatePost.ts`,
  `entities/post/model/post.schema.ts`, `entities/post/api/post.queries.ts`)

  </details>

### Fixed

- `bookmark` "최근 저장한 폴더"와 본 목록 사이 구분선이 없어 붙어 보이던 문제
  <details><summary>배경·구현</summary>

  최근 구획 시작 지점(라벨 위)에만 구분선이 있고 끝나는 지점엔 없어서, 같은 폴더가 최근
  구획 마지막 행과 본 목록 첫 행으로 바로 이어져 목록이 깨진 것처럼 보였다. 데스크탑
  사이드바(`FolderTree.tsx`)엔 이미 있던 닫는 구분선을 `FolderSelector.tsx`에 똑같이
  추가했다 — 이 컴포넌트는 모바일 바텀시트·데스크탑 모달이 같은 리스트 마크업을 공유해
  두 환경 모두에 영향이 있었다. (`features/post/bookmark/ui/FolderSelector.tsx`)

  </details>

- `post` 등록 직후 피드로 이동해도 새 글이 바로 보이지 않던 문제
  <details><summary>배경·구현</summary>

  `useCreatePost.onSubmit`이 등록 요청 완료를 기다리지 않고 즉시 피드로 `navigate`하는
  기존 fire-and-forget 흐름 자체는 유지했지만, 그 타이밍 때문에 피드의 목록 쿼리가 등록
  요청과 경합해 완료 전 상태로 먼저 fetch를 시작해버렸다. `invalidateQueries`만으로는
  이미 그 시점에 진행 중이던 fetch가 나중에 응답하며 갱신을 덮어써 새 글이 다시 사라지는
  경우까지 있었다 — 등록 응답이 오면 진행 중이던 목록 fetch를 먼저 취소한 뒤, 필터
  없는(전체) 목록 캐시 맨 앞에 새 글을 직접 꽂아 넣도록 했다. 페이지네이션 오프셋이
  실제로는 한 칸씩 밀리므로, 이미 캐시된 다음 페이지들과 겹쳐 카드가 중복 렌더링되는 걸
  막기 위해 page 0만 남기고 나머지는 버려 다음 스크롤 때 서버에서 새로 받는다.
  (`entities/post/api/post.queries.ts`, `entities/post/model/post.schema.ts`)

  </details>

- `post` 모바일 좁은 화면에서 등록/수정 진행 배지가 두 줄로 개행되던 문제
  <details><summary>배경·구현</summary>

  상단바 우측(메뉴·검색·테마·프로필과 한 줄)에 공간이 부족한 게 근본 원인이라
  `whitespace-nowrap`만 붙이면 이번엔 가로 스크롤이 생겼다. 상단바 배지를 없애고, 같은
  진행 상태를 완료 토스트(`포스트를 생성했어요.` 등)와 동일한 자리인 하단 토스트로 옮겨
  폭 제약 자체를 없앴다 — 진행→완료가 한 자리에서 이어진다(위치 정책은
  `shared/lib/toast/toast.ts` 참고, 알림 종류로 위치를 정하므로 데스크톱도 동일하게
  이동). 500ms 지연·400ms 최소 노출 등 기존 타이밍은 그대로 유지했다.
  (`shared/ui/elements/PostMutationLoadingToast.tsx`(신규, `PostMutationLoadingBadge.tsx`
  대체), `shared/lib/toast/toast.ts`, `app/App.tsx`, `widgets/layout/navbar/ui/Navbar.tsx`)

  </details>

- `comment` 이미지 첨부 시 취소·등록 버튼이 허공에 떠 보이던 문제
  <details><summary>배경·구현</summary>

  댓글 작성/수정 폼에서 이미지 첨부 영역과 버튼을 한 줄
  (`flex items-center justify-between`)에 나란히 두고 있어, 썸네일이 쌓여 그 줄의 높이가
  늘어나면 버튼만 수직 중앙에 그대로 남아 어색해 보였다. 이미지 첨부/미리보기를 독립된
  줄로, 취소·등록 버튼을 그 아래 우측 정렬된 별도 줄로 분리해 이미지 개수와 무관하게
  버튼 위치가 항상 고정되도록 했다. `ImageAttachmentField` 자체는 그대로 두고 두 폼의
  바깥 wrapper만 손봤다. (`features/comment/create/ui/CommentForm.tsx`,
  `features/comment/update/ui/CommentEditForm.tsx`)

  </details>

- `shared` 모바일 폭에서 폼 검증 메시지가 라벨과 겹쳐 잘려 보이던 문제
  <details><summary>배경·구현</summary>

  회원가입·로그인·마이페이지 닉네임 수정 폼에서, `FormField.tsx`의 `messageInLabelRow`
  레이아웃(라벨 옆에 `truncate` 적용)이 원인이었다. 라벨과 줄을 나누지 않고 입력창 아래
  자기 줄 전체를 쓰는 기존 레이아웃(줄바꿈 허용, `truncate` 없음)으로 통일해 잘림을
  없앴다. 메시지가 나타날 때 아래 요소가 밀리는 레이아웃 시프트는 감수하기로 했다 —
  자리를 상시 확보해두면 평소(메시지 없음) 상태에서 폼 전체 간격이 넓어 보이는 부작용이
  더 크다고 판단했다. `messageInLabelRow` prop과 분기는 이 변경으로 호출처가 0곳이 돼
  함께 제거했다. (`shared/ui/elements/form/_base/FormField.tsx`,
  `shared/ui/elements/form/FormInput.tsx`, `shared/ui/elements/form/FormInputPassword.tsx`,
  `features/auth/profile/ui/UpdateProfileForm.tsx`)

  </details>

- `auth` 회원가입 닉네임 입력이 uncontrolled로 시작해 경고가 뜨던 문제
  <details><summary>배경·구현</summary>

  `useSignUp.ts`의 기본값 객체가 실제 필드명(`nickname`)이 아닌 `name`이라는 존재하지
  않는 키를 쓰고 있어, 닉네임 입력이 `undefined`로 시작한 뒤 첫 타이핑에서야 값이 생겨
  controlled로 바뀌었다(React 경고 발생). (`features/auth/signup/hooks/useSignUp.ts`)

  </details>

- `auth` 가입 실패 시 서버발 에러가 아니면 아무 안내 없이 조용히 실패하던 문제
  <details><summary>배경·구현</summary>

  네트워크 오류·CORS 실패 등의 경우, `useCreateAccountMutation`의 `onError`가
  `error instanceof ApiError` 안에서만 토스트를 띄우고 있어, 그 조건을 벗어나는 에러는
  버튼만 다시 활성화되고 사용자에게 아무 피드백이 없었다. `useUpdateAccountMutation`과
  동일하게 `else` 분기로 일반 실패 메시지를 띄우도록 맞췄다.
  (`entities/user/api/auth.queries.ts`)

  </details>

- `auth` 닉네임이 중복인데 "이메일 중복" 문구가 잘못 뜨던 문제
  <details><summary>배경·구현</summary>

  BE가 이메일·닉네임 중복을 모두 같은 409(`DUPLICATE_MEMBER`)로 응답해 FE가 status만
  보고 무조건 "이메일로 가입된 계정이 존재해요" 문구를 띄우고 있었다. BE가 새로 분리한
  `DUPLICATE_NICKNAME` 코드를 받아 이미 있던 `TEXTS.messages.error.nicknameDuplicate`
  문구로 분기했다(BE `docs/VERSION-COMPATIBILITY.md` 참고). (`shared/config/error-code.ts`,
  `entities/user/api/auth.queries.ts`)

  </details>

- `comment` 작성창이 있는 화면에서 가로 스크롤이 생기던 문제
  <details><summary>배경·구현</summary>

  모바일 좁은 화면에서, 댓글 드래그앤드롭 판정 영역이 점선 박스보다 사방
  72px(`-inset-18`) 넓은 채로 `pointer-events`만 토글되며 평소에도 항상 DOM에 남아 있어,
  페이지 좌우 패딩을 넘어서는 약 56px가 뷰포트 밖으로 삐져나와 문서 전체를 가로로 밀었다.
  이 오버레이를 드래그 중일 때만 마운트하고, 확장 폭도 좌우는 페이지 패딩만큼으로
  좁혔다(상하 72px는 유지). 함께 `CommentItem`의 작성자 영역에 `min-w-0`·닉네임 말줄임을
  추가하고 이미지 첨부 미리보기가 긴 이미지로 인해 폭을 밀어내지 않도록 손봤다.
  (`features/comment/create/ui/CommentForm.tsx`,
  `features/comment/update/ui/CommentEditForm.tsx`,
  `widgets/comment/comment-list/ui/CommentItem.tsx`,
  `shared/ui/elements/ImageAttachmentField.tsx`)

  </details>

- `post` URL 앞뒤·중간 공백이 있으면 등록·수정이 항상 실패하던 문제
  <details><summary>배경·구현</summary>

  입력 검증에 쓰는 `zod .url()`(브라우저 `URL` 파서)은 공백이 섞인 URL도 유효하다고
  통과시키지만, BE `SafeUrlValidator`가 쓰는 `java.net.URI`는 RFC 2396 엄격 파서라 생
  공백을 거부해 400으로 떨어졌다. 제출 직전 브라우저 표준과 동일한 방식으로 URL을
  정리한다 — 앞뒤 공백 제거, 내부 공백은 `%20`으로 인코딩. 한글 등 다른 문자는 그대로
  둔다(전면 정규화는 한글 URL을 퍼센트 인코딩으로 바꿔 저장값을 훼손하므로 채택하지
  않음). (`shared/utils/url.util.ts`, `features/post/create/hooks/useCreatePost.ts`,
  `features/post/update/hooks/useUpdatePost.ts`)

  </details>

- `shared` 닉네임 입력 중 ESC를 누르면 모달과 함께 배경 페이지도 이동하던 문제
  <details><summary>배경·구현</summary>

  프로필 수정 모달에서 닉네임 입력 중(특히 한글 조합 중) ESC를 누르면 모달만 닫히지
  않고 배경 페이지까지 뒤로 이동해버렸다. 마이페이지·로그인 모달·이미지뷰어·모바일
  사이드바는 열림 상태를 히스토리 엔트리로 관리해 닫을 때 `navigate(-1)`을 한 번만
  보내야 하는데(`useHistoryOverlay`), 이 `navigate(-1)`은 popstate를 거쳐 비동기로
  반영된다. 그 사이에 ESC keydown이 한 번 더 들어오면(한글 등 IME 조합 중 ESC는
  브라우저가 조합 취소분과 실제 Escape로 keydown을 두 번 보낼 수 있다) 아직 갱신되지
  않은 `isOpen` 가드를 통과해 `navigate(-1)`이 두 번 나가 히스토리를 한 칸 더 소모했다.
  엔트리별로 back을 한 번만 보내도록 래치를 추가하고, 공유 `Dialog` 컴포넌트에는 IME
  조합 중 ESC를 무시하는 가드를 더해 원인 자체도 함께 줄였다. 이 컴포넌트를 쓰는 모든
  다이얼로그(마이페이지·로그인모달·이미지뷰어·Alert)에 한 번에 적용된다.
  (`shared/hooks/useHistoryOverlay.ts`, `shared/ui/atoms/dialog.tsx`)

  </details>

- `user` 프로필 변경이 댓글·게시글의 작성자 정보에 반영되지 않던 문제
  <details><summary>배경·구현</summary>

  프로필(닉네임·이미지) 변경이 포스트 상세의 댓글·글 작성자 정보와 북마크 폴더 게시글
  카드에 반영되지 않았다. 댓글·게시글의 작성자 정보는 BE가 매 요청 `members` 테이블에서
  조인해 내려주므로(스냅샷 컬럼도 서버 캐시도 없음) 재조회만 하면 바로 최신값이 온다.
  그런데 프로필 저장 성공 핸들러(`handleAccountUpdateSuccess`)가 포스트 목록 캐시만
  무효화하고 있어, 댓글 목록·포스트 상세·폴더별 게시글 캐시는 갱신되지 않은 채로 남아
  새로고침 전까지 이전 닉네임·아바타가 계속 보였다. 작성자 정보가 비정규화되어 실려오는
  캐시(포스트 목록+상세, 댓글 목록, 폴더별 게시글)를 모두 무효화하도록 변경했다.
  (`entities/user/api/auth.keys.ts`)

  </details>

- `shared` 비활성 버튼 이유 툴팁이 Tab 포커스로 열리고 깜빡이던 문제
  <details><summary>배경·구현</summary>

  프로필 수정에서 닉네임을 입력하는 동안 저장 버튼 위에 마우스를 올려두면 겪는
  문제였다. 포커스로도 여는 것은 Radix `TooltipTrigger`에 `onFocus` 오픈이 내장돼 있어
  트리거를 포커스 불가(`tabIndex={-1}`)로 만드는 것 외엔 끄는 방법이 없었다(키보드만
  쓰는 사용자는 이 이유를 볼 수 없게 되는 트레이드오프를 감수). 깜빡임은 Radix가 아니라
  우리 조건부 렌더(`content` 유무로 `<TooltipContent>`를 언마운트→재마운트)가
  원인이었다 — 열려 있는 동안은 호버 시작 시점의 문구를 고정하고, 닫힌 뒤에만 최신값을
  반영한다. 추가로, 마우스가 저장 버튼 위에 그대로 있어도 같은 폼의 다른 입력창(닉네임
  등)에 실제로 타이핑하면(포커스 이탈이 아니라 입력(`input`) 이벤트 기준) 즉시 닫는다.
  시간이 지난다고 저절로 다시 뜨지는 않는다 — Radix는 포인터가 트리거를 실제로
  벗어났다가 다시 들어와야만 "새로 진입"으로 인식해 다시 열기를 시도하므로, 마우스를
  뺐다가 다시 넣어야만 최신 이유로 다시 뜬다. (`shared/ui/elements/TooltipWrapper.tsx`)

  </details>

- `shared` 비활성 버튼에 `cursor-not-allowed`가 일부 상황에서 안 뜨던 문제
  <details><summary>배경·구현</summary>

  게시글 등록·수정, 댓글 등록·수정, 프로필 저장 버튼 5곳 모두에서 발생했다. 버튼이
  `disabled:pointer-events-none`이라 비활성 버튼 자신은 마우스 이벤트를 안 받고 부모
  `TooltipWrapper`의 `<span>`으로 넘기는데, 그 span의 `cursor-not-allowed`가 "보여줄
  이유(`content`)가 있는지"로 결정되고 있었다. 로딩 중·형식 오류 등 의도적으로 툴팁을
  안 보여주는 disabled 사유에서는 `content`가 `null`이라 커서도 같이 빠졌다. `disabled`
  여부를 별도 필수 prop으로 받아 커서는 그 값으로, 툴팁 표시 여부는 `content`로
  독립적으로 판단하도록 분리했다. (`shared/ui/elements/TooltipWrapper.tsx`, 호출부 5곳)

  </details>

- `shared` 모바일에서 이탈 확인 모달이 사이드바·댓글 입력바 뒤에 가려지던 문제
  <details><summary>배경·구현</summary>

  사이드바 드로어나 댓글 입력바가 열린 상태로 페이지를 벗어나려 하면 이탈 확인 모달이
  그 뒤에 가려 버튼을 누를 수 없었다. 공용 `Dialog`(오버레이·콘텐츠 모두 `z-50`)가
  사이드바 드로어(`z-55`/`z-60`)나 확장된 `MobileCommentBar`(`z-55`)보다 낮아 역전돼
  있었다. `Dialog`를 고정 UI 사다리 최상단인 `z-70`으로 올리고, `Dialog` 안에서 함께
  쓰이는 포털 팝오버(tooltip·dropdown-menu·select, 기존 `z-50`)는 `z-80`으로 올려 모달
  뒤에 숨지 않도록 했다. 사다리 전체는 `.claude/skills/responsive-ux/SKILL.md`에
  문서화했다. (`shared/ui/atoms/dialog.tsx`, `shared/ui/atoms/tooltip.tsx`,
  `shared/ui/atoms/dropdown-menu.tsx`, `shared/ui/atoms/select.tsx`)

  </details>

### Changed

- `auth` 프로필 저장 버튼의 중복 안내 툴팁 제거
  <details><summary>배경·구현</summary>

  "닉네임을 확인하고 있어요." 툴팁 제거 — 닉네임 형식(정규식) 오류는 이미 입력창 라벨
  옆에 에러 메시지로 보이고, 서버 중복 확인이 300ms 넘게 걸릴 때만 같은 자리에 "확인
  중..."이 뜬다(`nicknameStatusText`, 빨리 끝나는 대부분의 경우엔 깜빡이지 않도록 지연
  표시). 툴팁이 같은 정보를 중복으로 알려주고 있어 제거하고, "변경한 내용이 없어요."만
  남겼다. (`features/auth/profile/ui/UpdateProfileForm.tsx`, `shared/config/texts.ts`)

  </details>

- `comment` 수정 폼을 등록 폼과 동일한 구조로 전면 마이그레이션
  <details><summary>배경·구현</summary>

  `CommentEditForm`을 댓글 등록 폼과 동일한 구조(React Hook Form + `<form>`)로
  전환했다. 기존엔 유일하게 `useState` + 수동 dirty 비교 + `<div>`(진짜 `<form>` 아님)
  구조라, ⌘+Enter 저장이 없었고 TooltipWrapper의 "같은 폼의 다른 입력창에 타이핑하면
  억제" 로직도 `closest('form')`이 못 찾아 적용되지 않았다. `CommentItem.tsx`가 훅을
  호출해 12개 prop을 내려주던 구조도 답글 폼처럼 컴포넌트가 자기 훅을 직접 호출하는
  형태로 바꿔, `isEditing` 로컬 boolean만 남기고 나머지는 마운트가 곧 "편집 시작"이
  되도록 정리했다. 이제 댓글 등록과 완전히 동일하게 ⌘+Enter(및 그 힌트 뱃지), 빈 상태
  스크롤+테두리 강조, hover 이유 툴팁이 전부 동작한다.
  (`features/comment/update/hooks/useUpdateComment.ts`,
  `features/comment/update/ui/CommentEditForm.tsx`,
  `widgets/comment/comment-list/ui/CommentItem.tsx`)

  </details>

- `comment` 모바일 화면의 답글 들여쓰기·터치 타깃 개선
  <details><summary>배경·구현</summary>

  답글이 `ml-8` 고정 들여쓰기로 좁은 화면에서 본문 폭이 지나치게 좁아지던 문제를
  모바일에서 들여쓰기를 줄이고 좌측 스레드 라인으로 대체해 완화했다(데스크톱은 기존
  그대로). 좋아요·답글·수정·삭제 버튼이 44px 터치 타깃 기준에 못 미치던 것도
  모바일에서만 히트 영역을 넓혔다. 겸사겸사 `useIsMobile`의 초기값이 항상 `false`로
  시작해 모바일에서 첫 렌더에 데스크톱 UI가 잠깐 보였다 바뀌던 깜빡임도 lazy init으로
  없앴다. (`widgets/comment/comment-list/ui/CommentItem.tsx`,
  `features/comment/like/ui/LikeCommentButton.tsx`, `shared/hooks/useIsMobile.ts`)

  </details>

- `comment` 게시글 상세 댓글 섹션의 중복 헤딩·구분선 정리
  <details><summary>배경·구현</summary>

  페이지가 그리는 영어 `Comments` 헤딩과 댓글 위젯이 그리는 한글 `댓글` 헤딩이 같은
  자리에 겹쳐 렌더돼 라벨이 두 줄로 보였다. 위젯이 자기 섹션 헤딩을 소유하도록 페이지
  쪽 헤딩을 제거하고, 남은 헤딩에 답글·삭제된 톰스톤까지 포함한 전체 댓글 수를
  표시했다. 댓글 작성 폼 아래 구분선은 폼이 실제로 렌더되는 데스크톱에서만 그려지도록
  해, 폼이 하단 sticky 바로 빠지는 모바일에서 헤딩 바로 밑에 혼자 남던 구분선도 함께
  없앴다. (`pages/post/PostDetailPage.tsx`, `widgets/comment/comment-list/ui/CommentList.tsx`,
  `shared/config/texts.ts`)

  </details>

## [0.11.0] - 2026-08-10

### Added

- 게시글 등록/수정, 댓글·답글 작성, 댓글 수정 중 저장하지 않은 내용이 있으면 페이지 이탈
  시 확인 모달로 한 번 막는다. 새로고침·탭 닫기는 브라우저 기본 경고를 띄운다. 상세 페이지에
  댓글·답글·수정 폼이 동시에 여러 개 열릴 수 있어 react-router가 지원하는 단일 blocker로는
  폼별 감지가 불가능했고, 전역 dirty 키 레지스트리(`useUnsavedChanges`) + 루트 레이아웃의
  단일 가드(`useUnsavedChangesGuard`) 구조로 해결했다.
  (`shared/store/unsavedChanges.store.ts`, `shared/hooks/useUnsavedChanges*.ts`)
- **댓글 이미지 첨부 버튼·드래그앤드롭 추가, 최대 5장 제한** — 기존엔 텍스트영역에
  붙여넣기(Ctrl+V)로만 이미지를 첨부할 수 있어 모바일에서는 사실상 쓸 수 없었다.
  붙여넣기·첨부 버튼·드래그앤드롭 세 경로가 모두 같은 진입점(`addFiles`)을 거치며 개수·
  크기 검증을 공유한다. (`shared/hooks/useImageAttachments.ts`(구 `useImagePaste.ts`),
  `shared/ui/elements/ImageAttachmentField.tsx`, `entities/comment/config/const.ts`)
- **라이트박스(이미지 확대 뷰어)에 이전/다음 네비게이션 추가** — 댓글에 이미지가 여러 장
  붙을 수 있게 된 만큼, 화살표 버튼·좌우 방향키·`N / M` 인디케이터로 한 댓글 안의 이미지를
  넘겨 볼 수 있다. 아바타 확대 등 기존 단일 이미지 호출부는 그대로 동작한다(하위호환).
  (`shared/ui/elements/modal/image-viewer/imageViewer.store.ts`,
  `shared/ui/elements/modal/image-viewer/ImageViewer.tsx`,
  `shared/ui/elements/MarkdownContent.tsx`)
- **비활성 버튼에 이유 툴팁 표시** — 게시글 수정, 프로필 저장, 댓글 등록/수정 버튼이 눌리지
  않을 때 마우스 호버 시 이유(변경 없음, 닉네임 확인 중, 내용 없음 등)를 알려준다. 유효성
  에러처럼 이미 화면에 표시되는 이유는 중복이라 제외했다. `TooltipWrapper`는
  `pointerType === 'touch'`일 때 Radix 툴팁이 열리지 않는 한계가 있어, 터치로 탭하면 같은
  이유를 토스트로 대신 보여준다. (`shared/ui/elements/TooltipWrapper.tsx`,
  `features/post/update/ui/UpdatePostForm.tsx`,
  `features/auth/profile/ui/UpdateProfileForm.tsx`,
  `features/comment/update/ui/CommentEditForm.tsx`)

### Changed

- **댓글 이미지 붙여넣기 크기 상한을 10MB에서 30MB(SVG·GIF는 15MB)로 통일** — 붙여넣기만
  10MB 하드코딩이었고 실제 업로드 검증(`resizeImage.ts`)은 30/15MB라 기준이 어긋나 있었다.
  전 경로가 `getImageFileSizeError()` 하나로 통일된다. 어차피 클라이언트에서 1024px 이하로
  리사이즈해 업로드하므로 저장 용량에는 영향이 없다. (`shared/hooks/useImageAttachments.ts`)
- **댓글 이미지 화질 상한을 1024px에서 1600px로 상향** — 원본을 저장하지 않는 구조라 이
  값이 곧 영구 화질 상한이다. 레티나 디스플레이에서 라이트박스로 확대했을 때 스크린샷
  속 글자를 더 잘 알아볼 수 있게 됐다. (`entities/upload/api/upload.api.ts`)
- **댓글 등록 버튼을 빈 상태에서 비활성으로 전환** — 기존엔 빈 상태로 눌러야만 에러가 뜨고,
  그 메시지가 텍스트영역 아래 끼어들며 레이아웃이 밀렸다(이미지 첨부 시 사라지며 다시 밀림).
  버튼을 처음부터 비활성으로 두고 이유는 툴팁/토스트로 보여주는 방식으로 바꿔 시프트를
  없앴다. ⌘+Enter 제출 경로의 검증 실패도 `setError` 대신 토스트로 알리며, 메인 댓글창인지
  답글창인지에 따라 문구가 갈린다(토스트가 화면 상단에 고정돼 있어 텍스트영역 위치와
  분리돼 있다). 그래서 실패 시 그 폼을 화면 중앙으로 스크롤하고 텍스트영역 테두리를 잠깐
  `aria-invalid` 상태(회색→destructive)로 바꿔, 답글창이 여러 개 열려 있어도 정확히 어느 폼인지
  보여준다.
  (`features/comment/create/ui/CommentForm.tsx`,
  `features/comment/create/hooks/useCreateComment.ts`)

### Fixed

- **게시글 수정 버튼을 누르면 로딩 표시가 나타났다가 거의 즉시 사라져 화면이 깜빡이던
  문제** — 낙관적 업데이트 때문이 아니라, 같은 수정 동작에 지연·최소 노출 시간이 서로
  다른(또는 없는) 인디케이터 3개가 동시에 반응하고 있었다. 네비바 배지와 수정 폼 버튼은
  아무 타이밍 가드가 없어 API 응답이 빠르면 그대로 번쩍였고, 카드 오버레이는 지연만 있고
  최소 노출이 없어 응답이 딱 지연 시간대(300~600ms)일 때만 짧게 스쳤다. 수정 폼은 제출
  즉시 목록으로 벗어나므로 pending UI(버튼 라벨·입력 disabled)를 아예 없앴고, 네비바
  배지와 카드 오버레이는 지연·최소 노출을 공용 상수(`LOADING_INDICATOR_DELAY_MS`,
  `LOADING_INDICATOR_MIN_DURATION_MS`)로 통일했다. 배지는 최소 노출 구간 막바지에
  등록/수정 카운트가 엇갈려 라벨이 뒤바뀌는 것을 막기 위해 진행 중 라벨을 고정(latch)했다.
  (`shared/config/const.ts`, `shared/ui/elements/PostMutationLoadingBadge.tsx`,
  `widgets/post/post-card/hooks/usePostCard.ts`, `features/post/update/ui/UpdatePostForm.tsx`)
- **게시글 수정이 끝나도 등록과 달리 완료를 알려주는 토스트가 없던 문제** — 수정은
  제출 즉시 목록으로 이탈하는 논블로킹 설계라(커밋 917a578, URL 변경 시 재크롤링·AI
  재분석으로 응답이 늦어질 수 있어 폼에서 기다리지 않는다) 네비바 배지가 유일한 진행
  신호였는데, 라우터 트리에서 목록 화면이 수정 화면과 다른 레이아웃 그룹(`AppShellLayout`
  인스턴스가 별도)에 속해 화면 전환 시 배지가 통째로 리마운트되며 짧은 요청은 놓칠 수
  있었다. `useCreatePostMutation`에는 이미 있던 `meta.successMessage` 패턴을 그대로
  적용해 `useUpdatePostMutation`에도 완료 토스트를 추가했다 — 토스트는 라우터 트리
  바깥(`App.tsx`)에 떠 있어 이 리마운트와 무관하게 항상 뜬다.
  (`entities/post/api/post.queries.ts`, `shared/config/texts.ts`)
- **댓글 답글 작성·프로필 저장에서도 게시글 수정과 같은 패턴의 깜빡임이 있던 문제** —
  둘 다 같은 논블로킹 설계(제출 즉시 폼/모달을 닫고 백그라운드로 요청)를 쓰는데, 닫히는
  화면 쪽에 남아있던 pending 라벨·disabled 처리가 잠깐 그려졌다 사라졌다. 답글 폼은
  `onSuccess`로 접히는 게 곧 폼 언마운트라 `전송 중...` 라벨이 노출됐고, 프로필 모달은
  Radix Dialog의 종료 애니메이션(약 150~300ms) 동안 폼이 DOM에 남아 있어 `저장 중...`이
  더 뚜렷하게 보였다. 두 곳 다 pending UI를 제거했다. 같은 원인으로 게시글 등록 폼에도
  동일한 죽은 분기가 있었는데(`replace` 네비게이션이 동기 처리라 현재는 화면에 안
  보이지만) 같은 이유로 함께 제거했다. (`features/comment/create/ui/CommentForm.tsx`,
  `features/comment/create/hooks/useCreateComment.ts`,
  `features/auth/profile/ui/UpdateProfileForm.tsx`, `features/post/create/ui/CreatePostForm.tsx`)
- **네비바 배지가 게시글 등록·수정이 흔한 응답 속도(약 300~500ms)일 때 목록 화면 도착
  직후 잠깐 떴다 사라지는 것처럼 보이던 문제** — 배지는 지연 없이 즉시 뜨도록 만들어져
  있었는데, 이는 당시 배지가 유일한 완료 확인 수단이었기 때문이다. 이번에 등록·수정 모두
  완료 토스트를 갖추면서 그 전제가 사라졌다. 처음엔 카드 오버레이와 같은 300ms 지연을
  넣었는데, 이 값이 흔한 요청 속도의 경계값과 겹쳐 여전히 눈에 띄어 500ms로 늘렸다(카드
  오버레이는 목적이 달라 300ms 그대로 유지, 그래서 공용 상수 대신 배지 전용
  `BADGE_DELAY_MS`를 뒀다). 참고로 수정 화면 자체도 목록과 다른 라우터 레이아웃
  그룹이라 화면 전환마다 배지가 리마운트되는데(격리된 재현 테스트로 확인: 인스턴스가
  매번 새로 생성됨), 그 덕에 지연은 이미 "목록 도착 시점" 기준으로 정확히 재고 있었다 —
  문제는 기준 시점이 아니라 임계값 자체였다. 500ms를 넘는 요청만 뜬 뒤 최소 400ms
  유지된다. (`shared/ui/elements/PostMutationLoadingBadge.tsx`)
- **모바일 사이드바 드로어가 열린 상태에서 로그인 없이 보호된 메뉴(북마크 등)를 누르면,
  로그인 모달이 뜨자마자 자기 스스로 닫혀버리던 문제** — 메뉴 클릭 핸들러가 드로어를
  닫는 `navigate(-1)`(비동기)과 로그인 모달을 여는 `navigate(push)`(동기)를 같은 틱에
  연달아 호출하고 있었다. 동기 push가 먼저 반영된 뒤 뒤늦게 처리된 비동기 `-1`이 방금
  push한 로그인모달 엔트리를 엉뚱하게 pop해, 모달이 열리자마자 닫히는 것처럼 보였다.
  두 네비게이션 모두 새 위치로 이동하므로 드로어는 어차피 자연히 닫혀 — 레이스를 만드는
  드로어의 `navigate(-1)` 호출을 제거했다. (`widgets/layout/sidebar/ui/Sidebar.tsx`)
- **마우스 뒤로가기(옆면) 버튼을 한 번만 눌러도 모달이 닫히면서 페이지가 예상보다 더
  멀리 이동해버리던 문제** — 그 클릭이 브라우저 내비게이션뿐 아니라 페이지에도
  `pointerdown` 이벤트를 발생시키는데, 클릭 좌표가 다이얼로그 바깥이라 Radix Dialog의
  "바깥 클릭 시 닫기"가 이를 오인해 `navigate(-1)`을 먼저 실행했다. 그 직후 브라우저의
  실제 back navigation이 또 한 번 겹쳐, 클릭 한 번이 히스토리를 두 단계 소모했다.
  공유 `Dialog` 컴포넌트에서 뒤로가기/앞으로가기 버튼(`button === 3 || 4`)으로 인한
  바깥 클릭은 무시하도록 고쳐, 이 컴포넌트를 쓰는 모든 다이얼로그(Alert·이미지뷰어·
  마이페이지·로그인모달)에 한 번에 적용된다. (`shared/ui/atoms/dialog.tsx`)
- **삭제 확인 등 Alert/Confirm 모달을 띄운 채 뒤로가기를 누르면, 모달은 열린 채로 배경
  페이지만 다른 곳으로 바뀌던 문제** — Alert/Confirm은 의도적으로 히스토리에 묶지 않았는데
  (아래 Changed 항목 참고), 그 결과 어떤 네비게이션에도 반응하지 않게 됐다. 상세페이지에서
  삭제 확인을 띄우고 뒤로가기를 누르면 목록 페이지가 배경으로 바뀐 채 모달만 계속 떠 있는
  형태로 재현됐다. 모달이 열렸던 경로를 벗어나면(pathname 변경) 취소로 간주해 닫도록
  고쳤다. (`shared/ui/elements/modal/alert/Alert.tsx`)
- **위 수정 이후에도 삭제 확인 등 Alert/Confirm이 열린 채로 뒤로가기를 누르면 모달만
  닫혀야 할 자리에서 페이지 자체가 목록 등으로 이동해버리던 문제** — 앞선 수정은 이동이
  끝난 뒤에야 Alert가 닫히는 사후 처리였을 뿐, 이동 자체를 막지는 못했다. 페이지 이동
  없이 모달만 취소되는 T1 오버레이와 동작이 달라 보였다. react-router는 앱 전체에서
  `useBlocker`를 하나만 평가하는데, 이미 `useUnsavedChangesGuard`가 그 자리를 쓰고
  있어 그 blocker를 확장했다 — Alert/Confirm이 열려 있으면 네비게이션을 막고, 막힌
  시점에 열려 있던 Alert를 취소 처리한 뒤(`alert.store.ts`의 `cancelAlert`) 이동을
  취소한다. 로그아웃·세션만료로 인한 강제 리다이렉트는 이 체크보다 먼저 통과시켜 갇히지
  않도록 순서를 잡았다.
  (`shared/hooks/useUnsavedChangesGuard.ts`,
  `shared/ui/elements/modal/alert/{Alert.tsx,alert.store.ts}`)
- **글쓰기 등록 후 뒤로가기를 누르면 방금 제출을 끝낸 빈 폼으로 되돌아가던 문제** —
  제출 성공 시 목록으로 `navigate()`(PUSH)해 히스토리가 `목록 → 글쓰기 → 목록`으로
  쌓였다. `replace: true`로 폼 엔트리를 결과 화면으로 대체해 뒤로가기가 폼을 건너뛴다.
  같은 이유로 수정 화면에 링크로 직접 진입해 저장한 뒤 뒤로가기하는 경우도 함께 고쳤다.
  (`features/post/create/hooks/useCreatePost.ts`, `shared/hooks/useGoBack.ts`)
- **이미지 뷰어(라이트박스)에서 스크린리더 이용자에게 모달 용도가 전달되지 않던 문제** —
  `DialogContent`에 `DialogDescription`이 없어 개발 콘솔에도 Radix의 "Missing
  Description" 경고가 계속 떴다. sr-only `DialogDescription`을 추가해 닫는 방법을
  안내하고 경고도 함께 없앴다.
  (`shared/ui/elements/modal/image-viewer/ImageViewer.tsx`, `shared/config/texts.ts`)
- **라우트에서 예상치 못한 에러가 터지면 react-router의 원본 에러 화면(영어 "Unexpected
  Application Error!" + `error.message` + 전체 스택 트레이스)이 프로덕션에서도 그대로
  노출되던 문제** — 아무 라우트도 `errorElement`를 선언하지 않아, 라우트 트리 안에서
  던져진 에러(`RootLayout` 자신의 렌더 실패 포함)가 앱 자체의 에러 폴백보다 먼저
  react-router의 내장 기본 화면으로 샜다. 루트 라우트에 전용 에러 경계
  (`RouteErrorBoundary`)를 추가해 이 앱 스타일의 안내 화면으로 대체하고, `UserFacingError`가
  아닌 이상 날것의 `error.message`는 노출하지 않는다(기존 `auth.queries.ts`의 정책과
  동일하게 통일). 부수적으로, lazy 라우트 청크 로드 실패 시 자동 새로고침으로 복구하는
  기존 로직도 같은 이유로 지금까지 도달 불가능했는데 이번에 함께 살아났다.
  (`app/routes/RouteErrorBoundary.tsx`, `shared/ui/elements/AppErrorFallback.tsx`,
  `shared/utils/error.util.ts`)
- **게시글/댓글 링크 미리보기 썸네일이 브라우저 기본 깨진 이미지 아이콘으로 보이던 문제**
  — 원인을 조사해보니 두 가지가 섞여 있었다. (1) 일부 CDN(예: 네이버 blogthumb)이
  요청의 Referer로 우리 도메인이 노출되면 핫링크로 간주해 403을 반환했다 — 이미지
  요소에 `referrerPolicy="no-referrer"`를 붙여 Referer를 아예 보내지 않게 하면
  정상 응답한다. (2) 원본 사이트가 이미지를 이미 삭제했거나 무효화한 경우(예: namu.wiki)는
  어떤 헤더로도 복구할 수 없어, 로드 실패 시 썸네일 영역을 통째로 숨기도록 했다(폴백은
  `ogImage`가 애초에 없는 게시글과 동일한 모습이 된다). 두 컴포넌트가 동일한 마크업을
  복제하고 있어 신규 공통 컴포넌트로 추출했다.
  (`shared/ui/atoms/link-thumbnail.tsx`, `widgets/post/post-card/ui/PostCard.tsx`,
  `widgets/comment/comment-list/ui/CommentItem.tsx`)
- **HTTPS 페이지인 /post 목록에서 Mixed Content 콘솔 경고가 뜨던 문제** — 크롤링
  대상 사이트가 `og:image`를 http URL로 내리는 경우가 있어, 그 값을 검증 없이 그대로
  `<img src>`에 썼다. 브라우저가 어차피 https로 자동 업그레이드해 로딩 자체는 되고
  있었지만, 렌더링 직전 http를 https로 치환해 경고를 없앴다(신규 크롤링 건은 BE에서도
  저장 전에 정규화). (`shared/ui/atoms/link-thumbnail.tsx`)
- **이미지 라이트박스·로그인 모달·마이페이지 패널·모바일 사이드바 드로어를 열면 배경
  메인 스크롤이 최상단으로 튀던 문제** — 이 오버레이들은 뒤로가기로 자연스럽게 닫히도록
  히스토리 엔트리를 push해서 여는데(`useHistoryOverlay`), `<ScrollRestoration/>`이 이
  PUSH를 새 페이지 이동으로 보고 `window.scrollTo(0, 0)`을 실행했다. 오버레이를 여는
  모든 navigate 호출에 `preventScrollReset: true`를 추가해 배경 위치를 그대로 유지한다.
  (`shared/hooks/useHistoryOverlay.ts`, `shared/lib/router/navigation.ts`,
  `shared/ui/elements/MarkdownContent.tsx`, `entities/user/api/auth.queries.ts`)
- **mermaid.js 등에서 내보낸 SVG를 댓글에 첨부하면 미리보기에 안 보이던 문제** — 루트
  `<svg>`가 `width="100%"`고 `height`가 없는 경우, `<img src="blob:...">`로 불러올 때
  브라우저가 퍼센트 너비의 기준을 찾지 못해 intrinsic 크기를 못 구해 렌더링 자체가
  안 됐다(인라인 SVG나 새 탭 직접 열기는 문제없음 — `<img>` 태그로 불러올 때만 생기는
  잘 알려진 제약). 첨부 시점에 SVG를 파싱해 `viewBox`로부터 절대 `width`/`height`를
  계산해 주입한다. (`shared/lib/image/resizeImage.ts`)

### Changed

- **모바일 사이드바·마이페이지·이미지뷰어·로그인 모달을 뒤로가기로 닫을 수 있도록 변경** —
  기존에는 이 오버레이들이 zustand `isOpen` 불리언일 뿐 히스토리에 없어서, 열어둔 채
  뒤로가기를 누르면 오버레이가 닫히는 대신 페이지가 통째로 바뀌었다. 열 때
  `location.state`에 히스토리 엔트리를 push하는 공통 훅(`useHistoryOverlay`)으로
  옮겨 뒤로가기가 오버레이 하나만 자연스럽게 닫도록 했다(Navbar 모바일 검색 패널이 이미
  쓰던 패턴을 일반화). Alert/Confirm·토스트 등 한 번의 결정만 받고 사라지는 것은 대상에서
  제외했다 — 설계 배경은 `docs/DECISIONS.md` 참고.
  (`shared/hooks/useHistoryOverlay.ts`,
  `shared/store/{sidebar,mypage,loginModal,imageViewer}.store.ts`,
  `app/routes/ProtectedRoute.tsx`)
- **페이지 하단 여백을 16px에서 48px(데스크톱 64px)로 확대** — 상세 페이지에서 마지막
  댓글과 답글 폼이 화면 끝·하단 탭바에 붙어 답답했다. 여백을 한 곳에서 관리하는 기존
  구조를 유지하기 위해 댓글 영역이 아닌 전역 레이아웃에서 조정했다.
  (`app/layouts/app-layout/AppLayout.tsx`)
- **댓글 이미지 드롭존을 폼 영역에 정확히 올려야만 반응하던 것을 완화** — 뷰포트 어디로든
  파일을 드래그해 들어오는 순간 현재 열려 있는 모든 댓글 폼의 드롭존 오버레이가 동시에
  뜨고(실제 드랍은 각 폼 영역만 인식), 실제 드랍 판정 영역도 보이는 점선 박스보다 사방
  72px 넓게 잡아 정확히 겨냥하지 않아도 인식되게 했다. `position: absolute` + `z-index`로
  확장 레이어를 얹었는데, `position` 없는 형제 요소(미리보기 박스·버튼 줄)는 음수
  마진만으로는 페인트 순서상 그 위를 덮어버려 히트 영역이 무력화되는 문제가 있어
  z-index로 명시적으로 이겼다. (`shared/hooks/useImageAttachments.ts`,
  `features/comment/create/ui/CommentForm.tsx`,
  `features/comment/update/ui/CommentEditForm.tsx`)
- **이미지첨부 버튼 클릭 영역을 32px에서 44px(iOS/Android 최소 터치 타겟 기준)로 확대,
  문구를 GitHub 스타일로 통합** — 기존엔 패딩 없는 raw 버튼이라 클릭 영역이 텍스트
  줄 높이 정도였다. 같은 줄의 취소/저장 버튼과 같은 `Button` 아톰으로 교체하고,
  GitHub 첨부 버튼처럼 화면 폭에 따라 "이미지 첨부 0/5"(좁은 화면) ↔ "클릭·드래그·
  붙여넣기로 이미지 첨부 0/5"(넓은 화면)로 전환되는 라벨을 추가해 버튼을 몰라도
  드래그·붙여넣기가 된다는 걸 알 수 있게 했다. (`shared/ui/elements/ImageAttachmentField.tsx`,
  `shared/config/texts.ts`)
- **댓글 수정 모드에서도 좋아요·답글·수정·삭제 버튼 줄이 그대로 보이던 것을 수정 중엔
  숨김** — 게시글 수정이 이미 따르던 "수정 중엔 다른 액션 진입점을 노출하지 않는다"는
  원칙(전용 페이지로 이동해 다른 액션이 아예 화면에 없음)과 맞춰, 인라인 수정인 댓글도
  같은 원칙을 조건부 렌더링으로 적용했다. (`widgets/comment/comment-list/ui/CommentItem.tsx`)

## [0.10.0] - 2026-08-04

### Changed

- **게시글 카드의 제목 노출을 2줄에서 3줄로 늘림** — 데스크톱 3단 그리드 기준 2줄에는 한글
  약 28자만 들어가 대부분의 제목이 말줄임표로 잘렸다. 3줄로 늘려 노출 글자 수를 약 42자로
  키웠다. (`widgets/post/post-card/ui/PostCard.tsx`)

### Fixed

- **상세페이지에서도 게시글 제목이 2줄로 잘려 전문을 볼 방법이 없던 문제** — 상세 화면
  전용 `isDetail` 플래그가 본문 설명의 줄 제한만 해제하고 제목에는 적용되지 않았다. 제목도
  상세페이지에서는 클램프를 해제해 전문을 그대로 보여준다. (`PostCard.tsx`)

### Added

- 댓글에 첨부한 이미지를 클릭하면 화면에 꽉 차게 확대해서 볼 수 있는 라이트박스를 추가.
  기존에는 첨부 이미지가 `max-h-60`으로 잘려 표시되고 클릭해도 반응이 없어, 세로로 긴
  스크린샷 등은 내용을 확인할 방법이 없었다. 배경 클릭·ESC·닫기 버튼으로 닫을 수 있다.
  (`shared/ui/elements/modal/image-viewer/`, `MarkdownContent.tsx`)
- 게시글 카드·댓글의 작성자 프로필 사진을 클릭하면 위 라이트박스로 원본 크기 확대해서
  볼 수 있도록 `UserAvatar`에 `zoomable` prop을 추가. 목록 썸네일은 계속 리사이즈된
  이미지를 쓰고 확대 시에만 원본 URL을 넘긴다. 네비바·마이페이지 아바타는 각각 드롭다운
  메뉴·파일 선택창을 여는 기존 클릭 동작을 그대로 두기 위해 이번 확대 대상에서 제외했다.
  (`entities/user/ui/UserAvatar.tsx`)
- 마이페이지 프로필 수정 시 닉네임 타이핑을 멈추면(500ms 디바운스) 중복 여부를 미리 조회해
  사용 가능하면 "사용 가능한 닉네임이에요", 다른 사람이 쓰는 중이면 인라인 오류를 보여준다
  (BE 새 엔드포인트: `GET /auth/account/nickname-availability`). 디바운스가 정착하지
  않았거나 검사가 진행 중이면 저장 버튼이 비활성 상태로 그려져, 검사 결과를 기다리지 않고
  누른 클릭이 애초에 통과하지 않는다. (`useUpdateProfile`, `authApi.checkNicknameAvailability`)

### Changed

- **마이페이지 프로필(닉네임·아바타) 저장이 서버 응답을 기다리지 않고 즉시 모달을 닫도록
  변경** — 기존에는 저장 버튼을 누르면 아바타를 바꿨을 때 리사이즈→서명 URL 발급→스토리지
  업로드→계정 PATCH의 4단계 순차 왕복이 끝날 때까지 모달이 잠겨 있었다. 댓글 등록과 동일한
  형태로 제출 즉시 모달을 닫고, 이미 낙관적 업데이트를 갖추고 있던
  `useUpdateAccountMutation`의 `onMutate`가 캐시(Navbar 아바타·닉네임)를 바로 반영한다.
  실패 시 캐시를 롤백하고, 모달이 이미 닫힌 뒤라 놓치기 쉬운 만큼 자동으로 사라지지 않는
  오류 토스트에 "다시 열기" 액션을 붙여 시도했던 값(첨부 파일 포함) 그대로 모달을 복원한다.
  (`useUpdateProfile`, `useUpdateAccountMutation`, `shared/store/mypage.store.ts`)
- **댓글·답글 등록이 서버 응답(링크 프리뷰 크롤링·재조회)을 기다리지 않고 즉시 화면에
  반영되도록 변경** — 기존에는 등록 폼이 서버 응답까지 잠겨 있다가, 응답 후에도 댓글
  목록을 통째로 다시 조회(`GET`)한 뒤에야 화면에 나타났다. 이제 제출 즉시 임시 댓글을
  목록에 꽂아 넣고 폼을 비우며, 서버 응답이 오면 id 기준으로 실제 댓글로 조용히 치환한다
  (재조회 없음). 실패 시에는 이전 목록으로 롤백된다. 첨부 이미지는 업로드 완료 전까지
  로컬 미리보기(blob URL)로 보여준다. (`entities/comment/api/comment.queries.ts`,
  `features/comment/create/hooks/useCreateComment.ts`, `MarkdownContent.tsx`)
- **사용자 노출 문구의 종결어미를 해요체로 통일** — 토스트·확인 다이얼로그·에러 안내 등이
  합쇼체("-습니다.")·격식 청유형("-시겠습니까?")·개조식 명사 종결("폴더 생성 실패") 등으로
  제각각이었다. 국내 서비스 UX 라이팅 사례([토스 UX 라이팅](https://developers-apps-in-toss.toss.im/design/ux-writing.html) —
  해요체 통일, 능동형 문장("되었어요"→"했어요"), 긍정 표현, "-시겠어요?" 같은 과도한 경어
  지양)를 참고해 전면
  통일. 예: "회원이 생성되었습니다." → "가입을 완료했어요."(능동형), "정말 이
  포스트를 삭제하시겠습니까?" → "정말 이 포스트를 삭제할까요?", "폴더 생성 실패"(토스트
  노출) → "폴더 생성에 실패했어요." 완료를 나타내는 성공 메시지는 능동형으로, 원인이
  불분명하거나 상태를 서술하는 문구(삭제된 글 안내 등)는 그대로 수동형 유지. 제목류
  (다이얼로그·페이지 타이틀)는 마침표 없이, 본문·설명·토스트류는 마침표 있게
  통일. 콘솔 로그 전용 문구(`apiRequestFailed` 등)는 대상에서 제외. 가드 테스트
  (`texts.test.ts`)를 `messages.success` 전용 긍정 매칭에서 `TEXTS` 전체를 재귀 순회하며
  구 합쇼체·격식 청유형(`-습니다/-니까?` 계열, `-ㅂ니다`형인 "가져옵니다" 포함) 잔존 여부를
  검사하는 부정 매칭으로 확장해, 이후 새 문구가 다른 톤으로 섞여 들어가면 자동으로 잡아낸다.
  (`shared/config/texts.ts`, `shared/config/texts.test.ts`)

### Fixed

- 프로필 저장 중 아바타를 낙관적으로 미리 보여주는 blob URL이 "마지막 아바타"
  로컬스토리지 캐시에 저장되던 문제 — blob URL은 문서 생명주기에 묶여 새로고침 후엔
  깨지므로, 다음 방문 시 선반입 단계에서 깨진 이미지가 잠깐 보일 수 있었다. blob URL은
  이 캐시에서 제외한다. (`entities/user/hooks/useAccount.ts`)
- 댓글·답글을 수정하고 저장하면 폼이 닫히는 순간 수정 전 내용이 한 프레임 스쳐 보인 뒤
  새 내용으로 바뀌던 문제 — `isEditing`은 PATCH 응답 시점에 꺼지는데, 목록 캐시는 그
  응답을 버리고 무효화(`invalidateQueries`)만 해서 별도 재조회가 끝나야 새 내용으로
  바뀌는 두 시점 차이가 원인이었다. 서버 응답을 캐시에 먼저 병합해 쓴 뒤 폼을 닫도록
  순서를 맞춤. PATCH 응답이 `replies`/`likeCount`/`isLiked`를 항상 기본값으로 내려주는
  BE 특성 때문에 통째로 치환하지 않고 바뀐 필드만 병합한다.
  (`entities/comment/api/comment.queries.ts`, `features/comment/update/hooks/useUpdateComment.ts`)
- 프로필 사진·댓글 첨부 이미지가 24~32px 아바타에도 원본 그대로(최대 1MB대) 전송되어
  로딩이 느리던 문제 — 읽을 때는 Supabase 이미지 변환 엔드포인트로 실제 표시 크기에 맞게
  리사이즈해서 받고(`shared/lib/image/supabaseImage.ts` 신설), 업로드 전에는 캔버스로
  webp 재인코딩해 상한(아바타 512px, 댓글 이미지 1024px) 이하로 축소한다
  (`shared/lib/image/resizeImage.ts` 신설, `upload.api.ts`). 애니메이션 GIF·SVG·변환
  실패 시에는 원본을 그대로 사용한다.
- 아바타 이미지가 아직 로딩 중이거나 깨진 경우 빈 원만 보이던 문제 — 로딩 중엔 회색
  배경만 보이다가 이미지가 도착하면 그 위에 바로 그려지도록 수정. 닉네임 이니셜은
  이미지가 아예 없거나 로드가 실패했을 때만 표시하고, 닉네임 정보가 아직 없을 땐
  물음표(`?`) 같은 임시 문자도 보여주지 않는다(`entities/user/ui/UserAvatar.tsx`).
- 로그인 사용자의 아바타가 `/auth/refresh`→`/auth/account` 응답을 받은 뒤에야 요청을
  시작해 매번 늦게 뜨던 문제 — 직전 세션에서 저장해둔 아바타 URL을 앱 시작 시 두 API
  응답을 기다리지 않고 먼저 워밍하도록 수정 (`entities/user/hooks/useAppInitialization.ts`,
  `entities/user/hooks/useAccount.ts`).
- 프로필 아바타 업로드 시 파일 크기 제한이 모호했던 문제 — 기존엔 애니메이션이 깨져
  리사이즈를 건너뛰는 GIF·SVG에만 버킷 용량 제한(10MB)을 적용하고, 그 외 포맷은 제출
  시점까지 아무 검증도 없었다(100MB짜리도 업로드를 끝까지 시도한 뒤에야 실패). GitHub·
  Slack·X·Discord 등의 기준을 참고해([출처 미상, 2026-09-10 확인 — 재검증 필요])
  원본 30MB(리사이즈 가능한 일반 포맷)/15MB(리사이즈 불가한 SVG) 2단계로 재설계하고, 파일을 고르는 즉시(제출 전) 검증해 초과 시 바로 에러를
  보여준다. 아바타는 항상 48~160px 고정 크기로만 표시되므로 GIF는 애니메이션을 지키지
  않고 일반 리사이즈 파이프라인에 태워 30MB 기준 하나로 통합했다(댓글 첨부 이미지는
  기존처럼 GIF·SVG 모두 리사이즈를 건너뛴다). (`shared/lib/image/resizeImage.ts`,
  `entities/upload/api/upload.api.ts`, `entities/user/api/auth.api.ts`,
  `features/auth/profile/hooks/useUpdateProfile.ts`)
- 마이페이지 닉네임 입력의 상태 메시지·검증 정확도 문제 4건 — ① 메시지가 나타나고
  사라질 때 저장 버튼 위치가 순간적으로 흔들리던 레이아웃 시프트(라벨 행에 고정폭으로
  배치), ② 닉네임을 바꿨다가 원래 값으로 되돌리면 불필요하게 재조회하며 "사용 가능한
  닉네임입니다"라는 오해 소지 있는 메시지가 뜨던 문제(원래 값으로 되돌아오면 idle로
  처리), ③ 허용되지 않는 특수문자가 섞인 경우에도 길이 제한(2~20자) 메시지만 떠 원인을
  알 수 없던 문제(길이·문자셋 검증과 메시지를 분리), ④ 닉네임 형식이 잘못됐는데도 저장
  버튼이 활성 상태로 남아 눌러도 반응이 없던 문제(형식 오류도 비활성 조건에 포함)를
  함께 수정. (`useUpdateProfile`, `UpdateProfileForm.tsx`,
  `shared/ui/elements/form/_base/FormField.tsx`, `shared/types/auth.type.ts`)
- 프로필 저장 실패 시 사용자에게 보여주는 메시지가 부정확했던 문제 2건 — ① 오프라인
  등 네트워크 자체가 끊긴 일반 에러도 "구체적인 에러 메시지를 보여주자"는 이전 수정
  때문에 브라우저의 날것 기술 문구(`Failed to fetch` 등)가 그대로 노출되던 회귀를
  `UserFacingError` 클래스로 구분해 수정(우리가 의도적으로 던진 에러만 상세 메시지를
  보여주고, 그 외는 일반 실패 메시지로 감싼다), ② 닉네임 중복 조회 자체가 실패(오프라인
  등)했을 때 내부적으로 "사용 가능"으로 간주해 실제로는 확인되지 않았는데도 성공
  메시지를 보여주던 fail-open 버그를 수정 — 이제 조회 실패 시 저장은 막지 않되(서버가
  최종 검증) 어떤 메시지도 보여주지 않는다. (`shared/types/common.type.ts`,
  `entities/user/api/auth.queries.ts`, `entities/user/api/auth.api.ts`,
  `useUpdateProfile.ts`)
- 댓글 수정 시 기존에 첨부돼 있던 이미지가 삭제 가능한 썸네일이 아니라 textarea 안에
  raw URL 텍스트로 그대로 노출되던 문제 — 새 댓글 작성 때처럼 기존 이미지도 썸네일로
  보여주고, 유지한 채 새 이미지를 추가하거나 개별 삭제할 수 있도록 수정.
  (`shared/lib/content/imageContent.ts` 신설, `useUpdateComment.ts`)
- 이미지 붙여넣기가 Supabase 버킷 용량 제한(10MB)을 초과하면 클라이언트가 사전 검사 없이
  업로드를 끝까지 시도한 뒤에야 실패해, 느린 네트워크에서는 "등록 중..." 상태로 오래
  멈춰있는 것처럼 보이던 문제 — 붙여넣는 즉시 파일 크기를 검사해 초과 시 업로드 시도
  없이 바로 에러 토스트를 표시하도록 수정. (`useImagePaste.ts`)

### Removed

- **낙관적 업데이트로 화면에 결과가 이미 즉시 반영되는 액션의 성공 토스트 8개를 제거** —
  프로필 수정, 게시글 수정·삭제·공개 설정 변경, 폴더 이름 변경·삭제·생성, 북마크 제거는
  전부 결과가 화면에 바로 보이는데(모달이 닫히고 갱신됨/목록에서 사라짐/아이콘 상태 전환
  등) "성공했습니다" 토스트까지 뜨는 건 이미 본 결과를 텍스트로 한 번 더 말해주는 중복
  신호였다. 반대로 클립보드 복사처럼 화면 변화가 전혀 없는 액션(`linkCopied`)이나 "어느
  폴더에 저장됐는지"처럼 단순 성공 이상의 정보를 전달하는 토스트(`bookmarkSavedTo` 등)는
  유지. **게시글 생성(`postCreated`)은 처음에 같이 제거했다가 복원했다** — 제출 즉시 응답을
  기다리지 않고 피드로 이동하고, 목록도 낙관적 삽입이 아니라 `invalidateQueries`(재조회)라
  이동 시점엔 아직 옛 목록이고, 여러 사용자가 동시에 글을 올릴 수 있는 공개 피드라 "최신순
  맨 위 = 내 글"도 보장되지 않는다 — `accountCreated`(가입 후 리다이렉트, 결과가 화면에
  안 드러남)와 같은 패턴이라 가시성 기준에 안 맞았다. 판단 기준(가시성·정보량·실행취소
  여부)을 `.claude/CLAUDE.md` "성공 토스트 표시 기준"에 문서화해 앞으로 새 성공 메시지를
  추가할 때도 동일하게 적용한다. `messages.success`에서 해당 8개 키(`accountUpdated`,
  `postUpdated`, `postDeleted`, `postVisibilityUpdated`, `folderRenamed`, `folderDeleted`,
  `folderCreated`, `bookmarkRemoved`)도 더 이상 쓰이지 않아 함께 제거.
  (`shared/config/texts.ts`, `entities/post/api/post.queries.ts`,
  `entities/user/api/auth.queries.ts`,
  `widgets/bookmark/folder-tree/FolderTree.tsx`, `MobileFolderList.tsx`,
  `features/post/bookmark/ui/FolderSelector.tsx`)

## [0.9.0] - 2026-08-03

### Changed

- **댓글 이미지 첨부·아바타 업로드를 스토리지 직접 업로드 방식으로 전환** — 기존엔
  이미지를 FormData로 BE에 보내면 BE가 대신 Supabase Storage에 올려줬는데, CloudFront에
  붙은 WAF가 요청 바디 8KB 초과 시 무조건 차단해 실제 사진 첨부가 거의 항상 실패했다.
  이제 BE에서 서명된 업로드 URL을 발급받아(`POST /upload/signed-url`) 이미지 바이트를
  스토리지에 직접 전송하고, 결과 URL만 BE에 JSON으로 전달한다. 이미지 바이트가
  CloudFront/WAF를 거치지 않아 이 문제가 원천적으로 해결된다.
  (`entities/upload/api/upload.api.ts` 신설, `comment.api.ts`, `auth.api.ts`)

### Removed

- `authApi.uploadAvatar`가 더 이상 `POST /auth/account/avatar`(제거된 BE 엔드포인트)를
  호출하지 않음 — 반환 타입(`{ imageUrl }`)은 동일하게 유지되어 `useUpdateProfile` 등
  호출부는 변경 없음.

BE API 의존: 댓글 생성/답글/수정 요청 바디가 `multipart/form-data`에서 JSON으로
바뀜(BE v0.6.0 이상 필요, `images`가 파일이 아닌 URL 배열). BE를 먼저 배포해야 한다.

## [0.8.0] - 2026-08-02

### Added

- 북마크 저장 토스트에 [보기] 액션 버튼을 추가해 눌렀을 때 저장된 폴더
  (`/bookmark?folder=...`)로 바로 이동할 수 있게 함. 폴더 제거/해제처럼 볼
  대상이 남지 않는 토스트에는 붙이지 않음. (`FolderSelector.tsx`)
- 모바일 네비바 검색을 인스타그램 스타일의 전체화면 검색 모드로 전환. 기존에는
  검색 패널을 닫을 방법이 마땅치 않았다 — 뒤로가기(하드웨어 버튼·엣지 스와이프)를
  눌러도 패널이 히스토리에 전혀 참여하지 않아 실제로는 이전 페이지로 이동해버렸고
  (첫 진입이면 사이트 이탈), 검색 제출 후에도 라우트 변경 감지가 `pathname`만 봐서
  쿼리스트링만 바뀌는 제출에는 반응하지 않아 패널이 안 닫혔다. 검색 패널 열림
  상태를 `location.state`에 실어 히스토리 엔트리로 만들어 뒤로가기·← 버튼이
  동일하게 패널만 닫도록 하고, 검색 모드에서는 상단 바 전체를 `← 입력창 ✕`로
  교체. 최근 검색어를 로컬스토리지에 최대 10개까지 저장해 탭하면 바로 재검색,
  개별/전체 삭제도 지원. (`Navbar.tsx`, `MobileNavbarSearch.tsx`,
  `RecentSearchPanel.tsx`, `useRecentSearches.ts`, `texts.ts`)

### Changed

- 토스트가 성공·실패·시스템 알림 구분 없이 전부 화면 상단 한 곳에만 떠서,
  북마크 저장처럼 방금 한 행동의 결과를 확인하기엔 시선이 먼 위치였다.
  카테고리별 위치 정책을 도입해 성공 토스트는 하단, 오류·경고·시스템 알림은
  기존대로 상단에 뜨도록 함. 정책을 강제할 지점이 없어 42개 호출부가 각자
  `sonner`를 직접 불러 쓰던 것을 `shared/lib/toast` 래퍼로 일원화하고,
  ESLint로 `sonner`의 `toast` 직접 import를 차단. 모바일 하단 탭바에 토스트가
  가리지 않도록 반응형 offset도 함께 추가. (`shared/lib/toast/toast.ts`,
  `sonner.tsx`, `globals.css`, `eslint.config.js`)
- localStorage/sessionStorage 키 이름이 `ls_has_session`, `saved_email_linksphere`,
  `fcmToken`, `chunk-reload-attempted` 등 스타일이 제각각이고 한 곳에 모여 있지도
  않았음. `shared/config/storage-keys.ts`에 `linksphere:` 접두사 + 콜론 네임스페이스
  규칙으로 전부 모아 통일 (`linksphere:auth:has-session` 등). next-themes의 기본 키
  `theme`도 `linksphere:theme`로 편입. 마이그레이션 없이 키만 교체했으므로 기존
  사용자는 재로그인 1회, 저장된 이메일·최근 검색어·테마 선택이 초기화됨 — 세션
  스토리지 키는 탭을 닫으면 어차피 사라지므로 영향 없음. (`storage-keys.ts`,
  `auth.store.ts`, `useLogin.ts`, `useRecentSearches.ts`, `fcm.ts`)
- 북마크 개별 폴더 체크를 해제했을 때 그게 마지막 소속 폴더였다면 미분류로 자동
  이동하는데, "미분류에 저장됨" 토스트만 봐서는 왜 미분류가 됐는지 알기 어려웠다.
  같은 토스트에 "마지막 폴더에서 제거되어 미분류로 이동되었습니다." description을
  추가해 이유를 안내한다. (`FolderSelector`)
- 북마크/폴더 성공 토스트 문구의 종결 어미를 통일 — `folderRenamed`, `folderDeleted`,
  `folderCreated`, `bookmarkSavedTo`, `bookmarkRemoved`, `bookmarkRemovedFromFolder`,
  `bookmarkClearedAllFolders`가 개조식(`-됨`)·해요체(`-됐어요`)로 섞여 있던 것을
  나머지 `messages.success`(`accountCreated` 등)와 같은 합쇼체(`-되었습니다.`)로
  통일. 표시 문구만 바뀌고 동작은 동일. 이후 다른 톤이 섞여 들어가면 바로 잡아내도록
  회귀 테스트(`texts.test.ts`)도 추가. (`texts.ts`)

### Fixed

- 폰트가 화면이 다 로딩된 뒤에야 적용되는 것처럼 보였던 문제. 원인은 세 가지:
  (1) 본문에 쓰는 Pretendard를 단일 가변 폰트 파일(2.0MB)로 서빙하고 있어서
  `font-display: swap`이 걸려 있어도 이 큰 파일이 완전히 받아질 때까지 스왑이
  지연되고 다른 JS/이미지/API 요청과 대역폭을 다퉜음 — 실제 앱에서 쓰는 굵기는
  400/500/600/700뿐이라 가변 폰트의 연속 보간 기능이 쓰이지 않고 있어, 굵기별
  서브셋 정적 폰트(각 ~260KB)로 되돌리고 preload도 Regular/Medium/Bold로 맞춤.
  (2) `@font-face`가 `globals.css`에서 외부 CSS `@import`로 한 번 더 불러와지고
  있어, 번들 CSS 파싱 → import 발견 → 재요청까지 왕복이 한 번 더 들어가 렌더링을
  지연시켰음 — `@font-face`를 `globals.css`에 직접 인라인해 제거. (3) 배포
  스크립트에서 폰트 파일(`dist/fonts/`)에 캐시 헤더가 전혀 안 걸려 있어 재방문자도
  매번 새로 받고 있었음 — 해시 없는 정적 자산이지만 내용이 거의 안 바뀌므로
  `assets/`와 동일하게 1년 장기 캐시 추가. (`globals.css`, `index.html`,
  `deploy.yml`)
- 청크 로드 실패(새 배포 후 구 청크 hash 불일치) 시 재시도를 막는 세션 스토리지
  플래그를 `main.tsx`의 `vite:preload-error` 핸들러와 `App.tsx`의 전역
  ErrorBoundary 폴백이 서로 다른 키로 관리하고 있어, 한쪽이 이미 새로고침을
  했어도 다른 쪽이 그걸 모르고 한 번 더 새로고침을 실행할 수 있었다. 두 곳 모두
  경로별 키(`chunkReloadKey(pathname)`)를 공유하도록 통일. (`main.tsx`, `App.tsx`,
  `storage-keys.ts`)
- 게시글 등록 제출 직후 폼을 리셋하고 페이지를 이동하는데, 그 사이 탭을 닫거나
  이동하면 진행 중이던 등록 요청이 중단되어 게시글이 유실될 수 있었다. 요청에
  `keepalive: true`를 추가해 탭 종료/이동 후에도 이미 시작된 요청은 끝까지
  전송되도록 함. (`post.api.ts`)
- 새로고침 시 인증 게이트가 없는 `AppShellLayout`(게시글 목록 등 공개 페이지)이
  인증 복원(`/auth/refresh`)보다 먼저 렌더되면, 그 순간 나가는 게시글 목록 요청이
  비로그인 상태로 처리되어 본인 비공개 글이 목록에서 통째로 빠졌다(타이밍에 따라
  랜덤 재현). 이전 로그인 흔적(`ls_has_session`)이 있을 때만 인증 복원이 끝날
  때까지 짧게 기다리도록 하여 레이스 자체를 없앰 — 흔적이 없는 완전 비로그인
  방문자는 기존처럼 즉시 렌더되어 성능 영향 없음. (`AppShellLayout.tsx`,
  `useAppInitialization.ts`)
- 북마크 페이지 데스크탑 레이아웃은 내비게이션 + 폴더트리 사이드바가 폭을 먼저
  차지하고 남은 영역에 카드 그리드를 그리는데, 3열 전환 브레이크포인트(`lg`,
  1024px)가 뷰포트 폭 기준이라 사이드바가 차지하는 폭을 감안하지 못해
  1024~1279px 구간에서 카드가 비좁게 표시됐다. 브레이크포인트를 `xl`(1280px)로
  늦춰 남는 폭이 실제로 충분할 때만 3열이 켜지도록 함. (`BookmarkPostList.tsx`)
- 게시글 목록 검색 영역에서 카테고리 라벨을 클릭하면 입력해 둔 자유 검색어는
  지우지 않은 채 `@카테고리` 태그만 이어 붙였다. 라벨로 카테고리만 좁혀 보려
  해도 이전 검색어가 함께 걸려 의도와 다른 결과가 나왔다. 라벨 클릭 시 자유
  검색어는 초기화하고 이미 선택돼 있던 다른 카테고리 태그만 유지하도록 수정.
  (`PostListSearch.tsx`)
- 게시글 목록 검색을 재실행해도 결과가 바뀌었는지 알 수 있는 신호가 없었다.
  라우터의 `v7_startTransition` 설정 때문에 검색 제출이 전환(transition)으로
  처리되어 새 결과가 준비될 때까지 기존 화면을 조용히 유지하는데, 특히 이미
  캐시된 검색어로 재검색하면 전환이 사실상 순식간에 끝나 로딩 신호가 사람이
  인지하기엔 너무 짧게(수 ms) 지나갔다. 검색 제출을 자체 `startTransition`으로
  감싸 `isPending`을 노출하고, `useMinimumLoading`으로 최소 400ms는 검색
  버튼에 스피너·비활성화가 유지되도록 함. (`PostListSearch.tsx`)

## [0.7.0] - 2026-07-31

### Added

- **북마크 다중 폴더 소속 지원** — 북마크 하나를 여러 폴더에 동시에 저장할 수 있게 됨.
  폴더 선택 모달(`FolderSelector`)에서 소속된 **모든 폴더에 ✓**가 표시되고, 탭할
  때마다 그 폴더에 추가/제거된다(즉시 저장, 확인 단계 없음). 미분류 행은 소속 폴더가
  0개인 상태를 뜻하며, 이미 미분류인 상태에서 미분류 행을 다시 탭하면 아무 일도
  일어나지 않는다(오탭으로 북마크가 사라지는 것 방지). 폴더 1개 이상에 소속된 상태에서
  미분류 행을 탭하면 소속 전부를 한 번에 해제하며, 이때는 "모든 폴더에서 제거됨"으로
  안내해 단순 저장 문구와 구분한다. (`FolderSelector`, `useBookmarkFolders`,
  `useAddBookmarkFolderMutation`, `useRemoveBookmarkFolderMutation`,
  `useClearBookmarkFoldersMutation`) — BE API 의존, 동시 배포 필요

### Changed

- 사이드바/모바일 폴더 목록의 **`전체` 행에서 개수 배지를 제거**함 — 다중 폴더에서는
  `폴더별 개수 합 + 미분류`가 같은 북마크를 중복 집계해 부정확해지는데, 정확한 값을
  보여주려면 서버 필드가 필요해서 이번엔 숫자 자체를 표시하지 않기로 함. `전체` 목록
  자체(카드 나열)는 여전히 중복 없이 한 번만 보여준다. (`FolderTree`, `MobileFolderList`)
- 폴더 삭제 확인 문구를 조건부로 변경 — "폴더 안의 북마크는 미분류로 이동합니다" →
  "이 폴더에만 있던 북마크는 미분류로 이동합니다 (다른 폴더에도 있으면 그대로 유지)".
  BE가 더 이상 폴더 삭제 시 안의 북마크를 전부 미분류로 옮기지 않기 때문.
  (`TEXTS.bookmark.folder.deleteConfirmMessage`)
- `post.userInteractions.bookmarkFolderId: string | null` →
  `bookmarkFolderIds: string[]` — 게시글이 속한 모든 폴더 ID 배열로 변경.

### Removed

- 단건 폴더 이동 API(`moveBookmark`)와 관련 스키마(`moveBookmarkSchema`,
  `MoveBookmarkRequest`) 제거 — 폴더별 추가/제거 API로 대체됨. `useBookmarkWithFolder`
  훅(toggle→move 2단 호출)도 함께 제거 — 새 API가 북마크 없을 때 자동 생성해줘서
  탭 1회 = 요청 1회로 단순해짐.
- 미사용 `batchMove` 엔드포인트 상수 제거 (`shared/config/api.ts`).

### Fixed

- **비공개·삭제된 글에 접근했을 때 "서버 오류" 화면이 뜨던 문제** — BE가 비공개 글
  상세·댓글 조회를 404로 응답하도록 바뀌면서, 타인의 비공개 글이나 삭제된 글 URL에
  들어가면 백엔드 원문 메시지가 그대로 노출되는 전체화면 에러와 "서버 오류가
  발생했습니다" 토스트가 떴다. 이제 "포스트를 찾을 수 없습니다." 안내 토스트만 뜨고
  게시글 목록으로 이동함. (`PostDetailPage`, `queryClient`)
- **로그아웃 후 다른 계정으로 로그인하면 이전 사용자의 비공개 글이 화면에 남아있던
  문제** — 로그아웃 시 `queryClient.clear()`가 이미 화면에 마운트된 쿼리 옵저버를
  갱신 없이 고아로 만들어, 로그인 화면 전환 없이 같은 화면에 머무는 경우(비공개 글
  상세 등) 이전 사용자의 데이터가 계속 보이고 이후 로그인 시점의 캐시 무효화도
  닿지 않았다. `queryClient.resetQueries()`로 교체해 마운트된 화면이 새 인증 상태로
  즉시 다시 불러오도록 수정. (`AuthUtil.clearQueries`)
- **로그아웃 버튼을 누르면 로그인 페이지로 강제 이동하던 문제** — 위 `resetQueries()`
  수정의 부작용. 로그아웃 시 토큰을 먼저 지운 뒤 화면에 남아있던 쿼리(예: 상단
  내비게이션의 계정 조회)를 재요청하는데, zustand 상태 변경이 아직 컴포넌트
  리렌더로 반영되기 전이라 `enabled` 가드가 순간적으로 stale하게 통과되며 인증
  헤더 없이 요청이 나가 401(`NOT_LOGGED_IN`)을 받았다. 이 401을 세션 만료로 오인해
  로그인 페이지로 강제 이동시키고 "계정 정보 조회 실패" 토스트까지 띄우고 있었다.
  로그아웃이 트리거한 배경 재요청이 진행 중인 좁은 구간만 별도로 표시해 그 구간의
  401은 무시하도록 수정 — 실제 세션 만료(토큰 있음 → 401)는 기존대로 로그인
  페이지로 이동함. (`AuthUtil.isLoggingOut`, `client.ts`, `queryClient.ts`)

## [0.6.0] - 2026-07-28

### Added

- **검색어 한/영 자판 오타 자동 보정** — `spdlqj`처럼 한글을 영문 자판 상태로 잘못
  입력하거나, `메ㅔㅣㄷ`처럼 영문을 한글 자판 상태로 잘못 입력해도 검색이 되도록 함.
  검색 결과가 없을 때만 BE가 자판 변환 후보로 재검색하며, 보정이 적용된 경우 결과
  목록 위에 "'네이버'(으)로 검색한 결과입니다" 안내 문구를 표시함. 게시글 목록·북마크
  검색 양쪽에 적용됨. (이슈 #8)

### Fixed

- **링크 수정 화면을 열면 선택돼 있던 관심 분야가 매번 풀려 보이던 문제** — URL을 바꿨을
  때만 제목·관심 분야를 비우려던 로직이, 폼이 처음 열려 게시글 데이터로 채워지는 순간에도
  "URL이 바뀐 것"으로 잘못 판단해 곧바로 다시 비워버림. URL 변경 여부 판단 기준을 게시글의
  원래 URL(초기화 시점 값)로 고정해 초기 로드 시 오탐이 나지 않도록 수정.

## [0.5.0] - 2026-07-25

### Added

- **목록 로딩 중 스켈레톤 표시** — 링크 목록을 불러오는 동안 가운데 스피너 하나만 돌던 것을
  실제 카드 모양의 골격(작성자 줄·제목·설명·링크 프리뷰·액션 바)으로 교체. 로딩이 끝나도
  레이아웃이 튀지 않도록 카드와 동일한 그리드·여백을 사용함.
- **링크(URL) 수정 지원** — 수정 화면에서 URL을 직접 바꿀 수 있음. 기존에는 URL이 읽기
  전용으로 표시되고 제목·관심 분야·공개 설정만 수정 가능했음. URL을 변경하면 "제목·설명·
  이미지·AI 요약을 새 링크에서 다시 가져옵니다" 안내가 입력란 아래에 표시되며, 저장 시
  서버가 새 링크 기준으로 메타데이터와 AI 요약을 다시 생성함(입력한 제목은 새 링크의
  제목으로 대체됨).

### Changed

- **첫 화면이 인증 확인을 기다리지 않고 바로 뜸** — 기존에는 앱을 열면 인증 복원(`/auth/refresh`)이
  끝날 때까지 전체 화면 스피너만 보였고, 그동안 라우터 자체가 만들어지지 않아 페이지 코드
  다운로드와 목록 조회가 인증 요청 뒤로 밀렸음. 이제 화면 골격을 먼저 그리고 인증은
  백그라운드로 확인함. 서버가 콜드 상태일 때 특히 체감 차이가 큼.
- **비로그인 방문자는 인증 요청을 아예 보내지 않음** — 로그인한 적이 없으면 첫 로딩에서
  `/auth/refresh` 호출이 0건. 이전에는 로그인 여부와 무관하게 매번 호출하고 그 응답을
  기다렸음. 로그인 흔적은 토큰이 아닌 불리언 플래그만 브라우저에 저장하며, 플래그와 실제
  세션이 어긋나면 자동으로 정리됨.
- **링크 수정 중 URL을 바꾸면 제목·관심 분야가 초기화됨** — 옛 링크 기준 값이 남아 있는 것을
  방지. 비운 채로 저장하면 서버가 새 링크의 제목과 AI 자동 분류로 채우며, 원하면 직접 다시
  입력·선택할 수 있음. 이에 맞춰 수정 폼의 제목도 등록 폼처럼 선택 입력이 됨
  (비워두면 자동으로 가져옴).
- **헤더 진행 표시가 수정 작업에도 표시됨** — 기존에는 등록 중일 때만 '등록 중...' 배지가
  떴음. 수정 중에는 '수정 중...'으로 표시(`PostCreationLoadingBadge` →
  `PostMutationLoadingBadge`).
- **링크 수정 저장 시 즉시 목록으로 이동** — 기존에는 서버 응답을 기다리며 '수정하는 중...'
  상태로 수정 페이지에 머물렀음. 등록과 동일하게 요청을 백그라운드로 보내고 곧바로 목록으로
  이동하도록 변경(URL 변경 시 재크롤링·AI 재분석으로 응답이 길어지는 문제 해소). 완료 시
  토스트와 목록 갱신은 그대로 동작.
- **수정 저장 후 원래 보던 화면으로 스크롤 위치까지 유지한 채 복귀** — 기존에는 어디서
  수정했든 피드(`/post`) 최상단으로 이동했음. 북마크 목록에서 수정하면 해당 폴더 목록으로,
  상세에서 수정하면 상세로 돌아감(수정 URL로 직접 진입한 경우에는 기존대로 피드).
- **수정 진행 중인 카드에 '수정 중...' 표시** — 서버 응답 전까지 목록에 옛 내용이 보이던 것을
  카드 단위로 알 수 있게 함. 해당 카드만 흐려지고 상호작용이 잠겨, 같은 글에 대한 중복 수정·
  삭제 요청이 겹치는 것도 함께 막음. 300ms 안에 끝나는 수정에서는 표시되지 않음(깜빡임 방지).

### Fixed

- **상세 화면의 뒤로가기 버튼이 목록 첫 페이지 최상단으로 이동하던 문제** — 해당 버튼이
  `<Link to="/post">`(새 이동)이라 `<ScrollRestoration />`이 스크롤을 초기화했음. 브라우저
  뒤로가기와 동일하게 히스토리를 되돌아가도록 바꿔 스크롤 위치와 불러온 페이지가 유지됨
  (링크로 바로 진입해 되돌아갈 이력이 없으면 기존대로 피드로 이동).
- **북마크 목록에서 수정한 글이 옛 내용으로 보이던 문제** — 게시글 수정·공개설정 변경 시
  피드 캐시만 갱신하고 폴더별 게시글 목록 캐시(`folder.posts`)는 무효화하지 않아, 북마크
  화면에 이전 제목·설명·이미지가 계속 표시되던 것을 수정.
- **모바일 홈 피드 당겨서 새로고침(Pull-to-Refresh)** — 모바일에서 게시글 피드 최상단을
  아래로 당기면 목록을 새로고침. 당김 거리에 따라 상단 인디케이터가 나타나고, 임계값을
  넘겨 놓으면 목록을 재조회함. 데스크탑에서는 동작하지 않음.
- **북마크 '미분류'·'전체' 개수 표시** — 사이드바·모바일 칩·모바일 폴더목록·폴더 선택
  모달에서 미분류(폴더 미지정) 북마크 개수와 전체 개수를 표시. 북마크 토글이나 폴더
  이동 시 개수가 즉시 갱신됨(미분류 ↔ 폴더 이동 포함).

### Fixed

- **모바일 '전체' 북마크 개수가 실제보다 적게 표시되던 문제** — 폴더 개수만 합산해
  미분류 북마크가 누락되던 것을 '폴더 합 + 미분류'로 정확히 계산하도록 수정.
- **북마크 폴더 페이지에서 게시글 삭제 시 화면 미반영** — 삭제 후 폴더별 게시글 목록과
  폴더의 북마크 개수(bookmarkCount)가 갱신되지 않던 문제를 수정. 삭제 성공 시 folder
  목록·폴더별 게시글 쿼리를 재검증하도록 변경.
- **폴더 삭제 후 삭제된 폴더 URL에서 404 발생** — 폴더를 삭제해도 URL의 `?folder=<id>`가
  남아 존재하지 않는 폴더로 게시글을 조회해 404가 나던 문제를 수정. 삭제·미존재 폴더 UUID가
  URL에 있으면 '전체'로 리다이렉트하는 가드를 추가하고, 현재 보고 있는 폴더 삭제 시에는
  먼저 '전체'로 이동시켜 삭제된 폴더에 대한 재조회 자체를 방지.

## [0.4.0] - 2026-07-18

### Added

- **비로그인 콘텐츠 열람 지원** — 로그인하지 않아도 게시글 목록·상세·댓글을 열람할 수
  있도록 개방(사이드바·상단바·하단탭 등 화면 구성은 그대로 유지). 좋아요·북마크·댓글
  작성 버튼은 계속 노출되며, 비로그인 상태에서 누르면 로그인 유도.
- **로그인·회원가입 화면에서 피드로 나가는 진입점 추가** — 각 카드 헤더 상단에 클릭 시
  게시글 피드(`/post`)로 이동하는 'LinkSphere' 브랜드 링크를 배치. 로그인 화면에
  직접 진입해도 로그인 없이 둘러보기로 빠져나갈 수 있음.

### Changed

- **로그인 유도를 인라인 로그인 폼 모달로 변경** — 좋아요·북마크·댓글, 그리고 글 작성·북마크
  등 보호 페이지 진입 시, 로그인 페이지로 이동하지 않고 **그 자리에서 ID/PW를 입력해 바로
  로그인**할 수 있는 모달을 띄움. 로그인 성공 시 원래 하려던 페이지(예: 글 작성)로 이어짐
  (좋아요 등 액션은 자동 실행하지 않고 로그인만).
- **상단바 로그인 버튼도 모달로 변경** — 내비게이션의 로그인 버튼을 눌렀을 때 로그인 페이지로
  이동하지 않고 인라인 로그인 모달을 띄우도록 통일(로그인 페이지 라우트는 유지).
- **보호 페이지 진입 시 배경(피드) 유지** — Submit·Bookmark로 이동할 때 전체화면 스피너로
  덮이던 것을 없애고, 현재 피드가 배경으로 보이는 위에 로그인 모달만 뜨도록 변경
  (좋아요 버튼을 눌렀을 때와 동일한 경험).
- **로그아웃 시 현재 공개 화면 유지** — 로그아웃해도 게시글 상세 등 비로그인이 볼 수 있는
  화면이면 그 자리에 그대로 머물도록 변경(기존엔 로그인 화면/피드로 강제 이동). 글 작성·
  북마크 등 보호 페이지에서 로그아웃한 경우에만 공개 피드(`/post`)로 이동.
- **hover 시 미리 불러오기(prefetch)로 진입 체감속도 개선** — 마우스를 올린 시점에
  미리 데이터를 받아둬 클릭 시 스피너 없이 즉시 열리도록 함. 북마크 화면의 폴더에
  올리면 해당 폴더 게시글을, 게시글 카드 제목에 올리면 상세 페이지를 미리 로드.
  (데스크탑 전용, 3분 내 재요청 없음)
- **목록 로딩 시 우측 상단 원형 로딩 표시 제거** — 목록을 불러올 때 상단
  프로그레스바와 함께 우측 상단에 뜨던 원형 스피너를 껐음. 상단 프로그레스바는
  그대로 유지.

### Fixed

- **모바일에서 ⌘ + Enter 단축키 힌트 숨김** — 물리 키보드 단축키를 쓸 수 없는
  모바일 환경에서 댓글 작성 버튼에 불필요하게 노출되던 힌트를 데스크톱에서만
  표시하도록 변경.

### Notes

- BE API 의존: 비로그인 콘텐츠 열람은 BE의 비로그인 GET 엔드포인트 공개가
  필요 (BE `v0.3.0`)

## [0.3.0] - 2026-07-14

### Added

- **모바일 하단 탭바** — 모바일 화면에 항상 보이는 하단 탭바 추가(홈 · 링크 등록 ·
  북마크). 탭 1번 터치로 이동하며 현재 위치를 하이라이트. (검토했던 좌우 스와이프 전환
  방식은 앱 특성상 부적합하다고 판단해 철회)

### Fixed

- **수정 직후 이전 데이터가 잠깐 보이던 문제 수정** — 폴더 이름·프로필 닉네임·게시글
  수정 시, API 성공 후에도 화면(또는 목록)에 옛 값이 잠깐 남았다가 새 값으로 바뀌었음.
  세 경우 모두 수정 결과를 캐시에 즉시 반영하도록 수정(폴더·프로필은 낙관적 갱신 +
  실패 시 롤백, 게시글은 서버 응답을 목록·상세 캐시에 직접 반영)해 잔상 없이 즉시
  갱신되도록 개선.
- **모바일 검색창이 메뉴 이동 후에도 열린 채 유지되던 문제 수정** — 상단바 모바일
  검색창을 연 상태로 북마크·링크 등록 등에서 피드로 이동하면 검색창이 계속 열려 있었음.
  경로가 바뀌면 검색창을 닫도록 수정.
- **북마크 폴더 선택 팝업에 닫기(X) 버튼이 2개 보이던 문제 수정** — 다이얼로그 기본
  닫기 버튼과 커스텀 헤더의 닫기 버튼이 우상단에 겹쳐 X가 두 개로 보였음. 공용
  `Dialog`에 기본 닫기 버튼을 끌 수 있는 옵션을 추가하고, 폴더 선택 팝업은 커스텀 헤더
  버튼만 사용하도록 수정.
- **북마크 화면에서 북마크 취소가 즉시 반영되지 않던 문제 수정** — 카드 상세에서
  북마크를 취소하면 API는 성공했으나 폴더 목록·전체 건수·폴더별 건수가 갱신되지 않았음.
  북마크 토글 시 folder 계열 캐시(목록·건수)를 낙관적으로 반영하도록 수정해, 취소한
  카드가 즉시 사라지고 건수도 함께 감소.
- **보관함에서 폴더 이동 시 원본 폴더 건수가 줄어들지 않던 문제 수정** — 다른 폴더로
  이동하면 대상 폴더 건수는 늘었으나 원본 폴더 건수는 그대로였음. 이동 낙관적 갱신이
  원본 폴더 id를 `post.detail` 캐시에서만 읽어, 북마크 화면(해당 캐시 없음)에서는
  원본이 미분류(null)로 처리돼 감소가 누락됐음. `post.detail`이 없으면 folder 게시글
  캐시에서 원본 폴더를 찾도록 보완.

## [0.2.0] - 2026-07-11

### Added

- **북마크 페이지 내 검색** — 북마크 페이지에 전용 검색창 추가. 이제 전체 피드가
  아니라 현재 선택된 폴더(전체 · 미분류 · 사용자 폴더) 범위 내에서만 제목·설명·태그로
  검색됨. 검색어는 URL 쿼리 `q`로 동기화. (상단 네비바 전역 검색은 기존대로 전체 피드)

### Notes

- BE API 의존: `GET /bookmark/folders/{folderKey}/posts` 의 `search` 파라미터 필요
  (BE `v0.2.0`)

## [0.1.1] - 2026-06-28

### Changed

- 옵티미스틱 토글(좋아요·북마크) 실패 시, 기존엔 일반 에러 토스트가 떴으나
  앞으로는 토스트 없이 UI를 즉시 롤백 (옵티미스틱 UI 표준 동작)

### Fixed

- 에러 토스트가 두 번 뜨던 문제 수정. fetch 클라이언트(transport)·React Query
  전역 핸들러·개별 hook 세 레이어가 같은 에러에 각자 토스트를 띄우던 구조를,
  전역 핸들러를 "기본 토스트"의 단일 소유자로 통일하고 자체 토스트를 띄우는
  mutation에는 `manualErrorHandling`을 부여해 중복 제거 (로그인 실패 · 401/403 ·
  폴더/북마크 플로우)
- 프로필 이미지 업로드 시 일부 인앱 브라우저(예: 네이버 인앱)에서
  multipart 전송이 실패해 `imageUrl` 없는 비정상 200 응답이 와도
  "성공"으로 처리돼 `image=undefined`로 저장되던 문제 수정.
  업로드 응답을 Zod로 검증해 비정상 응답은 업로드 실패로 처리하고
  실패 토스트를 노출 (잘못된 빈 값 저장 방지)

## [0.1.0] - 2026-06-28

### Added

- **북마크 폴더 페이지** (`/bookmark`) — 폴더별로 북마크를 분류·탐색
  - 좌측 폴더 트리(데스크탑) / 상단 폴더 칩(모바일): 전체 · 미분류 · 사용자 폴더
  - 폴더 CRUD를 페이지 내에서 처리 (생성 / 이름 수정 / 삭제)
  - 정렬 4종 전환(최신 / 오래된 / 제목 / 조회수), URL 쿼리로 `folder`·`sort` 동기화
  - 무한 스크롤 게시글 목록 (기존 PostCard 재사용)
- **북마크 폴더 선택 UX** — YouTube Music 보관함 스타일 (탭 = 즉시 저장)
  - 데스크탑: Popover / 모바일: Bottom Sheet (`FolderSelector`)
  - 현재 폴더 ✓ 표시, "미분류" · "북마크 제거" · "+ 새 폴더 만들기" 항목
  - 북마크 버튼 클릭 시 단순 toggle 대신 폴더 선택 UI 오픈으로 변경
- 사이드바에 "북마크" 네비게이션 항목 추가
- `entities/folder`: 폴더 데이터 레이어(api·queries·schema),
  북마크 이동 시 옵티미스틱 업데이트(`useMoveBookmarkMutation`)

### Changed

- `post.schema`: `userInteractions.bookmarkFolderId` 필드 추가
  (게시글이 속한 폴더 표시용)

### Tests

- `folder.schema` Zod 스키마 및 `useMoveBookmarkMutation` 훅 테스트 추가 (16개)

### Notes

- BE API 의존: `/bookmark/folders` 등 폴더 API,
  `PostResponse.userInteractions.bookmarkFolderId` 필요
- 드래그앤드랍 · 다중 선택 · 폴더 공유는 차후 별도 작업

[Unreleased]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/BAECHAN/link-sphere_FE_NEW/releases/tag/v0.1.0
