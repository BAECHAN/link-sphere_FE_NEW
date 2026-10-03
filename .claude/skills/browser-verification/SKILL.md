---
name: browser-verification
description: Link-Sphere FE에서 UI 동작이 바뀌는 변경을 커밋하기 전, Playwright MCP로 실제 브라우저 확인 화면을 녹화해 사용자에게 보여주는 절차. 컴포넌트·훅·라우팅·스타일 변경을 반영하기 전에 사용.
when_to_use: 커밋하기 전 UI 동작이 바뀐 것을 브라우저로 직접 확인해야 할 때, 사용자가 "확인해줘" "보여줘"라고 요청할 때.
---

2026-09-10, "코드를 반영하기 전에 브라우저 검증 화면을 보고 싶다"는 요청을 계기로 도입했다.
`docs/DECISIONS.md`의 여러 항목이 "Playwright로 실측했다"는 기록을 남기지만, 그 검증은
세션이 끝나면 사라지고 코드로도 영상으로도 남지 않았다 — 이 skill은 그 검증을 녹화본으로
남겨 사용자가 직접 보고 승인할 수 있게 한다.

이 절차는 e2e 자동화(`@playwright/test`)와 무관하다. 세션이 방금 만든 변경을 세션 스스로
확인하는 수동 검증이며, 회귀 테스트를 대체하지 않는다.

## 설정

레포 루트 `.mcp.json`이 `--caps=devtools --headless --ignore-https-errors
--viewport-size=1280x800 --output-dir=.claude/browser-artifacts`로 Playwright MCP
서버를 띄운다. `--caps=devtools`가 `browser_start_video`류 도구를 연다. `--headless`라서
별도 Chrome 창이 뜨지 않는다 — 대신 녹화가 끝난 뒤 파일을 열어서 보여준다("브라우저
창이 따로 뜨면 정신없다"는 피드백에 따른 선택, 2026-09-10). `--ignore-https-errors`는
dev 서버가 mkcert 자체서명 HTTPS(`https://localhost:31119`)라서 필요하다. **뷰포트는
1280x800 데스크톱 고정이다** — 모바일 전용 UI(`BottomTabBar`, `MobileCommentBar` 등)를
검증할 때는 녹화 전에 `browser_resize`로 먼저 모바일 크기로 바꾼다, 안 그러면 데스크톱
화면으로 녹화해놓고 "검증 완료"로 오판하게 된다.

## 언제 녹화하는가

- 컴포넌트·훅·라우팅·스타일 등 **UI 동작이 바뀌는 변경**을 커밋하기 전
- 사용자가 명시적으로 "확인해줘"라고 요청할 때

**녹화하지 않는 것**: 문서·타입·설정·백엔드 전용 변경처럼 브라우저 화면에 드러나지
않는 변경.

## 로그인 계정

로그인이 필요한 화면(북마크·마이페이지 등)을 확인할 때 **README.md의 "테스트 계정"
섹션을 쓰지 않는다** — 그 계정은 사람이 오래 써온 수동 QA용이라 실제 폴더·북마크가
쌓여 있다. 에이전트 세션의 실수(예: 되돌리기 토스트 타이밍을 놓쳐 북마크가 영구
삭제됨, 2026-09-11)가 그 real-looking 데이터에 그대로 남는다.

1. `docs/TESTING.md` "세션 캡처" 절차대로 `~/.claude/link-sphere-e2e-auth-state.json`이
   이미 있는지 **먼저 확인한다.** 있으면 그 세션(쿠키)을 재사용 시도 — 비밀번호를 다시
   묻지 않는다. 단, `docs/TESTING.md`가 밝히듯 재사용 절차 자체는 아직 실측되지 않았다
   (최초 캡처만 확인됨) — 컨텍스트 생성 시 `storageState`로 넘길지 기존 컨텍스트에
   `addCookies`로 주입할지는 실제 사용 시점에 확인이 필요하다.
2. 파일이 없거나 재사용이 실패하면(세션 만료 등) **`tester_new_999@example.com`**
   계정으로 로그인한다 — 운영 데이터가 없는 전용 계정이다. 비밀번호는 그 자리에서
   사용자에게 물어보고 어떤 파일에도 저장하지 않는다(`docs/TESTING.md` 정책과 동일).
3. 로그인 후 세션을 다시 캡처해 다음 세션이 재사용할 수 있게 남긴다.

## 호출 순서

1. `pnpm dev`가 안 떠 있으면 먼저 기동 (`https://localhost:31119`, mkcert HTTPS)
2. `browser_video_show_actions` — 클릭·입력 지점에 오버레이 표시 켜기
3. `browser_start_video` — 파일명 `verify-<YYYY-MM-DD>-<slug>.webm`,
   `--output-dir`(`.claude/browser-artifacts/`) 기준 상대경로로 지정
4. 확인할 흐름을 실제로 조작. 단계가 바뀔 때마다 `browser_video_chapter`로 구간 표시
   (예: "1. 로그인", "2. 게시글 작성", "3. 결과 확인")
   - **여러 항목(결정/버그)을 한 번에 검증할 때는, 사용자에게 제시했던 항목 번호·순서
     그대로 챕터를 나눈다.** 페이지 이동 동선이 편하다고 임의로 순서를 재배열하지
     않는다(예: 로그인 페이지가 먼저 필요하다고 "5번 항목"을 챕터 1로 앞당기지 않는다)
     — 사용자가 영상을 보면서 자기가 답했던 목록과 1:1로 대조하기 때문이다
     (2026-09-14, 챕터 순서가 요청 순서와 달라 "검증이 제대로 됐는지 못 알아보겠다"는
     지적을 받았다).
   - **테스트 계정에 검증 대상이 화면에 실제로 보일 만한 데이터가 있는지 먼저 확인한다.**
     빈 상태(폴더 0개, 게시글 0개 등)에서는 검증하려는 요소 자체가 안 보이거나 의미 없는
     기본값만 찍힐 수 있다 — "코드를 추적해보니 문제없다"는 논리로 스스로 판단하고
     넘어가지 않는다, 검증 영상은 사용자가 직접 눈으로 확인하는 자리이지 에이전트가
     논리로 설득하는 자리가 아니다(CLAUDE.md §7). 필요하면 녹화 시작 전에 폴더 생성·
     북마크 추가 등으로 실제 데이터를 만들어둔다(2026-09-14, 북마크가 0개인 계정에서
     폴더 제목 폰트 크기를 "전체"라는 기본값으로만 검증했다가 "북마크가 실제로 있어야
     제목을 영상에서 볼 수 있다"는 지적을 받고 재녹화했다).
5. 마지막 결과 화면에서 **2~3초 머문 뒤** `browser_stop_video` — 아래 "마지막 화면 붙잡기" 참고

## 모킹 녹화 — 운영 데이터를 쓰거나 실패 상태를 보여줘야 할 때

dev 서버의 `/api`는 운영 BE로 프록시된다(`vite.config.ts`). 그래서 위 MCP 절차로 등록·수정·삭제를
녹화하면 **운영 DB에 실제 글이 생긴다**. 429·500·504처럼 운영에서 일부러 일으킬 수 없는 실패 화면도
위 절차로는 찍을 수 없다. 이런 흐름은 MCP 대신 **녹화 전용 Playwright 스펙**으로 찍는다.

e2e(`e2e/`)의 모킹 도구(`installCatchAll`·`mockAuthRefresh`·`mockAccountQuery`·`isApiPath`·
`wrapResponse`)를 그대로 쓴다. 캐치올이 모킹하지 않은 `/api` 요청을 막으므로 운영으로 새지 않는다.
로그인 계정도 필요 없다.

1. gitignore된 `.claude/browser-artifacts/`에 설정과 스펙을 둔다(레포에 커밋하지 않는다).

   ```ts
   // .claude/browser-artifacts/verify.playwright.config.ts
   import base from '../../playwright.config';
   import path from 'node:path';
   import { fileURLToPath } from 'node:url';

   // ESM이라 __dirname이 없다
   const here = path.dirname(fileURLToPath(import.meta.url));

   export default {
     ...base,
     testDir: here,
     testMatch: 'verify-*.spec.ts',
     outputDir: path.join(here, 'verify-<YYYY-MM-DD>-<slug>'),
     reporter: 'list',
     workers: 1,
     use: {
       ...base.use,
       video: { mode: 'on', size: { width: 1280, height: 800 } },
       viewport: { width: 1280, height: 800 },
     },
     webServer: { ...base.webServer, cwd: path.resolve(here, '../..') },
   };
   ```

2. 스펙(`verify-<slug>.spec.ts`)은 `e2e/post-create.spec.ts`처럼 `beforeEach`에서 캐치올과 인증
   모킹을 깔고, 시나리오마다 `test` 하나를 만든다. 테스트 이름은 `1-<짧은설명>`처럼 번호를 붙여
   사용자에게 제시한 항목 순서와 맞춘다(위 "호출 순서" 4번과 같은 이유).
   - 응답을 `setTimeout`으로 1초 남짓 늦춰 로딩 상태가 영상에 보이게 한다.
   - 입력은 `fill` 대신 `pressSequentially(값, { delay: 30 })`로 해야 타이핑이 보인다.
   - 모바일은 `test.describe` 안에서 `test.use(devices['Pixel 5'])`를 그대로 쓰면 거부된다
     (`defaultBrowserType`이 섞여서). `viewport`·`userAgent`·`hasTouch`·`isMobile`·
     `deviceScaleFactor`만 골라 넘긴다.
   - 모킹이 요청 값과 상관없이 같은 응답을 돌려주면 "엉뚱한 값으로 요청했다" 같은 버그가 영상에
     안 드러난다. 요청 URL·횟수가 중요하면 `page.on('request')`로 모아 단정한다(2026-10-03, 수정
     폼이 원래 URL로 미리보기를 한 번 더 요청하던 버그를 녹화가 못 잡고 단위 테스트가 잡았다).
3. 실행: `E2E_SERVER_PORT=$(node scripts/pick-e2e-port.js) npx playwright test -c .claude/browser-artifacts/verify.playwright.config.ts --project chromium`

## 마지막 화면 붙잡기

결과(토스트·에러 문구·이동한 화면)가 뜨자마자 녹화를 끝내면 영상이 그 직전에 잘려 사용자가 결과를
못 본다(2026-10-03, "실패하면 에러 토스트 뜨는 게 안 보인다"는 지적). 결과를 단정한 뒤 2~3초
(`page.waitForTimeout(2500)`) 머물고 끝낸다.

보여주기 전에 마지막 프레임을 직접 확인한다 — 단정이 통과해도 화면이 기대와 다를 수 있다.

```bash
ffmpeg -loglevel error -y -sseof -1 -i <영상>.webm -frames:v 1 <영상>-last.png
```

이 PNG를 Read로 열어 본다. PNG도 같은 폴더(`.claude/browser-artifacts/`)에 둔다.

## 다 만든 뒤

- **결과 파일의 절대경로를 채팅 텍스트에 그대로 적는다 — 파일 카드만 보내고 끝내지
  않는다.** `SendUserFile`의 인라인 렌더 카드는 클라이언트에 따라 눈에 잘 안 띌 수
  있다(2026-09-14, VSCode 확장 환경에서 실제로 이 문제가 재발했다). 사용자가 카드를
  찾아 헤매지 않도록 절대경로를 코드 블록으로 병기한다.
- **사용자가 묻기 전에 영상을 에디터에서 직접 열어준다.** Playwright 기본 출력 폴더명은 한글·
  `⋮`·`→`가 섞인 긴 테스트 제목이라 마크다운 링크가 잘 안 열린다. 같은 폴더 안에
  `1-<짧은설명>.webm`처럼 짧은 이름으로 **복사**한 뒤 연다(2026-10-03, 링크만 주고 끝내 사용자가
  매번 다시 요청해야 했다).
  - macOS: `open -a Cursor <절대경로...>`(VS Code면 `open -a "Visual Studio Code"`). 파일 여러 개를
    한 번에 넘길 수 있다.
  - `cursor`·`code` 명령은 쓰지 않는다. PATH에 있더라도 에디터 CLI라는 보장이 없다(실제로 같은
    이름의 다른 Node 스크립트가 잡혀 `ERR_UNKNOWN_FILE_EXTENSION`으로 실패한 머신이 있었다).
- 연 뒤에도 짧은 이름 파일을 마크다운 링크로 남긴다
  (`[1-....webm](.claude/worktrees/<워크트리명>/.claude/browser-artifacts/<폴더>/1-....webm)`,
  워크스페이스 루트 기준 상대경로). 대화에는 파일마다 "무엇을 확인하면 되는지" 한 줄을 붙인다.
- 사용자가 보고 승인한 뒤에만 커밋으로 넘어간다 — 승인 없이 먼저 커밋하지 않는다
- 이상이 보이면 코드를 고치고 처음부터 다시 녹화한다. 실패 지점만 잘라 보여주지 않는다
  — 영상은 검증의 증거이지 검증 자체를 대체하지 않는다

## 파일 관리

- `.claude/browser-artifacts/`는 `.gitignore`에 있다 — 레포에 커밋하지 않는다
- **녹화·스크린샷을 `.claude/browser-artifacts/` 밖으로 옮기지 않는다** — 스크래치패드나
  `/tmp` 등으로 옮기는 것도 포함. 여기가 이미 gitignore·`--output-dir`로 정해둔 정위치다
  (2026-09-11, 이 규칙이 없어 세션이 결과물을 스크래치패드로 옮겼다가 사용자에게
  "왜 로컬로 보내냐, 원래 워크트리에서 관리하지 않았냐"는 지적을 받았다). 사용자에게
  보여줄 때는 위 "다 만든 뒤"처럼 같은 폴더 안에서 짧은 이름으로 복사해 에디터로 연다
- PR 본문에 남길 가치가 있는 영상만 직접 첨부한다(GitHub은 `.webm`을 PR에 그대로
  임베드한다, 무료 플랜 기준 파일당 10MB 한도)

## 알려진 제약

Playwright는 VP8 코덱 webm으로만 녹화한다. 에디터에서 이 파일이 재생되지 않으면(빈
화면이거나 재생 버튼이 안 뜨면) 아래 중 하나를 사용자에게 확인받고 진행한다 — 임의로
정하지 않는다:

- `ffmpeg`(시스템 설치, Playwright 번들 ffmpeg는 VP8/webm 전용이라 변환 불가)로 mp4
  변환 후 다시 열기
- 영상 대신 `browser_start_tracing`/스크린샷으로 대체
