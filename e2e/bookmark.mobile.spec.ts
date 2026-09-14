import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

// BookmarkPage.tsx의 모바일 분기(MobileFolderList drill-down)는 데스크톱 뷰포트에서
// 전혀 렌더되지 않는 화면이라 mobile-chrome 프로젝트(playwright.config.ts)에서만 돈다.
test.describe('모바일 — 북마크 폴더 drill-down', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('모바일에서 /bookmark에 들어가면 폴더 목록이 먼저 뜨고, 폴더를 고르면 그 폴더의 글 목록으로 전환된다', async ({
    page,
  }) => {
    await page.goto('/bookmark');

    // ?folder가 없으면 MobileFolderList(폴더 목록) 모드 — 데스크톱 FolderTree와 달리
    // 페이지 제목이 "북마크"(pageTitle)다.
    await expect(
      page.getByRole('heading', { level: 1, name: TEXTS.bookmark.folder.pageTitle })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();

    const folderPostsRequest = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === `/api/bookmark/folders/${mockBookmarkFolder.id}/posts`
    );
    await page.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await folderPostsRequest;

    await expect(page).toHaveURL(new RegExp(`folder=${mockBookmarkFolder.id}`));
    // 게시글 모드로 전환되면 h1이 폴더명으로 바뀐다(BookmarkPage.tsx의 currentFolderName).
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();
  });

  test('폴더 목록으로 돌아가는 뒤로가기가 폴더 선택만 취소하고 페이지를 벗어나지 않는다', async ({
    page,
  }) => {
    await page.goto('/bookmark');
    await page.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(page).toHaveURL(new RegExp(`folder=${mockBookmarkFolder.id}`));

    // setFolderKey가 PUSH(replace:false)라 브라우저 뒤로가기 한 번으로 폴더 선택 이전
    // 상태(엔트리)로 돌아간다 — 페이지 자체(/bookmark)를 벗어나지는 않는다.
    await page.goBack();

    await expect(page).toHaveURL(/\/bookmark$/);
    await expect(
      page.getByRole('heading', { level: 1, name: TEXTS.bookmark.folder.pageTitle })
    ).toBeVisible();
  });
});
