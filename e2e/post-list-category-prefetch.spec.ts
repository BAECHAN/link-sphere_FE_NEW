import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 피드는 목록(PostList)이 게시글을 기다리며 멈추는 경계 바깥에서 카테고리 요청을 함께 시작한다
// (app/routes의 PostFeedRoute). 필터 카드의 useQuery는 커밋 뒤에야 요청하는데 페이지 첫
// 커밋은 게시글 응답을 기다리므로, 그대로 두면 칩이 카드보다 늦게 그려져 그 아래가 밀린다
// (docs/SEARCH.md §10). 지연은 React의 재시도 커밋 스로틀(500ms)보다 짧아야 한다 - 길면 카드가
// 게시글 없이 먼저 커밋돼, 고치기 전 코드에서도 카테고리 요청이 게시글 응답보다 앞선다. Vite가 의존성을
// 처음 최적화하는 콜드 실행처럼 페이지 청크가 늦게 와도 같은 이유로 요청 순서 검사는 고치기 전에 통과할 수
// 있다 - 고치기 전 코드를 늘 잡는 건 시프트 검사다.
const POST_LIST_DELAY_MS = 200;

interface RequestLog {
  categoryRequests: number;
  firstCategoryRequestAt?: number;
  postListResponseAt?: number;
}

async function mockDelayedPostList(page: Page, log: RequestLog): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, POST_LIST_DELAY_MS));
      log.postListResponseAt ??= Date.now();
      await route.fulfill({ json: wrapResponse(mockPostListResponse) });
    }
  );
}

function logCategoryRequests(page: Page, log: RequestLog): void {
  page.on('request', (request) => {
    if (isApiPath(new URL(request.url()), ENDPOINTS.common.categoryOption)) {
      log.categoryRequests += 1;
      log.firstCategoryRequestAt ??= Date.now();
    }
  });
}

// 범위 필터 행을 움직인 layout-shift 점수만 모은다 - 카테고리 칩이 늦게 들어오면 바로 아래인 이 행이
// 밀린다. 다른 요소(썸네일 등)의 시프트는 이 검사와 무관하다.
async function recordScopeFilterShifts(page: Page): Promise<void> {
  await page.addInitScript((scopeFilterLabel) => {
    const target = window as unknown as { __scopeFilterShift: number };
    target.__scopeFilterShift = 0;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as {
          value: number;
          sources: Array<{ node: Node | null }>;
        };
        const movedScopeFilter = shift.sources.some(
          (source) =>
            source.node instanceof Element &&
            source.node.getAttribute('aria-label') === scopeFilterLabel
        );

        if (movedScopeFilter) {
          target.__scopeFilterShift += shift.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }, TEXTS.ariaLabels.postScopeFilters);
}

test.describe('피드 카테고리 칩 요청 시점', () => {
  let log: RequestLog;

  test.beforeEach(async ({ page }) => {
    log = { categoryRequests: 0 };
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockDelayedPostList(page, log);
    logCategoryRequests(page, log);
  });

  test('피드에 들어오면 게시글 응답을 기다리지 않고 카테고리를 요청하고, 한 번만 요청한다', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    expect(log.firstCategoryRequestAt).toBeDefined();
    expect(log.postListResponseAt).toBeDefined();
    expect(log.firstCategoryRequestAt!).toBeLessThan(log.postListResponseAt!);
    // 필터 카드의 useQuery는 미리 받은 같은 키의 캐시를 읽는다 - 다시 요청하지 않는다
    expect(log.categoryRequests).toBe(1);
  });

  test('카테고리 칩이 카드와 함께 그려져 범위 필터 행이 밀리지 않는다', async ({ page }) => {
    await recordScopeFilterShifts(page);
    await page.goto('/post');

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: TEXTS.ariaLabels.postCategoryFilters })
        .getByRole('button', { name: `@${mockPost.categories![0]!.name}` })
    ).toBeVisible();
    // 칩이 늦게 들어왔다면 그 직후 시프트가 기록된다 - 관찰자 콜백이 돌 때까지 잠시 지켜본다
    await page.waitForTimeout(500);

    const scopeFilterShift = await page.evaluate(
      () => (window as unknown as { __scopeFilterShift: number }).__scopeFilterShift
    );

    expect(scopeFilterShift).toBe(0);
  });

  // 429는 재시도하지 않아(retry-policy.ts) 미리 받기가 곧바로 실패하고, 필터 카드가 마운트하며 다시
  // 보낸 요청도 실패한다. 두 실패가 같은 안내라 고정 id로 하나만 뜬다(error-toast.ts)
  test('카테고리 요청이 429면 미리 받기와 화면이 함께 실패해도 안내 토스트는 하나만 뜬다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.common.categoryOption),
      (route) =>
        route.fulfill({ status: 429, json: { status: 429, message: 'rate limited', data: null } })
    );
    await page.goto('/post');

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect.poll(() => log.categoryRequests).toBe(2);
    // 두 번째 실패의 토스트가 뒤따라 뜨는지 잠시 지켜본 뒤 그 순간의 개수를 한 번만 잰다 - 재시도하는
    // toHaveCount는 겹친 토스트가 하나씩 사라지며 잠깐 1개가 되는 순간에 통과해 버린다
    await page.waitForTimeout(500);
    expect(await page.getByText(TEXTS.messages.error.rateLimited).count()).toBe(1);
  });
});
