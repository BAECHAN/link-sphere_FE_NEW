import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 상세 돌아가기 버튼 문구(usePostDetail.ts)는 유입 경로로 정해진다. 같은 경로 위에 오버레이를
// 여는 PUSH(북마크 폴더 창 등)는 location.state를 오버레이 표시로 바꾸지만 유입 경로는 그대로라
// 문구를 유지해야 한다. 돌아가기 버튼은 데스크톱(md 이상)에서만 보여 chromium에서만 돈다.
// 모달이 열리면 뒤쪽 콘텐츠가 aria-hidden이 되므로 role이 아니라 텍스트로 찾는다.
test.describe('상세 돌아가기 버튼 문구 — 오버레이를 열어도 유지', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
    await mockBookmarkFolderList(page);
  });

  const backToListButton = (page: import('@playwright/test').Page) =>
    page.locator('button', { hasText: TEXTS.post.detail.backToList });
  const neutralBackButton = (page: import('@playwright/test').Page) =>
    page.locator('button', { hasText: TEXTS.post.detail.back });

  test('피드에서 들어와 북마크 창을 열어도 "목록으로"가 그대로다', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    // 상세 화면이 실제로 커밋된 뒤에 조작한다(목록 카드를 잘못 조작하는 경합 방지, #268)
    await expect(backToListButton(page)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(backToListButton(page)).toBeVisible();
    await expect(neutralBackButton(page)).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(backToListButton(page)).toBeVisible();
  });

  test('공유 링크로 바로 들어와("default" key) 북마크 창을 열어도 "목록으로"가 그대로다', async ({
    page,
  }) => {
    await page.goto(`/post/${mockPost.id}`);
    await expect(backToListButton(page)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(backToListButton(page)).toBeVisible();
    await expect(neutralBackButton(page)).toHaveCount(0);
  });

  test('북마크에서 들어오면 "뒤로가기"이고, 북마크 창을 열어도 그대로다', async ({ page }) => {
    await mockBookmarkFolderPosts(page);
    await page.goto('/bookmark');
    // BookmarkPostList가 카드에 backSource: 'bookmark'를 실어 상세로 보낸다
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(neutralBackButton(page)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(neutralBackButton(page)).toBeVisible();
    await expect(backToListButton(page)).toHaveCount(0);
  });

  test('공유 링크로 바로 들어와 제목 링크를 누르면(같은 주소 REPLACE) 지금처럼 "뒤로가기"가 된다', async ({
    page,
  }) => {
    await page.goto(`/post/${mockPost.id}`);
    await expect(backToListButton(page)).toBeVisible();

    await page.getByRole('link', { name: mockPost.title }).click();

    // 교체로 "첫 진입" 표시가 사라져 useGoBack이 navigate(-1)로 동작하므로 중립 문구가 맞다
    await expect(neutralBackButton(page)).toBeVisible();
    await expect(backToListButton(page)).toHaveCount(0);
  });
});
