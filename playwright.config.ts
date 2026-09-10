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
  },
});
