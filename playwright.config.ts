import { defineConfig, devices } from '@playwright/test';
import { E2E_SERVER_PORT_RANGE_START } from './dev-server.config';

// dev server가 mkcert HTTPS(--mode localhost, vite.config.ts:24)를 쓰면 CI에 로컬 CA를
// 설치해야 하는 부담이 생긴다. --mode test는 이미 있는 .env.test(docs/TESTING.md)를
// 그대로 재사용하면서 mkcert 조건(mode === 'localhost')을 자연스럽게 피해 HTTP로 뜬다.
// DEV_SERVER_PORT(pnpm dev)가 아닌 별도 대역을 쓴다 — 이유와 대역이 하나가 아니라 여러
// 개인 이유는 dev-server.config.ts의 E2E_SERVER_PORT_RANGE_* 주석 참고.
//
// 포트는 이 파일 안에서 직접 고르지 않는다 — Playwright는 fullyParallel 워커마다 이
// config 파일을 각자 다시 평가하므로, 여기서 매번 대역을 스캔하면 워커마다 다른 포트를
// 골라 서로 다른(또는 아무도 안 띄운) 서버를 바라보게 된다(2026-09-24 CI 실측, 57건 전부
// ERR_CONNECTION_REFUSED). 포트 선택은 scripts/pick-e2e-port.js가 playwright 프로세스
// 시작 전에 딱 한 번만 하고(package.json의 test:e2e), 그 값을 E2E_SERVER_PORT 환경변수로
// 넘기면 모든 워커가 OS 프로세스 상속으로 같은 값을 받는다. 그 스크립트를 거치지 않고
// (예: `pnpm exec playwright test`) 직접 실행하는 경우에만 대역의 첫 포트로 폴백한다.
const e2eServerPort = Number(process.env.E2E_SERVER_PORT ?? E2E_SERVER_PORT_RANGE_START);
const baseURL = `http://localhost:${e2eServerPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 모바일 스펙은 데스크톱 뷰포트를 전제로 단언하는 기존 스펙(예: protected-nav.spec.ts의
      // "사이드바만 보이고 BottomTabBar는 display:none" 가정)과 공존할 수 없다 — 반드시
      // 배타적으로 나눠야 한다(2026-09-14 조사 실측).
      testIgnore: '**/*.mobile.spec.ts',
    },
    {
      name: 'mobile-chrome',
      // devices['Pixel 5']는 viewport + hasTouch + 모바일 UA를 한 번에 준다.
      // useIsMobile.ts는 UA 또는 max-width:768px 중 하나만 맞아도 true이므로 viewport만으로도
      // 충분하지만, usePostCard.ts의 navigator.share 분기는 UA만 보므로 device 프리셋이 더 넓다.
      use: { ...devices['Pixel 5'] },
      testMatch: '**/*.mobile.spec.ts',
    },
  ],
  webServer: {
    // --strictPort: 포트가 이미 점유돼 있으면(예: 동시에 실행된 다른 e2e) 조용히 다음
    // 빈 포트로 넘어가는 대신 즉시 실패한다 — 그래야 baseURL과 실제 서버 주소가 어긋나
    // 헬스체크가 원인 불명 타임아웃으로 조용히 실패하는 걸 방지한다.
    command: `pnpm exec vite --mode test --port ${e2eServerPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // firebase/messaging의 getMessaging()이 앱 부트스트랩 중 즉시 호출되는데, 프로젝트
    // 설정값이 전혀 없으면 FirebaseError를 동기적으로 throw해 React가 마운트되기 전에
    // 페이지가 죽는다(2026-09-10 CI 최초 실행에서 실측 — 로컬은 .env가 있어 안 드러났다).
    // e2e는 실제 FCM을 쓰지 않으므로(로그인도 has-session 시딩이라 mutation 경로를 안 탄다)
    // 구조적으로만 유효한 더미 값이면 충분하다. playwright.config.ts는 Node 프로세스라
    // .env를 자동으로 읽지 않으므로(vite의 loadEnv만 .env를 읽는다) 로컬·CI 모두 이
    // 값이 그대로 쓰인다.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
      VITE_FIREBASE_VAPID_KEY: 'test-vapid-key',
    },
  },
});
