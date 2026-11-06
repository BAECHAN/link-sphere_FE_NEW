import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

// touch-targets.mobile.spec.ts와 짝이다 — 터치 기기에서 넓힌 타깃이 마우스 데스크톱에서는
// 원래 밀도로 돌아가는지(md:pointer-fine:min-h-0) 본다.
test.describe('데스크톱 마우스 — 터치 타깃을 넓히지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostDetail(page);
    await mockComments(page, [mockComment]);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('댓글의 행동 버튼은 44px로 넓어지지 않는다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);

    // 이 스펙의 전제 - 주 입력이 마우스여야 md:pointer-fine:이 적용된다
    expect(await page.evaluate(() => window.matchMedia('(pointer: fine)').matches)).toBe(true);

    const replyButton = page.getByRole('button', { name: TEXTS.comment.item.reply });
    await expect(replyButton).toBeVisible();

    const actionButtons = replyButton.locator('..').getByRole('button');
    await expect(actionButtons).toHaveCount(4);

    for (const button of await actionButtons.all()) {
      await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeLessThan(44);
    }
  });

  test('북마크 사이드바 행·⋮·제목 연필·정렬은 44px로 넓어지지 않는다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);

    // 앱 사이드바(Sidebar.tsx)도 <aside>라 본문(main) 안의 폴더 사이드바(FolderSidebar)만 고른다
    const targets = page
      .locator('main aside')
      .getByRole('button')
      .or(page.locator('main').getByRole('button', { name: TEXTS.bookmark.folder.rename }))
      .or(page.getByRole('combobox', { name: TEXTS.ariaLabels.bookmarkSortSelect }));
    await expect(targets.first()).toBeVisible();

    for (const target of await targets.all()) {
      await expect.poll(async () => (await target.boundingBox())?.height ?? 0).toBeLessThan(44);
    }
  });
});
