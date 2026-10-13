import type { Page } from '@playwright/test';

/**
 * PUT/DELETE /post/:id/like (성공) — 200 + { isLiked, likeCount }. 좋아요는 상태 지정형이라
 * PUT이면 켜진 상태(1), DELETE면 꺼진 상태(0)를 돌려준다.
 */
export async function mockLikePost(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/like$/.test(url.pathname),
    (route) => {
      const isLiked = route.request().method() === 'PUT';

      return route.fulfill({
        status: 200,
        json: {
          status: 200,
          message: isLiked ? '좋아요 성공' : '좋아요 취소 성공',
          data: { isLiked, likeCount: isLiked ? 1 : 0 },
          timestamp: new Date().toISOString(),
        },
      });
    }
  );
}

/** PUT/DELETE /post/:id/like (실패) — 좋아요 mutation의 목록 캐시 롤백(interaction.queries.ts) 회귀 테스트용. */
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
