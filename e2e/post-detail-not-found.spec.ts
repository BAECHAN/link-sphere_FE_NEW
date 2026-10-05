import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

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
    // 주소창에 직접 URL을 입력해 진입하는 것과 같은 경로 — 카드 클릭(prefetch)을 거치지 않는다.
    await page.goto(`/post/${mockPost.id}`);

    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toBeVisible();
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
});
