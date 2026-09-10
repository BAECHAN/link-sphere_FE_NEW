import { defineConfig, devices } from '@playwright/test';

// dev server가 mkcert HTTPS(--mode localhost, vite.config.ts:24)를 쓰면 CI에 로컬 CA를
// 설치해야 하는 부담이 생긴다. --mode test는 이미 있는 .env.test(docs/TESTING.md)를
// 그대로 재사용하면서 mkcert 조건(mode === 'localhost')을 자연스럽게 피해 HTTP로 뜬다.
const baseURL = 'http://localhost:31119';

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
    },
  ],
  webServer: {
    command: 'pnpm exec vite --mode test',
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
