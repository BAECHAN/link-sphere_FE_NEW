import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';

// 같은 브라우저 컨텍스트의 두 페이지는 localStorage를 공유하고 서로의 storage 이벤트를 받는다 -
// 실제 브라우저의 두 탭과 같다. 인증 세대(auth-epoch.util.ts)가 바뀌면 다른 탭이 useAuthEpochSync로
// 따라온다(docs/AUTH.md §8-H).

const VALID_PASSWORD = 'TestPass1!';
/** 만료 응답 뒤 refresh·재전송이 이어지지 않는지 지켜보는 시간 - 고치기 전 코드는 수 ms 안에 이어졌다 */
const NO_FOLLOW_UP_WAIT_MS = 500;

/** 페이지마다 route를 따로 건다(page.route는 페이지 단위) */
async function installMocks(page: Page) {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockLoginSuccess(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await mockBookmarkFolderList(page);
  await mockBookmarkFolderPosts(page);
}

test.describe('탭 간 로그인·로그아웃 동기화', () => {
  test('한 탭에서 로그아웃하면 보호 페이지에 있던 다른 탭도 로그아웃되고 /post로 옮긴다', async ({
    context,
  }) => {
    // 두 탭 모두 이전 로그인 흔적이 있는 상태로 연다(auth.fixture.ts와 같은 시딩을 컨텍스트 전체에)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const bookmarkTab = await context.newPage();
    const feedTab = await context.newPage();
    await installMocks(bookmarkTab);
    await installMocks(feedTab);

    await bookmarkTab.goto('/bookmark');
    await expect(
      bookmarkTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();

    await feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await feedTab.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await expect(bookmarkTab).toHaveURL(/\/post$/);
    await expect(bookmarkTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
  });

  test('한 탭에서 로그인하면 로그아웃 상태이던 다른 탭도 로그인된다', async ({ context }) => {
    const feedTab = await context.newPage();
    const loginTab = await context.newPage();
    await installMocks(feedTab);
    await installMocks(loginTab);

    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await loginTab.goto('/auth/login');
    await loginTab.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await loginTab.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await loginTab.getByRole('button', { name: TEXTS.auth.login.signIn }).click();
    await expect(loginTab).toHaveURL(/\/post$/);

    // 다른 탭은 쿠키로 세션을 받아들인다(여기서는 /auth/refresh 모킹)
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
  });

  test('다른 탭에서 다시 로그인한 순간 진행 중이던 요청은 TOKEN_EXPIRED를 받아도 갱신·재전송하지 않는다', async ({
    context,
  }) => {
    // 공유 refresh 쿠키가 이미 새 계정의 것일 수 있어, 갱신·재전송하면 그 요청이 새 계정으로 실행된다
    // (docs/AUTH.md §8-B "인증 세대가 바뀐 뒤 돌아온 401")
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const feedTab = await context.newPage();
    await installMocks(feedTab);

    let likeRequests = 0;
    let releaseLike!: () => void;
    const likeHeld = new Promise<void>((resolve) => {
      releaseLike = resolve;
    });
    await feedTab.route(
      (url) => /^\/api\/post\/[^/]+\/like$/.test(url.pathname),
      async (route) => {
        likeRequests += 1;

        // 첫 요청만 서버에 머물다 만료로 돌아온다 - 재전송되면 성공해 버린다(새 계정으로 실행된 것)
        if (likeRequests > 1) {
          return route.fulfill({
            json: {
              status: 200,
              message: 'ok',
              data: { isLiked: true, likeCount: 1 },
              timestamp: '',
            },
          });
        }

        await likeHeld;

        return route.fulfill({
          status: 401,
          json: {
            status: 401,
            code: SERVER_ERROR_CODE.TOKEN_EXPIRED,
            message: 'expired',
            timestamp: new Date().toISOString(),
          },
        });
      }
    );
    let refreshRequests = 0;
    feedTab.on('request', (request) => {
      if (isApiPath(new URL(request.url()), ENDPOINTS.auth.refresh)) {
        refreshRequests += 1;
      }
    });

    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    // exact — 이름 부분 일치면 피드의 "좋아요한" 범위 칩이 먼저 걸린다
    await feedTab
      .getByRole('button', { name: TEXTS.ariaLabels.postLike, exact: true })
      .first()
      .click();
    await expect.poll(() => likeRequests).toBe(1);

    // 좋아요가 서버에 가 있는 사이 다른 탭에서 로그인했다 - 이 탭은 쿠키로 새 세션을 받아들인다
    const otherTab = await context.newPage();
    await installMocks(otherTab);
    await otherTab.goto('/post');
    const refreshBeforeSignIn = refreshRequests;
    await otherTab.evaluate(
      ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
      [STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab'] as const
    );
    await expect.poll(() => refreshRequests).toBe(refreshBeforeSignIn + 1);

    const expiredResponse = feedTab.waitForResponse((response) =>
      /^\/api\/post\/[^/]+\/like$/.test(new URL(response.url()).pathname)
    );
    releaseLike();
    await expiredResponse;

    // 고치기 전에는 만료 응답 직후 refresh → 원 요청 재전송이 이어졌다. "더 나가지 않음"은 기다려 봐야 알 수 있다
    await feedTab.waitForTimeout(NO_FOLLOW_UP_WAIT_MS);
    expect(likeRequests).toBe(1);
    expect(refreshRequests).toBe(refreshBeforeSignIn + 1);
    // 서버 값으로 다시 맞춰진다(받아들이기의 재조회) - 재전송돼 성공했다면 좋아요 상태로 남는다
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.postUnlike })).toHaveCount(0);
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
  });
});
