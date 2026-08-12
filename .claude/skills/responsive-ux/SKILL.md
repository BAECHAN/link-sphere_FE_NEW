---
name: responsive-ux
description: Link-Sphere FE 반응형 UX 규약(모바일+데스크톱). 반응형 분기, 터치 UI, 하단 탭바·safe-area, 데스크톱 sticky·플로팅 버튼 관련 작업에 사용.
when_to_use: 모바일/데스크톱 UI를 만들거나 고칠 때, 반응형 분기를 추가할 때, 고정(fixed/sticky) 요소를 배치할 때.
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
md:hidden fixed bottom-0 inset-x-0 z-50 h-16 pb-[env(safe-area-inset-bottom)]
```

그 위에 새 고정 UI를 띄울 때:

- 탭바를 피해서 쌓으려면 `bottom-[calc(4rem+env(safe-area-inset-bottom))]`
- 탭바를 덮어야 하면(예: 전체화면 모달·확장 입력바) `z-index`를 55 이상으로

`AppLayout`(`src/app/layouts/app-layout/AppLayout.tsx`)의 `main`은 `pb-28 md:pb-16`으로 이미 탭바 높이를 확보해 놓았다 — 새로 스크롤 영역을 만들 때 이 값을 다시 계산하지 않아도 된다.

### 토스트 오프셋

`src/app/globals.css`에 `--toast-offset-bottom`이 정의돼 있고, 탭바 높이를 피해 계산된다:

```css
@media (max-width: 767px) {
  :root {
    --toast-offset-bottom: calc(4rem + env(safe-area-inset-bottom) + 0.75rem);
  }
}
```

하단에 탭바보다 높은 고정 UI(예: 확장형 입력바)를 추가하면, 그 UI가 떠 있는 동안만 이 변수를 늘리고 언마운트 시 되돌린다. 선례: `MobileCommentBar.tsx`(ResizeObserver로 실측 높이만큼 조정).

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

### sticky vs fixed

- **데스크톱**은 문서 흐름을 유지하는 `sticky` 위주 — `Navbar`(`sticky top-0 z-50`), `Sidebar`(`sticky top-0 h-screen`), `BookmarkPage`의 폴더 패널(`sticky top-4 self-start`).
- **모바일**은 뷰포트에 완전히 고정하는 `fixed` + safe-area 위주(위 "하단 고정 요소" 참고).
- 페이지 전체가 스크롤되는 단일 컬럼 레이아웃(게시글 상세 등)에서 데스크톱에 "상시 보이는 sticky 패널"을 새로 넣을지 고민될 때는, 화면 상단을 계속 차지하는 비용과 편의성을 저울질할 것 — 이 코드베이스는 지금까지 이런 경우 아래 "플로팅 버튼" 쪽을 택했다.

### 데스크톱 플로팅 버튼

우측 하단 플로팅 아이콘 버튼 자리(`fixed bottom-6 right-6 z-50`, `rounded-full h-12 w-12 shadow-lg`, framer-motion `AnimatePresence`+`motion.div` 페이드)를 페이지별로 상호 배타적으로 나눠 쓴다:

| 컴포넌트                                                       | 트리거                                                            | 적용 페이지                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `src/shared/ui/elements/ScrollToTop.tsx`                       | `window.scrollY > 300`                                            | 상세 페이지(`/post/:id`) 제외 전역                     |
| `src/features/comment/create/ui/ScrollToCommentFormButton.tsx` | `IntersectionObserver`로 상단 작성 폼이 화면 밖으로 나갔는지 감지 | 상세 페이지 전용(`CommentList`가 이 페이지에서만 쓰임) |

새 데스크톱 플로팅 버튼이 필요하면 이 표에 어느 페이지에서 켜지는지부터 정하고, 기존 버튼과 같은 페이지에서 동시에 뜨지 않게 한다(z-50 하나뿐이라 자리가 겹치면 시각적으로 충돌한다).

## z-index 사다리 (실측, 모바일+데스크톱 공용)

| 값  | 사용처                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 40  | `RecentSearchPanel`, `MobileCommentBar` 접힘 상태                                                             |
| 50  | `Navbar`(sticky top), `BottomTabBar`, 데스크톱 플로팅 버튼(`ScrollToTop`/`ScrollToCommentFormButton`)         |
| 55  | `Sidebar` 모바일 오버레이, `MobileCommentBar` 확장 상태                                                       |
| 60  | `Sidebar` 모바일 드로어                                                                                       |
| 70  | `Dialog` 오버레이·콘텐츠(`shared/ui/atoms/dialog.tsx`) — Alert/Confirm, 로그인 모달, 이미지 뷰어 등 모든 모달 |
| 80  | 포털 팝오버 — `tooltip`/`dropdown-menu`/`select`(`shared/ui/atoms/`)                                          |

모달(70)·팝오버(80) 층은 고정 UI 사다리(40~60)의 최상단 의도를 담고 있다 — 새 고정
UI에 70 이상을 쓰지 말 것. 모달이 다른 고정 UI보다 항상 위에 뜨지 못하면(예: 이탈
확인창이 열린 드로어 뒤에 가리는 것) 사용자가 모달을 조작할 수 없게 된다.

## 점검 항목

- 375px 뷰포트에서 가로 스크롤 0
- `md:` 이상에서 기존 데스크톱 레이아웃과 시각적으로 동일(반대로 모바일 전용 요소가 데스크톱에 새지 않는지도 확인)
- 고정 UI가 탭바·토스트·다른 플로팅 버튼과 겹치지 않음
- 모바일 터치 타깃 44px, 입력 폰트 16px 이상
- 데스크톱 hover 상태가 자연스럽게 동작
