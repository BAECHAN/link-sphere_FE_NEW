# Link-Sphere FE — 설계·UX 의사결정 기록

되돌리기 어렵거나 "왜 이렇게 했는지"가 코드만으로 드러나지 않는 설계·UX 결정을 기록합니다.
무엇을 바꿨는지는 [CHANGELOG.md](../CHANGELOG.md), 날짜별 자동 변경 로그는 [HISTORY.md](./HISTORY.md)를 참고하세요.
이 문서는 **"왜"** 를 남기는 곳입니다. 형식은 가볍게: 배경 / 결정 / 이유 / 상태.

---

## 2026-09-21 — 다크모드·필터칩 중복 클릭 방지: 8ms 채터링 가드 (300ms대 디바운스 기각)

**배경**

다크모드 버튼·필터칩을 눌러도 반영이 안 되는 것 같다는 제보를 화면 녹화 영상으로 받아
20fps로 프레임을 뜯어 배경색을 픽셀 단위로 직접 측정했다. 2초 안에 7번 토글이 찍혔지만,
사용자가 재현을 위해 의도적으로 여러 번 빠르게 누른 것이었다 — 짝수 번 누르면 원래
상태로 돌아가는 토글의 정의 자체가 원인이었다. 그럼에도 사람이 낼 수 없는 속도의 중복
클릭(마우스 스위치 접점 불량, 채터링)이 실제로 들어올 가능성은 방지할 가치가 있다고
판단해 대안을 비교했다.

**검토**

- **아무것도 안 한다** — 기각: 채터링이 실제로 발생하면 토글이 짝수 번 눌려 "반영 안 됨"
  으로 보이는 문제를 그대로 방치한다.
- **300~1000ms대 디바운스(React 커뮤니티의 흔한 "중복 제출 방지" 패턴,
  [예시](https://medium.com/@daveford/prevent-double-click-dups-in-react-83fcbc475704))**
  — 기각: 실제로 구현해 기존 테스트에 돌려본 결과 `Navbar.test.tsx`의 "다시 누르면
  라이트로 돌아간다"(딜레이 0ms로 두 번 클릭)와 `usePostList.test.tsx` 시나리오 C(로딩
  중 같은 필터 재클릭 취소)가 실제로 깨졌다. 이 앱은 이미 "즉시 재클릭하면 정확히
  취소된다"를 테스트로 보장하고 있어, 이 규모의 디바운스는 그 계약과 정면으로 충돌한다.
- **8ms 채터링 가드(채택)** — 아래 이유 참고.

**결정**: `useClickGuard(thresholdMs = 8)` 훅을 만들어 `FilterChip`·다크모드 토글 버튼에만
적용한다. 값은 실제 게이밍 마우스 소프트웨어(Logitech G Hub, Razer Synapse 등)가
노출하는 채터링 방지 debounce 설정값을 그대로 가져왔다 —
_"Bumping it to 8 ms hides most low-grade chatter"_
([Angry Miao](https://store.angrymiao.com/blogs/insider-stories/how-to-fix-mouse-double-clicking)).

**이유**: 이 앱 자체가 요구하는 "즉시 재클릭" 간격을 실측한 결과 4ms였다(`userEvent.click()`
두 번을 `performance.now()`로 직접 측정) — 8ms는 이보다 커서 이론상 여전히 충돌 여지가
있었으나, 두 기존 테스트의 실제 클릭 간격이 딜레이 없는 합성 이벤트였을 뿐 사람이 그
속도로 재클릭할 일은 없다는 점에 근거해 테스트 쪽에 20ms 지연을 추가하는 것으로
해결했다(실제 앱 동작이 아니라 테스트의 타이밍 가정만 현실화한 것). 실제 브라우저에서
동기적으로 연속 `click()`을 두 번 호출하면 한 번만 반영되고, 100ms 간격 재클릭은
매번 정상 토글됨을 Playwright로 실측 확인했다.

**상태**: 적용 완료. `src/shared/hooks/useClickGuard.ts`.

---

## 2026-09-21 — 새 폴더 만들기 취소: ESC 소유권 이동 + blur/click 경합 해법 비교

**배경**

북마크 새 폴더 만들기 인라인 폼(저장 모달·데스크톱 사이드바·모바일 카드) 3곳에 취소
버튼을 추가하면서, 두 가지 구현 함정을 만났다. 둘 다 "취소를 넣는다"는 결정 자체가
아니라 넣는 과정에서 실제로 대안을 비교해 고른 것이라 여기 남긴다(기능 서술은
`docs/BOOKMARK.md` §5 "새 폴더 만들기 인라인 폼의 취소" 참고).

**함정 1 — Escape가 폼이 아니라 모달 전체를 닫음**

저장 모달(`BookmarkFolderSelectModal.tsx`)의 생성 입력에 `onKeyDown`으로 ESC를
받아 폼만 접으려 했는데, 실제로는 모달 전체가 닫혔다. 원인을 추적한 결과
`@radix-ui/react-use-escape-keydown`이 `document`에 **capture 단계**로 리스너를
건다(`ownerDocument.addEventListener('keydown', handleKeyDown, { capture: true })`).
React 18의 루트(`src/main.tsx`)는 `#root`에 붙으므로 캡처 순서상 Radix의 리스너가
Input의 React `onKeyDown`보다 항상 먼저 실행된다 — Input에서
`e.stopPropagation()`을 호출해도 이미 늦은 뒤라 아무 효과가 없다.

**결정**: `stopPropagation()`으로는 고칠 수 없으므로, Dialog가 노출하는
`onEscapeKeyDown` 콜백에서 `preventDefault()`로 dismiss 자체를 막는 쪽으로
바꿨다(`SheetDialogContent`에 `onEscapeKeyDown` prop을 그대로 통과시킴). 생성
폼이 열려 있을 때만 이 처리를 하고, 아니면 즉시 `return`해 기존 "ESC로 모달 닫기"
동작을 그대로 보존한다. `dialog.tsx`의 IME 조합 가드(`if (e.isComposing) { … return; }`)
가 이 콜백보다 먼저 돌기 때문에 조합 중 ESC와 충돌하지 않는다.

**함정 2 — 빈 입력에서 취소를 누르면 클릭이 유실될 수 있음**

데스크톱 사이드바·모바일 카드는 입력이 비어 있을 때 `onBlur`가 폼을 자동으로
접는다(`if (!name) { onClose(); }`). 취소 버튼을 입력 옆에 두면, 빈 입력 상태로
취소를 클릭할 때 `mousedown → blur(폼 언마운트) → click`의 순서가 되어 취소의
`onClick`이 실제로는 실행되지 않을 수 있다. 결과(폼이 접힘)는 의도와 같아 보이지만,
핸들러가 실행되지 않았을 뿐이다.

검토한 해법 3가지:

| 안                                                       | 탈락/채택 이유                                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (가) 취소 버튼에 `onMouseDown` preventDefault — **채택** | 포커스 이동 자체를 막아 blur가 안 남. 기존 훅 시그니처·테스트를 하나도 안 건드리고, 이 처리가 브라우저에서 안 먹어도 blur 경로가 같은 결과를 내 안전하게 열화된다 |
| (나) `handleBlur`에서 `e.relatedTarget` 확인             | 훅 시그니처가 `handleBlur(e)`로 바뀌어 기존 테스트가 깨지고, iOS Safari는 탭으로 버튼에 포커스를 주지 않아 `relatedTarget`이 `null`이 되어 가드가 무효화됨        |
| (다) blur 자동 닫힘 핸들러 자체 제거                     | "빈 폼을 바깥 탭으로 접는다"는 기존 동작이 사라져 승인받지 않은 체감 회귀가 생김                                                                                  |

(가)를 채택했다. 이 레포에 "blur-close 입력 옆에 버튼이 붙은" 선례가 없어(전체
`onBlur` 6곳 중 이 패턴은 0건) 새로 만든 형태다.

**상태**

적용 완료. 실제 브라우저(Playwright)로 사이드바에서 **입력이 빈 상태로** 취소를
클릭해도 정상 동작함을 실측 확인. 계획 스냅샷:
`docs/plans/2026-09-21-bookmark-create-folder-cancel.md`.

---

## 2026-09-22 — 사이드바 "새 폴더 만들기" 위치: 모달 선례 재검토 + Polaris 근거로 하단→상단 전환

**배경**

2026-09-21에 사이드바 자체 스크롤을 도입하면서 "새 폴더 만들기"를 하단 고정으로
뒀다(바로 위 2026-09-21 항목). 사용자가 실제 화면을 보고 "내 폴더" 라벨이 스크롤에
같이 밀리는 것과 함께 "새 폴더 만들기"를 상단에 두는 게 나을지 확인해 달라고
요청했다.

조사 결과 이 레포 안에 이미 반대 사례가 있었다 — 폴더 선택 모달
(`BookmarkFolderSelectModal.tsx`)은 2026-09-11에 정확히 같은 고민(스크롤 중 상시
노출 행을 어디 둘지)을 하고 "새 폴더 만들기"를 **헤더 바로 아래(상단)**에 두기로
했다(이 문서 2026-09-11 "보관함 모달" 항목, "생성 발견성 최상 — 새 폴더 만들기가
목록보다 먼저 눈에 들어옴" 근거로 채택. 하단 안은 "모바일에서 파괴 액션(북마크
제거)이 엄지 위치에 상시 노출됨" 때문에 기각). 그런데 2026-09-21 사이드바 스크롤을
설계할 때는 모달에서 "목록만 스크롤 + 상시 노출 행은 스크롤 밖 고정"이라는
**구조**만 가져오고, "생성 버튼을 정확히 어디 둘지"는 모달 선례와 대조하지 않은 채
하단으로 정했다 — 모달의 하단 기각 사유(파괴 액션 엄지 노출)는 사이드바엔 데스크톱
전용이고 파괴 액션 행 자체가 없어 애초에 해당하지 않는데도.

**검토**

외부 근거도 확인했다 — Shopify Polaris 디자인 시스템(GitHub 소스로 직접 확인:
https://github.com/Shopify/polaris-react/pull/11796/files):

> _"Place add actions at the bottom of a list unless the list will likely be long"_
> (목록이 짧으면 하단) / _"Place add actions in the header in long lists of resources"_
> (길거나 스크롤되는 목록이면 헤더=상단)

우리 사이드바는 방금 "폴더 많으면 스크롤"을 도입한 대상이라 정확히 후자 조건에
해당한다.

|      | 하단 유지                                                                                                                  | 상단 이동 — **채택**                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 근거 | 사이드바는 상시 노출돼 매번 새로 훑을 필요가 없고, 생성은 자주 쓰는 액션이 아니라 맨 위 자리가 아까울 수 있다(사용자 직관) | 모달 선례(생성 발견성) + Polaris(긴/스크롤 목록은 헤더에 add 액션) |
| 반례 | 모달의 "하단 기각 사유"(파괴 액션 엄지 노출)가 사이드바엔 애초에 없어, 하단을 유지할 근거가 약하다                         | —                                                                  |

사용자에게 두 근거를 제시하고 상단으로 확인받았다(하단 유지도 나름의 직관은
있었으나, 반례가 더 결정적이라고 판단).

**결정**

`FolderTree.tsx`의 상단 고정 블록 끝에 `<CreateFolderInput />`과 divider, "내 폴더"
라벨을 추가하고, 스크롤 영역 안쪽의 "내 폴더" 라벨은 제거해 폴더 행만 남겼다(사용자가
같이 보고한 "라벨이 스크롤에 같이 밀린다" 문제도 함께 해결). 기존 하단 고정 블록은
제거했다.

**상태**: 적용 완료. `docs/BOOKMARK.md` §10 "'내 폴더' 라벨이 스크롤에 같이 밀리고
'새 폴더 만들기'가 하단이었던 문제" 참고. 계획 스냅샷:
`docs/plans/2026-09-22-bookmark-sidebar-create-position.md`.

---

## 2026-09-21 — ⋮ 메뉴 트리거: Radix 기본 동작(pointerdown 오픈)에서 click 오픈으로 이탈

**배경**

북마크 폴더 목록의 ⋮ 메뉴를 누르면 메뉴가 떴다가 아무 일도 없이 사라진다는 제보를
Radix `DropdownMenu` 2.1.16 소스를 직접 읽어 추적했다. `DropdownMenuTrigger`가
`onPointerDown`(누르는 순간, 떼기 전)에서 즉시 메뉴를 열고, `MenuItem`은
`onPointerUp`에서 `if (!isPointerDownRef.current) event.currentTarget?.click()` —
그 항목에서 직접 누르지 않았어도 거기서 손을 떼면 클릭을 강제 발동한다. 트리거를
누른 채 손이 몇 px만 밀려도(사람이면 불가피) 이미 열린 메뉴의 첫 항목 위에서
`pointerup`이 나 "이름 수정"이 오발동됐다 — 이름이 그대로라 API 호출 없이 조용히
원복돼 사용자에겐 "메뉴가 떴다 그냥 사라진" 것으로 보였다.

**검토**

- **그대로 둔다** — Radix 기본값이라 관리 비용이 없다. 기각: 파괴적/상태변경 액션
  (이름 변경·삭제)의 오발동을 그대로 방치하는 것이라 안전성 문제를 덮어두는 셈이다.
- **sideOffset·padding만 키워 손 떨림 여유를 늘린다** — 코드 변경이 작다. 기각:
  원인(down-event 실행) 자체는 그대로라 더 큰 손 떨림에는 여전히 재현된다 — 증상
  완화일 뿐 근본 수정이 아니다.
- **click(=pointerup 후) 오픈으로 바꾼다(채택)** — 아래 이유 참고.

WCAG 2.2 성공 기준 **2.5.2 Pointer Cancellation(Level A)**의 첫 조건은 _"The
down-event of the pointer is not used to execute any part of the function"_ 이고,
Understanding 문서는 그 이유를 _"cancel the action by moving their pointer or
finger away from the target before releasing"_ — 떼기 전에 포인터를 치워 취소할
기회를 주기 위해서라고 설명한다
([W3C, Understanding SC 2.5.2](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)).
Radix 저장소에도 같은 지적이 open 상태로 쌓여 있다 —
[#3124](https://github.com/radix-ui/primitives/issues/3124)(WCAG 2.5.2 위반 직접
지적), [#3012](https://github.com/radix-ui/primitives/issues/3012),
[#2418](https://github.com/radix-ui/primitives/issues/2418)(터치 스크롤 충돌).
메인테이너 답변은 없다.

**Radix가 pointerdown을 택한 이유(반대 근거)도 기록한다** — macOS 네이티브 메뉴의
"눌러서 끌어 한 번에 선택"을 재현해 클릭 두 번을 한 동작으로 줄이는 효율 논거다.
Material UI의 `Select`도 같은 이유로 `mouseDown`을 쓴다. 이 레포에서 그 효율을
포기하는 이유는 ⋮ 메뉴 항목이 이름 변경·삭제 같은 되돌리기 어려운/상태변경 액션이라
오발동 비용이 "한 동작 절약"보다 크기 때문이다 — 단순 네비게이션 메뉴였다면 이 결정은
달랐을 것이다.

**결정**: `shared/ui/atoms/dropdown-menu.tsx`가 open 상태를 직접 들고 Radix Root에
controlled로 넘긴다. 트리거의 `onPointerDown`은 항상 `preventDefault()`로 Radix
내부 열기 핸들러를 막고, `onClick`에서만 연다. 키보드(Enter/Space/ArrowDown)는
Radix가 그 자리에서 `preventDefault()`를 호출해 클릭 합성과 겹치지 않으므로 건드리지
않는다.

**이유**: 이 컴포넌트 하나를 고치면 이걸 쓰는 4곳(폴더 메뉴 데스크톱·모바일, 게시글
카드 메뉴, 계정 메뉴)이 함께 낫는다. 수정 전 실패·수정 후 통과를 실제 Playwright로
확인했다 — 마우스로 트리거를 누른 채 "이름 수정" 항목까지 이동했다 떼는 시퀀스를
`document`의 `click` 이벤트 관찰로 직접 재현·고정했다(`e2e/bookmark-folder-menu-
press-drag.spec.ts`).

**되돌리기 비용**: Radix `@radix-ui/react-dropdown-menu` 메이저 업그레이드 시 내부
구조(예: Trigger가 onPointerDown 대신 다른 이벤트로 열게 바뀌거나, Root의 controlled
open 처리 방식이 바뀌는 경우)가 이 래퍼의 가정과 어긋날 수 있어 재검토가 필요하다.

**상태**: 적용 완료. `docs/BOOKMARK.md` §10, 계획 스냅샷:
`docs/plans/2026-09-21-dropdown-trigger-click.md`.

---

## 2026-09-21 — 사이드바 스크롤 영역 경계: 목록만 스크롤 채택 (모달 선례 재사용)

**배경**

북마크 페이지 데스크톱 사이드바(`FolderTree`)는 폴더 목록이 뷰포트보다 길어져도
`sticky top-4`만 걸려 있어 자체 스크롤이 없었다 — 아랫부분을 보려면 페이지 전체
스크롤을 끝까지 내려야 했다. `BookmarkFolderSelectModal`이 2026-09-11에 같은 문제를
겪고 이미 해법을 정한 선례가 있어(아래 "안 B 채택" 항목), 사이드바에도 같은 구조를
적용할지 검토했다.

**대안 비교**

사용자가 2026-09-06 결정(parallel prototyping)의 원칙대로, 실제 Tailwind 클래스와
`globals.css` 색 토큰을 그대로 쓴 정적 목업(Artifact, Tailwind Play CDN)을 두 안
나란히 만들어 비교했다.

|                              | (가) 패널 전체 스크롤              | (나) 목록만 스크롤 — **채택**                                          |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 전체·미분류·최근 저장한 폴더 | 같이 스크롤                        | 상단 고정                                                              |
| 내 폴더                      | 스크롤                             | 스크롤                                                                 |
| 새 폴더 만들기               | 같이 스크롤(아래로 밀림)           | 하단 고정 — 폴더 개수와 무관하게 항상 보임                             |
| 구현                         | `BookmarkPage.tsx` className 한 줄 | `FolderTree.tsx`를 상단 고정 + 내부 스크롤 + 하단 고정 3단 구조로 변경 |

(가)는 구현이 더 단순하지만, 폴더가 많을수록 "새 폴더 만들기"를 누르려면 매번 끝까지
스크롤해야 해 자주 쓰는 액션이 점점 멀어진다. (나)는 `BookmarkFolderSelectModal`
(2026-09-11 "안 B 채택" 항목)이 이미 검증한 구조라 선례를 그대로 재사용할 수 있다.

**결정**

(나)를 채택했다. 구현 중 `FolderTree`의 `sticky top-4`가 `Navbar`(`sticky top-0 h-16`)와
44px 겹치는 기존 버그(이번 변경으로 만든 게 아님)를 Playwright 실측으로 발견해
`top`을 `top-[calc(var(--navbar-height)+1rem)]`로 함께 조정했고, 패널 높이도
`h-[calc(100vh-var(--navbar-height)-2rem)]`로 뷰포트에 맞춰 제한했다. Playwright로
실제 브라우저에서 내부 스크롤이 페이지 스크롤로 새지 않는 것(`overscroll` 체이닝
없음)과 "새 폴더 만들기"가 스크롤 중에도 고정 위치를 유지하는 것을 확인했다.

**상태**: 적용 완료. `docs/BOOKMARK.md` §10 "폴더가 많을 때 사이드바 아랫부분에
도달할 수 없던 문제" 참고. 계획 스냅샷: `docs/plans/2026-09-21-bookmark-folder-sidebar-fixes.md`.

---

## 2026-09-21 — "최근 저장한 폴더" 노출 임계값: 출처 미상 "6" → 완전 일치 배제로 재정의

**배경**

"최근 저장한 폴더" 상단 구획은 두 조건을 모두 만족해야 떴다: 전체 폴더 6개 이상
(`MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT`), 저장 이력 있는 폴더 3개 이상
(`RECENT_BOOKMARK_FOLDER_COUNT`). 이 중 "6"의 근거를 사용자가 물어 확인한 결과,
`bookmark-folder.const.ts`의 코드 주석 한 줄(_"이보다 적으면 전체가 한 화면에 보여
상단 구획이 이득 없이 중복만 늘린다"_)이 유일한 설명이었고 이 레포 자체 문서에도
이 숫자를 비교·확정한 항목이 없었다 — CLAUDE.md §10 기준 출처 미상이었다.

**검토**

임계값을 완전히 없애면(6→0) 어떤 부작용이 생기는지 실제로 따져봤다. 최근 구획은
`RECENT_BOOKMARK_FOLDER_COUNT`(3)개까지만 보여주므로, "최근 구획 = 본 목록"이 되는
지점은 **전체 폴더가 정확히 3개**일 때뿐이었다(4개부터는 본 목록이 항상 더 많아
완전 일치가 구조적으로 불가능). 이 케이스는 NN/g
[The Same Link Twice on the Same Page: Do Duplicates Help or Hurt?](https://www.nngroup.com/articles/duplicate-links/)의
_"사용자는 두 항목이 중복이라는 걸 모르기 때문에 결국 둘 다 훑어보게 되고, 분석량이
사실상 두 배가 된다"_(번역, 원문: "designers know these links are duplicates, but
users do not, so they often end up scanning both sets of links — effectively
doubling the amount of analysis")는 지적이 직접 들어맞는다 — 두 구획의 정렬 기준
(최근=`lastUsedAt`, 본 목록=`sortOrder`)이 달라 사용자가 한눈에 중복임을 알아차리기
어렵기 때문이다.

|                          | 완전 일치일 때도 노출                      | 완전 일치일 때만 배제 — **채택**                     |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| 폴더 3개(전부 저장 이력) | 같은 3개가 정렬 순서만 바뀌어 두 번 노출   | 안 뜸                                                |
| 폴더 4개 이상            | 노출(본 목록에 최근 구획에 없는 항목 존재) | 노출(동일) — split menu 스캔 비용 절감 효과이 유효함 |
| 근거                     | 단순함 우선                                | NN/g 중복 콘텐츠 연구(위 인용)                       |

**결정**

`MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT` 상수를 제거하고, `pickRecentFolders`에
`folderList.length === RECENT_BOOKMARK_FOLDER_COUNT`(전체 폴더 수가 정확히 3)일 때만
빈 배열을 반환하는 조건을 추가했다. 결과적으로 폴더 3개 이하는 안 뜨고, 폴더 4개부터
(그중 3개 이상 저장 이력이 있으면) 뜬다 — 이전(6개부터)보다 훨씬 이른 시점부터
노출된다는 부수 효과가 있고, 사용자에게 이를 미리 알리고 확인받았다.

**상태**: 적용 완료. `docs/BOOKMARK.md` §7 "완전 일치 제외 조건", §10 "노출 임계값
'6'이 출처 미상이었고 완전 일치 배제로 재정의한 경위" 참고.

---

## 2026-09-21 — "최근 저장한 폴더" 세션 스냅샷: 상시 마운트 화면만 해제 (A/B/C 비교)

**배경**

북마크 폴더를 새로 만들고 미분류 글을 그 폴더로 옮겨도, 데스크톱 사이드바
(`FolderTree`)·모바일 폴더 그리드(`MobileFolderList`)의 "최근 저장한 폴더" 구획이
새로고침 전까지 갱신되지 않는 버그가 보고됐다. React Query 무효화는 정상이었고,
원인은 `useRecentBookmarkFolders`의 세션 스냅샷 — 두 화면이 `sessionKey`를 넘기지
않아 `undefined`로 고정되고 세션 경계 자체가 생기지 않았던 것이었다(상세는
`docs/BOOKMARK.md` §10 "상시 화면에서는 스냅샷이 영영 안 풀리던 문제").

**대안 비교**

| 안                             | 범위                                                                                           | 탈락 이유                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 상시 화면만 해제 — **채택** | `FolderTree`·`MobileFolderList`만 스냅샷 없이 매 렌더 재계산. 모달은 유지                      | —                                                                                                                                                                                                                                                                                                                                                                                       |
| B. 세 화면 전부 해제           | `useRecentBookmarkFolders` 훅 자체 삭제, 모두 `pickRecentFolders` 직접 호출                    | 등록 폼 모달(`PostCreateBookmarkFolderField`)은 열린 채로 새 폴더를 만들 수 있어, 6→4개 임계값 재정의(별도 항목) 이후 더 이른 시점부터 열린 모달 안에서 상단 구획이 끼어들며 행이 밀리는 오탭 위험이 생긴다                                                                                                                                                                             |
| C. 저장 직후에만 재배열        | TanStack Query mutation cache(`useMutationState`)로 "방금 저장했는지"를 감지해 그때만 재스냅샷 | mutation cache 기본 gcTime 5분(`@tanstack/query-core`의 `removable.ts`, node_modules 소스로 직접 확인)이라, 아무 조작 없이 마지막 저장 5분 뒤 캐시가 GC되며 트리거가 흔들려 막으려던 "예기치 않은 재배열"을 다른 형태로 재생산한다. 또한 `interaction.queries.ts`의 북마크 토글 mutation은 `mutationKey` 자체가 없어(전체 소스 grep 0건) 어떤 필터로도 잡히지 않는 커버리지 구멍이 있다 |

**결정**

안 A를 채택했다. `widgets/bookmark/folder-tree/hooks/useFolderSections.ts`가
`useRecentBookmarkFolders` 대신 `BookmarkFolderUtil.pickRecentFolders`를 직접
호출하도록 바꿨다. `useRecentBookmarkFolders`는 모달(`useBookmarkFolderSelect.ts`)
전용 훅으로 남는다 — 시그니처는 바꾸지 않았다.

**상태**: 적용 완료. `docs/BOOKMARK.md` §5·§10·§12 갱신, 관련 테스트는 §9 참고.

---

## 2026-09-20 — Storybook 공개 호스팅: 기존 S3+CloudFront 재사용 (Chromatic·GitHub Pages 기각)

**배경**

`shared/ui` 43개 컴포넌트가 이미 Storybook 스토리 100%(153개 케이스)를 갖추고 CI에서
axe a11y 게이트까지 통과하고 있는데, 이를 볼 수 있는 공개 URL이 없었다. `build-storybook`
스크립트와 `@chromatic-com/storybook` addon은 설치돼 있었지만 이를 실행하는 배포
워크플로가 0건이라 로컬 `pnpm storybook`으로만 확인 가능한 상태였다. "FE가 코드-디자인
파이프라인을 이해하고 있음"을 포트폴리오로 보여주는 목적에서, 이미 완성된 이 자산을
공개하는 쪽이 Figma를 새로 구축하는 것보다 비용 대비 효과가 크다고 판단했다(Figma는
무료 Starter 플랜이 변수 모드를 지원하지 않아 이 레포의 라이트/다크 2모드 토큰을 무료로
이식할 수 없어 별도로 보류).

**검토**

- **Chromatic** — 기각. `@chromatic-com/storybook` addon이 이미 설치돼 있고 무료
  플랜(월 5,000 스냅샷 + Storybook 호스팅)으로 비용은 들지 않지만, publish 시 스냅샷과
  베이스라인이 생성되는 구조라 2026-09-06 "화면 먼저, 그다음 반영"(사전 목업 승인 방식)
  및 `docs/plans/2026-09-10-e2e-playwright-foundation.md`의 "사후 시각 회귀 미채택"
  결정과 취지가 어긋난다. "호스팅만 쓰고 시각 회귀는 끈다"는 기술적으로는 가능하나
  결정을 재검토하지 않고 우회하는 것이라 채택하지 않았다.
- **GitHub Pages** — 기각. 비용은 $0이지만 배포 경로가 S3와 GitHub Pages로 2원화되어
  `docs/DEPLOY.md`가 정본으로 서술하는 "AWS 단일 배포" 서사가 깨진다.
- **전용 S3 버킷 + 전용 CloudFront 배포 신설** — 기각. 격리는 최고지만 1인 개발
  포트폴리오에 시크릿 2세트·도메인 2개·배포 절차 이원화는 과잉이다. 접근 제한 등
  격리가 실제로 필요해지면 재검토한다.

**결정**

기존 S3 버킷의 `storybook/` 접두사 + 기존 CloudFront 배포를 재사용한다
(`.github/workflows/deploy-storybook.yml`). 트리거 경로가 겹치는 `deploy.yml`과는
별도 워크플로 파일로 분리해 `.storybook/**` 변경이 앱 프로덕션 배포·전역 캐시
무효화를 유발하지 않게 했고, CloudFront 무효화도 `/storybook/*`로 한정했다. 기존
`deploy.yml`의 `--delete` sync가 이 접두사를 지우지 않도록 `--exclude`를
추가했고, `infra/cloudfront-functions/spa-fallback.js`(SPA 라우팅 폴백)에
`/storybook` 분기를 추가해 공개 URL이 앱으로 리다이렉트되지 않게 했다.

**상태**: 적용 완료. 관련 파일: `.github/workflows/deploy-storybook.yml`,
`.github/workflows/deploy.yml`, `infra/cloudfront-functions/spa-fallback.js`,
`docs/DEPLOY.md`("Storybook 공개 배포" 절). 계획 스냅샷:
`docs/plans/2026-09-20-storybook-public-deploy.md`.

---

## 2026-09-19 — 피드·북마크 목록 가상 스크롤: lanes 대신 행 청크, content-visibility 대신 라이브러리

**배경**

공유받은 Threads 글(@2weekhun)의 "무한스크롤은 네트워크 요청만 나눌 뿐 DOM 개수를 줄이는
건 별개 문제"라는 주장을 실측으로 검증했다. 프로덕션(`dbw3brui6htwk.cloudfront.net`)에서
Playwright로 직접 잰 값: 게시글 195개 전부 로드 시 DOM 14,330노드(Lighthouse "오류" 기준
1,400개의 10배), 강제 레이아웃 재계산 30.2ms(60fps 예산 16.7ms의 1.8배), 모바일에서 실제
화면에 보이는 카드는 195장 중 2장. 게시글이 하루 평균 3.7개씩 늘고 있어(최근 100건
`createdAt` 집계) 약 7개월 뒤 1,000개(Threads 글이 인용한 개선 사례의 기준선)에
도달한다. 스크롤 프레임 자체는 지금도 60fps를 유지해(p95 16.8ms) 당장 체감 지연은
없지만, 미리 준비하기로 사용자가 결정했다.

**검토**

- **`content-visibility: auto`만 적용** — 기각. 같은 페이지에 런타임으로 주입해 A/B
  측정한 결과 레이아웃 재계산 30.2ms→4.0ms로 개선됐지만, `contain-intrinsic-size`가
  실제 카드 높이 대신 추정 높이를 부여해 문서 높이가 32,801px→41,142px로 25% 틀어지는
  부작용을 실측했다. 195개 규모에서는 유효한 대안이지만 1,000개 규모에서는 가상화만큼
  근본적이지 않고, 나중에 다시 가상화를 얹으면 `measureElement`의 ResizeObserver가 이
  가짜 높이를 측정해 캐시가 오염된다 — 그래서 가상화와 병행하지 않는다.
- **TanStack Virtual `lanes` 옵션으로 다열 그리드 구현** — 기각. API 문서 원문
  ["Items are assigned to the lane with the shortest total size"](https://tanstack.com/virtual/latest/docs/api/virtualizer)
  대로 메이슨리(들쭉날쭉) 배치가 되어, 지금의 "같은 행 카드는 항상 같은 높이"인 정렬
  그리드와 시각적으로 달라진다. 대신 게시글을 열 수만큼 행으로 청크하고 행 단위로
  가상화(`lanes: 1`)하되, 행 안쪽은 기존과 동일한 CSS Grid를 그대로 써서 화면을 픽셀
  단위로 유지했다 — 라이브러리 소스 확인 결과 `lanes===1` 경로가 `lanes>1` 경로보다
  내부 계산도 더 싸다.
- **`react-window`/`react-virtuoso` 등 다른 가상화 라이브러리** — 검토했으나
  `@tanstack/react-virtual`로 확정. 이미 `@tanstack/react-query`·`@tanstack/react-table`을
  쓰고 있어 같은 생태계이고, 이 앱의 구조(별도 스크롤 컨테이너 없이 `window` 자체를
  스크롤하는 구조)에 필요한 `useWindowVirtualizer`를 공식 지원한다.
- **가상화 후 Ctrl+F(브라우저 페이지 내 검색)로 화면 밖 글을 못 찾게 되는 트레이드오프**
  — 사용자가 명시적으로 수용("검색 기능을 쓰는 사람이 많고, 직접 찾는 사람은 적을 것").
  가상화의 근본적인 대가라 우회할 방법이 없다.

**결정**

`@tanstack/react-virtual`의 `useWindowVirtualizer`를 채택하고, 공용 훅
`shared/hooks/useWindowGridVirtualizer.ts`로 `PostList`·`BookmarkPostList` 둘 다에서
재사용한다. 스크롤 위치 복원은 라이브러리가 공식 문서화한 패턴을 그대로 따른다 — 원문:
["Useful for restoring scroll position after navigation: persist the result of
`takeSnapshot()` (plus the current `scrollOffset`) in your route state, then pass them
back as `initialMeasurementsCache` and `initialOffset`"](https://tanstack.com/virtual/latest/docs/api/virtualizer).
`location.key`(React Router의 `<ScrollRestoration/>`이 스크롤 위치를 저장하는 것과 동일한
단위) 기준으로 sessionStorage에 스냅샷을 저장·복원하며, `useGoBack`과
`<ScrollRestoration/>` 자체는 손대지 않는다.

**범위 밖 (보고만)**

- `MyCommentList`는 가상화하지 않는다. `MyCommentCard`는 노드 수가 적고(~10개) 이미지가
  없어 195개 전부 렌더해도 무해하고, "내가 쓴 글을 찾는" 화면 목적상 Ctrl+F를 유지하는
  쪽이 낫다고 판단했다.

**상태**

코드 구현·정적 검증(`type-check`/`lint`/`format`/유닛테스트 403개/e2e 45개)까지 완료 후
[PR #127](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/127)로 배포했다(당시엔
로컬에 BE가 없어 스크롤 복원 등 실제 데이터 기반 브라우저 상호작용 검증은 못 함).
이후 [PR #128](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/128)로 "가상화가
실제로 DOM을 줄이고 스크롤 위치를 정확히 복원하는지"를 결정적으로 증명하는 e2e 4개(목
데이터 최대 200개 규모)를 추가했다 — `overscan`을 임시로 키우거나 스냅샷 복원을
임시로 꺼서 4개 전부 정확히 실패하는 것까지 확인한 뒤 원복해, 통과가 느슨한 임계값의
우연이 아님을 검증했다(3회 반복 실행, flaky 없음).

배포 후 실제 프로덕션(게시글 195개)에서 Playwright로 직접 재확인했다(2026-09-20, 직접
측정):

- DOM 노드 수: 끝까지 스크롤해 195개를 전부 로드해도 827→960개로 유지된다(가상화 전
  실측 14,330개 대비 약 93% 감소).
- 렌더된 행 `data-index`가 `[0,1,2]`(최초 진입) → `[61,62,63,64]`(맨 아래)로 실제 이동한다
  — DOM이 쌓이기만 하는 게 아니라 교체되고 있음을 확인.
- 스크롤 위치 복원: 중간 지점의 실제 게시글로 스크롤한 뒤 상세 진입 → 브라우저
  뒤로가기 시 화면 좌표(`getBoundingClientRect().y`)와 `window.scrollY` 둘 다 **오차
  0px**로 정확히 복원됐다.

상세 계획은
[`docs/plans/2026-09-19-virtualize-post-list.md`](./plans/2026-09-19-virtualize-post-list.md),
[`docs/plans/2026-09-19-virtualize-post-list-e2e-verification.md`](./plans/2026-09-19-virtualize-post-list-e2e-verification.md)
참고.

---

## 2026-09-17 — T1 오버레이 배경 스크롤 잠금: 커스텀 훅 대신 react-remove-scroll 재사용

**배경**

모바일 검색 오버레이(`RecentSearchPanel`) 작업 중 `inert`가 포커스·클릭만 막을 뿐 배경
스크롤은 막지 못한다는 게 드러났다. 패널 자신은 `overflow-y-auto`인데
`overscroll-behavior` 방지 장치가 없어, 목록 끝까지 스크롤한 뒤 계속 스와이프하면 그
아래 가려진 배경(document)이 조용히 스크롤되고, 패널을 닫았을 때 게시글 목록 위치가
튀는 시나리오가 가능했다. 같은 문제가 `Sidebar` 모바일 드로어에도 있었다. 반면
`docs/DECISIONS.md`가 "T1 화면 덮는 상태"로 묶은 나머지 3개(마이페이지·이미지뷰어·
로그인모달)는 전부 Radix `Dialog`(`shared/ui/atoms/dialog.tsx`) 기반이라 이미 배경
스크롤이 잠겨 있었다 — Radix Dialog가 `modal`(기본 `true`)일 때 내부적으로
`react-remove-scroll`을 걸기 때문이다
(`node_modules/@radix-ui/react-dialog/dist/index.mjs:96-118`).

**검토**

- **`document.body.style.overflow = 'hidden'`을 손으로 구현** — 기각. `position:fixed`
  트릭 없이 iOS의 touchmove/wheel 오버스크롤까지 처리하려면 사실상
  `react-remove-scroll`을 다시 만드는 것과 같다. 이미 같은 라이브러리가 이 코드베이스
  3곳(Dialog 기반 오버레이)에서 검증된 채로 쓰이고 있다.
- **스크롤 잠금을 `useHistoryOverlay`에 통합** — 기각. 그 훅은 히스토리 기반 열림 상태
  관리만 하는 단일 책임 훅이고 4곳(Sidebar·MyPage·Login·ImageViewer)이 쓴다. 여기 잠금을
  얹으면 Dialog 기반 3곳은 Radix 자체 잠금과 중복 적용되고, 정작 `RecentSearchPanel`은
  `useHistoryOverlay`를 안 쓰고 `Navbar.tsx`가 인라인으로 구현해(별도로 남겨둔 기존
  사안) 혜택을 못 받는다.

**결정**

`react-remove-scroll`(Radix Dialog의 전이 의존성이라 이미 `pnpm-lock.yaml`에 있고
`shamefully-hoist=true`라 바로 import 가능하던 것을 `package.json`에 직접 의존성으로
승격)을 `RecentSearchPanel.tsx`·`Sidebar.tsx` 두 곳에 **컴포넌트 레벨로 직접** 적용한다.
`dialog.tsx`의 `DialogOverlayImpl`이 쓰는 것과 정확히 같은 패턴 —
`<RemoveScroll as={Slot} allowPinchZoom>`로 오버레이 DOM을 감싸고, 배경과 패널이
DOM상 형제로 분리된 `Sidebar`는 `shards`로 드로어 패널을 Lock의 일부로 지정해 내부
스크롤을 허용한다.

**범위 밖 (보고만)**

- `MobileCommentBar` 펼침 시트 — 배경이 실제로 보이고 탭·스크롤 가능하게 설계돼 있어
  (스크림 없음, `inset-x-0 bottom-0`만) 배경을 열어두는 게 의도로 보여 제외했다(사용자
  결정).
- `usePullToRefresh`(`PostList.tsx`)가 검색 오버레이 열림 상태를 모르는 문제 — 기존부터
  있던 별개 gap, 이번 변경으로 악화되지 않는다.

**상태**

적용 완료. 관련 파일: `package.json`, `pnpm-lock.yaml`, `RecentSearchPanel.tsx`,
`Sidebar.tsx`, 신규 테스트(`RecentSearchPanel.test.tsx`, `Sidebar.test.tsx`,
`e2e/mobile-search-scroll-lock.mobile.spec.ts`,
`e2e/sidebar-drawer-scroll-lock.mobile.spec.ts`). 새 T1 오버레이를 추가할 때 이 규약은
`.claude/skills/responsive-ux/SKILL.md`에 남겼다.

---

## 2026-09-15 — 상세 돌아가기 버튼 간격: margin 오버라이드 폐기, gap 중첩 컨테이너로 교체 (PR #106 수치 정정)

**배경**

PR #106에서 돌아가기 버튼과 카드 사이 간격을 24px→12px로 줄이려고 버튼에
`md:-mb-3`(음수 마진)을 추가해 배포했다. 이후 "너무 딱 붙었다, 블록처럼 떨어져
보여야 한다"는 피드백을 받아 원인을 다시 조사했다.

**검토**

Playwright로 실제 `/post/:id` 페이지(데스크톱 1280px)에서 `getBoundingClientRect()`/
`getComputedStyle()`을 직접 측정한 결과, **PR #106의 "24px→12px" 서술 자체가
틀렸다는 걸 발견했다** — 실제로는 24px→**3px**이었다(버튼의 `transition-all`
때문에 클래스 변경 직후 바로 측정하면 트랜지션 중간값을 읽는 함정이 있어, 클래스
교체 후 400ms 대기하고 재측정해 값을 안정화했다). 원인은 버튼(`shadcn Button`)의
실제 `display`가 `inline-flex`라는 점이었다 — `inline-flex`(atomic inline-level
박스)에 준 음수 `margin-bottom`이 선언한 값대로 반영되지 않고 상당 부분 상쇄됐다
(같은 요소를 진단용으로 `display:block`으로 강제하면 선언값과 일치하는 결과가
나와 확인함).

이게 우연한 버그가 아니라는 근거를 세 갈래로 확인했다:

1. **Tailwind CSS 공식 업그레이드 가이드**
   (https://tailwindcss.com/docs/upgrade-guide, "space-between-selector" 절)가
   정확히 이 두 상황(① `inline` 요소에 `space-y-*` 사용 ② `space-y-*`가 관리하는
   자식에 개별 마진을 더해 미세조정)을 명시적으로 경고한다: _"You might see changes
   in your project if you were ever using these utilities with inline elements, or
   if you were adding other margins to child elements to tweak their spacing."_
   (번역: "이 유틸리티를 inline 요소에 쓰고 있었거나, 자식 요소에 다른 마진을 더해
   간격을 미세조정하고 있었다면 변화를 보게 될 수 있다.")
2. **W3C CSS Working Group의 실제 스펙 논의**
   (Issue #8182 "Negative margins on inline boxes",
   https://lists.w3.org/Archives/Public/public-css-archive/2024Feb/0427.html)에서
   스펙 에디터 fantasai가 설명한 문제: atomic inline-level 박스에 라인박스 높이를
   줄이려는 의도로 음수 마진을 줘도, 대응하는 음수 마진이 없는 중첩 콘텐츠가 있으면
   그 효과가 상쇄(cancel)된다 — 이 방향으로 스펙을 새로 쓰자고 결의(RESOLVED)될
   만큼 알려진 CSS 함정이었다(번역·요약).
3. **Tailwind 공식 `margin` 문서**(tailwindcss.com/docs/margin, "Adding space
   between children" 절)도 같은 맥락에서 `space-y-*`를 _"a shortcut for adding
   margin to all-but-the-last-item"_ 이라 정의하며 _"For those situations, it's
   better to use the gap utilities when possible"_ 라고 명시한다.

대안으로 (A) 버튼을 블록 레벨 `<div>`로 감싸 마진을 그 wrapper에 주는 방식과
(B) `margin`을 아예 쓰지 않고 중첩 `flex` 컨테이너의 `gap`으로 간격을 관리하는
방식을 비교했다. (A)도 기술적으로는 동작하지만(블록 요소는 margin이 예측 가능하게
반영됨), 공식 문서가 명시적으로 `gap`을 권장하고, 실제 오픈소스 사례로
[당근(Daangn) SEED 디자인 시스템](https://github.com/daangn/seed-design)의
`Stack`/`VStack`/`HStack` 컴포넌트가 `gap` prop을 실제 CSS
`gap: var(--seed-box-gap)`(`packages/css/base.css:335`)로 컴파일하고 `margin`은
별도 prop으로 완전히 분리해두고 있어 — 요소 사이 간격은 `gap`, 개별 요소 바깥
여백은 `margin`이라는 역할 분리가 실제 프로덕션 디자인 시스템에서도 일관되게
쓰이고 있음을 확인해 (B)를 택했다.

**결정**

1. `PostDetailPage.tsx`의 루트 컨테이너를 `space-y-6` → `flex flex-col gap-6`로
   바꾸고, 버튼과 카드를 감싸는 중첩 `flex flex-col md:gap-4` 컨테이너를 추가했다
   (버튼↔카드 16px, 카드↔댓글 24px — 두 구간 간격이 달라 `gap`이 컨테이너당 균일한
   값만 지원하는 특성상 중첩 구조가 필요했다).
2. 버튼에서 `md:-mb-3`(음수 마진)을 완전히 제거했다 — 이제 간격은 전부 `gap`이
   관리하고, 버튼 자체에는 어떤 마진 클래스도 없다.
3. 간격 값은 24px(원래, 너무 넓었음) → 12px(PR #106, 실제로는 3px 밖에 안 나옴,
   너무 좁았음) → **16px**(이번 결정, `gap`이라 선언값=실제값이 보장됨)로 재조정.

**이유 / 주의점**

- 실측 방법(재현 절차): `pnpm dev` 기동 → Playwright `browser_run_code_unsafe`로
  `getBoundingClientRect()` 차이를 측정. **클래스를 바꾼 직후 바로 측정하지 않는다**
  — `Button`의 기본 클래스에 `transition-all`이 있어 트랜지션 중간값을 읽는 함정이
  있다. 클래스 변경 → `waitForTimeout(400)` → 재측정 순서를 지켜야 안정된 값이
  나온다.
- `gap` 기반 구조는 버튼이 `hidden`(모바일에서 `display:none`)이어도 `gap` 계산에서
  자동으로 제외되므로, 모바일에서 카드가 그룹의 사실상 첫 아이템이 되어 별도 처리
  없이 기존과 동일한 레이아웃이 유지된다(직접 측정으로 확인, 모바일 회귀 없음).
- 결과적으로 이 변경은 `space-y-*`를 대체하는 첫 사례다 — 이후 비슷한 "구간별로
  다른 간격이 필요한" 상황에서도 margin 오버라이드보다 중첩 `gap` 컨테이너를
  먼저 고려한다.

**상태**

적용 완료. `src/pages/post/PostDetailPage.tsx` 참고.

---

## 2026-09-14 — 상세 돌아가기 버튼: 모바일 제거 + 데스크톱 sticky 해제 (PR #100 결정 재검토)

**배경**

이 문서 아래에 있는 "포스트 상세 돌아가기 버튼: sticky 고정 + 유입 경로별 라벨"(PR #100)에서
버튼을 Navbar 바로 아래 sticky로 고정했는데, 배포 후 실제 사용자가 "스크롤하면 두 바가
계속 붙어 있어서 답답하다"는 피드백을 줬다.

**검토**

dev 서버에서 직접 측정한 결과, 스크롤 시 Navbar(64px) + 돌아가기 바가 항상 함께
고정돼 **모바일 390px 124px · 데스크톱 1440px 112px**가 스크롤 위치와 무관하게 상시
소비됐다. Adobe XD의 UI 가이드는 _"Don't dedicate more than 100px vertical space to
static elements on mobile"_ 라고 권고하는데
([Best Practices For Designing Fixed Elements](https://xd.adobe.com/ideas/process/ui-design/best-practices-designing-fixed-elements)),
124px는 이를 24px 초과했다.

대안으로 (1) 스크롤 방향에 따라 자동 숨김/표시, (2) 원형 오버레이 버튼(줄 추가 없이
Navbar 아래 여백에 겹침), (3) 헤더 자체를 상세용으로 교체를 Artifact 목업으로 비교했다.
(3)은 velog·dev.to·네이버뉴스 3개 사이트 실측(위 원본 결정 항목 참고)으로 이미 배제된
안을 다시 여는 비용이 커서 제외했고, (1)은 모바일에서는 합리적이나 데스크톱은 이미
왼쪽 `Sidebar`에 "Feed" 링크가 상시 떠 있어 목록 복귀 수단 자체가 있는데도 스크롤
방향에 따라 나타났다 사라지는 움직임을 추가하는 게 얻는 공간(900px 중 48px)에 비해
과하다고 판단해 데스크톱엔 적용하지 않기로 했다.

최종적으로는 더 단순한 셋째 길을 택했다 — 모바일은 버튼을 아예 없앤다. 근거:
`BottomTabBar`가 `md:hidden fixed bottom-0`으로 라우트와 무관하게 항상 떠 있어
([BottomTabBar.tsx](../src/widgets/layout/bottom-tab-bar/ui/BottomTabBar.tsx)) Feed
탭이 이미 대체 수단이고, 일반 브라우저 탭에서는 OS·브라우저 뒤로가기(제스처·버튼)가
`navigate(-1)`과 동일하게 동작해 지금과 체감 차이가 없다 — 오히려 velog·dev.to·
네이버뉴스 벤치마크(모두 인앱 back 버튼 없이 브라우저 back에만 의존)와 더 정확히
일치한다. 유일한 예외는 standalone PWA(홈 화면 추가)로 쓰는 모바일 사용자로, 브라우저
체인이 없어 이 경우엔 정확한 위치 복귀 대신 `BottomTabBar`의 Feed 탭(목록 최상단)으로
대체된다 — 이게 원래 PR #100을 만든 동기였다는 점은 감안했지만, 그 대응(sticky화)이
오히려 이번 문제를 낳았으므로 "완벽한 위치 복귀"보다 "화면을 상시 어지럽히지 않는 것"을
우선했다.

**결정**

1. 모바일(`< md`)에서는 버튼을 렌더링하지 않는다 — `hidden md:inline-flex`
   ([PostDetailPage.tsx](../src/pages/post/PostDetailPage.tsx)).
2. 데스크톱(`md:` 이상)은 버튼을 유지하되 sticky wrapper를 걷어내 PR #100 이전처럼
   평범한 위치로 되돌린다.
3. `useGoBack`의 이동 로직(`navigate(-1)`/`replace('/post')`)과 유입 경로별 라벨
   (`resolveBackLabel`)은 변경하지 않는다 — 바뀌는 건 배치·노출 조건뿐이다.

**이유 / 주의점**

- e2e 5개 스펙(`comment.spec.ts` 등)이 `backToList` 버튼을 찾지만, `playwright.config.ts`가
  이 스펙들을 데스크톱 전용 `chromium` 프로젝트에서만 돌리고(`testIgnore:
'**/*.mobile.spec.ts'`) 모바일 버튼을 검증하는 `*.mobile.spec.ts`도 없어 수정 없이
  통과했다(직접 실행 확인, 7개 전체 통과).
- 이 결정은 위 원본 결정의 "배치는 velog·dev.to·네이버뉴스 실측 근거" 자체를 뒤집는 게
  아니라, 그 실측이 애초에 가리키던 방향(인앱 back 버튼 없음)에 모바일을 마저 맞춘
  것이다 — 데스크톱만 인앱 버튼을 유지하는 비대칭은 새로 생긴 트레이드오프다.

**상태**: 적용 완료. 관련 파일: `src/pages/post/PostDetailPage.tsx`. 비교에 쓴 Artifact:
"돌아가기 버튼 배치안" (세션 로컬, 링크는 대화 기록 참고).

---

## 2026-09-14 — BE·FE 버전 호환 매트릭스 중복 제거: BE 사본을 FE 정본 링크로 전환

**배경**

BE 레포에도 FE와 동일한 `docs/VERSION-COMPATIBILITY.md` 사본이 있었다 — BE·FE가 분리된
레포라 어느 쪽 저장소를 보더라도 호환 정보를 확인할 수 있도록 도입 시점부터 양쪽에
내용을 동일하게 유지하기로 한 것이다. 이번 v0.14.0/v0.10.0 릴리즈 작업 중 BE 사본이
2026-08-13(FE 기준 v0.10.0 시점) 이후로 한 번도 갱신되지 않아 v0.11.0~v0.13.0 3개
버전 행이 빠진 채 방치돼 있던 것을 발견했다. 두 문서 하단 "앞으로 지켜야 할 규칙"에
"그 항목이 버전 승격되면 이 표에도 한 줄 추가한다 (BE·FE 양쪽 문서 동일하게 갱신)"라고
명시돼 있었지만, 과거 릴리즈 커밋 기록(FE 9건·BE 9건)을 확인한 결과 그중 BE 사본이
실제로 함께 갱신된 적은 한 번도 없었다 — 규칙은 있었지만 지켜지지 않았다.

**검토**

- **최신화**: BE 사본에 빠진 행을 채워 두 문서를 다시 동일하게 맞춘다. 지금 당장은
  해결되지만 근본 원인(두 파일을 릴리즈마다 수동으로 동기화해야 하는 구조)은 그대로
  남아 다음 릴리즈에서 다시 벌어질 가능성이 높다 — 실제로 지난 9번의 릴리즈 동안
  이미 그래왔다.
- **링크로 전환**: BE 사본을 삭제하는 대신 FE 레포 파일을 가리키는 짧은 안내 문서로
  바꾼다. 이 레포는 이미 같은 종류의 문제를 같은 방식으로 풀어본 선례가 있다 — BE
  `docs/HISTORY.md`도 2026-08-01에 "정본은 FE, 여기는 안내"로 전환한 뒤 다시 벌어지지
  않았다.

**결정**

링크로 전환한다. FE 레포 `docs/VERSION-COMPATIBILITY.md`를 정본으로 삼고, BE 레포의
동일 경로 파일은 정본 링크 + 전환 경위 안내만 남긴다. BE `.claude/CLAUDE.md`의 릴리즈
절차 문구("API 계약이 바뀌었다면 docs/VERSION-COMPATIBILITY.md에도 상대 레포 최소
버전 행 추가")도 FE 정본 파일을 가리키도록 함께 고친다.

**이유 / 주의점**

이 결정 이후에도 API 계약이 바뀌는 릴리즈가 있으면 정본(FE) 파일 갱신은 여전히
수동이다 — 자동화된 것은 아니고, "두 파일을 동기화해야 한다"는 실패 지점 하나를
구조적으로 없앴을 뿐이다.

**상태**: 적용 완료. 관련 파일: FE `docs/VERSION-COMPATIBILITY.md`(변경 없음, 계속
정본), BE `docs/VERSION-COMPATIBILITY.md`(안내 문서로 교체), BE `.claude/CLAUDE.md`,
BE `README.md`.

---

## 2026-09-14 — 포스트 상세 돌아가기 버튼: sticky 고정 + 유입 경로별 라벨

**배경**

"내가 쓴 댓글" 목록에서 카드를 클릭하면 `/post/:id#comment-:id`로 진입해 해당 댓글로
`scrollIntoView({ block: 'center' })`가 실행된다(`CommentList.tsx`의
`scrollToHashedComment`). 화면이 이미 스크롤된 상태로 시작하는데, 돌아가기 버튼은
페이지 최상단에만 있어 그 상태로는 화면 밖에 있었다. 여기에 `public/favicons/site.webmanifest`의
`"display": "standalone"`이 겹친다 — 홈 화면에 추가해 실행하면 브라우저 자체의 back
버튼도 없다.

별개로 버튼 라벨("목록으로")도 유입 경로 중 일부에서만 참이었다. 버튼은 이미
`useGoBack`으로 `navigate(-1)`(폴백 시 `/post`로 `replace`)인데, 라벨은 항상
"목록으로"였다 — 북마크 폴더에서 들어온 경우 "북마크"가 아니라 특정 폴더로 돌아가고,
FCM·공유링크·새로고침처럼 앱 내 이력이 없는 경우는 가본 적 없는 `/post`를 "목록"이라
불렀다.

**검토**

- 동작(어디로 갈지)은 바꿀 이유가 없었다. Baymard 벤치마크는 목록 복원이
  _"widespread support across our benchmark sites, making it a 'web convention'
  users have come to expect"_ 라고 정리하고([Baymard: Return Users to the Same
  Place](https://baymard.com/blog/return-same-place), 13%의 사이트만 이 관례를
  어김), 같은 곳의 다른 글은 이를 어기는 사이트가 _"59% of e-commerce sites"_
  라고 집계한다([Baymard: 4 Design Patterns That Violate Back Button
  Expectations](https://baymard.com/blog/back-button-expectations)). NN/g는
  Wayfair 사례에서 _"Both Back buttons (the site's and browser's) take users to
  the initial product overview page, which is what users expect"_ 라고
  짚는다([NN/g: User Control and
  Freedom](https://www.nngroup.com/articles/user-control-and-freedom/)). 기존
  `useGoBack`의 `navigate(-1)`은 이미 이 조건(사이트 back = 브라우저 back)을
  만족하고 있었다.
- 라벨은 [Android 내비게이션 원칙](https://developer.android.com/guide/navigation/principles)의
  Back/Up 구분을 기준으로 잡았다: _"The Back button... is used to navigate in
  reverse-chronological order"_ 인 반면 _"The Up button never exits your
  app"_ 이고 딥링크 진입 시에도 _"a synthetic back stack that ... should match a
  back stack that could have been achieved by organically navigating through
  the app"_ 로 재구성된다(번역 생략, 위 링크). 이 구분을 "화면이 하나로 고정돼
  이름을 약속할 수 있는가"로 옮겨 라벨을 골랐다.
- 배치는 velog·dev.to·네이버뉴스 3개 서비스를 Playwright로 390px 뷰포트에서 직접
  스크린샷 실측했다(직접 측정, 2026-09-14) — 셋 다 상세에서 헤더를 목록과 동일하게
  유지하고 별도 인앱 back 버튼이 없었다(브라우저 back에만 의존). `responsive-ux`
  skill은 이 레포가 상세 같은 단일 컬럼 레이아웃에서 지금까지 sticky 패널보다 플로팅
  버튼을 택해왔다고 적는데, 상세의 플로팅 자리(`fixed bottom-6 right-6`)는 이미
  `ScrollToCommentFormButton`이 쓰고 모바일 하단은 `BottomTabBar`+`MobileCommentBar`가
  채워 자리가 없어 이번엔 그 관례에서 의도적으로 벗어나 버튼만 sticky로 고정했다.
  standalone 웹앱의 인앱 back 필요성은 Smashing Magazine도 _"replace the menu
  button in the top left with a back button once the user progresses past the
  initial page"_ 로 권고한다([Designing For A Browserless
  Web](https://www.smashingmagazine.com/2017/11/designing-for-a-browserless-web/)).

**결정**

1. 버튼을 감싸는 wrapper를 `sticky top-16 z-panel`로 고정한다(`PostDetailPage.tsx`).
   `top-16`은 `Navbar`의 `h-16`과 맞춘 값, `z-panel`(40)은 `Navbar`의 `z-nav`(50)보다
   한 단계 아래. 배경도 `Navbar`와 같은 `bg-background/95 backdrop-blur`로 맞췄다.
2. 라벨은 유입 경로에 따라 두 가지로 나눈다 — `PostDetailPage.tsx`의
   `resolveBackLabel(location)`:
   - `location.key === 'default'`(외부 유입: 공유링크·FCM·새로고침) 또는
     `location.state.backSource === 'feed'`(피드/검색에서 옴) → **"목록으로"**.
     실제로 이름 있는 고정 화면(포스트 목록)으로 가므로 약속할 수 있다.
   - 그 외(북마크, 내 댓글, 출처 불명 앱 내 이동) → **"뒤로가기"**. 목적지를
     이름으로 약속하지 않는 중립 표현.
   - `PostCard`(피드·북마크에서 재사용)에 `backSource?: 'feed' | 'bookmark'` prop을
     추가해 `<Link state={{ backSource }}>`로 실어 보낸다.

**결정하지 않은 것 (검토했으나 채택 안 함)**

- **북마크 전용 라벨("북마크로")**: 처음엔 만들었으나, 북마크 화면은 폴더마다
  다른데(`/bookmark?folder=...`) "북마크로"라는 한 단어로는 실제로 어느 폴더로
  가는지 말할 수 없어 — 사용자 피드백으로 폐기하고 중립 "뒤로가기"로 합쳤다. 이건
  "덜 구체적"이 아니라 "다른 화면을 가리키는 것처럼 거짓말"하는 문제였다.
- **"내 댓글" 전용 라벨("내 댓글로")**: `/my/comments`는 북마크 폴더와 달리 매번
  바뀌지 않는 고정된 화면이라 이름을 약속할 수 있다는 점에서 한 차례 추천했으나,
  재검토 후 보류했다. 이유: "뒤로가기"가 이 경우 거짓이 아니라 그냥 덜 구체적일
  뿐이라 고칠 필요가 없었고, 붙이려면 `backSource` 타입을 `shared` 레이어로 올려
  `PostCard`(위젯)와 `MyCommentCard`(다른 위젯, 별도 세션이 만든 기능)가 공유해야
  하는 리팩터 비용이 드는데 얻는 건 "조금 더 구체적인 단어" 하나뿐이었다.
- **새 "목록으로" 버튼 추가**: 계층 이동(포스트 목록으로)은 이미 `BottomTabBar`·
  `Sidebar`가 상시 제공하므로 상세 화면에 중복 버튼을 더 두지 않았다.

**이유 / 주의점**

- e2e 5개 스펙(`comment.spec.ts`, `post-visibility.spec.ts`, `like.spec.ts`×2, `comment-delete.spec.ts`)이 모두 `getByRole('button', { name: TEXTS.post.detail.backToList })`로 이 버튼을 찾는다 — 전부 피드 진입 또는 직접 URL 진입(둘 다 "목록으로" 분기)이라 `backToList` 값(`'목록으로'`)을 그대로 두는 한 수정 없이 통과한다. 라벨 키 이름 자체를 바꾸면 이 5개 파일도 함께 고쳐야 한다.
- `PostCard.tsx:171,282`가 `isDetail`일 때도 자기 자신(`/post/{id}`)을 링크하는
  기존 동작은 이번 변경과 무관하게 남아 있다(범위 밖) — 상세에서 제목을 눌러도
  `backSource`가 없어 "뒤로가기"로 정확히 떨어지긴 하지만, 애초에 자기 자신으로
  또 이동하는 것 자체는 별개 버그다.

**상태**: 적용 완료. 관련 파일: `src/pages/post/PostDetailPage.tsx`,
`src/shared/config/texts.ts`, `src/widgets/post/post-card/ui/PostCard.tsx`,
`src/widgets/post/post-list/ui/PostList.tsx`,
`src/widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`. 계획 스냅샷:
[`docs/plans/2026-09-14-post-detail-sticky-back.md`](./plans/2026-09-14-post-detail-sticky-back.md).

## 2026-09-14 — 로그아웃 배경 재요청: 화면이 곧 바뀔 때는 resetQueries 대신 removeQueries

**배경**

"내 댓글" 재로그인 캐시 버그([PR #94](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/94))를
설명하던 중, "로그아웃 시 `GET /comment/my` 같은 요청 자체를 왜 보내는가, 안 보내면
안 되나"라는 질문을 받았다. `AuthUtil.clearQueries()`가 `queryClient.resetQueries()`로
화면에 남은 모든 활성 쿼리를 토큰 없이 배경 재요청하는데, 보호 경로 로그아웃이나
세션 만료처럼 어차피 다른 화면으로 이동하는 경우엔 그 쿼리 재요청이 100% 낭비였다.

**결정**

1. 로그아웃을 "화면이 곧 이동하는가"로 나눈다 — `clearAll()`(보호 경로·세션 만료)은
   새 `clearQueriesWithoutRefetch()`(`queryClient.removeQueries()`)를 쓰고,
   `clearQueries()` 단독 호출(제자리 로그아웃)은 `resetQueries()`를 그대로 유지한다.
2. `isLoggingOut()`을 타임스탬프 기반 유예 창(`LOGOUT_GRACE_MS`, 2초)으로 확장해
   `clearAll()` 경로에도 적용한다 — `resetQueries()` Promise에 묶인 기존 플래그는
   `clearAll()`이 재요청을 아예 안 하므로 붙잡을 Promise가 없다.
3. `clearAll()` 안의 호출 순서(`clearAuth → removeQueries → navigate`)는 실측 결과
   상관없었다 — 순서를 바꾸거나 `removeQueries()`를 `setTimeout(0)`으로 지연시켜도
   보호 경로 e2e의 재요청 여부는 달라지지 않았다(둘 다 시도해 확인, 아래 참고).

**이유 / 주의점**

- **`resetQueries()`에는 재요청을 끄는 옵션이 없다.** `invalidateQueries`의
  `refetchType: 'none'`에 해당하는 게 TanStack Query(`@tanstack/query-core`)의
  `queryClient.ts` 구현 자체에 없어, 검토한 대안은 4가지였다: (A) `getQueryCache().findAll({type:'active'}).forEach(q => q.reset())`로
  전반부만 실행 — Suspense 쿼리는 리렌더가 끼면 여전히 재요청됨(아래 참고)이라 기각.
  (B) `resetQueries({predicate})`로 리셋 후 스스로 매칭이 풀리게 하는 트릭 — 이미
  `useLoginMutation.onSuccess`(PR #94)에 선례가 있지만 내부 동작 의존이라 fragile.
  (C) `resetQueries({type:'inactive'})` — `refetchQueries`가 type과 무관하게 매칭된
  쿼리를 `fetch()`해버려 역효과, 즉시 기각. (D) `removeQueries()` — 채택. 캐시 파괴
  시 `destroy() → cancel({silent:true})`까지 하고 옵저버에 알리지 않아 재요청·리렌더
  둘 다 유발하지 않는다.
- **`removeQueries()`도 `clear()`와 같은 특성("옵저버에 알리지 않음")을 갖지만, `clearAll()`
  경로에선 무해하다.** `auth.util.ts`가 애초에 `clear()`를 피한 이유(옵저버 안 알림 →
  화면이 이전 데이터를 계속 그림)가 여기선 성립하지 않는다 — 뒤따르는 `navigate()`가
  그 화면을 통째로 언마운트시키기 때문이다.
- **Suspense 쿼리는 `reset()`만으로는(리렌더가 끼면) 안전하지 않다.** `Query.reset()`
  자체는 재요청을 안 하지만(`query.ts`의 `reset()` → `setState(initialState)` →
  옵저버 `onQueryUpdate()`뿐, `fetch()` 호출 없음), `useSuspenseQuery`/
  `useSuspenseInfiniteQuery`는 캐시가 `status: 'pending'`이면 그 즉시 `fetchOptimistic()`으로
  재요청을 낸다(`useBaseQuery.ts`의 `shouldSuspend`). `removeQueries()`도 같은
  전제(리렌더가 끼기 전에 언마운트가 먼저 와야 함) 위에 있다.
- **호출 순서·지연은 실측 결과 무관했다.** 보호 경로(`/bookmark`) 로그아웃 e2e에
  "로그아웃 이후 북마크 API 요청 0건" 단언을 처음 추가했을 때 2건 실패가 재현됐는데,
  원인은 `removeQueries()`의 타이밍이 아니라 **테스트 설계 자체**였다 —
  `Navbar.tsx`의 `handleLogout`이 "로그아웃 처리 중" 표시를 700ms 보여준 뒤에야
  실제로 `AuthUtil.clearAll()`을 호출하는데(로그아웃 처리감 연출), 요청 타임스탬프를
  찍어보니 실패한 두 요청은 그 700ms보다 훨씬 전(약 130ms 시점, `/auth/logout` 요청은
  1000ms 시점)에 이미 발생한 것이었다 — `clearAll()`과 전혀 무관한, 폴더 선택 UI의
  정상적인 초기 로드 요청. 호출 순서를 `clearAuth → navigate → removeQueries`로
  바꾸거나 `removeQueries()`를 `setTimeout(0)`으로 지연시켜도 이 2건은 그대로
  나타났다(당연히 로그아웃 클릭 이전에 이미 끝난 요청이므로). 테스트를 "`/auth/logout`
  요청 시점 이후"로 필터링하도록 고친 뒤에는 원래 순서(`clearAuth → removeQueries →
navigate`)로도 통과했다 — 즉 이 구현에 타이밍 의존적인 요소는 없다.

**상태**: 적용됨. 관련 코드: `src/shared/utils/auth.util.ts`, 테스트:
`src/shared/utils/auth.util.test.ts`, `src/shared/api/client.test.ts`,
`e2e/logout.spec.ts`. 상세 설명은 `docs/AUTH.md` §8-E.

---

## 2026-09-14 — URL 쿼리 파라미터 쓰기: mutation 제거, pending 의도는 모듈 스코프로 공유

**배경**

게시글 목록 필터 칩 클릭이 간헐적으로 URL·UI에 반영되지 않거나 되돌아간다는 제보를
Playwright로 재현했다(`history.pushState` 호출 스택 계측 + 네트워크 지연 주입). 원인은
`usePostList.ts`의 `toggleFilter`/`setSearch`가 `useSearchParams()`가 돌려주는 **공유
URLSearchParams 인스턴스**를 `.set()`/`.delete()`로 직접 수정(mutate)하고 있었다는 것 —
`RouterProvider.tsx`의 `v7_startTransition: true` 때문에 필터 변경으로 목록 쿼리가
suspend하는 동안(정지 구간) React가 보는 `location.search`는 API 응답이 올 때까지 안
바뀌고, 그 구간 안에서 또 조작하면 아직 커밋 안 된 mutation이 남은 같은 인스턴스를 또
읽고 고친다.

실측으로 이 mutation이 양날의 검임을 확인했다: 정지 구간 안 **다른** 필터/파라미터
연속 클릭이 누적되는 건 이 mutation 덕분(제거하면 회귀), 반면 초기화 직후 정지 구간에
다른 칩을 클릭하면 방금 지운 필터가 되살아나는 건 같은 mutation이 낸 버그. 같은 패턴이
`BookmarkPage.tsx`(folder/sort)·`useBookmarkSearch.ts`(q)에도 있었는데, 이 둘은 **서로
다른 `useSearchParams()` 인스턴스**를 각자 mutate해 구조적으로 더 취약했다(한쪽의
아직 반영 안 된 변경을 다른 쪽이 인지 못 함).

**결정**

1. mutation을 제거하고, 새 공용 훅 [`useSearchParamsDraft`](../src/shared/hooks/useSearchParamsDraft.ts)로
   "커밋된 URL 또는 아직 반영 안 된 pending 의도" 위에 사본(draft)을 만들어 그 사본만
   고치는 구조로 바꿨다(`usePostList.ts`, `BookmarkPage.tsx`, `useBookmarkSearch.ts`).
2. pending 의도는 훅 인스턴스별 `useRef`가 아니라 **모듈 스코프 변수**에 둔다. 신선도
   판정은 `location.key`(react-router가 push/replace/pop마다 새로 발급)로 한다.
3. 정지 구간 안에서 같은 필터를 재클릭하면 취소되는 동작(토글의 정상 동작)은 고치지
   않았다. 로딩 중임을 보여주는 UI(스피너 등) 추가도 하지 않았다.

**이유 / 주의점**

- **왜 모듈 스코프인가(훅별 `useRef`가 아니라)**: URL은 라우터당 하나뿐인 공유 자원이라
  그에 대한 pending 의도도 하나만 있으면 된다. `BookmarkPage`와 `useBookmarkSearch`처럼
  서로 다른 컴포넌트의 훅 인스턴스가 같은 URL에 대해 쓰기를 할 때, `useRef`는 인스턴스마다
  따로라 이 공유 요구를 못 채운다. 선례: `shared/lib/router/navigation.ts`의
  `NavigationService`(모듈 `let` + `setNavigate`로 1회 주입, 같은 "라우터는 앱당 하나"라는
  전제). 대안(훅별 `useRef`, zustand 스토어, React Context)과 트레이드오프는 계획 설계
  단계에서 비교했다 — Context는 이 레포에 선례가 0건(`grep -rln createContext src`)이라
  배제, zustand는 구독 없이 `getState`/`setState`만 쓸 값이라 스토어 파일을 가변 박스로
  쓰는 셈이라 배제.
- **왜 `location.key`로 신선도를 판정하는가(문자열 비교나 `useSearchParams()` 인스턴스
  identity가 아니라)**: `useSearchParams()` 인스턴스는 훅 호출부마다 별도 memo라 서로
  다른 컴포넌트가 공유할 수 없다. URL 문자열 비교는 "A→B→A(뒤로가기)"에서 옛 pending이
  되살아나는 구멍이 남는다. `location.key`는 컨텍스트 값이라 전 컴포넌트가 동일하고,
  push/replace/pop 모두 새 키를 받는다.
- **읽기(`searchParams`)에는 pending을 섞지 않는다.** `PostListSearch`의
  `useEffect([currentFilter])` 낙관적 미러 3종, `usePostList`의 쿼리 키가 지금처럼
  "커밋된 URL"만 기준으로 돌아야 이중 반영되지 않는다.
- **"같은 필터 재클릭 시 취소"는 의도적으로 범위에서 뺐다.** 재설계로도 이 결과 자체는
  안 바뀐다(칩은 토글이라 논리상 정상 동작). 사용자가 겪은 정확한 체감 증상(로딩 중
  재클릭 → URL이 되돌아감)은 이 정상 토글 동작이 "느린 응답 + 반영 중이라는 피드백
  부재" 때문에 유발된 것이다. 로딩 피드백 추가를 검토하며 NN/g의 Visibility of System
  Status 원칙([nngroup.com](https://www.nngroup.com/articles/visibility-system-status/))을
  근거로 들었으나, 실제로 이 앱은 `v7_startTransition`이 Suspense fallback을 억제해
  필터 변경 시 로딩 스켈레톤조차 원래 안 뜨고("사용자 확인: 다른 사이트에서도 검색
  파라미터 필터에 로딩 표시를 본 적이 없다"), 인용한 리서치도 일반 버튼/폼 제출 맥락이지
  "검색 파라미터 필터 칩"이라는 구체적 사례에 대한 근거는 아니었다 — 근거 부족을 인정하고
  범위에서 뺐다.
- **북마크(`/bookmark`)는 정지 구간 자체가 거의 없다.** `BookmarkPostList`가
  `useInfiniteQuery`(suspense 아님)를 쓰기 때문이다(`grep -rln "useSuspense" src`는
  게시글/상세/댓글 3곳뿐). 그런데도 북마크를 범위에 넣은 이유는 "실사용 버그 재현
  빈도"가 아니라 "URL이라는 공유 자원을 두 훅이 각자 사본으로 다루는 구조 자체를 맞게
  고치는 것"이었다.

**상태**

적용 완료. `pnpm type-check`·`pnpm test`(신규 `useSearchParamsDraft.test.tsx`,
`usePostList.test.tsx` 포함)·`pnpm lint`·`e2e/post-list-filters.spec.ts`·
`e2e/bookmark.spec.ts`·`e2e/bookmark-folder-delete.spec.ts` 통과. 구현 계획은
`docs/plans/2026-09-14-filter-chip-pending-url.md` 참고.

---

## 2026-09-13 — z-index 토큰화 중 발견한 z-scrim 공유 충돌: 값 보존, 분리는 후속 결정

**배경**

z-index 8단계를 이름 붙이며(`globals.css`의 `@theme static` 블록) 전수 감사한 결과,
`Sidebar.tsx`의 모바일 드로어 백드롭과 `MobileCommentBar.tsx`의 확장된 댓글 작성
시트가 원래부터 같은 값(55)을 쓰고 있었다. 둘 다 모바일 전용 `fixed` 요소라, 게시글
상세에서 댓글 작성창을 펼친 채로 사이드바를 열면 어느 쪽이 위에 뜨는지가 DOM 순서로
우연히 정해지는 잠재 충돌이다.

**결정**

이번 토큰화 작업에서는 두 사용처를 똑같이 `z-scrim` 토큰으로 옮겼다 — 즉 **값을
그대로 두고 이름만 붙였다.** 층을 갈라 하나를 위/아래로 옮기는 건 그 자체로 겹침
순서라는 화면 결과를 바꾸는 UX 결정이라, 이번 작업 범위("화면이 전혀 안 바뀌는
것까지만")를 벗어난다.

**상태**

미해결. 두 화면이 실제로 동시에 뜨는 시나리오가 있는지, 있다면 어느 쪽이 우선해야
하는지는 후속 결정 대상이다. `docs/DESIGN-SYSTEM.md` §11 "남은 것"에도 남겨둔다.

---

## 2026-09-13 — 죽은 `tailwind.config.ts` 삭제: Tailwind v4는 CSS-first가 기본값

**배경**

레포 최초 커밋(2026-01-18, `2aac989`)부터 `package.json`에 `"tailwindcss": "^4"`였다 —
v3에서 마이그레이션한 적이 없다. 그런데 그 최초 커밋에 `tailwind.config.ts`도 같이
들어왔고, 같은 날(`7f196b5`) `globals.css`에 `@theme` 블록도 함께 도입됐다. 즉 처음부터
"진짜 설정"(CSS의 `@theme`)과 "아무도 안 읽는 설정"(`tailwind.config.ts`)이 공존했다.

Tailwind v4는 `@config "..."` 지시자가 CSS에 명시돼야만 JS 설정 파일을 읽는다 — 파일
이름만으로 자동 인식되던 v3와 다르다(_"to enable the legacy tailwind.config.js, you can
modify your index.css with `@config \"path/to/tailwind.config.js\";`"_ —
[oumuamua, Medium](https://medium.com/@oumuamuaa/transitioning-from-tailwind-config-js-to-css-first-in-tailwind-css-v4-4afb3bfca4ee)).
이 레포의 `globals.css`에는 `@config`가 한 번도 없었다(grep 0건) — 따라서
`tailwind.config.ts`는 **빌드에 한 번도 반영된 적이 없다.** 빌드 산출물(dist CSS)로
교차검증: config의 `container.screens['2xl']: 1400px`, `tailwindcss-animate`의
accordion keyframes가 dist에 전혀 없었다.

2026-03-14(`c003555`)에 `globals.css`와 `tailwind.config.ts`를 같이 수정한 커밋이
마지막으로 두 파일을 동기화하려던 시도였고, 이후 6개월간 `globals.css`만 계속
진화했다(지금 색 토큰 39개). 그 결과 `tailwind.config.ts`가 참조하는
`--destructive-foreground`가 `globals.css`엔 끝내 정의되지 않았고, 이 때문에
`button.tsx`·`badge.tsx`가 흰색 글자 클래스를 하드코딩해 이 레포의 색상 토큰 규칙을
우회하고 있었다(Tailwind가 기본 제공하는 그 팔레트 클래스 이름은 이 문서에 그대로 적지
않는다 - CSS/JS 주석·문서에 실제 클래스명을 적으면 Tailwind 스캐너가 이를 후보로
오인식해 미사용 유틸리티를 생성한다는 걸 이번에 실측했다, 아래 "상태" 참고).

**결정**

`tailwind.config.ts`를 삭제하고 참조 7곳을 정리했다: `tsconfig.node.json`의 `include`,
`components.json`의 `tailwind.config`(shadcn v4 공식 안내대로 빈 문자열로),
`.github/workflows/deploy.yml`·`history.yml`의 경로 트리거, `docs/DEPLOY.md`·
`docs/SYSTEM-ARCHITECTURE.md`·`docs/CI-CHECK-GATE.md`의 트리거 서술. 색·반경 토큰
정의는 이제 `globals.css`의 `@theme` 한 곳뿐이다.

`tailwindcss-animate`(`package.json`)는 이 죽은 config가 유일한 참조처였지만
(실제 애니메이션은 `tw-animate-css`가 담당), 원래 있던 죽은 의존성이라 이번엔
제거하지 않았다 — 완전한 고아 상태임만 기록해둔다.

**상태**

적용 완료. 이후 디자인 토큰 작업(z-index, 색상 결손 보강 등)은 전부 `globals.css`
기준으로 진행한다.

---

## 2026-09-11 — 미분류 재탭 no-op 결정 번복: 마지막 폴더 규칙과 동일하게 완전 삭제

**배경**

카드 상세에서 북마크 버튼을 눌러 미분류로 저장한 뒤 모달을 다시 열어 미분류 행을
재탭해도 아무 일도 일어나지 않는 것이 이상하다는 문제 제기가 있었다. 아래 "마지막
폴더 해제 시 미분류 대신 북마크 완전 삭제 + 되돌리기" 항목의 **결정 #4**는 이
no-op을 유지하기로 하면서 근거를 이렇게 적었다: _"미분류는 지울 소속 row 자체가
없는 파생 상태라 되돌릴 대상(folderId)이 없어 Undo가 불가능한 파괴적 조작이 되므로
막는다."_

그런데 **같은 커밋에서 만든** `restoreBookmark([])`
(`src/features/bookmark/toggle/hooks/useBookmarkFolders.ts:66-72`)가 정확히 그
Undo를 이미 구현해두고 있었고, 하단 `북마크 제거` 행은 미분류 상태에서 이 함수로
되돌리기를 실제로 제공하고 있었다(`usePostCardBookmarkFolderModal.ts:149-152`,
`prevFolderIds.length <= 1` 분기에 소속 0개가 포함된다). "되돌릴 수 없다"는 전제
자체가 같은 세션에서 이미 틀렸던 것이다 — 새 메커니즘을 만들 필요 없이, 이미
동작하는 경로를 미분류 행에도 열어주면 되는 문제였다.

**결정**

1. `useBookmarkFolderSelect.ts`의 no-op 가드(`isUncategorizedSelected ||`)를
   제거했다 — 남은 조건은 `isAnyPending`뿐이다.
2. `useBookmarkFolders.ts`의 `selectUncategorized`는 소속이 있으면 전체 해제, 없으면
   `toggleBookmark()`를 호출하도록 바꿨다(방향은 `resolveCurrentBookmarkState`가
   캐시에서 판단 — 호출부는 분기하지 않는다). 미북마크 상태의 생성과 미분류 상태의
   완전 삭제가 같은 토글 호출로 갈린다.
3. `usePostCardBookmarkFolderModal.ts`의 `handleSelectUncategorized`는 이미
   미분류일 때 별도 로직을 만들지 않고 `handleRemove()`에 위임한다 — 되돌리기
   토스트·에러 처리·모달 닫기가 그대로 재사용된다.
4. 등록 폼(`usePostCreateBookmarkFolderField.ts`)도 대칭으로 바꿨다 — 이미
   미분류면 "북마크 안 함"으로 되돌린다. 아래 항목의 결정 #3(같은 프레젠테이션의
   같은 탭이 화면마다 다른 뜻이 되면 안 된다는 원칙)을 그대로 적용한 결과다.

**남은 논점**: 근거가 틀렸다고 자동으로 "바꾸는 게 맞다"는 결론이 나오는 건
아니다 — 오탭 위험은 그대로 남는다. 모달 맨 위 행(미분류)까지 파괴적 조작이 되면
목록의 모든 행 중 안전하게 눌러도 되는 행이 하나도 남지 않는다. 이 트레이드오프는
폴더 행의 "마지막 폴더 탭"이 이미 감수한 것과 같은 종류이고(아래 항목 결정 #1~#2),
8초 되돌리기가 위험을 상쇄한다고 보고 그대로 적용했다 — 미분류만 예외로 남기면
"왜 미분류만 다르게 동작하나"라는 더 큰 혼란을 낳는다고 판단했다.

**상태**

적용 완료. `docs/BOOKMARK.md` §5·§10 갱신, 관련 테스트는 §9 참고.

## 2026-09-11 — 보관함 모달: 새 폴더 만들기·북마크 제거를 스크롤 밖에 고정 (안 B 채택)

**배경**

`BookmarkFolderSelectModal`은 헤더만 고정하고 폴더 목록·새 폴더 만들기·북마크 제거를
전부 같은 스크롤 영역(`overflow-y-auto` + `max-h-96`/`max-h-[70vh]`)에 넣고 있었다.
계정에 폴더가 6개를 넘어 "최근 저장한 폴더" 구획까지 켜지면(`docs/BOOKMARK.md` §5)
아래 두 행이 스크롤 없이는 안 보이는 위치로 밀렸다(추정 — 데스크탑 384px 프레임을
행 높이로 역산해 폴더 6개부터 잘리기 시작한다고 계산했을 뿐, 정확한 렌더 결과를
브라우저로 재검증하지는 않았다).

**대안 비교**

세 안 모두 "폴더 목록만 스크롤되고 새 폴더 만들기·북마크 제거는 항상 보인다"는
목표는 같다. 실제 Tailwind 클래스·`globals.css` 색 토큰을 그대로 쓴 정적 목업을 한
Artifact 페이지에 나란히 만들어 비교했다(2026-09-06 결정의 parallel prototyping
원칙 적용).

|           | (A) 하단 고정                                                                                                                                                                             | (B) 생성 위 / 삭제 아래 — **채택**                            | (C) 헤더 아이콘                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 생성 위치 | 하단(북마크 제거 위)                                                                                                                                                                      | 헤더 바로 아래 고정                                           | 헤더 우측 아이콘 버튼                                                                        |
| 목록 손실 | 두 행분(약 82px)                                                                                                                                                                          | 두 행분, 위아래로 분산                                        | 한 행분(약 41px) — 가장 적음                                                                 |
| 근거      | Material Design 다이얼로그 가이드라인과 정확히 일치: _"Actions always remain in place when content scrolls."_([Material Design, Dialogs](https://m1.material.io/components/dialogs.html)) | 생성 발견성 최상 — 새 폴더 만들기가 목록보다 먼저 눈에 들어옴 | 목록 손실은 최소지만 라벨이 없어 발견성이 낮고, 닫기(X) 버튼과 인접해 오탭 위험              |
| 탈락 이유 | 모바일에서 파괴 액션(북마크 제거)이 엄지 위치에 상시 노출됨                                                                                                                               | —                                                             | 자주 쓰는 "폴더 선택"보다 덜 쓰는 "생성"에 자리를 더 배려하는 게 우선순위상 맞지 않다고 판단 |

사용자가 세 안을 보고 B를 선택했다.

**결정**

`BookmarkFolderSelectModal.tsx`에서 새 폴더 만들기 블록을 헤더와 스크롤 영역
사이로, 북마크 제거/북마크 안 함 블록을 스크롤 영역 뒤로 옮겼다. 스크롤 영역의
`max-h-96`/`max-h-[70vh]`는 그대로 유지해(폴더 목록이 보여주는 행 수는 변화 없음)
두 고정 블록만큼 모달 전체 높이가 늘어나는 쪽을 택했다 — 헤더·확인 버튼이 이미 이
방식(스크롤 캡과 무관하게 추가)으로 동작하고 있어 기존 패턴과 일관된다.

**상태**

적용 완료. `docs/BOOKMARK.md` §5 갱신.

## 2026-09-11 — 마지막 폴더 해제 시 미분류 대신 북마크 완전 삭제 + 되돌리기

**배경**

사용자가 폴더 1곳에만 속한 북마크를 그 폴더에서 빼면 미분류로 남는 게 이상하다고
문제 제기했다. 조사 결과 "미분류로 남기는 것" 자체는 의도된 기존 설계였고
(`docs/BOOKMARK.md` §5 "폴더에서 제거 ≠ 북마크 제거"), 완전 삭제 수단은 이미 모달
하단 `북마크 제거` 행으로 존재했다.

그런데 사용자가 실제로 그 행을 눌러보니 미분류 상태에서는 반응이 없는 것처럼,
폴더 소속 상태에서는 완전 삭제가 아니라 되레 미분류로 옮겨간 것처럼 보였다(실사용자
재현). 코드 추적 결과 `useBookmarkPostMutation`(`entities/interaction/api/interaction.queries.ts`)의
낙관적 갱신이 현재 북마크 상태를 계산할 때 메인 피드 목록 캐시(`postKeys.listRoot`)를
조회만 하고 방향 계산에는 쓰지 않아, 메인 피드에서 조작하면 항상 "추가" 방향으로
잘못 처리되던 버그였다(자세한 재현 조건·수정은 `docs/BOOKMARK.md` §10 두 번째
시행착오 참고).

이 버그를 확인하는 과정에서 "그렇다면 마지막 폴더를 뺄 때 미분류로 남기지 말고 그
자리에서 바로 완전 삭제하자"로 방향을 정했다.

**검토 — 대안 비교**

|                                                                                                                                            | (A) 삭제만                                                                                                                                                                                | (B) 삭제 + 되돌리기                                                                                           | (C) 현행 유지 + 문구 개선 | (D) 확인 다이얼로그                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| 데이터 손실 위험                                                                                                                           | 높음 — 오탭 1회로 영구 소실                                                                                                                                                               | 낮음 — 8초 내 1클릭 원복, 이후에도 같은 폴더 재탭으로 복구 가능                                               | 없음                      | 낮음                                                      |
| 기존 설계와의 충돌                                                                                                                         | "폴더에서 제거 ≠ 북마크 제거" 정면 뒤집기                                                                                                                                                 | 동일하게 뒤집지만 되돌리기가 "오탭으로 조용히 사라지면 안 된다"는 원래 우려를 다른 방식으로 해소              | 없음                      | "탭 = 즉시 저장, 확인 단계 없음"(YouTube Music 모델) 위반 |
| 리서치 지지                                                                                                                                | 근거 약함                                                                                                                                                                                 | [NN/g, Jakob Nielsen(2018-02-18, 2026-08-07 재검토)](https://www.nngroup.com/articles/confirmation-dialog/)가 |
| 지지 — _"do go to great lengths to provide undo, because some user errors will remain despite the even the best of confirmation dialogs."_ | Gmail 라벨 선례(마지막 라벨을 떼도 메일은 All Mail에 남음)와는 일치하지만, Gmail엔 "전체 편지함"이라는 상시 노출 안식처가 있어 이 앱의 "안 보이는 곳으로 옮겨감"과는 사용자 체감이 다르다 | NN/g는 되돌리기 가능한 조작엔 확인창을 권장하지 않는다                                                        |

(C)가 가장 아까운 탈락이었다 — `docs/BOOKMARK.md` §1이 이미 이메일 라벨 비유를
채택하고 있어서다. 하지만 마지막 폴더에서 빠진 항목은 "사용자가 방금 보고 있던
화면에서 사라져 다른 곳(미분류)에 나타나는" 것이라, 비유의 일관성보다 실제 사용자
모델(제거했는데 아직 있다는 인지 부조화)을 우선했다.

**결정**

1. `PostCardBookmarkFolderModal`의 폴더 탭: 소속이 그 폴더 1개뿐이면(마지막 폴더)
   `removeBookmarkFolder` 대신 북마크 토글(완전 삭제)을 호출하고, 성공 토스트에
   "되돌리기" 액션(8초, `UNDO_TOAST_DURATION_MS`)을 붙인다. 되돌리기는 같은 폴더로
   `addBookmarkFolder`를 다시 호출하는 것과 정확히 같다 — 그 API가 "북마크 보장 +
   소속 보장"으로 멱등하게 동작해(`ON CONFLICT DO NOTHING`) BE 변경 없이 정확히
   원복된다.
2. 하단 `북마크 제거` 행에도 소속이 0~1개였을 때는 동일하게 되돌리기를 제공한다.
   소속 2개 이상은 일괄 복원(순서·부분 실패 처리)이 별도로 필요해 범위 밖으로 미뤘다
   (`docs/BOOKMARK.md` §11).
3. 등록 폼(`PostCreateBookmarkFolderField`)도 마지막 폴더 해제 시 "미분류로 남는다"
   대신 "북마크 안 함"으로 대칭화했다 — 같은 프레젠테이션(`BookmarkFolderSelectModal`)의
   같은 탭이 화면마다 다른 뜻이 되는 걸 막기 위함. 이쪽은 제출 전 폼 값만 바뀌는
   지연 선택이라 API 호출이 없어 되돌리기 자체가 불필요하다.
4. 미분류 재탭 no-op 규칙(변경 없음)의 근거를 갱신했다 — 기존 근거("북마크 제거
   행과 중복")는 폴더 탭이 이제 파괴적 조작이 된 뒤로는 자기모순이 된다. 새 근거:
   미분류는 지울 소속 row 자체가 없는 파생 상태라 되돌릴 대상(folderId)이 없어
   Undo가 불가능한 파괴적 조작이 되므로 막는다.
5. 파괴적 조작이 생겨 in-flight 중 다른 행을 탭하면 요청이 꼬일 수 있어, 모달
   전체를 pending 중 잠그도록 보강했다(`useBookmarkFolderSelect.ts`).

**의도적으로 감수한 트레이드오프**: 소속 2개 이상에서 완전 삭제는 여전히 되돌리기가
없다(위 2번). 사용자가 자주 겪는 경로(소속 0~1개)를 우선 커버하고, 일괄 복원은
후속 과제로 남겼다.

**상태**

적용 완료. 관련 테스트 7개 파일 58건(신규 회귀 테스트 4건 포함) + 전체 스위트
54개 파일 349건, `pnpm type-check`·`pnpm lint` 모두 통과. 자세한 구현 지도는
`docs/BOOKMARK.md` §5·§8·§10, 계획 대비 구현 대조는 `docs/plans/2026-09-11-bookmark-last-folder-remove.md`
참고.

## 2026-09-11 — 비로그인 북마크 재개: 온보딩 대신 버그 수정, 전면 재개 대신 opt-in

**배경**

"첫 로그인 사용자를 위한 북마크 튜토리얼"을 검토하다가, 비로그인 상태로 북마크를 시도한
사용자가 로그인해도 아무 일도 일어나지 않는 것(`useAuthGuard`가 콜백을 의도적으로 버리는
설계, `docs/AUTH.md` §8-D)과 공유 아이콘이 북마크 상태로 채워지는 버그(`PostCard.tsx`의
`Share2` `fill-current`가 `isBookmarked`에 잘못 묶여 있던 것)를 먼저 발견했다.

**튜토리얼을 채택하지 않은 이유**

NN/g가 모바일 튜토리얼을 실측한 연구에서 과제 성공률은 튜토리얼을 본 그룹 91% / 건너뛴
그룹 94%로 차이가 없었고, 오히려 참가자들이 튜토리얼을 읽었을 때 과제를 더 어렵게
느꼈다(_"participants who read tutorials perceived tasks as more difficult"_ —
[Mobile Tutorials: Wasted Effort or Efficiency Boost?](https://www.nngroup.com/articles/mobile-tutorials/)).
같은 곳의 [Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)는
_"In-context learning cues ... In most cases, this approach is generally more successful
than forced tutorials shown to the user at initial use."_ 라고 권고한다. 온보딩 UI(빈
상태 CTA·툴팁 등)는 §9(시각적 변경은 미리보기 먼저)에 따라 별도 작업으로 미뤘다.

**왜 `onSuccess`에 재개 액션을 태우지 않았는가**

`loginModal.store`의 기존 `onSuccess` 채널은 콜백이 스스로 navigate해 히스토리 엔트리를
벗어난다는 것을 전제로 설계돼 있다 — `LoginModal`이 `onSuccess` 실행 후 `close()`를 부르지
않는 이유가 그것이다(navigate가 이미 엔트리를 벗어났다고 가정). `setOpen(true)`처럼
navigate하지 않는 콜백을 그 채널에 태우면 로그인 모달이 안 닫힌 채 다음 모달이 위에
겹친다. 그래서 navigate하지 않는 재개 액션 전용의 `pendingAction` 채널을 새로 만들고,
`LoginModal`이 먼저 `close()`로 직접 닫은 뒤(기존 else 분기, 무변경) 그 닫힘이 반영된
뒤에만 실행하도록 했다.

**왜 전면 재개가 아니라 opt-in인가**

`useAuthGuard` 사용처 4곳(좋아요·북마크·댓글 좋아요·댓글 작성)을 모두 검토한 결과, 전면
재개는 구체적 버그를 낳는다: 좋아요는 **토글**이라 로그인 후 갱신된 상태를 기준으로
재개하면 오히려 좋아요가 취소되고, 댓글 작성은 가드 내부가 클릭 시점 클로저의 `account`를
참조해 재개해도 조용히 무반응이 된다. 서버 쓰기가 없고 한 번 더 탭해야 저장되는
북마크에만 `resumeAfterLogin` opt-in을 켰다.

**상태**

적용 완료. `src/shared/store/loginModal.store.ts`(pendingAction 채널),
`src/entities/auth/hooks/useAuthGuard.ts`(opt-in 옵션),
`src/features/auth/login/ui/LoginModal.tsx`(닫힘 이후 재개 effect),
`src/features/bookmark/toggle/ui/BookmarkPostButton.tsx`(opt-in 적용),
`src/widgets/post/post-card/ui/PostCard.tsx`(공유 아이콘 fill 버그 수정). 상세 설계는
[`docs/plans/2026-09-11-bookmark-login-resume.md`](plans/2026-09-11-bookmark-login-resume.md) 참고.

---

## 2026-09-10 — 로딩 인디케이터 지연 게이트를 조회 로딩 전체에 일관 적용

**배경**

빠르게 응답이 오는 화면에서 로딩 인디케이터가 잠깐 보였다 사라지는 깜빡임 제보. 전수
조사 결과 이미 지연 게이트(`useDelayedLoading`)가 있고 조회 로딩의 절반(상세·댓글·lazy
청크·세션 복원, `SpinnerOverlay` 경유)은 500ms 지연으로 보호되고 있었지만, 나머지
7곳은 0ms로 즉시 떴다: 피드 목록 스켈레톤, 북마크 목록 스피너, 폴더 트리(데스크톱/모바일),
폴더 선택 모달, `ProtectedRoute`의 전체화면 스피너(`delay={0}`), `RouterProvider`의
좌상단 raw 스피너, 게시글 목록 API의 NProgress 상단바.

부수적으로 `LOADING_INDICATOR_DELAY_MS = 300`(`shared/config/const.ts`)이라는 이름과
달리 이 상수는 조회 로딩에 안 쓰이고 mutation(`usePostCard`, `PostMutationLoadingToast`)
에만 쓰이고 있었고, 실제 조회 로딩 값 500은 `SpinnerOverlay.tsx`에 근거 주석 없는
매직넘버로 박혀 있었다.

**검토**

- **각 fallback 컴포넌트가 스스로 `useDelayedLoading`을 갖는 안(`SpinnerOverlay` 패턴을
  `PostListSkeleton`에 복제)** — 기각. 스켈레톤이 순수 프레젠테이션이 아니게 되어
  Storybook 확인이 어려워지고, `isLoading &&` 분기(북마크 등)에는 애초에 적용할 수 없어
  패턴이 둘로 갈린다. 대신 공통 래퍼 `shared/ui/elements/DelayedFallback.tsx`를 신설해
  Suspense fallback과 `isLoading` 분기 양쪽에 동일하게 쓴다.
- **지연 후 최소 노출까지 Suspense fallback에 걸기** — 기술적으로 불가능하다고 판단.
  fallback의 수명은 Suspense 경계가 소유하고, React 18에는 exit lifecycle이 없어
  fallback이 스스로 노출을 연장할 방법이 없다. 경계 바깥에서 suspend 여부를 관측할
  수도 없다(`useTransition().isPending`은 최초 마운트 suspend를 커버하지 않는다). 대신
  `animate-in fade-in duration-200`(이미 있는 `tw-animate-css`)로 하드 엣지를 없앤다 —
  지연 만료 직후 콘텐츠가 도착해도 opacity가 거의 0인 채로 사라져 눈에 안 띄고, 최소
  노출과 달리 총 대기 시간을 늘리지 않는다. 이 비대칭(조회=지연+페이드인,
  mutation=지연+최소노출)은 취향이 아니라 표시 주체의 소유권 차이에서 나온다.
- **NProgress 상단바 제거** — 처음엔 제거 쪽으로 검토했다(3-Layer API의 Layer 1에 UI
  타이밍 로직이 박혀 있는 계약 위반이라는 점, `refetchOnWindowFocus: true` 때문에 탭
  복귀할 때마다 이미 보이는 목록 위로 번쩍인다는 점 근거). 사용자 확인을 거쳐 한 차례
  "제거"로 진행했으나, 이후 사용자가 그 확인 질문을 "회전하는 스피너 아이콘만 지운다"는
  뜻으로 이해했던 것으로 뒤늦게 드러나 **최종적으로는 NProgress를 그대로 유지**하기로
  정정했다. 코드는 `post.api.ts`(NProgress import·configure·start/done)와
  `globals.css`(`@import 'nprogress/nprogress.css'`, `#nprogress` 규칙)를 원상태로
  되돌렸고, `package.json`/lockfile은 애초에 건드리지 않아 변경이 없다.
- **북마크 폴더/정렬 전환 시 `placeholderData: keepPreviousData` 적용** — 후속으로
  분리. `isLoading`의 의미가 바뀌어 `BookmarkPostList.tsx`의 조기 반환 가드를 다시
  설계해야 하고, "새 폴더 헤더 + 옛 폴더 글 목록"이라는 오해 유발 상태를 별도로
  다뤄야 해서 이번 범위(사용자 요청 문면)를 넘는다. 다만 이번 지연 게이트와 기존
  hover prefetch(`prefetchBookmarkFolderPosts`)가 맞물려 hover 후 클릭하는 흔한
  경로에서는 스피너가 아예 안 뜨게 된다.
- 피드의 필터·검색·봇숨기기 전환은 `RouterProvider.tsx`의 `v7_startTransition: true`
  와 `PostListSearch.tsx`의 `flushSync`/`startTransition` 조합으로 이미 해결돼 있어
  이번 변경 대상에서 제외했다(코드 변경 없음, 수동 QA로만 확인).

**근거**

- [NN/g 응답시간 3한계](https://www.nngroup.com/articles/response-times-3-important-limits/) —
  0.1초=직접 조작감, 1.0초=사고 흐름이 끊기지 않는 한계. 원문: "0.1초 초과 1.0초 미만의
  지연에는 보통 특별한 피드백이 필요 없다." 500ms는 이 구간 안쪽이다.
- 스켈레톤 UX 가이드라인(업계 통용, 개별 벤더 링크 미확보 — 재검증 필요) — 실제 로드가
  400ms~3초일 때만 체감 성능에 도움, 200ms 미만 로드에는 오히려 해로움(깜빡임).
- 기존 결정과의 연속성: 2026-08-13 항목(§ 위)이 이미 mutation 진행 표시에 "500ms 지연
  → 400ms 최소 노출" 타이밍을 확립해 뒀다 — 이번 상수 분리(`MUTATION_PROGRESS_DELAY_MS`)는
  그 값을 승격한 것뿐, 동작 변화는 없다.

**결정**

1. `shared/config/const.ts` — `LOADING_INDICATOR_DELAY_MS`를 300→500으로 올려 이름과
   실제 조회 로딩 값을 일치시키고, `MUTATION_PROGRESS_DELAY_MS`(500, 신규)를 분리해
   mutation 진행 표시 전용으로 둔다. 값이 같지만 성격이 다른 별개 정책이라 상수를
   나눴다 — 나중에 한쪽만 조정할 수 있어야 한다.
2. `shared/ui/elements/DelayedFallback.tsx` 신설 — "마운트돼 있는 동안 = 로딩 중"
   계약의 공통 래퍼. `SpinnerOverlay`는 자체 게이트를 이미 갖고 있으므로
   `DelayedFallback`으로 다시 감싸지 않는다(이중 게이트 금지).
3. 0ms였던 5곳(`PostList` Suspense fallback, `BookmarkPostList`·`FolderTree`·
   `MobileFolderList`·`BookmarkFolderSelectModal`의 `isLoading` 분기)에
   `DelayedFallback`을 적용. 훅 3개(`useBookmarkPostList`·`useFolderSections`·
   `useBookmarkFolderSelect`)는 전부 무변경 — `if (isLoading)` 조기 반환 가드를 그대로
   유지해, 지연 구간에 가드를 통과해 빈 상태 문구("저장한 북마크가 없어요")가 잠깐
   뜨는 회귀를 원천 차단했다.
4. `ProtectedRoute`의 `delay={0}`(근거 주석 없는 흔적, 같은 인증 복원 대기를
   `AppShellLayout`은 이미 기본 게이트로 처리 중이라 정책이 갈려 있었다)을 제거하고
   기본 지연을 쓰도록 통일. `RouterProvider`의 중앙정렬 없는 raw `Spinner`를
   `SpinnerOverlay`로 교체.
5. NProgress는 유지(위 검토 참고).

**상태**

적용 완료. 관련 파일: `shared/config/const.ts`, `shared/ui/elements/DelayedFallback.tsx`
(+ `.stories.tsx`), `shared/ui/elements/SpinnerOverlay.tsx`(+ `.stories.tsx`, 페이드인
추가), `shared/ui/elements/AsyncBoundary.tsx`(JSDoc 오기 `GlobalLoading`→`SpinnerOverlay`
정정), `app/ui/PostMutationLoadingToast.tsx`, `widgets/post/post-card/hooks/usePostCard.ts`,
`widgets/post/post-list/ui/PostList.tsx`, `widgets/bookmark/bookmark-post-list/ui/BookmarkPostList.tsx`,
`widgets/bookmark/folder-tree/ui/{FolderTree,MobileFolderList}.tsx`,
`features/bookmark/select/ui/BookmarkFolderSelectModal.tsx`, `app/routes/ProtectedRoute.tsx`,
`app/providers/RouterProvider.tsx`, `app/routes/ProtectedRoute.test.tsx`(계약 2개로 분리).
신규 테스트: `useDelayedLoading.test.ts`, `useMinimumLoading.test.ts`, `DelayedFallback.test.tsx`.

**후속**: 북마크 폴더/정렬 전환 `keepPreviousData` 검토, 스켈레톤 가이드라인 개별 출처 확정.

## 2026-09-10 — 외부 인용을 "우리가 직접 겪은 것"처럼 쓰지 않기 (CLAUDE.md §10 확장)

**배경**

"인용한 글이 있으면 우리가 한 것처럼 쓰지 말고 눈에 잘 보이게 표시해야 하지 않을까"라는
지적에서 시작한 전수 조사. 레포 문서의 외부 인용은 총 약 90건이었고, 그중 링크가 붙은 건
49건, 무링크는 약 40건이었다 — 큰따옴표로 감싼 직접 인용문인데 무링크가 8건, 구체 수치인데
무링크가 9건. 외부 인용을 `>` blockquote로 시각 분리한 사례는 레포 전체에 `.claude/CLAUDE.md:7-8`
단 1건뿐이었고, 각주(`[^1]`) 형식은 0건이었다.

가장 뚜렷한 패턴은 **재인용 경로에서 링크가 탈락하는 것**이었다: `docs/DECISIONS.md`에
링크와 함께 들어온 인용(Baymard #346, Material 3 Chips, WCAG 등)이 `CHANGELOG.md`·
`docs/SEARCH.md`·`docs/BOOKMARK.md`로 재인용될 때 링크만 사라지고 문장은 그대로 남아,
"우리가 조사해서 아는 사실"처럼 굳어졌다.

**검토한 대안**

`scripts/check-docs.js`를 확장해 이 규칙을 CI로 강제하는 설계를 먼저 검토했다. 실제로 짜본
설계는 새 함수 8개·정규식 10여 개·이 레포에 선례 없는 "파일별 경고 상한 래칫" 개념까지
필요했고, 그렇게 만들어도 오탐률이 11~33%였다(한글 문서의 큰따옴표는 강조·용어 소개·
자문자답에도 널리 쓰여 "인용"과 구분이 어렵다). 이 복잡도를 사용자에게 보이자 "CI까지는
필요 없다, 우리가 직접 겪은 것처럼 쓰는 것만 막으면 된다"는 정정을 받았다 — 기각.
`.claude/CLAUDE.md` §2("과하게 복잡하면 단순화한다")에도 맞는 선택이라 채택하지 않았다.

**검증한 사실 (추측 아님)**

무링크 인용 8건의 원본을 실제로 찾아 대조한 결과, 결과는 네 갈래로 갈렸다:

| 결과                         | 건수 | 예                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 내용 정확, 링크만 없음       | 6건  | TanStack Query SSR 가이드, NN/g Progress Indicators(11–15%), WCAG 2.5.8, Sears & Shneiderman(1994), 토스 UX 라이팅, Claude Code memory 문서(200줄)                                                                                                                                                                   |
| 뉘앙스가 강화됨              | 1건  | `.claude/skills/*/SKILL.md`의 "공식 권장 **상한**(~200줄)" — 원문은 "target"(목표치)이고, 200줄/25KB hard cap은 `MEMORY.md`에만 적용되며 CLAUDE.md는 4 MiB까지 전부 로드된다                                                                                                                                         |
| 서술이 부정확함              | 1건  | `CHANGELOG.md`의 "MS Office 2000 개인화 메뉴 폐기" — 실제로는 도입이 Office 2000, 기본값이 꺼진 건 Office 12(2007)                                                                                                                                                                                                   |
| 외부에 없는 문구에 권위 부여 | 1건  | `.claude/CLAUDE.md`의 `업계 ADR 컨벤션 기준으로 "한 엔지니어가 짧은 기간 안에 발견·수정한 것"` — [Nygard(2011)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)의 실제 ADR 기준은 "되돌리기 어렵다·트레이드오프가 크다·같은 질문이 두 번 이상 논쟁됐다"이고 이 문구 자체는 어디에도 없었다 |

즉 문제는 날조가 아니라 **검증 불가능**이었다. 8건을 확인하는 데 웹 조회가 10여 회
들었는데, 작성 시점에 링크 한 줄이 있었으면 0회였을 일이다.

웹 선례: [Wikipedia:Plagiarism](https://en.wikipedia.org/wiki/Wikipedia:Plagiarism)은
인라인 각주(어디서 확인하는가)와 문장 내 출처 표시(누구의 말인가)를 별개 요건으로
요구한다 — _"Naming the author in the text allows the reader to see that it relies
heavily on someone else's ideas, without having to search in the footnote."_
[agent-style RULE-H](https://github.com/yzhao062/agent-style/blob/main/RULES.md)는
"Uncited claims are a trust failure"라며 검증 실패 시 `[UNVERIFIED]` 마커를 쓴다 — 이
레포의 `[출처 미상]` 표기와 같은 발상이다.

**결정**

1. `.claude/CLAUDE.md` §10에 표기 규칙을 추가했다: 한 문장 이하는 인라인(`_"원문"_` +
   링크 + 누구의 말인지 문장 안에서 밝힘), 두 문장 이상은 blockquote + `— 출처명, URL`.
   번역·생략·재인용은 그 사실을 표시하고, 외부에 없는 문구에 권위를 씌우지 않는다.
2. `.claude/CLAUDE.md:7-8`의 낡은 인용 경계 표기("§8~10은 여기서 직접 추가했다")를
   실제 §13까지로 고쳤다 — 규칙을 만드는 김에 자기 자신의 위반부터 고쳤다.
3. 위 표의 8건과, 조사에서 함께 발견된 구체 수치 무링크 인용(Baymard 42%, Material 3
   Chips, Sears & Shneiderman, WCAG 2.5.8/2.5.5 조항 구분, GitHub·Discord·Slack·X
   업로드 제한 등) 약 10여 건을 각 파일에서 직접 링크를 달거나(내용 정확), 문장을
   고치거나(부정확), 따옴표를 걷어내거나(권위 부여), `[출처 미상, 날짜 확인]`으로
   표시했다(검증 불가).
4. FE 레포에 한정한다. BE는 §10에 해당하는 규칙 자체가 없어 후속 과제로 남긴다.

**상태**

적용 완료. 수정 파일: `.claude/CLAUDE.md`, `docs/DECISIONS.md`(본 항목 포함), `CHANGELOG.md`,
`docs/SEARCH.md`, `docs/BOOKMARK.md`, `docs/CI-CHECK-GATE.md`,
`.claude/skills/{changelog-release,design-tokens,texts-conventions}/SKILL.md`.

---

## 2026-09-09 — BookmarkFolderSelectModal을 entities에서 features/bookmark/select로 이동

**배경**

`docs/FE-ARCHITECTURE.md`·`.claude/CLAUDE.md`·`eslint.config.js`가 실제 코드와 여전히
일치하는지 전수 감사하던 중, `entities/bookmark/folder/ui/BookmarkFolderSelectModal.tsx`
(270줄)가 폴더 생성·선택·삭제까지 담은 완전한 인터랙션 UI라는 게 드러났다. 이 레포의 규칙
(`.claude/CLAUDE.md` "레이어별 허용 세그먼트" 표)은 FSD 공식 레이어 정의를 그대로 인용한다
— entities/ui는 _"the visual representation... reused across several pages"_(시각적
표현), features/ui는 _"the UI to perform the interaction like a form"_(인터랙션 수행). 이
모달은 후자에 해당하는데 entities에 있었다.

**검토 — 순서대로 검증한 대안들**

- **useAlert(`shared`) 선례를 그대로 따르기** — 기각. `useAlert`는 제목·메시지·확인/취소
  버튼뿐인 순수 UI 패턴으로 비즈니스 로직이 전혀 없다. 이 모달은 폴더 CRUD라는 명백한
  비즈니스 로직(생성 뮤테이션, 쿼리)을 가진 훅(`useBookmarkFolderSelect`)과 강하게
  결합돼 있어 같은 선례로 보기 어렵다.
- **widgets로 이동** — 기각(실행 불가능한 오판이었음, 뒤늦게 발견). 이 모달을 참조하는
  `PostCardBookmarkFolderModal`·`PostCreateBookmarkFolderField`는 둘 다 **features**
  레이어에 있다. widgets는 features보다 상위 레이어라, 모달을 widgets로 옮기면
  "features가 widgets를 import"하는 **레이어 역방향 import**가 되어 `eslint.config.js`의
  `no-restricted-imports`(features 블록)가 즉시 막는다.
- **`PostMutationLoadingToast`(`app/ui/`) 선례를 따라 app으로 이동** — 기각. 그 컴포넌트는
  `App.tsx`에 한 번 마운트되는 헤드리스 옵저버(`return null`)로, `useIsMutating`을 통해
  entities(post·account)의 뮤테이션 키를 **구독만** 할 뿐 어떤 feature도 이걸 import하지
  않는다. 반면 이 모달은 두 feature가 **명시적으로 import해서 props(콜백)를 주입**하며
  렌더링해야 동작한다 — 구조가 근본적으로 달라 선례로 쓸 수 없다. FSD 공식 문서가
  제시하는 "상위 레벨(pages/app)이 슬라이스를 조합"(render props/slots/DI) 패턴을 적용하려면
  이동이 아니라 전역 상태 스토어를 새로 설계해야 해서, 이번 범위에는 비용이 과했다.
- **shared로 이동** — 기각. FSD 공식은 "같은 레이어의 feature끼리 공유가 안 되면 shared로
  내리라"고도 처방하지만, `shared`는 "비즈니스 로직 없는 재사용 가능한 UI 킷"이 원칙이라
  폴더 CRUD 훅을 그대로 옮기면 이 원칙과 충돌한다.

**결정**

`BookmarkFolderSelectModal.tsx`와 그 전용 훅 `useBookmarkFolderSelect.ts`(다른 소비처가
없어 모달과 함께 이동, 원래 폴더 목록 조회·생성·행별 pending 상태를 전담)를
`features/bookmark/select/`(`ui/`, `hooks/`)로 옮긴다. 슬라이스 이름 `select`는 features
네이밍 규칙("원칙적으로 동사만", 선례 `features/bookmark/toggle/`)을 따르고, 코드에 이미
쓰이던 어휘(`onSelectFolder`, `handleSelectFolder`)와 일치한다. `folder-select`는
`bookmark/` 그룹 아래서 하위 엔티티명을 다시 반복하는 형태(`create-post`류 위반 패턴)라
채택하지 않았다.

entities/bookmark/folder/에는 다른 소비처가 있는 순수 데이터 훅(`useRecentBookmarkFolders`
— `widgets/bookmark/folder-tree/`도 사용)과 3-Layer API(`bookmark-folder.api/keys/queries.ts`),
스키마·유틸은 그대로 남긴다. `ui/` 디렉터리는 비어 삭제했다.

**의도적으로 감수한 트레이드오프**: `features/post/create`가 `features/bookmark/select`를
import하는 features↔features cross-import가 새로 생겼다. FSD 공식·`docs/DECISIONS.md`
2026-09-09(entities/user 분리 항목)이 인용한 Cross-import 가이드는 이 패턴을 권장하지
않지만("compose at a higher level"), 위에서 검토한 대로 다른 대안들이 이 케이스에는 더
큰 비용이나 실행 불가능한 문제를 안고 있어 이 트레이드오프를 선택했다.

**상태**

적용 완료. `pnpm type-check`/`pnpm lint`(신규 cross-import는 ESLint가 감지 못함, 위
"의도적으로 감수" 참고)/`pnpm test`(51 파일, 333건) 전부 통과. `docs/FE-ARCHITECTURE.md`의
디렉터리 트리(§3)와 §1 "정식 FSD와 다른 점" 표를 함께 갱신했다.

## 2026-09-09 — entity 쿼리 훅 UI 직접 호출 금지를 ESLint로 승격 (features 한정)

**배경**

`CreatePostForm.tsx`가 `useFetchCategoryOptionQuery()`를 UI 컴포넌트에서 직접 호출하고 있다는
지적에서 시작한 조사. 같은 슬라이스(`features/post/create/`) 안에서 북마크 폴더 필드는 조회를
훅(`usePostCreateBookmarkFolderField.ts`)이 소유하는데 카테고리만 UI가 소유하는 불일치가
있었다. 전수 조사 결과 같은 형태(features/widgets의 `ui/`가 entity `*.queries` 훅을 직접
호출)가 5건이었고, `custom-query-rules/no-direct-query-import`는 `@tanstack/react-query`
직접 import만 막아서 entity가 감싼 `*.queries` 훅 호출까지는 못 잡았다 — `dayjs` 규칙이 같은
이유(문서 규칙에만 의존, ESLint 부재)로 5개월간 위반이 안 잡혔던 것과 같은 패턴이다.

**검토한 대안**

1. **기존 feature 훅(`useCreatePost`/`useUpdatePost`)에 흡수** — 반환 객체에
   `categoryOptionList` 키를 추가하는 방식. `.claude/CLAUDE.md` "변경 범위 원칙"의 "반환 타입
   변경은 명시적 요청 없이 불가"에 걸리고, `useUpdatePost.test.tsx`는 MSW 핸들러 없이
   `setQueryData`로만 post 상세를 심는데 카테고리 조회가 훅에 딸려 들어가면 미핸들 요청
   경고가 매 테스트마다 붙는다. **탈락.**
2. **`features/post/_shared/hooks/` 신설** — features 슬라이스 간 import가 이 레포에 현재
   0건이라 선례 없는 패턴을 새로 여는 셈. **탈락.**
3. **`entities/category/hooks/useCategoryOptions.ts` 신설** — `entities/account/hooks/useAccount.ts`
   (쿼리를 감싼 entity 훅), `entities/bookmark/folder/hooks/useBookmarkFolderSelect.ts`(두
   슬라이스가 공유하는 entity 훅) 선례와 같은 자리. **채택.**
4. **ESLint 룰을 `no-restricted-imports`로 구현** — `eslint.config.js`가 이미 같은 rule key로
   FSD 레이어 경계(`features`→`widgets` 등)를 강제하는데, flat config는 같은 key가 겹치면
   배열 병합이 아니라 통째로 덮어써서 그 파일들의 레이어 규칙이 조용히 사라진다(이 레포가
   이미 두 번 당한 함정, `eslint.config.js` 주석 참고). **탈락** — 고유 rule key의 커스텀
   룰(`no-entity-query-import-outside-hooks`)로 구현.
5. **widgets까지 룰 대상에 포함** — §8의 "query 1개 + trivial 파생" 예외는 "파생이
   trivial한가"라는 사람 판단이라 ESLint가 평가할 수 없다. 파일 단위 ignore로 흉내 내면 그
   파일에 앞으로 들어올 모든 쿼리까지 영구 면제된다. **탈락** — widgets는 문서(§8)와 PR
   리뷰로 지킨다.

**결정**

1. `entities/category/hooks/useCategoryOptions.ts`를 신설해 `CreatePostForm.tsx`·
   `UpdatePostForm.tsx`·`PostListSearch.tsx` 세 호출부가 공유한다. `?? []` fallback을 훅
   하나로 모은다.
2. `custom-query-rules/no-entity-query-import-outside-hooks`를 추가해 `src/features/**`(hooks/
   제외)에서 entity `*.queries` 모듈 import를 금지한다. widgets는 대상 아님.
3. 같은 조사에서 `.claude/commands/code-review.md`의 "React Query hooks only in
   `<entity>.queries.ts` — not in feature hooks, not in UI"가 사실과 다르다는 것도 발견했다
   (feature hook 13곳이 정상적으로 쿼리 훅을 호출하는 게 이 레포의 정상 패턴). 함께 정정했다.
4. 범위 밖으로 남긴 것: `widgets/comment/comment-list/ui/CommentList.tsx`(정렬+재귀 집계라
   §8 예외에 해당하지 않지만 별건 리팩터링), `pages/post/index.tsx`의 반환값 미사용
   프리페치 호출, `entities/category/api/category.queries.ts`의 호출부 없는
   `prefetchCategoryData` — 전부 CLAUDE.md §3("무관한 죽은 코드는 언급만 하고 지우지
   않는다")에 따라 언급만 하고 손대지 않았다.

**상태**: 적용됨.

## 2026-09-09 — 질문 전에 판단 재료를 먼저 준다 (CLAUDE.md §13 신설)

**배경**

"질문하기 전에 그 질문이 도출된 과정과 조사한 내용을 공유해야 판단할 수 있다. 선택지만
주면 답을 못한다"는 지적. `CLAUDE.md` §7("사용자가 체감하는 트레이드오프는 승인을 받는다")은
*묻지 않고 혼자 결정하지 마라*까지만 다루고 있었고, *물을 때 무엇을 함께 줘야 하는가*는
비어 있었다.

**검증한 사실 (직접 측정)**

측정 방법: `~/.claude/projects/-Users-baechan-project-link-sphere-link-sphere-FE-NEW/*.jsonl`
중 최근 8개 세션을 파싱해 `AskUserQuestion` 도구 호출을 전수 조사했다(스크립트는 세션
스크래치패드의 `scan.py`·`lens.py`, 재현 절차: 각 JSONL을 줄 단위 JSON으로 읽어
`message.content[].type == "tool_use" && name == "AskUserQuestion"`를 찾고, 직전 같은
턴의 assistant 텍스트 블록 길이와 `input.questions[].options[].description` 길이를 측정).

- `AskUserQuestion` 호출 18건 중 **7건(39%)이 직전 본문 설명 300자 미만**, 그중 1건은
  본문 설명이 0자였다(중앙값 459자).
- 옵션 `description` 97개 중 **29개(30%)가 150자 초과**, 최대 283자. 옵션 `label`은
  도구 스펙상 1~5단어 권장인데 최대 39자까지 나왔다.
- 실제 사례(2026-09-09 05:04, `shared/` 152개 파일 재구조화 질문): 본문 설명은 123자였고
  "config 133·ui 109·lib 79 파일이 참조" 같은 조사 결과는 전부 옵션 `description` 안에
  압축돼 있었다. 즉 근거가 본문이 아니라 옵션 카드 안에 들어가 있었다.
- 구조적 원인: `AskUserQuestion` 옵션 카드는 판단 재료를 담는 자리가 아니다(label
  1~5단어, 옵션 최대 4개). 그리고 조사를 서브에이전트(Explore·Plan 등)에 위임하면 그
  리포트는 사용자 화면에 표시되지 않고 호출자에게만 전달된다 — 옮겨적지 않으면 사용자가
  보는 근거는 0이 된다. Plan 모드가 이 경로를 그대로 탄다.
- 안전망 훅 가능성도 검토했다(§12의 `plan-diagram-reminder.sh` 선례를 참고). 그러나
  `AskUserQuestion`이 `PreToolUse` 훅의 matcher로 걸리는지는 공식 문서
  (code.claude.com/docs/en/hooks.md)의 내장 도구 목록에 없어 확인되지 않았고, §12 훅과
  달리 "150줄 이상 계획 파일" 같은 객관적 판정 기준이 없어 글자수 휴리스틱은 "PR을
  병합할까요?" 같은 정당한 짧은 질문을 오탐할 위험이 크다.

**결정**

`CLAUDE.md`에 §13("질문하기 전에 판단 재료를 먼저 준다")을 신설한다. 질문 전에 본문으로
확인한 사실·왜 묻는가·각 선택지가 바꾸는 것·추천을 먼저 낸 뒤 `AskUserQuestion`을
호출하고, 옵션 `description`은 본문 요약 라벨로만 쓴다. 같은 규칙을 BE 레포
(`link-sphere_BE_NEW/.claude/CLAUDE.md` §9)에도 반영한다. 훅은 만들지 않는다(위 이유).

**상태**

적용 완료. `CLAUDE.md`는 세션 시작 시 스냅샷되므로(§12가 같은 성질을 기록해 둠) 이
커밋 이후 시작된 세션부터 자동 적용된다.

---

## 2026-09-09 — entities/user를 auth/account/user 세 엔티티로 분리

**배경**

"user라는 이름도 좀 애매한 것 같다"는 지적에서 출발한 조사. `entities/user/` 폴더 안 실제
내용물은 폴더명과 달리 전부 `auth.*.ts` 파일이었다 — `auth.api.ts`에 `login`과
`updateAccount`가 한 객체(`authApi`)에 같이 있었고, `authKeys`도 `auth.keys.ts`(함수형)와
`auth.queries.ts`(배열형) 두 곳에 형태가 다르게 중복 정의돼 있었다. 반면 `UserAvatar.tsx`는
"내 계정"이 아니라 게시글·댓글 작성자(남의 프로필) 표시에 주로 쓰이고 있어, account(비공개
내 정보)와 user(공개 사용자 표현)를 가르는 축이 이미 코드 안에 잠재해 있었다.

**검증한 사실 (추측 아님)**

- FSD 공식 [Authentication 가이드](https://feature-sliced.design/docs/guides/examples/auth):
  "The current user is also sometimes called 'viewer' or 'me'. This is to distinguish
  the single authenticated user, with permissions and private information, from a list
  of all users with publicly accessible information." — 즉 공식이 가르는 축은 "auth vs
  account"가 아니라 "current user(비공개) vs user(공개)"다. `Account` 타입의 `email`·`role`은
  비공개, `post.schema.ts`의 `author`(`accountSchema.pick({id,nickname,image})`)는 공개
  정보만이라 이 축과 정확히 일치한다.
- 공식 등재 예제 [nukeapp](https://github.com/noveogroup-amorgunov/nukeapp/tree/master/src/entities)의
  실제 슬라이스 목록에 `session`과 `user`가 별도로 존재하고, 세션/아바타를 각각 다른
  엔티티에서 가져온다 — 지금 결정과 같은 구도.
- FSD 공식 [Public API — cross-imports](https://feature-sliced.design/docs/reference/public-api):
  "only use this notation on the Entities layer, where eliminating cross-imports is
  often unreasonable." 동일 레이어 슬라이스 간 참조는 entities에서 예외적으로 허용된다.
  이 레포는 이미 `docs/FE-ARCHITECTURE.md` §1에서 이 규칙을 명시적으로 미채택(entities
  cross-import 29건, post↔comment/interaction/bookmark-folder 순환 3개 실측)했다고
  기록해뒀다 — auth→account 참조 1건은 새 위반이 아니라, 기존 `entities/user/api/auth.keys.ts`가
  이미 post·comment·bookmark/folder 3개 슬라이스를 참조하던 결합을 줄이는 방향이다.

**결정**

1. `entities/user/api/`·`entities/user/hooks/`를 인증(로그인·로그아웃·회원가입·세션 복원)과
   계정(내 프로필 조회·수정)으로 쪼개 `entities/auth/`·`entities/account/`로 옮긴다.
   `entities/user/`는 `ui/UserAvatar.tsx` 하나만 남기고 "공개 사용자 표현" 전용으로 좁힌다.
2. `shared/types/auth.type.ts`도 함께 쪼갠다 — `loginSchema`·`createAccountSchema`·
   `passwordValidationSchema`는 `entities/auth/model/auth.schema.ts`로, `accountSchema`·
   `updateAccountSchema`·`nicknameValidationSchema`·`emailValidationSchema`는
   `entities/account/model/account.schema.ts`로 옮긴다. 두 파일 중 하나가 상대방의
   validator를 cross-import하되(`auth.schema.ts` → `account.schema.ts`의 nickname/email
   validator), 파일 단위 순환은 만들지 않도록 한 방향으로만 흐르게 설계했다 — email·nickname은
   계정 데이터(Account의 실제 필드)이므로 소유권을 account 쪽에 두고, password만 auth
   고유 자격증명이라 auth 쪽에 남겼다.
3. `features/auth/profile/` → `features/account/update/`로 옮기고, 내부 파일도
   `useUpdateProfile`→`useUpdateAccount`, `UpdateProfileForm`→`UpdateAccountForm`으로
   개명해 폴더-파일명 일관성을 맞췄다(폴더만 옮기고 파일명을 안 맞추면 아래 "엔티티 파일명
   접두사" 결정이 다룬 `useRecentFolders.ts` 사례처럼 반쪽 마이그레이션이 남는다).
4. 쿼리 키 이중 정의(`auth.keys.ts`의 함수형 `authKeys` vs `auth.queries.ts`의 배열형
   `authKeys`)를 `auth.keys.ts` 하나로 통합했다(3-Layer 규약대로 keys 파일이 소유). `account`
   쪽은 `accountKeys.root = ['account']`로 새로 분리했다. BE 엔드포인트(`API_ENDPOINTS.auth.*`)는
   그대로 둔다 — `/auth/account` 같은 실제 라우트는 FE 폴더 구조와 무관하다.
5. **범위 밖으로 남긴 것**: `shared/store/auth.store.ts`·`shared/utils/auth.util.ts`·
   `shared/config/storage-keys.ts`의 `AUTH.LAST_AVATAR`(프로필 데이터지만 AUTH 그룹에
   있음)는 이미 세션/토큰 인프라로 올바르게 좁혀져 있어 건드리지 않았다. `signup`은
   비로그인 상태에서 일어나는 인증 flow이자 BE 엔드포인트도 `/auth/signup`이라 그대로
   `auth`에 남긴다.

**발견했지만 이번 범위 밖으로 남긴 것**

- `entities/user/api/auth.keys.ts`의 `authInvalidateQueries.all`은 이미 프로덕션에서
  미사용이었다(테스트 mock에만 등장). 분리 후 `['auth']` 트리에는 login/logout만 남아
  invalidate할 대상 자체가 사라지므로(계정 캐시는 `['account']`로 옮겨감) 그대로
  옮기는 대신 이번에 제거했다.
- `entities/user/api/auth.queries.ts`의 `useCreateAccountMutation` `onSuccess`가
  `navigate(API_ENDPOINTS.auth.login)`으로 **API 엔드포인트 상수**를 라우팅에 쓰고 있다
  (원래는 `ROUTES_PATHS.AUTH.LOGIN`이어야 한다). 우연히 같은 문자열이라 지금은 동작하지만
  API 경로가 바뀌면 라우팅이 깨진다 — 이번 리네임과 무관한 기존 버그라 건드리지 않았다.

**상태**

적용 완료. `pnpm type-check`/`pnpm lint`/`pnpm test`(48 파일, 314건)/`pnpm check:docs`/
`pnpm format:check` 전부 통과.

---

## 2026-09-09 — queryClient 싱글턴 → useQueryClient() 마이그레이션 + react-query import 화이트리스트 전환

**배경**

"UI에서 react-query를 직접 호출하는 곳이 있는지, hooks에서만 호출 가능하도록 강제해야
하지 않을까"라는 질문에서 시작한 조사. 결과: 이 레포는 이미 `custom-ui-rules/no-direct-query-import`
(`src/**/ui/**`에서 `@tanstack/react-query` import 금지)로 막고 있었고 프로덕션 위반은
사실상 0건이었다. 다만 두 가지가 드러났다:

1. 룰이 `src/**/ui/**`만 검사해서 `pages/`·`*/hooks/**`는 대상 밖이었고, `@tanstack/react-query`
   문자열만 봐서 싱글턴 `queryClient`(`@/shared/lib/react-query/config/queryClient`)를
   직접 import하는 경로는 전혀 못 잡았다.
2. `entities/*/api/*.keys.ts`(5개)·`*.queries.ts`(6개)가 `useQueryClient()` 대신 싱글턴을
   직접 import해서, 테스트가 `createTestQueryClient()`로 격리된 클라이언트를 만들어도
   캐시 무효화는 싱글턴으로 새어나가 검증이 안 됐다. 9개 테스트가 이 때문에 격리 클라이언트를
   포기하고 싱글턴을 그대로 provider에 꽂고 있었다(`post.queries.test.ts`의 "캐시 갱신이
   싱글톤 queryClient를 직접 조작하므로 동일 인스턴스를 provider로 사용" 주석).

`PostMutationLoadingToast`(당시 위치 `src/shared/ui/elements/`)는 ESLint 예외(`ignores`)로
룰을 피해가면서, `postMutationKeys`를 shared 레이어라 import 못 해 뮤테이션 키 문자열
(`['post','create']` 등)을 하드코딩하고 있었다.

**검증한 사실 (추측 아님)**

- **싱글턴 자체는 이 레포에서 안티패턴이 아니다.** [TanStack Query SSR 가이드](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)가
  모듈 스코프 싱글턴을 문제 삼는 이유는 _"can share data between users"_(여러 사용자
  요청이 같은 캐시를 공유해 데이터가 샌다 — 번역)인데, 이 레포는 SSR 없는 Vite CSR SPA라
  그 전제가 없다. [tRPC Setup 문서](https://trpc.io/docs/client/tanstack-react-query/setup)도
  client-only SPA는 모듈 스코프 싱글턴이 _"fine and acceptable"_ 하다고 명시한다.
  `useQueryClient()`가 반환하는 것도
  결국 `QueryProvider`가 주입한 그 싱글턴과 **동일 인스턴스**다 — 마이그레이션 후에도
  프로덕션 런타임 동작은 0 변화다.
- 마이그레이션의 유일한 실익은 **테스트 격리 회복**이다. `.keys.ts`가 싱글턴을 직접 잡는 한,
  테스트가 격리 클라이언트를 써도 무효화 검증이 안 된다.
- `AuthUtil.clearAll()`/`clearQueries()`는 React 트리 밖(axios 인터셉터 `shared/api/client.ts`,
  전역 `MutationCache`/`QueryCache` 에러 핸들러 `queryClient.ts`)에서 호출되므로
  `useQueryClient()`를 쓸 수 없다 — `auth.util.ts`는 싱글턴 예외로 남긴다.
- FSD 공식 [Cross-import 가이드](https://feature-sliced.design/docs/guides/issues/cross-imports)는
  여러 슬라이스 데이터를 다뤄야 하는 UI를 "compose them at a higher level (pages/app)"로
  처방한다. `PostMutationLoadingToast`가 post·auth 두 엔티티의 뮤테이션 키를 알아야 하는
  이유가 정확히 이 경우였다 — `shared`(entities보다 아래 레이어)에 있어서 import가 안 돼
  하드코딩한 것이었다.

**결정**

1. `.keys.ts`의 invalidate/handler 함수들을 "`QueryClient`를 첫 인자로 받는" 시그니처로
   변경. 대안이었던 (a) 훅 안으로 이동, (b) 팩토리로 감싸기는 각각 크로스 엔티티 무효화의
   캡슐화(`.claude/CLAUDE.md` Critical Rules)를 깨뜨리거나 실익 없는 추상화 1겹을
   추가하는 것이라 기각했다.
2. `PostMutationLoadingToast`를 `src/shared/ui/elements/`에서 `src/app/ui/`로 이동.
   `app`은 entities를 자유롭게 import할 수 있어 하드코딩된 키 배열이 `postMutationKeys`/
   `authMutationKeys` 참조로 바뀌었다.
3. ESLint 룰을 화이트리스트 방식(`src/**` 기본 금지 + 정당한 위치만 예외)으로 전환하고,
   싱글턴 import를 막는 룰(`no-query-client-singleton-import`)을 별도로 추가했다. 두 룰을
   같은 rule key로 겹치게 두면 flat config가 뒤 블록으로 앞 블록을 덮어쓰는 함정이 이미
   이 레포에서 사고를 낸 적이 있어(§2 참고), 고유 rule key로 분리했다.

**계획 대비 이탈 — PR을 2개로 나누려 했으나 실제로는 분리 불가능했다**

당초 "PR A(마이그레이션) 후 PR B(ESLint 룰 화이트리스트 전환)"로 나눌 계획이었다.
그런데 화이트리스트 룰만 먼저 켜보니(마이그레이션 전 상태) **21건이 즉시 lint 에러**로
잡혔고, 그 21건 전부가 정확히 PR A의 대상 파일과 겹쳤다. 즉 "룰만 켜는 것"과
"마이그레이션"은 같은 diff일 수밖에 없었다 — 계획 단계에서 예측하지 못한 지점이었다.
최종적으로는 마이그레이션 코드·테스트·ESLint 룰을 한 커밋에 담았다.

**상태**

적용 완료. `.keys.ts` 5개, `.queries.ts` 6개, 비-훅 prefetch 함수 3개(`prefetchPostDetail`·
`prefetchBookmarkFolderPosts`·`prefetchCategoryData`), 테스트 13개(엔티티 쿼리 테스트 5개 +
`auth.keys.test.ts` + `renderWithProviders` 사용 3개 + `selective-test-coverage`가 추가한
폴더 트리 훅 테스트 4개) 전환. `pnpm type-check`/`pnpm lint`/`pnpm test`(47 파일, 314건)
전부 통과. ESLint 룰이 실제로 작동하는지는 임시 위반 코드를 넣어 `pnpm lint`가 잡는 것을
확인한 뒤 되돌리는 방식으로 실증했다.

---

## 2026-09-09 — 엔티티 파일명 접두사는 디렉터리 세그먼트명이 아니라 엔티티명을 따른다

**배경**

직전 PR(entities/bookmark/folder export 전체를 `BookmarkFolder`로 개명)에서 파일명
6개(`folder.api.ts` 등)는 그대로 두기로 하면서 "파일 접두사는 디렉터리 세그먼트명
(`folder`)을 따르지 export명을 안 따른다"는 규칙을 근거로 들었다. 이 규칙은
**문서 어디에도 존재하지 않았다** — 실제로 있는 규칙은
[`docs/FE-ARCHITECTURE.md`](./FE-ARCHITECTURE.md) §18의 `<entity>.<역할>.ts`(`<entity>`는
엔티티명)뿐이었다. 사용자가 "파일명도 `bookmark-folder.api.ts`처럼 바꿔야 하지 않냐 —
`folder`라고만 하면 나중에 다른 의미의 folder가 생겨도 헷갈리지 않는다"고 재차 지적해
근거를 다시 검증했다.

**드러난 문제 — 없는 규칙을 근거로 든 것**

2026-09-08 항목(바로 아래, "entities 세그먼트 규칙")의 결정 3번은 "복합명
(`bookmark-folder/`)은 '도메인 폴더는 단수 소문자' 규칙과 충돌한다"고 적었는데, 이건
**디렉터리 네이밍**에 대한 판단이었다(`.claude/CLAUDE.md`의 "폴더 네이밍 규칙" 섹션 —
섹션 제목, 트레일링 슬래시가 붙은 예시, 인용 근거인 "도메인 폴더" 표 행 모두 디렉터리
전용임을 가리킨다). 그런데 직전 PR에서 이 디렉터리 판단을 **파일명에도 확장 적용**하며
"파일 접두사는 세그먼트명을 따른다"는 문장을 새로 지어냈다 — 실측 결과 이런 규칙은
`docs/FE-ARCHITECTURE.md`·`.claude/CLAUDE.md` 어디에도 없었고, 오히려 §18 표는 API
객체(`<entity>Api`)·쿼리 키(`<entity>Keys`)를 전부 엔티티명 기준으로 규정하고 있었다.

**검증 결과 (fresh Explore subagent 3개, 실측)**

- 레포의 "역할 접미사가 붙은" 파일 56개 중 52개가 1단어 접두사였지만, 이는 해당
  엔티티명(`post`·`comment`·`category`·`auth`…)이 전부 1단어라서 그런 것이었다.
  복합 접두사 선례는 이미 `.store.ts`에 4개(`hideBots`·`loginModal`·`unsavedChanges`·
  `imageViewer`) 있었다.
- ESLint `unicorn/filename-case`는 `*.api.ts`·`*.queries.ts`·`*.schema.ts`·`utils/**`에
  `kebabCase`만 강제하고, 접두사 자체(1단어인지 복합어인지)는 강제하지 않는다.
- 현재 `src/` 299개 파일 중 basename 중복은 2건(`utils.ts`, `index.tsx`)뿐이고 역할
  파일 중복은 0건, 북마크가 아닌 다른 "folder" 도메인도 0건 — 즉 "지금 당장 헷갈린다"는
  아니고 장래 대비 성격의 지적이었다.

**결정**

1. `entities/bookmark/folder/`의 역할 파일 6개(`folder.api.ts`→`bookmark-folder.api.ts`
   등) + 짝 테스트 2개 + mocks 2개(`folder.fixtures.ts`→`bookmark-folder.fixtures.ts`,
   `folder.handlers.ts`→`bookmark-folder.handlers.ts`, 안의 export 식별자도 mocks
   레이어 관례(`mock<EntityType>`, `<entity>Handlers`)에 맞춰 함께 개명)를
   `bookmark-folder.*`로 rename한다.
2. PR #46(entities export 전체 개명) 당시 놓쳤던 `useRecentFolders.ts`→
   `useRecentBookmarkFolders.ts` 파일명 rename도 함께 바로잡는다 — "파일명 = export명"
   컨벤션 대상인데 export만 바뀌고 파일명이 안 따라가 있었다.
3. `docs/FE-ARCHITECTURE.md` §18의 `config/` 파일 규칙 행에 "`<entity>`는 엔티티명이지
   디렉터리 세그먼트명이 아니다"를 명시해, 이번에 실제로 잘못된 근거를 낳은 모호성을
   재발 방지로 기록한다.
4. **디렉터리명은 안 바꾼다** — `entities/bookmark/folder/`의 그룹 폴더 구조는
   2026-09-08 결정(아래 항목)을 그대로 유지한다. 이번 결정은 파일명에만 적용되고,
   그 결정을 뒤집지 않는다.
5. 같은 조사에서 `<entity>List` 규칙(§18) 위반이 레포에 7종 더 있었다
   (`recentFolders`·`folders`·`usedFolders`·`posts`·`comments`·`previousComments`·
   `categories`). 이번 파일명 rename과 직접 얽힌 bookmark 도메인 3종(`recentFolders`→
   `recentFolderList`, `folders`(파라미터)→`folderList`, `usedFolders`→`usedFolderList`)만
   함께 처리하고, 나머지 4종(post·comment·category 도메인)은 이 PR과 무관해 후속 PR로
   미룬다.

**상태**

적용 완료. 후속: `<entity>List` 규칙 위반 4종(`posts`·`comments`·`previousComments`·
`categories`)은 별도 PR에서 처리 예정.

---

## 2026-09-08 — features 네이밍 규칙 완화 + 테스트 정책 명문화 + bookmark 구조 재검토

**배경**

두 가지 지적에서 시작했다: (1) 어떤 파일엔 테스트가 있고 어떤 파일엔 없는데
(`CreatePostForm.tsx`는 없고 같은 폴더의 `BookmarkFolderField.tsx`(현재
`PostCreateBookmarkFolderField.tsx`)는 있는 식)
기준이 뭔지 불명확하다. (2) `.claude/CLAUDE.md`의 "features 슬라이스는 동사만"
규칙이 있는데 `auth/login`·`auth/signup`·`auth/profile`은 명사이고,
`features/post/bookmark/hooks/useBookmarkFolders.ts`처럼 슬라이스명과 파일명
어휘가 안 맞는 경우도 있다.

**결정 1 — "동사만" 규칙을 완화하고 예외를 명문화한다**

이 규칙은 FSD가 강제하는 게 아니었다. [FSD 공식 FAQ](https://feature-sliced.design/docs/get-started/faq):
"entity = a real-life concept, feature = an interaction ... the thing people want
to do" — 품사 규칙이 없다. 공식 [Authentication 가이드](https://feature-sliced.design/docs/guides/examples/auth)도
`features/login/`을 그대로 쓴다. 자주 인용되는 레퍼런스 구현
[realworld-react-fsd v1.2.1](https://github.com/yurisldk/realworld-react-fsd/tree/v1.2.1)도
`features/session/{login,logout,register,update}`처럼 인증은 명사(행위 자체를
가리키는)를 쓴다. 반면 이 레포의 `auth/login`·`auth/signup`·`auth/profile`은
"동사만" 규칙(`84931ba`, 2026-05-17 문서화)보다 **먼저**(2026-03-12/03-15) 만들어졌고
소급 정리도 예외 명시도 없었다 — 규칙이 실제보다 늦게 왔을 뿐 예외가 아니었다.
`.claude/CLAUDE.md` "폴더 네이밍 원칙" 표를 "원칙적으로 동사, 단 슬라이스 자체가
완결된 사용자 액션/flow일 때는 명사 허용"으로 정정하고 `login/`·`signup/`을
근거 예시로 추가했다.

**결정 2 — `features/post/bookmark/`를 `features/bookmark/toggle/`로 승격한다**

현재 구조는 레이어마다 다른 축으로 bookmark를 다룬다 — `entities/bookmark/folder`,
`widgets/bookmark/*`, `pages/bookmark/`는 bookmark를 **도메인 그룹**으로 쓰는데
`features/post/bookmark/`만 post를 도메인 그룹으로 쓰고 bookmark를 그 안의 액션
슬라이스로 둔다. FSD 공식 [Slices and segments](https://feature-sliced.design/docs/reference/slices-segments)는
슬라이스 그룹이 "코드 공유 없는 순수 폴더"일 뿐이라 두 배치 다 규칙상 합법이라고
말한다 — 정오 문제가 아니라 판단의 문제다.

가장 가까운 FSD 공식 등재 사례([nukeapp](https://github.com/noveogroup-amorgunov/nukeapp),
[examples 페이지](https://feature-sliced.design/examples))는 컬렉션(`wishlist`)이
자체 CRUD·API·모델을 가진 본격 엔티티일 때 토글 액션도 콘텐츠(`product`)가 아니라
컬렉션(`wishlist`) 도메인 그룹에 두었다(`features/wishlist/addToWishlist/`, 의존
방향은 컬렉션→콘텐츠). 반대로 컬렉션이 평면 즐겨찾기 목록에 불과한 더 단순한 예제
([polka](https://github.com/lollipopfly/polka), realworld)는 토글을 콘텐츠 그룹에
뒀다(`features/book/toggle-favorite`). link-sphere의 folder는 CRUD·재정렬·다중
소속·"최근 저장한 폴더" split menu까지 갖춘 본격 엔티티라 nukeapp 쪽에 가깝다고
판단해 승격을 택했다. 실제 영향 범위를 확인한 결과 외부 참조는 `PostCard.tsx`
1곳뿐이라 비용도 작았다.

`features/post/create/hooks/useBookmarkFolderField.ts`(현재
`usePostCreateBookmarkFolderField.ts`)는 옮기지 않았다 — 등록 폼
필드 제어 코드라 create 액션에 종속된 게 맞고, FolderPickerModal(현재
`BookmarkFolderSelectModal`)을 재사용할 뿐 "북마크 액션"은 아니기 때문이다.

**결정 3 — 테스트 정책을 있는 그대로 문서화한다**

`docs/TESTING.md`·`.claude/CLAUDE.md`·`docs/FE-ARCHITECTURE.md` 어디에도 "무엇에
테스트를 써야 하는가"가 없었다. 실측(features/widgets/entities 95개 파일 중 20개,
21%)해보니 파일 크기·분기 수 등 코드 성질로는 경계선이 안 나오고, 실제 기준은
"그 파일이 버그 수정 커밋의 대상이었는가"였다 — `.claude/CLAUDE.md`의 "버그 수정
→ 재현 테스트" 규범과 정확히 일치한다. 결정적 증거: `b48799c`(2026-09-08, 폴더
고르기 3형제 로직 분리)에서 테스트 있던 원본을 3개 훅으로 쪼갰는데 테스트는 껍데기
UI 파일에만 남고 새 훅 3개엔 안 생겼다 — 로직 분리 시 테스트를 어디로 옮길지에
대한 규칙 자체가 없었다는 뜻이다. coverage threshold도, 스캐폴딩 커맨드의 테스트
생성 스텝도 없어 강제 장치가 전혀 없다. 새 정책을 만드는 대신, 이 실제 기준을
`docs/TESTING.md`에 명시해 "왜 없지?"라는 질문이 문서만 보고 해소되게 했다.

**상태**

적용 완료(`.claude/CLAUDE.md`, `docs/TESTING.md`). bookmark 구조 이동은 후속 PR에서
진행.

---

## 2026-09-08 — `*Queries.test.tsx` 5개를 소스와 같은 dot-case `.ts`로 개명

**배경**

entities 세그먼트 규칙 조사(바로 아래 항목) 중 발견한 별개 문제. `entities/*/api/`의
React Query 훅 테스트 5개(`FolderQueries.test.tsx`·`PostQueries.test.tsx`·
`CommentQueries.test.tsx`·`AuthQueries.test.tsx`·`InteractionQueries.test.tsx`)가
대응하는 소스 파일(`folder.queries.ts` 등, dot-case)과 이름 케이스가 달랐다.

**원인**

파일 안 `Wrapper` 함수가 JSX(`<QueryClientProvider>...</QueryClientProvider>`)를 써서
`.tsx`가 필요했고, ESLint `unicorn/filename-case`가 `.tsx` 파일에는 PascalCase를
강제한다(`eslint.config.js`) — `folder.queries.test.tsx`처럼 소문자로 시작하면
그 자체로 린트 에러였다. 업계 관행(테스트 파일명·확장자는 대상 소스 파일을 따른다)과
같은 폴더의 `comment.api.test.ts`·`auth.keys.test.ts` 관례 둘 다에서 벗어난 상태였지만,
5개월 넘게(2026-03-15 `AuthQueries.test.tsx` 최초 작성) 아무도 원인을 찾지 않았다.

**결정**

`Wrapper`를 JSX 대신 `React.createElement`로 작성해 `.tsx`일 필요 자체를 없앴다.
그러면 확장자 제약이 사라져 소스와 같은 dot-case `.ts`로 개명할 수 있다 —
`FolderQueries.test.tsx` → `folder.queries.test.ts` 등. `AuthQueries.test.tsx`만
`<QueryClientProvider><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>`로
중첩돼 있어 `createElement` 중첩 호출이 JSX보다 읽기 불편해지는 트레이드오프가
있었지만, 5개 파일의 일관성을 위해 동일하게 적용했다. 레포에 컴포넌트용
`React.createElement` 선례가 없어 이번이 처음 도입한 패턴이다(기존 `createElement`
사용은 `document.createElement`뿐).

**상태**

적용 완료. 테스트 케이스·단언은 무수정, 파일명·`Wrapper` 구현만 변경.

---

## 2026-09-08 — entities 세그먼트 규칙: FSD 공식 세그먼트명 미채택, UI 배치만 공식 따름

**배경**

`entities/folder/ui/FolderPickerDialog.tsx`(324줄)가 같은 세그먼트의 `entities/user/ui/UserAvatar.tsx`(80줄, 쿼리·상태 없는 순수 표현)와 형태가 달라 보인다는 지적에서 출발해 조사한 결과, `.claude/CLAUDE.md`의 "레이어별 허용 세그먼트" 표 자체가 날조된 근거로 세워져 있었다는 게 드러났다.

**드러난 문제 — 순환논증**

커밋 `c35f2b6`(2026-09-06, AI 공동저자)은 "entities 5개 슬라이스(post·comment·interaction·folder·upload)가 훅을 `model/`에 두는데 user만 `hooks/`를 썼다"고 주장하며 `entities/user/hooks/`의 훅 5개를 `model/`로 옮기고 규칙을 못박았다. 그 시점 실제 파일을 확인하면 훅을 `model/`에 둔 슬라이스는 `folder` 하나(파일 1개, 2026-08-12 AI 작성)뿐이었고 나머지 3개(comment·interaction·post)는 애초에 훅이 없어 비교 대상이 아니었다 — "다수 관례"는 AI가 한 달 전 자신이 만든 단일 사례를 근거로 부풀린 것이었고, 실제로는 사람이 2026-01-27부터 유지해온 `user/hooks/` 5개가 우세했다.

**결정**

1. **entities 세그먼트 구조는 원래 방식(hooks/model 분리)으로 되돌린다.** `model/`은 스키마·타입 정의 전용(`*.schema.ts`)으로 좁히고, 훅·비즈니스 로직은 `hooks/`, 상수는 `config/`, 순수 함수는 `<entity>.util.ts`로 `utils/`에 둔다. FSD 공식 세그먼트명(`lib` 등)으로 전면 전환하는 대안도 검토했으나 채택하지 않았다 — 이미 `features`·`widgets`가 `hooks/`·`utils/`를 레이어 전체에서 일관되게 쓰고 있어(18개 디렉터리), 전면 전환은 그보다 훨씬 큰 변경이 되고 이번 문제의 원인(날조된 근거)과 무관하다.
2. **UI 배치만 FSD 공식 정의를 따른다.** [FSD 공식 레이어 정의](https://feature-sliced.design/docs/reference/layers)는 `entities/ui`를 _"the visual representation of this entity in the interface... reused across several pages"_, `features/ui`를 *"the UI to perform the interaction like a form"*로 구분한다. 이 레포의 `features/*/ui` 15개는 전부 폼·버튼(인터랙션)이라 현재 자리가 맞고, "entities가 모든 UI를 담당한다"는 방향은 채택하지 않았다.
3. **entities에도 그룹 폴더를 도입한다.** `entities/folder`라는 이름만으로 북마크 폴더인지 구분이 안 됐다. 복합명(`bookmark-folder/`)은 "도메인 폴더는 단수 소문자" 규칙과 충돌하므로, `features/post/bookmark/`(2026-09-08 후속 결정으로 `features/bookmark/toggle/`로 승격됨 — 아래 "features 네이밍 규칙 완화..." 항목 참고)·`widgets/bookmark/folder-tree/`가 이미 쓰는 그룹 폴더 패턴을 entities에도 적용해 `entities/bookmark/folder/`로 옮긴다.

**부수 발견 — dayjs 규칙 위반이 5개월간 안 잡힌 경위**

CLAUDE.md의 `new Date()`/`.getTime()` 금지 규칙은 2026-03-15 `83131b9`(사람 단독)에서 추가됐고, 같은 커밋이 `CommentList.tsx`에 `dayjs(b.createdAt).valueOf()` 정답 선례까지 만들었다. 그런데 5개월 뒤 2026-08-12 `85b7428`(AI)이 `useRecentFolders.ts`에 `new Date(lastUsedAt as string | Date).getTime()`을 작성하며, 문제를 정확히 진단한 커밋 메시지("BE가 원시 문자열을 보내 Date로 가정하면 크래시난다")로 스스로 정당화했다 — `dayjs(lastUsedAt).valueOf()`가 같은 문제를 규칙을 지키며 해결하는데도 선례를 찾지 않았다. 문서 규칙만으로는 강제가 안 됐던 것이 근본 원인이라, ESLint `no-restricted-syntax`로 승격했다(`eslint.config.js`). 기존 위반 5곳(`useRecentFolders.ts`, `shared/utils/common.util.ts`, `shared/api/client.ts` 2곳, `entities/comment/api/comment.queries.ts` 2곳)을 dayjs로 치환. `shared/utils/date.util.ts`(dayjs 구현 자체)·테스트 파일·`src/mocks/**`(MSW fixture·handler, 테스트가 직접 통제하는 리터럴 날짜)는 규칙에서 제외했다.

규칙 추가 과정에서 레포에 이미 있던 별개의 잠재 버그도 발견해 함께 고쳤다 — `eslint.config.js`의 "Zustand Best Practice 규칙" 블록이 `no-restricted-syntax`를 같은 `files: ['src/**/*.{ts,tsx}']`로 다시 선언해, ESLint flat config의 "같은 rule key가 겹치는 files에 다시 나오면 배열을 병합하지 않고 통째로 덮어쓴다"는 동작 때문에 그 뒤에 오는 모든 `no-restricted-syntax` 규칙(클래스 컴포넌트 금지 포함)을 무력화하고 있었다. 중복 블록을 제거했다.

**상태**

적용 완료(`.claude/CLAUDE.md`, `docs/FE-ARCHITECTURE.md`, `eslint.config.js` 및 위반 5곳 수정). 세그먼트 이동(`entities/bookmark/folder/` 그룹화, 훅 6개 재배치)과 `FolderPickerDialog` 등 "폴더 고르기" 3형제 로직 분리·네이밍 정리는 후속 PR에서 진행.

---

## 2026-09-08 — 제목 비움 재수집: URL 변경과 트리거는 합치되 덮어쓰기 범위는 다르게

**배경**

사용자가 YouTube 링크를 제목 없이 등록했다가 제목이 "- YouTube"로 저장된 것을
보고 고치려 했다. 수정 화면에서 제목을 비우고 저장했지만("비워두면 자동으로
가져와요" placeholder를 믿고) "수정했어요" 토스트만 뜨고 제목은 그대로였다.
CloudWatch 로그(`/aws/lambda/link-sphere-api`, 2026-09-08 04:18:41)로 원인을
추적한 결과 두 버그가 겹쳐 있었다: BE `PostService.updatePost`가 URL이 바뀔
때만 재크롤링해 제목만 비운 수정은 조용히 무시됐고, YouTube 등록 시점엔
Lambda(데이터센터 IP)가 og:title 없는 껍데기 페이지(`bodyTextLength=94`
실측)를 받아 `<title>`인 "- YouTube"가 그대로 채택됐다 — `WeakTitleDetector`가
이걸 약한 제목으로 못 잡았고, oEmbed 폴백도 발동 조건이 좁아 구제하지 못했다.

**검토**

제목을 비운 재수집이 나머지 필드(설명·태그·AI 요약)까지 URL 변경과 똑같이
전부 덮어써야 하는지가 핵심 쟁점이었다.

- **A안: URL 변경과 동일하게 전부 덮기** — 기각. "제목이 빈약하다"와 "본문·
  썸네일도 못 긁힌다"는 같은 원인(껍데기 페이지)에서 나온다. 즉 사용자가
  제목을 비우는 상황은 통계적으로 재크롤링이 또 실패할 가능성이 가장 높은
  상황이라, 여기서 전면 덮어쓰기를 하면 제목 하나 고치려다 description=null,
  tags=[host], aiSummary=null까지 잃을 위험이 더 크다. 게다가 URL 변경 시엔
  `urlChangedNotice`가 파괴적 변경을 사전 고지하지만, 제목만 비우는 경우엔
  그런 경고가 없어 예고 없는 데이터 손실이 된다.
- **B안(채택): 빈 칸만 채우는 순수 폴백** — description·ogImage는 기존 값이
  없을 때만 채우고, tags·aiSummary·aiStatus(COMPLETED 등)는 건드리지 않는다.
  이 원칙은 이미 BE `PostAIService`에 있다("크롤링이 건진 값이 있으면 절대
  덮지 않는다 — 순수 폴백") — 같은 원칙을 updatePost에도 일관되게 적용한 것.
  전면 초기화가 필요한 사용자를 위한 별도 "다시 가져오기" 액션은 이번 범위
  밖으로 남겼다(요구가 실제로 나오면 별도 기능으로).

**결정**

- BE `updatePost`의 재수집 트리거를 "URL 변경 OR 제목 비움"으로 넓히되, 제목만
  비운 경우는 B안(순수 폴백)을 적용한다. AI 이벤트의 `existingTags`는
  `metadata.tags`(크롤링 시 호스트 하나뿐)가 아니라 `post.tags`(기존 태그)를
  넘긴다 — 안 그러면 `PostAiService`가 `mergedTags`를 통째 대입해 기존 AI
  태그가 조용히 사라진다.
- `WeakTitleDetector`는 제목 양 끝의 구분자(`-–—|·:`)만 떼어내고 남은 문자열을
  hostname과 영숫자 정규화로 비교한다. 가운데 구분자는 쪼개지 않는다 —
  "리액트 19 릴리즈 - React Blog" 같은 정상 제목까지 약하다고 오판하지 않기
  위함이다. `UrlMetadataExtractor`의 oEmbed 폴백 발동·채택 조건도 이
  `isWeak` 판정으로 통일했다.
- FE는 로직 변경 없음(이미 빈 제목을 그대로 전송하고 있었다). 안내 문구
  `titleClearedNotice`만 추가해 재수집이 또 실패해도 "가져오지 못하면 기존
  제목이 유지돼요"로 기대치를 미리 심었다.

**범위 밖 (보고만)**

- 기존에 "- YouTube"·"| GitHub" 등으로 오염된 글의 일괄 제목 복구.
  `PostAiBackfillRunner`는 제목을 재크롤링하지 않고 AI만 돌리므로, 기존
  오염 글은 사용자가 수정 화면에서 제목을 비워야 고쳐진다.

**상태**

적용 완료(BE·FE 양쪽). BE 먼저 배포 권장 — API 계약 변경은 없지만, FE가
먼저 배포되면 새 안내 문구가 "다시 가져와요"라고 약속하는데 구 BE는 아직
무시하므로 버그가 더 눈에 띄게 광고되는 상태가 된다. 관련 파일: BE
`PostService.kt`, `WeakTitleDetector.kt`, `UrlMetadataExtractor.kt`; FE
`UpdatePostForm.tsx`, `texts.ts`. 2026-08-04 게시글 제목 정책 항목의 후속.

---

## 2026-09-07 — 헤더 검색어 유지: 경로 게이트 + X 버튼은 입력만 비움

**배경**

사용자가 "검색하고 나면 검색어가 input에 남아있지 않는데, 문서에 반영돼 있는지"
물어 조사한 결과 두 가지가 함께 드러났다. 첫째, `docs/` 13개 문서·`README.md`·
`CHANGELOG.md`·`.claude/CLAUDE.md`를 전수 조사해도 "제출 후 input이 비워진다"를
명시한 문장이 한 곳도 없었다 — 의도된 결정인지 리팩터링(2026-09-06 검색창 헤더
통합) 부작용인지 판단할 근거가 없었다. 둘째, 이 동작 자체가 업계 다수 관행과
어긋났다 — [Baymard 가이드라인 #346 "Always Persist the User's Search Query on
the Results Page"](https://baymard.com/blog/persist-search-queries)에 따르면
데스크톱 33%·모바일 42%만 제출 후 검색어를 비우는 소수파(2017년 43%에서 감소,
업계가 유지 쪽으로 이동 중)이고, 사용자는 평균 2.2회 쿼리를 고쳐 쓰며("dresses"
→ "red dresses") 검색어가 사라지면 재입력 오타가 누적돼 검색을 포기한 사례가
관찰됐다. 같은 앱 안의 북마크 검색(`useBookmarkSearch.ts`)은 이미 URL→input
역방향 동기화로 검색어를 유지하고 있어, 포스트 검색과 북마크 검색의 동작이
서로 불일치하기도 했다.

**검토**

- **URL `q`를 무조건 미러** — 기각. 헤더 검색(`NavbarSearch`)은 `Navbar.tsx`에서
  전 페이지에 렌더되는데, 북마크 페이지도 같은 이름의 `q` 파라미터를 쓴다
  (`useBookmarkSearch.ts`). 게이트 없이 `q`를 그대로 읽으면 `/bookmark?q=...`
  상태에서 헤더 검색창에 북마크 검색어가 잘못 표시된다.
- **X 버튼이 URL `q`까지 함께 지우게 만들기** — 기각. 웹 조사 결과 [Google 결과
  페이지의 Clear 버튼](https://9to5google.com/2019/11/12/google-search-clear-text-desktop/)과
  네이티브 `<input type="search">`의 X 모두 입력만 비우고 결과는 그대로 둔다.
  반대 근거는 [D2L Brightspace 디자인 시스템](https://github.com/BrightspaceUI/core/blob/main/components/inputs/docs/input-search.md)의
  "결과 초기화용 _별도_ 컨트롤을 만들지 말라" 하나뿐인데, 이 레포는 이미
  `PostListSearch`에 필터까지 함께 지우는 별도 초기화 버튼이 있어 해당 사항이
  아니다.
- **URL `q`를 키워드만 분해해 미러** — 기각. `q`에는 자유 키워드뿐 아니라
  `@카테고리`·`#닉네임` 토큰까지 통째로 들어간다(`search-parser.ts`). 원본을
  그대로 미러하면 placeholder(`키워드나 @카테고리, #닉네임으로 검색...`)와
  일관되고 제출 시 토큰이 보존되지만, 키워드만 분리하면 제출할 때마다 기존
  토큰을 재조립해야 하고 실패하면 칩이 조용히 풀린다.

**결정**

- `widgets/layout/navbar/hooks/useNavbarSearch.ts` 신규: `pathname ===
ROUTES_PATHS.POST.ROOT`(정확 일치, `/post/:id` 상세 제외)일 때만 URL `q`를
  input에 미러하고, 그 외 페이지에서는 빈 값을 반환한다.
- 데스크톱(`NavbarSearch.tsx`) 제출 시 더 이상 input을 비우지 않는다. `.trim()`을
  추가해 모바일·최근검색과 정렬한다. `/` 단축키는 `focus()` 뒤에 `select()`를
  추가해 검색어가 남아있는 상태에서 새로 시작할 때 기존 값이 전체 선택되게 한다
  (검색어 유지가 실제로 만드는 유일한 회귀 — Baymard가 이 케이스의 표준 처방으로
  드는 "select-all on re-focus").
- X 버튼(데스크톱·모바일 모두)은 **로컬 input만 비우고 URL `q`는 건드리지
  않는다.** 모바일 X는 이 결정이 사실상 강제된다 — 모바일 검색 패널의 열림
  상태가 `location.state.mobileSearchOpen`에 실려 있는데, `setSearchParams`가
  내부적으로 `navigate`를 호출하며 `state`를 날려 URL을 건드리면 패널이 스스로
  닫힌다.
- 카테고리 칩 클릭 시 헤더 input의 값이 자유 검색어에서 `@토큰`으로 바뀌는 것은
  **의도된 가시화로 그대로 둔다** — 칩 클릭이 자유 검색어를 버리는 동작은
  2026-09-06 헤더 통합 때 이미 있던 것이고, 그때 "입력 지점이 멀어지며 더 눈에
  띌 수 있음"으로 고지했던 지점이 이번에 최대치로 드러날 뿐이다.

**범위 밖 (보고만)**

- 데스크톱 제출이 `addRecentSearch`를 호출하지 않아 최근 검색어를 기록하지
  않는다(`NavbarSearch.tsx`). 최근검색 UI가 모바일 전용이라 지금까지 티가 안
  났다.
- 데스크톱 제출(`navigate('/post?q=X')`)이 search 문자열을 통째로 교체해
  `filter` 파라미터를 버린다.
- 데스크톱 제출이 `replace` 없이 push해 history가 누적된다. 다만 이번 변경으로
  뒤로가기 시 이전 검색어가 input에 복원되는 push의 장점이 처음으로 눈에
  보이게 되므로 그대로 둔다.

**상태**

적용 완료. 관련 파일: `useNavbarSearch.ts`(신규), `NavbarSearch.tsx`,
`MobileNavbarSearch.tsx`. 기능 전체 서술은 [`docs/SEARCH.md`](./SEARCH.md) 참고.

---

## 2026-09-06 — CHANGELOG 항목에서 커밋/PR 상세로 연결되는 링크 추가

**배경**

`CHANGELOG.md`를 GitHub에서 보면 각 항목이 요약 + 접힌 `<details>` 상세 블록으로
돼 있어 내용 자체는 있는데, 그 변경을 만든 커밋이나 PR로 점프할 수 있는 링크가
구조적으로 하나도 없었다. `.gitmessage` 템플릿 덕분에 커밋 메시지 자체는 WHY/WHAT/
영향범위를 담아 CHANGELOG 상세 블록만큼(혹은 그 이상) 상세한데 거기로 가는 길이
없었고, `docs/DECISIONS.md`는 "대안까지 비교한 큰 결정"만 다루도록 범위가 좁아
모든 항목의 착지점이 될 수 없었다.

**검토**

- **커밋 해시를 직접 링크** — 기각. 이 레포는 CHANGELOG 항목 추가 커밋 뒤에도 같은
  브랜치에 후속 커밋(포맷 수정 등)이 흔히 붙고, amend·force-push도 종종 일어난다.
  해시는 그럴 때마다 깨지거나 다른 커밋을 가리키게 된다.
- **PR 링크** — 채택. 이 레포는 예외 없이 워크트리+PR을 거쳐 머지되므로 PR이 항상
  존재하고, PR 번호는 생성 시점에 고정돼 이후 같은 브랜치에 커밋이 늘어나거나
  rebase가 일어나도 바뀌지 않는다.
- **기존 165개 항목까지 소급 적용** — 기각(범위만). 과거 커밋과 CHANGELOG 항목을
  정확히 매칭하는 작업량이 크고 일부는 매칭이 애매할 수 있어, 지금부터의 새 항목만
  적용하고 과거분은 손대지 않기로 했다.

**결정**

`gh pr create`로 PR을 만든 직후, 그 URL을 방금 그 커밋이 추가한 CHANGELOG 항목의
파일 목록 괄호 끝에 `[PR #NN](URL)` 형식으로 덧붙이는 작은 후속 커밋을 머지 전에
push한다(amend 아님 — Git Safety Protocol). PR 없이 직접 머지하는 예외 상황이면
커밋 해시 링크로 대체한다. 규칙 원문: `.claude/CLAUDE.md`의 "릴리즈노트 (CHANGELOG)
관리" 절.

**상태**: 규칙 확정, 다음 fix/feat 커밋부터 적용.

---

## 2026-09-06 — 상세 화면 스크롤 시 본문이 밀리던 문제: 진짜 원인은 `space-y-*`의 `:not(:last-child)`

**배경**

게시글 상세 화면에서 스크롤하다 보면(특히 PC, 페이지 하단 근처에서) 본문이 한 번
"툭" 아래로 밀리고, 스크롤을 올렸다 다시 내리면 같은 지점에서 매번 똑같이 재현되는
증상이 보고됐다. Chrome DevTools의 "Layout shift regions"(파란 박스)는 전혀 뜨지
않았고 "Paint flashing"(초록)만 스크롤바·우측 하단 버튼 근처에 떴다 — 즉 눈에는
콘텐츠가 움직이는 것처럼 보이는데, 브라우저의 레이아웃 시프트 감지기는 아무 것도
잡지 못하는 상태였다.

**검토 — 순서대로 기각한 가설들**

1. **댓글 첨부 이미지 미예약(H1)** — `MarkdownContent.tsx`의 댓글 이미지 `<img>`에
   `width`/`height`/`aspect-ratio` 예약이 없어 로드 완료 시 0→최대 240px로 늘어나며
   아래 내용을 민다고 추정. 코드 근거는 확실했지만, **사용자가 댓글 이미지가 전혀
   없는 글에서도 동일 증상을 직접 재현 확인**해줘서 기각. (이 미예약 자체는 별개의
   실재하는 이슈이지만 이번 증상의 원인은 아니었다 — 손대지 않음.)
2. **웹폰트 지연 스왑** — `index.html`이 Pretendard Regular/Medium/Bold만 preload하고
   실사용 굵기인 SemiBold(600)는 빠져 있었다(0.12.0 `Fixed` 항목이 "400/500/600/700
   전부 preload"라고 명시했음에도 실제로는 3개뿐이었던 기존 버그). `font-semibold`가
   쓰이는 "댓글" 헤딩이 지연 로드되며 폴백 폰트→Pretendard로 스왑되면 그 텍스트의 줄
   높이가 바뀔 수 있다는 가설. 실재하는 버그라 별도로 고쳤지만(아래 "부수 수정"),
   **사용자가 "스크롤을 올렸다 다시 내려도 매번 재현된다"고 알려와 기각** — 폰트
   스왑은 세션당 한 번만 일어나는 현상이라 반복 재현과 모순된다.
3. **실제 원인을 찾기 위해 배포된 사이트에서 직접 계측**(로컬 dev 서버 대신 프로덕션
   CloudFront API를 그대로 사용해 실 데이터로 검증 — 비로그인 열람이 공개돼 있어
   가능했다). Playwright로 댓글 45개/0개인 두 글 각각에서 `document.documentElement
.scrollHeight`를 스크롤 위치별로 연속 샘플링한 결과, **정확히 같은 스크롤
   위치에서, 위/아래로 여러 번 오가도 매번 정확히 24px씩** 늘었다 줄었다 하는 것을
   확인했다. Chromium·Firefox 재현, WebKit(Safari 엔진) 미재현까지 교차 확인해
   "브라우저 버그"가 아니라 "CSS 자체의 동작"일 가능성에 무게를 실었다.

**진짜 원인**

데스크톱 전용 "댓글쓰기로 이동" 플로팅 버튼(`ScrollToCommentFormButton`)이
`CommentList.tsx`에서 댓글 목록 등 실제 콘텐츠와 **같은 `space-y-6` 형제 목록
안에** 조건부로 마운트되고 있었다. Tailwind v4의 `space-y-6`는
`:where(& > :not(:last-child))` 선택자로 `margin-block-end: 1.5rem`을 주는데, 이
선택자는 **화면에 실제로 보이는지와 무관하게 DOM 순서만으로 "마지막 자식"을
판단한다.** 이 버튼은 `position: fixed`라 화면엔 안 보이지만(댓글 작성 폼이
뷰포트에 들어와 있으면 숨겨지고, 스크롤로 벗어나면 나타남) DOM에는 실재하므로:

- 버튼이 마운트되면 → 그 앞의 댓글 목록이 "마지막 자식이 아니게" 되어 24px 여백이
  붙음 → 문서 전체 높이가 24px 늘어남
- 버튼이 사라지면 → 여백이 빠지며 24px 줄어듦

사용자가 페이지 **하단 근처**에 있을 때 이 높이 변화가 일어나면, 브라우저가 스크롤
위치를 새 문서 높이에 맞춰 강제로 보정한다 — 이게 "본문이 살짝 내려온다"로 보인
정체다. 이건 요소 자체의 위치가 바뀐 레이아웃 시프트가 아니라 **스크롤 위치
보정**이라 Chrome의 Layout Shift 감지기가 잡지 못했고, 스크롤바와 버튼의
리페인트만 감지된 것도 이 때문이다. Tailwind가 실제로 컴파일한 CSS
(`:where(& > :not(:last-child)) { margin-block-end: ... }`)를 직접 확인해
메커니즘을 수학적으로 검증했다.

**결정**

`ScrollToCommentFormButton`과 같은 문제가 있던 모바일 전용 `MobileCommentBar`를
`space-y-6` 형제 목록 밖으로(별도 Fragment로) 옮겨 근본 원인을 제거했다. 두 컴포넌트
모두 `position: fixed`라 DOM 트리상 위치만 바뀌고 화면 표시 위치·기능은 동일하다.
코드베이스 전체에서 `space-y-*`와 `fixed`가 같은 파일에 공존하는 다른 곳이 있는지
확인했고, 이번에 고친 곳이 유일했다.

**부수 수정**: 조사 중 발견한 `index.html`의 SemiBold preload 누락도 별도 커밋으로
함께 보완했다(문서화된 의도와 실제 구현이 어긋나 있던 기존 버그, 이번 증상의
원인은 아님).

**향후 비슷한 상황에 적용할 기준**

`space-y-*`/`gap-*`이 아닌 형제-마진 유틸(`:not(:last-child)`, `* + *` 계열)을 쓰는
컨테이너 안에, `position: fixed`(또는 `absolute`)로 화면 표시 위치가 문서 흐름과
무관한 요소를 조건부 렌더로 넣지 않는다 — 화면엔 안 보여도 DOM 순서 기반 선택자에는
그대로 잡혀 형제 요소의 여백이 흔들린다. 이런 요소는 항상 그 컨테이너 **밖**에
형제로 둔다. 스크롤 중 "레이아웃 시프트 감지기엔 안 잡히는데 콘텐츠가 움직여
보인다"는 증상을 만나면, 후보를 `<img>` 미예약이나 웹폰트 스왑으로 단정하기 전에
`document.documentElement.scrollHeight`가 스크롤 위치에 따라 흔들리는지부터
확인한다 — 재현 가능한 정확한 임계값이 있다면 시간 기반(폰트·이미지 로드)이 아니라
DOM 구조 기반일 가능성이 높다.

**상태**: 구현·배포 완료. PR [#21](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/21)
→ `main` 머지(merge commit `3631071`) → Frontend Deploy 워크플로우 성공, 사용자가
운영 사이트에서 재현 안 됨을 직접 확인. 관련 파일:
`widgets/comment/comment-list/ui/CommentList.tsx`, `index.html`.

---

## 2026-09-06 — 필터 초기화 버튼: disabled 대신 항상 활성 + 조용한 early return

**배경**

게시글 목록 필터 카드의 **초기화** 버튼은 적용된 조건이 없으면 `disabled` 처리되고,
`TooltipWrapper`가 "적용된 조건이 없어요"라는 이유를 hover/터치로 안내했다. 문제는
`disabled` 버튼이 **탭 순서에서 빠진다**는 점이다. `TooltipWrapper`는 의도적으로
`tabIndex={-1}`(호버 전용, 키보드 포커스로는 안 열림)이라, 키보드만 쓰는 사용자에게는
버튼 자체도 이유도 존재하지 않게 된다. 마우스(툴팁)·터치(`TooltipWrapper`의 토스트
폴백)는 이미 커버돼 있어 구멍은 키보드 경로 하나였다.

**검토 — 버튼을 성격별로 나눠 판단**

- **멱등한 버튼(초기화·지우기·해제)**: 누르면 "특정 상태로 만든다"는 뜻이라, 이미 그
  상태여도 눌러서 이상할 게 없다. `disabled`로 막을 논리적 근거가 원래 약하다.
- **결과를 기대하는 버튼(저장·등록)**: "눌렀으면 반영됐다"는 피드백을 기대하는
  성격이라, 무음으로 아무 일도 안 일어나면 "고장인가?"로 읽힌다. 여기는 기존 방식
  (`disabled` + 이유 툴팁, `UpdatePostForm.tsx`/`UpdateProfileForm.tsx`/
  `CreatePostForm.tsx`)을 그대로 유지하기로 사용자와 합의했다 — Critical Rules
  L211(`useUpdateComment.ts`)이 다루는 "진짜 빈 입력만 disabled" 규칙과는 별개 축이다.
- **선례**: `useFolderActions.ts`의 폴더 이름 변경 핸들러가 이미 "이름이 안 바뀌었으면
  토스트 없이 조용히 편집 모드만 닫고 return"하는 패턴을 쓰고 있었다.

**결정**

- 초기화 버튼(`PostListSearch.tsx`)만 `disabled`·`TooltipWrapper`를 제거하고 항상
  활성 상태로 둔다. 클릭 핸들러(`handleClearSearch`)가 `appliedCount === 0`이면
  아무 것도 하지 않고 조용히 return한다(토스트도 안내도 없음 — 조건 뱃지가 이미
  화면에 없다는 사실 자체가 "지울 게 없다"는 신호이므로 별도 안내가 불필요하다는
  판단, `RecentSearchPanel.tsx`의 "모두 지우기"가 조건부 렌더로 아예 숨기는 것과
  같은 결의 선택).
- 적용 범위는 이 버튼 하나로 한정한다 — 저장·등록 버튼에는 이 패턴을 확장하지 않는다.
- 부수 근거: `clearSearch`는 `usePostList.ts`에서 `setSearchParams({})`를 replace
  없이 호출하므로, 조건이 없는데도 실행되면 같은 URL로 history entry가 쌓여 뒤로가기가
  한 번 먹통이 될 수 있다(react-router 기본 push 동작에서의 추론, 재현 검증은 안 함).
  early return이 이 가드도 겸한다.
- `resetDisabledReason` 텍스트 상수는 이 변경으로 유일한 사용처가 사라져 함께 제거했다.
  이 문구는 아직 릴리즈되지 않은 상태였다(disabled+툴팁 자체가 `v0.12.0`에 미포함) —
  그래서 `CHANGELOG.md`에도 "추가했다 되돌림"이 아니라 미출시 `Added` 항목을 지우고
  최종 동작만 `Changed`로 남겼다.

**향후 비슷한 버튼에 적용하는 기준**

새 버튼을 만들 때 "조건이 없어서/할 게 없어서" disabled를 고려하고 있다면:
멱등한 동작이면 항상 활성 + early return, 결과를 기대하는 동작이면 기존처럼
`disabled` + 이유 안내(툴팁 또는 인라인 문구)를 쓴다. 판단이 애매하면 "눌렀는데
아무 반응이 없으면 사용자가 고장으로 오인할지"를 기준으로 삼는다.

**상태**: 구현·배포 완료. `worktree-reset-button-no-disable` → PR #18 → `main` 머지
(merge commit `210506e`) → Frontend Deploy 워크플로우 성공 확인.

---

## 2026-09-06 — 댓글 등록 403: CloudFront WAF 과차단 + 앱 본문 길이 상한

**배경**

배포 환경에서 긴 댓글을 등록하면 CloudFront가 403 HTML(`Request blocked.`)을 반환하는
문제가 신고됐다. 조사 결과 BE 앱 코드에는 댓글 등록이 403을 낼 경로가 아예 없었다
(`CommentService`에 `ForbiddenException` 없음, 인증 실패는 전부 401) — 원인은 CloudFront에
붙은 WAF `CreatedByCloudFront-bcd729fb`의 `AWSManagedRulesCommonRuleSet` >
`SizeRestrictions_BODY`가 요청 바디 8,192바이트 초과를 차단하는 것이었다. 실측: 8,189바이트는
Lambda까지 도달(401), 8,219바이트는 WAF 차단(403). 이 8KB는 우리가 정한 값이 아니라
ALB/AppSync 기준 AWS 기본값이고, CloudFront는 원래 16KB까지 검사가 가능하다 — 8~16KB
구간은 검사가 가능한데도 막히는 순수한 과차단이었다.

**검토 — 대안 비교**

- **WAF 임계값을 어디로 잡을지**: `SizeRestrictions_BODY`를 Count로 오버라이드하고 "바디
  16,384바이트 초과 시 차단"하는 커스텀 룰을 앞 우선순위에 추가하기로 했다. inspection
  limit(16KB) 자체를 32KB로 올리는 대안도 검토했으나(추가 과금은 16KB 초과 요청에만
  붙어 미미함), 관리 포인트를 하나 더 늘리는 대신 AWS 기본 한도 안에서 해결되는 쪽을
  택했다 — 이 범위에서는 XSS·LFI·RFI·Log4j 등 다른 바디 보안 룰이 여전히 전부 작동한다.
- **앱 상한을 얼마로 잡을지**: 처음엔 "한글 5,000자 = 15,000바이트"로 계산했으나, WAF가
  재는 건 `content`가 아니라 **JSON 직렬화 후 전체 바디**라는 걸 놓쳤다 — 개행 이스케이프
  (`\n`→2바이트) + 이미지 URL 5개(~565바이트) + JSON 봉투를 더하면 15,890바이트로 16KB
  방어선까지 여유가 490바이트뿐이었다. 개행이 조금만 많아도 다시 원인 불명의 403이
  재현될 수 있어, 한글 4,000자(UTF-8 12,000바이트)로 낮춰 최악치도 16KB 아래 3,500바이트
  가까이 여유를 뒀다.
- **검증 대상을 `content` vs `finalContent`(이미지 URL을 이어붙인 최종 저장값) 중 어느
  쪽으로 잡을지**: `content`로 결정. `finalContent`를 재면 FE가 같은 값을 계산할 수
  없고(수정 폼은 URL을 떼어낸 텍스트만 가짐), 이미지를 붙일 때마다 텍스트 예산이 몰래
  줄어든다. URL 기여분은 이미지 5장 상한이 이미 결정적으로 봉인한다.
- **등록 실패 시 입력 유실 방지 방식**: 답글 폼·모바일 바는 등록 성공 시 `onSuccess`에서
  폼 컴포넌트를 언마운트하는데, React Query는 뮤테이션이 끝나기 전 언마운트되면 `mutate()`
  스코프 콜백(`onError` 포함)을 호출하지 않는다. "즉시 비우되 폼을 닫는 시점만 미루는" 방식과
  "초안을 별도 스토어에 보관해 폼이 닫혀 있어도 살아남게 하는" 방식을 비교해, 복잡도 대비
  이득이 낮다고 판단해 전자를 택했다 — 대가로 요청 시간(수백 ms)만큼 빈 폼이 열려 있다가
  닫힌다(낙관적 항목이 이미 목록에 떠 있어 "보냈다" 피드백은 유지됨).
- **초과 시 UI**: 상시 글자수 카운터 대신, 기존 "내용/이미지 필요" 툴팁과 같은 언어로
  초과했을 때만 안내하는 쪽을 택했다(평소엔 화면에 아무것도 추가하지 않음).

**적용 중 발견 — WAF 커스텀 크기 제한 룰은 Pro 플랜 전용이었고, 그래서 WAF는 원복했다**

최초 계획은 `SizeRestrictions_BODY` → Count 오버라이드 + "바디 16,384바이트 초과 → Block"
커스텀 룰 신설이었다. 실제 적용 시 그 커스텀 룰(`SizeConstraintStatement`)이
`WAFFeatureNotIncludedInPricingPlanException`으로 거부됐다 — 이 기능은 CloudFront **Pro
플랜($15/월 정액제) 이상**에서만 지원되는데 이 계정은 Free 플랜이었다.

Pro 업그레이드(월 $15 고정비)와 "업그레이드 없이 Count만 적용"을 사용자에게 물었고,
처음엔 후자를 택했다. 하지만 Count만 적용하면 **WAF 레이어의 바디 크기 방어선이 완전히
사라져** Lambda 자체 한도(6MB)까지 뭐든 통과한다는 걸 실측(300KB 페이로드)으로 보여준 뒤,
이건 비용(큰 페이로드를 반복 전송하는 요청이 Lambda 처리 시간을 그만큼 늘림)과 보안
(다른 WAF 룰의 시그니처 검사 한도인 16KB를 넘겨 XSS·LFI·RFI·Log4j 탐지를 우회할 길이
새로 생김 — 이전엔 8KB에서 무조건 막혀 이 경로 자체가 없었다) 양쪽에 새 노출이라는
점을 짚었다. 사용자가 **WAF는 원복하고, 앱 상한을 그 안전한 값으로 다시 잡는** 쪽으로
결정을 뒤집었다.

**결정**

- WAF: 손대지 않는다(원본 상태로 원복 — 실제로 Count 오버라이드까지 적용했다가 원복
  커맨드로 되돌렸다). `SizeRestrictions_BODY`가 8,192바이트 초과를 계속 차단한다. Pro
  플랜으로 올라가면 되살릴 수 있는 대체 룰 설정은 `docs/DEPLOY.md`에 남겨뒀다.
- 앱: 그 8KB 벽 안쪽에 여유 있게 들어가도록 상한을 **UTF-8 6,000바이트(한글 약 2,000자)**로
  낮춰 잡았다(처음 계획한 12,000바이트는 8KB 벽 앞에서 이제 의미가 없다). BE
  `CommentService.createComment`/`createReply`/`updateComment`, FE
  `commentContentFormSchema` 공유 스키마.
- FE: `useCreateComment`가 실패 시 입력·이미지를 복원(사용자가 그 사이 새로 입력을
  시작했으면 덮어쓰지 않음).

**구현 중 발견한 버그 — 비활성 버튼은 클릭이 안 먹어 초과 안내가 표시되지 않았다**

최초 UI 설계는 "제출 버튼 비활성화 + 초과 시에만 안내(툴팁)"였다. 실제로 만들어보니
버튼을 `disabled`로 두면 클릭 이벤트 자체가 발생하지 않아, `onSubmit`(zod 검증 →
초과 토스트)이 실행될 기회가 없었다 — 즉 사용자는 왜 제출이 안 되는지 알 방법이
없었다(호버 툴팁은 데스크톱에서만, 그것도 마우스를 올려야만 보임). 버튼을 비활성화하지
않고 항상 클릭 가능하게 두어 `onSubmit`이 실행되게 하고, 실제 차단은 zod resolver가
맡도록 바꿨다. 대신 텍스트 영역 아래 상시 인라인 안내 문구(초과일 때만 렌더)를 추가해
타이핑 중에도 알 수 있게 했다.

**상태**

적용 완료. WAF는 원본 그대로 유지, 앱 상한 6,000바이트로 반영, 초과 안내는 인라인
문구 + 제출 시도 시 토스트로 노출된다. 게시글(`POST`/`PATCH /post`) 본문 길이 제한은
이번 범위 밖으로 남겨뒀다.

**추가 발견 (같은 날, 배포 직후) — "정상 사용 범위"로 판단했던 경계가 실제로 뚫렸다**

위 검토에서 "content 원본 바이트만 재는 체크로는 개행이 많은 입력이 실제 전송
바이트로는 더 클 수 있다"는 걸 인지하긴 했지만, 그건 "일부러 만든 병리적
입력"이라 정상 사용 범위 밖이라고 보고 넘겼다. 그런데 배포 직후 실사용자가
짧은 줄이 아주 많은 문서(요약 노트 같은 흔한 형태)를 붙여넣었을 때 원본 6,000바이트
밑인데도 실제 전송 바이트가 8,192바이트를 넘어 WAF 403이 재현됐다 — "드문
edge case"로 접어뒀던 위험이 하루도 안 돼 실제로 발생한 것이다. 교훈: 클라이언트
검증이 서버(여기서는 WAF)가 실제로 재는 값과 다른 값을 잴 때는, 그 차이가
발생하는 입력이 "비정상"인지 "짧은 줄이 많은 흔한 글"인지를 먼저 따져야 한다 -
후자였다.

대응: content 원본 바이트 체크(타이핑 중 인라인 힌트용, 그대로 유지)와 별개로,
제출 직전에 실제로 전송될 `JSON.stringify({content, images})`와 같은 모양을
만들어 그 바이트를 재는 안전망을 추가했다(`estimateCommentPayloadBytes`, 상한
7,500바이트). 이미지는 업로드 전이라 실제 URL을 모르므로 Supabase 공개 URL
실측치에 여유를 둔 200바이트 자리표시자로 채워 잰다.

**추가 발견 (같은 날, 며칠 뒤) — 크기가 아니라 WAF의 XSS 탐지 룰이 근본 원인이었다**

위 대응(전송 바이트 안전망)을 배포한 뒤에도 403이 또 재현됐는데, 이번엔 결정적인
단서가 있었다 — 사용자가 "긴 문서는 우리 길이 안내가 정상 작동하는데, 짧은
콘솔 로그를 붙여넣으면 403이 난다"고 정확히 대조해줬다. `curl`로 프로덕션에
직접 이분 탐색한 결과, 문제의 짧은 입력(4,162바이트 — 상한 6,000의 2/3)은
크기와 무관하게 막혔고, 범인은 `AWSManagedRulesCommonRuleSet` >
**`CrossSiteScripting_BODY`** 였다(CloudWatch `BlockedRequests` 지표로 확정 —
테스트에서 403이 난 횟수와 이 룰의 차단 횟수가 정확히 일치).

**핵심 재현**: `<META>` 태그 하나만 있어도, `React에서 <Button onClick={x}>를
쓰면 됩니다` 같은 지극히 정상적인 개발 댓글도 403으로 막혔다. 이건 붙여넣기
실수가 아니라 **개발 아티클을 공유하는 서비스에서 실사용자가 매일 마주칠 수
있는 결함**이었다. 대조군으로 `POST /post`(게시글 등록)·`PATCH /comment/{id}`
(댓글 수정)도 같은 조건에서 403이 남을 확인해, 댓글 폼만의 문제가 아니라
**모든 요청 본문에 걸리는 전역 문제**임을 확인했다.

**왜 이 룰을 꺼도 안전한지 조사**: FE 전체에 `dangerouslySetInnerHTML`·
`innerHTML`·`insertAdjacentHTML`·`document.write`·`eval` 사용처가 **0건**이었다.
`shared/ui/elements/MarkdownContent.tsx`는 이름과 달리 HTML 문자열을 만들지
않고 React 엘리먼트 객체를 직접 조립하는 자체 파서라 `<script>alert(1)</script>`도
글자 그대로 렌더된다. `javascript:` URI는 `MarkdownContent.tsx`의 URL 정규식
(http/https/blob만 매칭)과 BE `SafeUrlValidator.kt`(스킴 화이트리스트)에서
이중으로 막혀 DB 저장 자체가 불가능하다. 마크다운 라이브러리·HTML sanitizer는
아예 도입돼 있지 않다 — 즉 sink가 없으니 이 룰이 실제로 막아주던 위험이
거의 없었다.

**결정**

- WAF `CrossSiteScripting_BODY`만 **Block → Count**로 내린다(오탐 완화).
  `SizeRestrictions_BODY`를 비롯한 나머지 룰(SQLi·LFI·RFI·Log4J·IP 평판·
  KnownBadInputs)은 전부 그대로 Block 유지 — 위 회귀 위험 인식(16KB 검사
  한도를 넘겨 다른 시그니처 탐지를 우회하는 새 노출)은 크기 룰에만 해당했고,
  XSS 룰 하나를 Count로 내리는 것은 그 우회로를 만들지 않는다.
- 댓글 길이 상한(6,000B/7,500B)은 그대로 둔다 — `SizeRestrictions_BODY`는
  여전히 Block이라 이 방어선은 계속 필요하다.
- 그와 별개로, FE에 `EDGE_BLOCKED` 전용 에러 코드를 신설해 "WAF가 앱보다
  먼저 채간" 모든 경우(이 룰이 아니어도, 앞으로 다른 룰이 오탐을 내도)에
  사용자가 이유를 알 수 있게 했다(`shared/api/client.ts`, `error-code.ts`,
  `queryClient.ts`). `meta.errorMessage`가 최우선인 전역 에러 핸들러 구조상,
  게시글처럼 `errorMessage`를 쓰는 mutation이 이 원인을 삼키지 않도록
  `EDGE_BLOCKED` 판정을 그 앞에 둬야 했다.

**포기한 것 — 무엇을 받아들였는가**

이 결정으로 **저장형 XSS 방어가 사실상 "FE가 React라서, 그리고 지금 아무도
`dangerouslySetInnerHTML`이나 마크다운 라이브러리를 안 써서"라는 단일
전제에만 의존**하게 됐다. CSP 헤더도 없다(FE `index.html`·BE
`SecurityConfig.kt` 모두 미설정). BE는 댓글/게시글 본문을 sanitize 없이
원문 그대로 저장한다(store-raw / escape-on-output). 즉 **향후 누군가
`dangerouslySetInnerHTML`을 쓰거나, 마크다운 렌더러를 새로 붙이거나, 서버
렌더 HTML·이메일 템플릿·FCM 알림 본문처럼 React 밖에서 이 content를
소비하는 코드를 추가하는 순간 즉시 저장형 XSS가 열린다.** 이 조건이 깨지면
이 결정 전체를 재검토해야 한다. CSP 도입은 이번 범위 밖으로 남겨뒀다.

**상태**: WAF 룰 완화는 적용 완료(실측 재검증: 위 오탐 사례 전부 401로 통과,
`SizeRestrictions_BODY`는 여전히 403 유지 — 라이브 인프라라 코드 배포와 별개로
즉시 반영됨). FE `EDGE_BLOCKED`는 코드 작성·테스트 완료, main 병합·배포는
별도 확인 후 진행.

---

## 2026-09-06 — 콘솔의 `reportAllChanges` TypeError: 브라우저 보안 확장이 원인, 조치 안 함

**배경**

배포 환경 콘솔에 `Uncaught TypeError: Cannot read properties of undefined (reading
'startTime')`가 `VM<n>`(익명 eval 컨텍스트) 안의 `reportAllChanges`에서 반복 신고됐다.
FE 코드·의존성 전체에 web-vitals·`reportAllChanges` 사용처가 없음을 grep으로 확인했고
(0건), Playwright로 확장이 전혀 없는 브라우저에서 같은 프로덕션 URL을 로드해도 재현되지
않았다(콘솔 에러 0건, 로드되는 script도 전부 우리 번들뿐) — 우리 코드·인프라 문제가
아님을 실측으로 확인했다.

시크릿모드에서도 재현된다는 재보고를 받았는데, Chrome 시크릿모드는 확장을 기본
차단하지만 "시크릿모드에서 허용"이 켜진 확장은 그대로 실행된다는 점에 착안해
`chrome://extensions` 목록을 확인했다. INISAFE CrossWeb EX / INISAFE SmartManagerEX /
TouchEn PC보안 확장(전부 라온시큐어 제품, 한국 인터넷뱅킹·공공기관 사이트 접속용 보안
플러그인 — 방문하는 모든 페이지에 스크립트를 주입해 검사하는 방식이라 사이트와 무관하게
이런 콘솔 노이즈를 일으키는 것으로 알려짐)을 유력 후보로 지목했고, 사용자가 직접
껐다 켰다 대조한 결과 이 셋이 켜져 있을 때만 에러가 재현됨을 확인했다.

**결정**

조치하지 않는다. 원인이 우리 코드·배포 밖(사용자 로컬 보안 소프트웨어)에 있고, 에러가
던져지는 지점이 우리 페이지 로직과 무관한 별도 eval 컨텍스트라 화면 기능에도 영향이 없다.

**상태**: 조치 없음 확정. 같은 증상(`VM<n>:...`에서 `reportAllChanges`류 함수명의
`Cannot read properties of undefined (reading 'startTime')`)이 재보고되면 이 항목을
링크해 반복 조사를 생략한다.

---

## 2026-09-06 — 검색창 헤더 통합 + 모바일 칩 높이 되돌림

**배경**

필터 카드의 검색창 placeholder 잘림 문제를 고치려던 중, 코드를 추적해보니
데스크톱 헤더(`NavbarSearch.tsx`)와 모바일 헤더 검색(`MobileNavbarSearch.tsx`,
`Navbar.tsx`의 `handleSearchSubmit`)이 이미 있고, 제출하면 이 필터 카드의
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
이건 접근성 기준을 낮추는 트레이드오프이기도 해서([WCAG 2.2 SC 2.5.8 Target
Size Minimum, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)의
24px 최소 기준은 여전히 만족, [SC 2.5.5 Target Size Enhanced, AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)의
44px·이 레포 `responsive-ux` 스킬의 자체 규약은 포기) 텍스트로 설득하지 않고
실제 두 높이를 Artifact로 나란히
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

**재보정 (2026-09-06, 재발)**

바로 다음 커밋(검색창을 헤더로 통합, `e6ae4df`)이 이 행의 클래스를 다시
`justify-between`으로 덮어써 위 보정이 원복됐다 — 별개 리팩터링을 하면서
승인된 배치를 인지하지 못하고 되돌린 것이다. `self-end inline-flex items-center
gap-2`로 다시 붙여 카드 오른쪽 끝에 정렬했다(라벨 → 스위치 순, 44px 타깃 유지).
"초기화" 버튼과 우측 세로 라인을 맞추는 것도 함께 요청받았는데, 실제로 재보면
ghost 버튼의 `px-2` 패딩은 텍스트만 안쪽으로 밀 뿐 버튼 박스 자체의 오른쪽 끝은
이미 `justify-between` 행의 오른쪽 끝과 일치했다(Playwright로 두 요소의
`boundingBox()` 우측 좌표를 직접 재서 확인, diff 0px) — 마진 보정은 필요 없었다.

**세 번째 조정 — 컨트롤 블록 간격 제거 (2026-09-06)**

"봇 글 숨기기·초기화 영역은 이미 줄바꿈으로 구분되는데 간격까지 있어 카드가
넓어 보인다"는 피드백. "라벨(칩) 부분만 간격을 주고 나머지는 없애라"는 문장이
어디까지 붙이라는 건지(범위 필터 칩까지 포함인지) 갈릴 수 있어, 두 후보(A: 봇
숨기기↔초기화만 / B: 범위 필터 칩부터 전부)를 Artifact 목업으로 비교했다 — B 채택.

목업 1차 버전에서 모바일이 "안 바뀐 것처럼" 보인다는 지적을 받았는데, 실제
원인은 표시 버그(A 후보의 gap-0 경계 라벨이 잘못된 자리에 붙어 있었음)와 실제
제약(모바일은 스위치 행이 44px 터치 영역을 확보해, flex gap을 0으로 줄여도 그
안쪽 위아래 12px는 그대로 남아 데스크톱만큼 붙어 보이지 않음)이 섞여 있었다.
목업에 44px 터치 박스를 점선으로 표시하고, "터치 타깃도 28px로 줄이면" 실제
결과를 보여주는 프레임을 추가한 뒤 — 사용자가 그 28px 축소도 함께 선택했다.

반영: 범위 필터 칩 행 + 봇 스위치 행 + 초기화 행을 `<div className="flex
flex-col">`(gap 없음)로 감싸 카테고리 칩과의 경계 gap만 바깥 컨테이너
(`gap-2 md:gap-3`)에 남기고 안쪽 세 행은 완전히 붙였다. 봇 스위치 행의
`min-h-11 md:min-h-0`(44px 모바일 터치 타깃)는 `min-h-7`(28px, 모바일/데스크톱
공통)로 교체 — `FilterChip`이 같은 이유로 이미 28px로 통일된 전례를 그대로
따른 것이다. Playwright로 실측(칩↔봇 0px, 봇↔초기화 0px, 스위치·초기화 우측
정렬 유지, 모바일 가로 스크롤 없음, 라벨 클릭 토글 정상)해 확인했다.

**네 번째 조정 — 봇 스위치를 초기화 행으로 이동, 텍스트 크기 통일 (2026-09-06)**

세 번째 조정에서 봇 스위치가 범위 필터 칩에 완전히 붙게 되자 두 가지 새 문제가
드러났다. (1) "봇 글 숨기기" 라벨이 `text-sm`(14px, 기본 굵기)이었는데 이 카드의
다른 모든 텍스트(칩 `text-xs font-bold`, 카운트/초기화 `text-xs`)는 12px대라,
이 라벨만 유일하게 튀어 "폰트가 다르다"는 인상을 줬다 — 실제로는 폰트 자체는
전역 하나(Pretendard)뿐이라 버그가 아니라 크기·굵기 불일치였다. (2) 범위 필터
칩과 완전히 붙어버려서 "라벨 영역과 구분이 필요하다"는 피드백을 받았다.

사용자가 봇 스위치를 아예 "조건 N개 적용 중 + 초기화" 행으로 옮기고 그 행의
왼쪽 끝에 두자고 제안했다. 배치 방식(스위치+라벨만 왼쪽 단독 vs 스위치+카운트를
왼쪽에 묶고 초기화만 오른쪽)은 AskUserQuestion으로 확인 — "스위치는 왼쪽 끝,
카운트+초기화는 오른쪽으로 묶음"이 채택됐다(초기화가 지우는 대상은 카운트가
집계하는 조건들이고, 봇 숨기기는 애초에 `appliedCount` 계산에서 제외되는 별개의
기기별 설정이라는 기존 주석과도 일치하는 그룹핑).

반영: 세 번째 조정에서 만든 `<div className="flex flex-col">`(gap 없음) 특수
래퍼를 제거하고, 범위 필터 칩 그룹을 다시 카드 최상위 `flex flex-col`의 직계
자식으로 되돌렸다 — 이러면 카테고리 칩 ↔ 범위 필터 칩 ↔ (봇 스위치+카운트+
초기화 통합 행) 사이가 다시 카드 전체와 동일한 `gap-2 md:gap-3`로 균일하게
구분되어, 특수 케이스 없이 "라벨 영역과 구분" 문제가 함께 해결됐다. 봇 스위치
행은 `text-sm` → `text-xs`로 바꾸고(`font-bold`는 주지 않음 — 클릭 가능한
칩이 아니라 옆의 "조건 N개 적용 중"과 같은 성격의 보조 텍스트라 그쪽과
통일), `self-end`는 더 이상 단독 행이 아니므로 제거했다.

Playwright로 실측: 봇 라벨 폰트(12px/400)가 카운트 텍스트와 완전히 일치, 범위
필터 칩과 이 행 사이 간격이 정상 복원(데스크톱 14px/모바일 10px, gap 클래스
범위 내), 같은 행에서 라벨이 왼쪽·초기화가 오른쪽, 375px에서 겹침·가로 스크롤
없음, 라벨 클릭 토글 정상 확인.

**상태**

적용 완료(네 번째 조정 반영).

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
Prototyping 근거). 이 원칙은 FE `CLAUDE.md`(Critical Rules + "§8 UI/UX 결정은
리서치와 선례에 근거한다" 옆)에도 명문화해 세션이 바뀌어도 지켜지게 했다 —
memory에만 남기면 팀 공용 문서에 반영하는 걸 잊을 수 있다는 우려가 있었다.

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
   원칙 위반. 별개로 [NN/g Progress Indicators](https://www.nngroup.com/articles/progress-indicators/)는
   _"Waits with feedback feel 11–15% faster"_(피드백 있는 대기가 11~15% 더 빠르게
   느껴진다 — 번역)고 밝힌다.
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

GitHub은 개수 제한 없음(파일당 10MB), Discord 10장, Slack 20장, X 4장 [출처 미상,
2026-09-10 확인 — 각 서비스 공식 문서 대조 없이 기억에 의존한 값, 재검증 필요].
X(4)와 Discord(10) 사이에서 **5장**으로 정했다.

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

- [NN/g 사용성 리서치](https://www.nngroup.com/articles/accidental-overlay-dismissal/)는
  화면을 덮는 오버레이를 브라우저·폰 뒤로가기로 닫을 수 있게 하라고 권고하면서, 동시에
  **오버레이 중첩**을 실패 패턴으로 지목했다(월마트에서 X 버튼 한 번에 스택 전체가 닫혀
  사용자가 처음부터 다시 찾아야 했던 사례).
- "대화상자는 URL·히스토리에 넣지 말라"는 판단은 Alert/Confirm처럼 한 번의 결정만 받고
  사라지는 것에 대한 것이었다 — 화면을 덮는 오버레이와는 대상이 다르다. [출처 미상,
  2026-09-10 확인 — 특정 문헌을 찾지 못함, 재검증 필요]
- [Pairs(eureka) 엔지니어링의 `backdropLocation` 패턴](https://medium.com/eureka-engineering/navigable-modals-with-the-history-api-adventures-in-web-modals-27d94ae2014)(모달을
  URL로 만드는 방식)은 저자 스스로 단순 모달 하나만 지원하고 웹 히스토리는 선형이라
  분기 컨텍스트는 복잡해진다는 한계를 밝혔다 — 공유가 필요 없는 우리 오버레이엔 과한 해법.
- [토스페이먼츠 Flow 모듈](https://toss.tech/article/engineering-note-1)(다단계 퍼널
  관리)도 저자가 깨짐·가독성 저하를 인정한 무거운 해법이었다 — 우리 퍼널은 1스텝이라
  `replace: true`로 충분.

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
이 일을 계기로 `.claude/CLAUDE.md`에 "§7 사용자가 체감하는 트레이드오프는 승인을
받는다" 원칙을 추가했다 — 기술적 제약에서 나온 부수 효과라도 사용자가 체감하는
UX라면 독단으로 정하지 말고 확인받는다.

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
자동 제목의 출처는 URL 크롤링(`og:title`/`<title>`/YouTube 인라인 JSON·oEmbed)뿐이다
(2026-09-07 BE 변경: YouTube는 `videoDetails.title`을 우선 소스로 추가했고, oEmbed는
그중 하나라도 비었을 때만 호출하는 폴백으로 격하됐다 — 자세한 배경은 BE
`docs/AI-ASYNC-PROCESSING.md` §5.5 참고).

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
`features/comment/create/hooks/useCreateComment.ts`, `shared/hooks/useImagePaste.ts`(현재
파일명: `useImageAttachments.ts`).

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
전체 인증 아키텍처(이 결정이 만든 `ProtectedRoute`가 왜 보안 장치가 아닌지, 만료 토큰의
실제 처리는 어느 레이어가 하는지)는 [`docs/AUTH.md`](AUTH.md) 참고.

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
