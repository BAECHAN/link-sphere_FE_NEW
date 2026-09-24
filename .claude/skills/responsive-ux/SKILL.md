---
name: responsive-ux
description: Link-Sphere FE 반응형 UX 규약(모바일+데스크톱). 반응형 분기, 터치 UI, 하단 탭바·safe-area, 데스크톱 sticky·플로팅 버튼, hover 컨테이너 안에 드롭다운·팝오버를 둘 때 관련 작업에 사용.
when_to_use: 모바일/데스크톱 UI를 만들거나 고칠 때, 반응형 분기를 추가할 때, 고정(fixed/sticky) 요소를 배치할 때, hover 스타일이 있는 컨테이너(카드·행) 안에 드롭다운·팝오버 트리거를 둘 때.
paths: src/**/*.tsx
---

이 코드베이스는 컴포넌트 하나가 Tailwind `md:` 분기로 모바일·데스크톱을 함께 처리한다
(별도 빌드가 아니다). 아래 규약은 두 뷰포트에 공통으로 적용되며, 모바일 전용/데스크톱
전용 규칙은 각 절에서 구분해 표시한다.

## 브레이크포인트

- `md` = 768px. Tailwind `md:` 분기를 기본으로 쓴다.
- JS 분기가 꼭 필요할 때만 `useIsMobile()`(`src/shared/hooks/useIsMobile.ts`, UA + `matchMedia('(max-width: 768px)')`).

## 모바일 규약

### 터치 타깃

- 상호작용 요소(버튼, 링크, 아이콘 버튼)는 모바일에서 최소 44px.
- 데스크톱 밀도를 유지해야 하면 `min-h-11 md:min-h-0` 형태로 모바일에만 적용.
- 입력 요소(`input`/`textarea`) 폰트는 16px 이상 유지 — 작으면 iOS Safari가 포커스 시 자동 확대(줌)한다. `Textarea`는 `text-base md:text-sm`으로 이미 이 기준을 지킨다.

### 하단 고정 요소 충돌 규칙

`BottomTabBar`(`src/widgets/layout/bottom-tab-bar/ui/BottomTabBar.tsx`)는:

```
// nav
md:hidden fixed bottom-0 inset-x-0 z-nav border-t bg-background pb-[env(safe-area-inset-bottom)]
// 내부 div — 실제 높이는 여기서 결정된다
flex h-16
```

그 위에 새 고정 UI를 띄울 때:

- 탭바를 피해서 쌓으려면 `bottom-[calc(4rem+env(safe-area-inset-bottom))]`
- 탭바를 덮어야 하면(예: 전체화면 모달·확장 입력바) `z-scrim`(55) 이상 토큰을 쓴다

`AppLayout`(`src/app/layouts/app-layout/AppLayout.tsx`)의 `main`은 하단 패딩이
`pb-28`(모바일)·`md:pb-16`(데스크톱)으로 이미 탭바 높이를 확보해 놓았다 — 새로
스크롤 영역을 만들 때 이 값을 다시 계산하지 않아도 된다.

### 토스트 오프셋

`src/app/globals.css`에 `--toast-offset-bottom`이 정의돼 있고, 탭바 높이를 피해 계산된다:

```css
@media (max-width: 767px) {
  :root {
    --toast-offset-bottom: calc(4rem + env(safe-area-inset-bottom) + 0.75rem);
  }
}
```

하단에 탭바보다 높은 고정 UI(예: 확장형 입력바)를 추가하면, 그 UI가 떠 있는 동안만 이 변수를 늘리고 숨김/언마운트 시 되돌린다. 선례: `MobileCommentBar.tsx`(ResizeObserver로 실측 높이만큼 조정, CSS로 숨기는 동안엔 가드절로 기본값을 되돌림 — `offsetHeight`가 0이 되어 어긋나는 것을 막는다).

### 모바일 선례 파일

| 패턴                                  | 파일                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| 하단 고정 + safe-area                 | `src/widgets/layout/bottom-tab-bar/ui/BottomTabBar.tsx`                               |
| 접힘/펼침 하단 sticky 입력바          | `src/features/comment/create/ui/MobileCommentBar.tsx`                                 |
| 모바일 전용 풀스크린 오버레이         | `src/widgets/layout/navbar/ui/RecentSearchPanel.tsx`                                  |
| 모바일 제스처(pull-to-refresh)        | `src/widgets/post/post-list/ui/PostList.tsx` + `src/shared/hooks/usePullToRefresh.ts` |
| 모바일 링크 동작 분기(`target=_self`) | `src/shared/ui/elements/MarkdownContent.tsx`                                          |

## 데스크톱 규약

### hover와 밀도

- 데스크톱은 마우스 hover 상태를 쓸 수 있다(모바일엔 없음) — `hover:` 클래스는 데스크톱 상호작용의 기본.
- 모바일에서 넓힌 터치 타깃(`min-h-11` 등)은 `md:min-h-0`처럼 되돌려 데스크톱 밀도를 원래대로 유지한다.
- **hover 스타일이 있는 컨테이너 안에 드롭다운·셀렉트·팝오버 트리거를 두면 `hover:` 대신
  `hover-or-open:`(`globals.css`)을 쓴다.** `DropdownMenuContent`(`shared/ui/atoms/dropdown-menu.tsx`)
  등 팝업 콘텐츠는 Portal로 `<body>`에 렌더돼 커서가 메뉴로 들어가는 순간 컨테이너는 더 이상
  `:hover` 상태가 아니게 된다 — 메뉴를 열고 항목 위로 커서를 옮기면 카드가 원래대로 풀리는
  버그가 이 때문에 생긴다(2026-09-24, `PostCard.tsx`·`FolderTree.tsx`에서 실제로 발견). `hover-or-open`은
  `:hover` 또는 `:has([aria-haspopup][aria-expanded="true"])`를 함께 보므로, 컨테이너 안의
  트리거가 열려 있는 동안에도 스타일이 유지된다. `hover:`처럼 `@media (hover: hover)` 안에서만
  적용되므로 모바일 동작은 바뀌지 않는다. 선례: `src/widgets/post/post-card/ui/PostCard.tsx`,
  `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`.

### sticky vs fixed

- **데스크톱**은 문서 흐름을 유지하는 `sticky` 위주 — `Navbar`(`sticky top-0 z-50`), `Sidebar`(`sticky top-0 h-screen`), `BookmarkPage`의 폴더 패널(`sticky top-[calc(var(--navbar-height)+1rem)] h-[calc(100vh-var(--navbar-height)-2rem)] self-start` — 2026-09-21, 원래 `top-4`만 쓰다 Navbar와 44px 겹치던 버그를 고치며 `top`을 조정하고, 폴더가 많을 때 자체 스크롤하도록 `h-[...]`도 추가했다. `docs/BOOKMARK.md` §10 참고).
- **모바일**은 뷰포트에 완전히 고정하는 `fixed` + safe-area 위주(위 "하단 고정 요소" 참고).
- 페이지 전체가 스크롤되는 단일 컬럼 레이아웃(게시글 상세 등)에서 데스크톱에 "상시 보이는 sticky 패널"을 새로 넣을지 고민될 때는, 화면 상단을 계속 차지하는 비용과 편의성을 저울질할 것 — 이 코드베이스는 지금까지 이런 경우 아래 "플로팅 버튼" 쪽을 택했다.

### 플로팅 버튼

우측 하단 플로팅 아이콘 버튼 자리(`fixed right-6 z-nav`, `rounded-full h-12 w-12
shadow-lg`, CSS transition + `setTimeout`으로 exit 애니메이션 동안 마운트 유지 —
framer-motion 아님, `package.json`에 없음)를 페이지별로 상호 배타적으로 나눠 쓴다.
세로 위치와 노출 조건은 컴포넌트별로 다르다:

| 컴포넌트                                                       | 세로 위치                                   | 노출/게이트                                                                                                                  | 적용 페이지                                            |
| -------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/shared/ui/elements/ScrollToTop.tsx`                       | `bottom-20 md:bottom-6`(모바일은 탭바 회피) | `window.scrollY > 300`. 모바일+데스크톱 공용, 뷰포트 게이트 없음                                                             | 상세 페이지(`/post/:id`) 제외 전역                     |
| `src/features/comment/create/ui/ScrollToCommentFormButton.tsx` | `bottom-6`                                  | `IntersectionObserver`로 상단 작성 폼이 화면 밖으로 나갔는지 감지 + JS `!isMobile` 게이트(`CommentList.tsx`)로 데스크톱 전용 | 상세 페이지 전용(`CommentList`가 이 페이지에서만 쓰임) |

새 플로팅 버튼이 필요하면 이 표에 어느 페이지에서 켜지는지부터 정하고, 기존 버튼과
같은 페이지에서 동시에 뜨지 않게 한다(`z-nav` 하나뿐이라 자리가 겹치면 시각적으로
충돌한다).

## z-index 사다리 (실측, 모바일+데스크톱 공용)

`globals.css`가 8단계를 이름 있는 토큰으로 정의하고, `custom-tailwind/no-raw-z-index`
ESLint 룰이 `z-50` 같은 raw 숫자 클래스를 pre-commit에서 차단한다 — 아래 값은 참고용,
실제로는 토큰을 쓴다.

| 토큰        | 값  | 사용처                                                                                                          |
| ----------- | --- | --------------------------------------------------------------------------------------------------------------- |
| `z-raised`  | 10  | 카드 내부 오버레이 (`DropTargetOverlay.tsx`, `PostCard.tsx`)                                                    |
| `z-hitbox`  | 20  | 드롭 히트박스 (`DropTargetOverlay.tsx`)                                                                         |
| `z-panel`   | 40  | `RecentSearchPanel`, `MobileCommentBar` 접힘 상태                                                               |
| `z-nav`     | 50  | `Navbar`(sticky top), `BottomTabBar`, 플로팅 버튼(`ScrollToTop`/`ScrollToCommentFormButton`)                    |
| `z-scrim`   | 55  | `Sidebar` 모바일 오버레이, `MobileCommentBar` 확장 상태                                                         |
| `z-drawer`  | 60  | `Sidebar` 모바일 드로어                                                                                         |
| `z-modal`   | 70  | `Dialog` 오버레이·콘텐츠(`shared/ui/atoms/dialog.tsx`) — Alert/Confirm, 로그인 모달, 이미지 뷰어 등 모든 모달   |
| `z-popover` | 80  | 팝오버 — `tooltip`/`dropdown-menu`/`select`(`shared/ui/atoms/`), `RecentSearchDropdown.tsx`(widgets, 포털 아님) |

`z-raised`/`z-hitbox`(10~20)는 카드 내부 지역 스택용이라 화면 고정 UI 사다리
(`z-panel`~`z-drawer`, 40~60)와 층이 다르다. 모달(`z-modal`)·팝오버(`z-popover`) 층은
고정 UI 사다리의 최상단 의도를 담고 있다 — 새 고정 UI에 `z-modal` 이상을 쓰지 말 것.
모달이 다른 고정 UI보다 항상 위에 뜨지 못하면(예: 이탈 확인창이 열린 드로어 뒤에
가리는 것) 사용자가 모달을 조작할 수 없게 된다.

## 화면 덮는 오버레이의 배경 스크롤 잠금

배경(main/document)을 완전히 덮는 새 T1 오버레이(모바일 사이드바 드로어·모바일 검색처럼
`docs/DECISIONS.md`가 분류한 것)를 만들 때는 배경 스크롤도 함께 잠가야 한다 — 그러지
않으면 오버레이 자신의 스크롤 영역을 끝까지 스크롤한 뒤 계속 스와이프할 때 배경으로
스크롤이 체이닝되고, 오버레이를 닫으면 배경이 조용히 다른 위치로 튀어 있는 버그가 난다.

- **`shared/ui/atoms/dialog.tsx`(Radix `Dialog`) 기반이면 아무것도 안 해도 된다** —
  `modal`(기본 `true`)일 때 내부적으로 `react-remove-scroll`을 걸어 자동으로 잠긴다.
- **순수 `<div>`로 직접 짠다면 `RemoveScroll`(`react-remove-scroll`)로 직접 감싼다** —
  `Dialog`가 내부에서 쓰는 것과 같은 라이브러리를 그대로 재사용한다(#125에서
  `package.json`에 직접 의존성 `2.7.2`로 핀해 뒀다 — Radix 전이 의존성에 기대지 않는다).
  ```tsx
  <RemoveScroll as={Slot} allowPinchZoom>
    <div className="...">...</div>
  </RemoveScroll>
  ```
  `as={Slot}`(`@radix-ui/react-slot`)을 쓰면 별도 wrapper DOM이 안 생긴다. 오버레이의
  스크롤 영역과 시각적 덮개가 같은 요소면 `shards`는 필요 없다. 배경(백드롭)과 실제
  콘텐츠 패널이 DOM상 형제로 분리돼 있다면(예: `Sidebar` 모바일 드로어의 백드롭+`aside`)
  `shards={[패널ref]}`로 패널을 Lock의 일부로 지정해 패널 안쪽 스크롤은 허용해야 한다 —
  선례: `RecentSearchPanel.tsx`(shards 불필요, 자기 자신이 스크롤 영역), `Sidebar.tsx`
  (백드롭에 `shards={[drawerRef]}`).
- 근거·검토한 대안은 [`docs/DECISIONS.md`](../../../docs/DECISIONS.md) "2026-09-17 — T1
  오버레이 배경 스크롤 잠금" 참고.

## 점검 항목

- 375px 뷰포트에서 가로 스크롤 0
- `md:` 이상에서 기존 데스크톱 레이아웃과 시각적으로 동일(반대로 모바일 전용 요소가 데스크톱에 새지 않는지도 확인)
- 고정 UI가 탭바·토스트·다른 플로팅 버튼과 겹치지 않음
- 모바일 터치 타깃 44px, 입력 폰트 16px 이상
- 데스크톱 hover 상태가 자연스럽게 동작
- hover 컨테이너 안에 드롭다운·팝오버가 있다면 `hover:` 대신 `hover-or-open:`을 썼는가
