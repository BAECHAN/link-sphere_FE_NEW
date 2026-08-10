# Link-Sphere FE — 설계·UX 의사결정 기록

되돌리기 어렵거나 "왜 이렇게 했는지"가 코드만으로 드러나지 않는 설계·UX 결정을 기록합니다.
무엇을 바꿨는지는 [CHANGELOG.md](../CHANGELOG.md), 날짜별 자동 변경 로그는 [HISTORY.md](./HISTORY.md)를 참고하세요.
이 문서는 **"왜"** 를 남기는 곳입니다. 형식은 가볍게: 배경 / 결정 / 이유 / 상태.

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

**상태**

적용 완료(Dialog 수정, NavItem 레이스 수정, T0 blocker 확장). 마지막 "DevTools
에뮬레이션 아티팩트" 발견 건은 앱 버그가 아님을 확인, 조치 불필요. 관련 파일:
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
