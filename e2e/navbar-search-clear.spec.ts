import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

const LIST_DELAY_MS = 1500;

/**
 * 헤더 검색의 X 버튼은 입력을 비우고 URL의 q를 뺀다(useNavbarSearch.handleClear). 그 URL 반영은
 * 새 목록 응답이 올 때까지 늦게 도착하고, "URL이 바뀌면 입력창을 URL 값으로 맞춘다"는 동기화가
 * 그 사이 친 글자를 빈 값으로 덮었다. jsdom은 이동이 즉시 반영돼 단위 테스트로는 재현되지 않아
 * 목록 응답을 늦춘 실제 브라우저에서 확인한다(docs/SEARCH.md §10).
 */
test.describe('헤더 검색 — X 버튼을 누른 뒤 입력', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, LIST_DELAY_MS));
        await route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );
  });

  test('X 버튼을 누르고 친 글자가 목록 응답이 온 뒤에도 입력창에 남는다', async ({ page }) => {
    await page.goto('/post?q=react');

    const input = page.getByPlaceholder(TEXTS.placeholders.postSearch).first();
    await expect(input).toHaveValue('react');
    await expect(page.getByRole('link', { name: mockPost.title }).first()).toBeVisible();

    // X는 누른 뒤 포커스를 입력창으로 돌려주므로 곧바로 칠 수 있다
    await page.getByRole('button', { name: TEXTS.ariaLabels.inputClear }).first().click();
    await page.waitForTimeout(400);
    await page.keyboard.type('vue', { delay: 150 });
    await expect(input).toHaveValue('vue');

    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
    // 늦게 온 목록 응답으로 URL 반영이 끝난 뒤에도 친 글자가 그대로여야 한다
    await page.waitForTimeout(LIST_DELAY_MS + 500);
    await expect(input).toHaveValue('vue');
  });
});
