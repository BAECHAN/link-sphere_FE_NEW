import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPostList, mockRecordPostView } from './mocks/post.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';

const VALID_PASSWORD = 'TestPass1!';

// 응답 body의 status 필드가 ApiError.status로 그대로 옮겨진다(client.ts) — HTTP status만
// 404로 두고 body의 status를 빠뜨리면 PostDetailPage의 `error.status === 404` 분기를 못 탄다.
async function mockPostDetailNotFound(page: import('@playwright/test').Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 404,
        json: {
          status: 404,
          code: 'POST_NOT_FOUND',
          message: '게시글을 찾을 수 없습니다.',
          timestamp: new Date().toISOString(),
        },
      })
  );
}

test.describe('게시글 상세 404', () => {
  // /post/:id는 공개 라우트라 인증 불필요 — auth.fixture를 쓰지 않는다.
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetailNotFound(page);
  });

  test('삭제된 글을 직접 열면 주소를 그대로 둔 채 안내 화면을 띄우고, 목록으로 링크로 /post에 간다', async ({
    page,
  }) => {
    let detailRequests = 0;

    page.on('request', (request) => {
      if (/^\/api\/post\/[^/]+$/.test(new URL(request.url()).pathname)) {
        detailRequests += 1;
      }
    });

    // 주소창에 직접 URL을 입력해 진입하는 것과 같은 경로 — 카드 클릭(prefetch)을 거치지 않는다.
    await page.goto(`/post/${mockPost.id}`);

    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toBeVisible();
    // 404는 다시 시도해도 결과가 같다 — 라우트의 미리 받기(PostDetailRoute)도 상세 조회와 같은
    // retry: false를 실어야 재시도만큼 안내가 늦게 뜨지 않는다(post.queries.ts).
    expect(detailRequests).toBe(1);
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // 200으로 응답하는 화면이라 검색엔진 색인에서 빠지도록 noindex를 단다(useNoIndex.ts).
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    // 전역 핸들러가 404를 의도적으로 무시하고 화면(ErrorFallback)에 안내를 위임한다
    // (queryClient.ts) — 이 계약이 깨지면 일반 서버 오류 토스트가 추가로 뜬다.
    await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);

    await page.getByRole('link', { name: TEXTS.post.detail.backToList }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
  });

  test('목록에서 카드를 클릭한 사이 글이 사라지면 안내 화면을 띄우고, 뒤로가기로 목록에 돌아온다', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    // 카드 클릭(PUSH 이동) — usePostCard.ts의 onFocus prefetch도 같은 404 목을 탄다.
    await page.getByRole('link', { name: mockPost.title }).click();

    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.goBack();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
  });

  // 로그인은 캐시를 새 인증으로 다시 부르지만, 에러 경계가 풀리지 않으면 로그인 전에 실패해 떠 있던 화면은 그대로
  // 남았다(docs/AUTH.md §8-H "인증이 바뀌는 사이 첫 로딩 중이던 조회"의 "이 탭 로그인")
  test('비로그인으로는 볼 수 없는 글의 안내가 떠 있을 때 그 자리에서 로그인하면 안내가 풀리고 글을 보여 준다', async ({
    page,
  }) => {
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockComments(page, []);
    await mockRecordPostView(page);
    const sentTokens: Array<string | null> = [];
    // 내 비공개 글이다 - 토큰을 실은 요청에만 글을 주고, 비로그인 요청은 beforeEach의 404로 넘긴다
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => {
        const token = route.request().headers()['x-access-token'] ?? null;
        sentTokens.push(token);

        if (token) {
          return route.fulfill({ json: wrapResponse(mockPost) });
        }

        return route.fallback();
      }
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.nav.logIn }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await dialog.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    // dialog.tsx의 열린 직후 클릭 가드
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await dialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();

    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();
    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toHaveCount(0);
    expect(sentTokens).toEqual([null, mockLoginResponse.accessToken]);
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
  });
});
