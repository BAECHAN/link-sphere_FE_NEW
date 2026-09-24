/**
 * 로컬 dev 서버 포트의 단일 정의. vite.config.ts와 playwright.config.ts가 각자 리터럴
 * `31119`를 따로 들고 있으면 포트를 바꿀 때 한쪽만 고치고 다른 쪽을 놓치는 드리프트가
 * 생길 수 있어(2026-09-14 발견) 여기 하나로 모은다.
 */
export const DEV_SERVER_PORT = 31119;

/**
 * e2e(`playwright.config.ts`의 webServer, `vite --mode test`) 전용 포트 대역. DEV_SERVER_PORT와
 * 분리하는 이유: e2e는 MSW로 완전히 모킹돼 실제 BE·DB를 전혀 쓰지 않아 "워크트리 간 동시
 * pnpm dev 금지"(CLAUDE.md, 실제 BE/원격 DB 공유가 이유) 규칙의 대상이 아닌데도, 같은
 * DEV_SERVER_PORT를 쓰면 다른 워크트리의 `pnpm dev --mode localhost`(mkcert HTTPS)와 주소가
 * 겹쳐 e2e의 HTTP 헬스체크가 응답을 못 받고 60초 타임아웃난다(2026-09-24 실측).
 *
 * 고정 포트 하나가 아니라 대역인 이유: 워크트리 두 곳이 동시에 e2e를 돌리면, Playwright의
 * `reuseExistingServer: true`(로컬 기본값)는 그 포트에 이미 떠 있는 서버를 "이게 내가 기대한
 * 서버인지" 검증 없이 그냥 재사용한다(공식 문서: "it will re-use an existing server on the
 * port or url when available", https://playwright.dev/docs/test-webserver) — 즉 고정 포트
 * 하나였다면 나중에 시작한 워크트리가 먼저 뜬 워크트리의 서버에 조용히 붙어 자기 코드를
 * 전혀 테스트하지 못한 채 "통과"로 보고했을 것이다. `playwright.config.ts`가 이 대역에서
 * 매 실행마다 바인딩 가능한 포트를 직접 찾아 쓰고, `--strictPort`로 그 사이 레이스가 나도
 * 조용히 잘못된 서버에 붙는 대신 즉시 실패하게 한다.
 */
export const E2E_SERVER_PORT_RANGE_START = 31120;
export const E2E_SERVER_PORT_RANGE_END = 31139;
