# Changelog

이 프로젝트(Link-Sphere FE)의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
버전 표기는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 사용합니다.

각 항목은 `스코프` + 한 줄 요약이며, 배경·구현은 접힌 `배경·구현` 블록에 있습니다.

## [Unreleased]

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

- `post` 필터 카드 초기화 버튼이 비활성 상태일 때 사유 툴팁 표시
  <details><summary>배경·구현</summary>

  적용된 조건이 없으면 초기화 버튼이 회색으로 비활성화되는데, hover해도 왜
  눌리지 않는지 알려주는 게 없었다. 이 레포에서 disabled 버튼에 툴팁을 붙일
  때 이미 쓰던 유일한 패턴(`TooltipWrapper`로 감싸기 — Radix Tooltip이
  `disabled` 버튼 자체에서는 pointer-events가 막혀 안 열리는 문제를, 버튼을
  감싸는 `<span>`을 트리거로 써서 우회. `CommentForm.tsx` 등 5곳에서 이미 같은
  방식 사용)를 그대로 따랐다. 옆에 있는 "조건 N개 적용 중" 텍스트는 조건이
  0개일 때 빈 문자열이 돼 정확히 툴팁이 필요한 순간에는 아무 설명도 없었다.
  (`PostListSearch.tsx`, `texts.ts`(`post.search.resetDisabledReason` 추가))

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

### Changed

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
  달라졌다. GitHub Issues·Linear의 그룹 구분선 패턴(Baymard 사용성 테스트: 적용
  필터 개요를 상단에 명확히 두지 않는 사이트가 42%)을 참고해 검색바 → 카테고리 →
  범위 필터 → 봇 숨기기 → "조건 N개 적용 중"+초기화 순으로 행을 나누고, 경계는
  텍스트 라벨 없이 `border-t`만 사용했다. 가로 스크롤은 쓰지 않기로 하고
  (GitLab이 검색 토큰 가로 스크롤에 대해 반복적으로 wrap 요청을 받은 사례),
  모바일에서만 카테고리를 앞 4개로 접고 `+N` 버튼으로 펼치되(Material 3 chip
  overflow 가이드), 그 값은 `useState`가 아니라 `categories`·`searchInput`의
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
  의도적 트레이드오프(WCAG 최소 기준인 24px는 여전히 만족, 44px 권장 기준은
  포기).
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

  폴더 순서를 고정할지 최근 사용순으로 올릴지 반복되던 고민에 대한 결론. Sears &
  Shneiderman의 split menu 연구를 따라, 최근에 저장한 폴더 최대 3개를 상단에 별도로
  보여주되 아래 본 목록 순서는 절대 바꾸지 않는다(위치가 계속 바뀌는 전체 재정렬 방식은
  MS Office 2000 "개인화 메뉴"가 예측 불가능성 때문에 폐기된 선례가 있어 기각). 상단
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
  제각각이었다. 국내 서비스 UX 라이팅 사례(토스 공식 UX 라이팅 가이드 — 해요체 통일, 능동형
  문장("되었어요"→"했어요"), 긍정 표현, "-시겠어요?" 같은 과도한 경어 지양)를 참고해 전면
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
  Slack·X·Discord 등의 기준을 참고해 원본 30MB(리사이즈 가능한 일반 포맷)/15MB(리사이즈
  불가한 SVG) 2단계로 재설계하고, 파일을 고르는 즉시(제출 전) 검증해 초과 시 바로 에러를
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

[Unreleased]: https://github.com/BAECHAN/link-sphere_FE_NEW/compare/v0.12.0...HEAD
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
