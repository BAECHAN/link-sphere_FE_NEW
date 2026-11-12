import { test, expect } from '@playwright/test';

// dev 서버(vite)는 프로젝트 폴더의 파일을 요청받는 대로 내준다. Vite는 .env·.env.*·인증서·.git을 기본으로 막는데
// (server.fs.deny), vite.config.ts가 이 목록을 적으면 기본 목록과 합쳐지지 않고 통째로 바뀐다. 2026-01-18부터
// 있던 `deny: ['..']`가 그렇게 기본 목록을 지워 /.env가 200으로 나갔다(2026-11-12 발견,
// docs/plans/2026-11-12-vite-env-deny-dayjs-locale.md). 아래 두 파일은 git에 있어 CI와 워크트리 어디서나
// 요청할 수 있다 - .env는 CI에 없고, .git/config는 워크트리에 없다(.git이 파일이다).
const DENIED_PATHS = ['/.env.test', '/.env.example'];

test.describe('dev 서버 — 환경 변수 파일을 내주지 않는다', () => {
  for (const path of DENIED_PATHS) {
    test(`GET ${path} → 403`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(403);
    });
  }
});
