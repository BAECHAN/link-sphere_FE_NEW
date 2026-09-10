import type { Page } from '@playwright/test';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * GET /common/category-option — Post 페이지가 마운트마다 항상 호출한다(비로그인
 * 포함, pages/post/index.tsx:9). mockPost.categories가 이미 CategoryOption[] shape라
 * 그대로 재사용한다.
 */
export async function mockCategoryOptions(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.common.categoryOption),
    (route) => route.fulfill({ json: wrapResponse(mockPost.categories ?? []) })
  );
}
