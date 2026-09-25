/**
 * Lighthouse CI의 puppeteerScript — 로그인 필요 페이지를 측정하기 전에 자동으로 로그인한다.
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#puppeteerscript
 *
 * 테스트 계정은 `tester_new_999@example.com`을 쓴다. README `## 테스트 계정`의 계정은
 * 실사용자 데이터(폴더·북마크)가 쌓인 수동 QA용이라 2026-09-11 사고 이후 자동화에서
 * 배제됐다(docs/TESTING.md "로그인 계정" 절 참고).
 *
 * 비밀번호는 코드에 남기지 않고 환경변수(LH_TEST_PASSWORD)로만 받는다 — 로컬에서는
 * 실행 직전에 셸에서 export, CI에서는 GitHub Actions secret으로 주입한다.
 */
const TEST_EMAIL = 'tester_new_999@example.com';

module.exports = async (browser, context) => {
  const password = process.env.LH_TEST_PASSWORD;

  if (!password) {
    throw new Error(
      'LH_TEST_PASSWORD 환경변수가 없다 — 로그인 필요 페이지를 측정하려면 테스트 계정 비밀번호를 셸에서 export하거나 CI secret으로 등록해야 한다.'
    );
  }

  const page = await browser.newPage();

  await page.goto(`${context.url.replace(/\/[^/]*$/, '')}/auth/login`, {
    waitUntil: 'networkidle0',
  });

  const stillOnLoginPage = page.url().includes('/auth/login');

  if (!stillOnLoginPage) {
    // has-session 쿠키가 이미 있어 GuestGuard가 /post로 리다이렉트한 경우 — 이미 로그인된 상태다.
    await page.close();
    return;
  }

  await page.waitForSelector('#email');
  await page.type('#email', TEST_EMAIL);
  await page.type('#password', password);

  await Promise.all([
    page.waitForFunction(() => window.location.pathname === '/post', { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);

  await page.close();
};
