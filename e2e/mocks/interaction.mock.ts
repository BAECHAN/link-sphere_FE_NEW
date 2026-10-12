import type { Page } from '@playwright/test';

/** POST /post/:id/like (성공) — 200 + { isLiked, likeCount }. */
export async function mockLikePost(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/like$/.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 200,
        json: {
          status: 200,
          message: '좋아요 성공',
          data: { isLiked: true, likeCount: 1 },
          timestamp: new Date().toISOString(),
        },
      })
  );
}

/** POST /post/:id/like (실패) — 좋아요 mutation의 목록 캐시 롤백(interaction.queries.ts) 회귀 테스트용. */
export async function mockLikePostFailure(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/like$/.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 500,
        json: {
          status: 500,
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했어요.',
          timestamp: new Date().toISOString(),
        },
      })
  );
}
