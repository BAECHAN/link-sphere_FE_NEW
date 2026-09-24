/**
 * 로컬 dev 서버 포트의 단일 정의. vite.config.ts와 playwright.config.ts가 각자 리터럴
 * `31119`를 따로 들고 있으면 포트를 바꿀 때 한쪽만 고치고 다른 쪽을 놓치는 드리프트가
 * 생길 수 있어(2026-09-14 발견) 여기 하나로 모은다.
 */
export const DEV_SERVER_PORT = 31119;

/**
 * e2e(`playwright.config.ts`의 webServer, `vite --mode test`) 전용 포트. DEV_SERVER_PORT와
 * 분리하는 이유: e2e는 MSW로 완전히 모킹돼 실제 BE·DB를 전혀 쓰지 않아 "워크트리 간 동시
 * pnpm dev 금지"(CLAUDE.md, 실제 BE/원격 DB 공유가 이유) 규칙의 대상이 아닌데도, 같은
 * DEV_SERVER_PORT를 쓰면 다른 워크트리의 `pnpm dev --mode localhost`(mkcert HTTPS)와 주소가
 * 겹쳐 e2e의 HTTP 헬스체크가 응답을 못 받고 60초 타임아웃난다(2026-09-24 실측). 별도 포트로
 * 이 충돌 자체를 없앤다.
 */
export const E2E_SERVER_PORT = 31120;
