import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import {
  mockBookmarkFolder,
  mockBookmarkFolderListResponse,
} from '@/mocks/fixtures/bookmark-folder.fixtures';

// URL이 바뀌면 맨 위로 가는 건 <ScrollRestoration/>(RootLayout.tsx)의 전역 규칙이다. 가상 스크롤
// 목록은 같은 커밋에서 옛 스크롤 위치 기준으로 보정 스크롤을 걸어 그 리셋을 되돌렸었다 —
// useWindowGridVirtualizer.ts의 shouldAdjustScrollOnItemResize 가드가 빠지면 헤더 검색 테스트가
// 실패한다(직접 확인: 0 → 1261 → 1022로 되돌아감).
// 목록 내용이 그대로면 가드 없이도 0이 되므로(직접 확인), 조건이 바뀌면 "더 짧지만 여전히 긴
// 다른 목록"을 돌려줘 실제 필터링과 같은 상황을 만든다.

function fulfillPostList(route: Route, isFiltered: boolean): Promise<void> {
  const count = isFiltered ? 18 : 30;
  // 걸러진 글은 설명을 길게 줘 행 높이가 추정치와 달라지게 한다 — 가상화 보정은 새 행의 실측
  // 높이가 추정치와 다를 때만 일어나서, 모든 글이 같은 내용이면 가드 없이도 통과해 버린다(직접 확인).
  const content = Array.from({ length: count }, (_, index) => ({
    ...mockPost,
    id: `${isFiltered ? 'filtered' : 'all'}-${index}`,
    title: `${isFiltered ? 'Filtered' : 'All'} ${index}`,
    description: isFiltered ? `${mockPost.description} `.repeat(12) : mockPost.description,
  }));

  return route.fulfill({
    json: wrapResponse({
      page: 0,
      size: count,
      content,
      totalElements: count,
      totalPages: 1,
      last: true,
    }),
  });
}

async function scrollDownPastOneScreen(page: Page): Promise<void> {
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
}

test.describe('URL이 바뀌면 가상 스크롤 목록도 맨 위부터 보여준다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
  });

  test('피드 중간에서 헤더 검색을 제출하면 결과를 맨 위부터 보여준다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) => fulfillPostList(route, new URL(route.request().url()).searchParams.has('search'))
    );

    await page.goto('/post');
    await expect(page.getByRole('link', { name: 'All 0' })).toBeVisible();
    await scrollDownPastOneScreen(page);

    // 헤더(sticky)의 검색창은 스크롤한 상태에서도 화면 안에 있다 — NavbarSearch의 인풋은
    // aria-label 없이 id만 있다(post-list.spec.ts와 같은 선택자).
    const searchInput = page.locator('#header-search-input');
    await searchInput.fill('react');
    await searchInput.press('Enter');

    await expect(page.getByRole('link', { name: 'Filtered 0' })).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  // 이 테스트는 가드 회귀 테스트가 아니라 동작 확인이다 — 폴더를 바꾸면 커밋 전에 목록이 먼저
  // 짧아져 스크롤이 이미 맨 위 근처(직접 측정 48px)로 내려오므로, 가드를 꺼도 통과한다. 같은 훅을
  // 쓰는 목록이라 전역 규칙이 여기서도 지켜지는지만 본다.
  test('북마크 목록 중간에서 폴더를 바꾸면 그 폴더 글을 맨 위부터 보여준다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => route.fulfill({ json: wrapResponse(mockBookmarkFolderListResponse) })
    );
    await page.route(
      (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
      (route) => fulfillPostList(route, route.request().url().includes(mockBookmarkFolder.id))
    );

    await page.goto('/bookmark');
    await expect(page.getByRole('link', { name: 'All 0' })).toBeVisible();
    await scrollDownPastOneScreen(page);

    // 폴더 트리는 sticky 사이드바라 스크롤한 상태에서도 화면 안에 있다.
    await page.getByRole('button', { name: mockBookmarkFolder.name }).click();

    await expect(page.getByRole('link', { name: 'Filtered 0' })).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});
