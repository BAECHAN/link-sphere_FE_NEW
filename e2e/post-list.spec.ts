import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

test.describe('비로그인 방문자 — 게시글 목록 조회 → 검색 → 상세 진입', () => {
  test.beforeEach(async ({ page }) => {
    // 캐치올을 가장 먼저 등록한다 — Playwright route는 나중에 등록한 핸들러가 먼저
    // 실행되므로(LIFO), 아래에서 등록하는 구체적인 mock*이 이 캐치올을 덮어쓴다.
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page);
  });

  test('목록에서 게시글을 검색하고 상세로 진입한다', async ({ page }) => {
    await page.goto('/post');

    // has-session 플래그가 없어 /auth/refresh 자체가 호출되지 않는다
    // (useAppInitialization.ts:50) — 스피너 없이 바로 목록이 보인다.
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    // 검색 — NavbarSearch의 인풋은 aria-label이 없고 id만 있다(NavbarSearch.tsx:35).
    const searchInput = page.locator('#header-search-input');
    await searchInput.fill('react');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/post\?q=react/);

    // 같은 목 응답을 그대로 쓰므로 검색 후에도 제목이 계속 보인다
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    // 상세 진입
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();
  });
});
