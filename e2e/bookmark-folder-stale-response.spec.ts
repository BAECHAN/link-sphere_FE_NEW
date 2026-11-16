import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import {
  mockRemoveFromFolderScene,
  openSheetOnFolderPage,
  removeSceneFolder,
  removeScenePost,
} from './mocks/bookmark-folder-remove-scene';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// 폴더 행을 누르고 응답을 기다리는 동안 뒤로가기로 창을 닫은 경우(#513). 응답 뒤 핸들러가 창을 닫으려 해도
// ① 이미 닫힌 창이면 뒤로가기를 한 번 더 보내 페이지를 떠나지 않고(useBackClosableOverlay.ts의 close 가드)
// ② 그 사이 다시 연 창이면 닫지 않는다(usePostCardBookmarkFolderDialog.ts의 closeIfStillOn)
// 응답을 늦춰 뒤로가기·다시 열기가 응답보다 먼저 일어나게 한다
const SLOW_RESPONSE_MS = 2_000;

test.describe('북마크 폴더 창 — 응답 전에 뒤로가기로 닫은 뒤 늦게 온 응답', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
  });

  test('이미 닫힌 창이면 응답 뒤에도 페이지를 떠나지 않는다', async ({ page }) => {
    await mockRemoveFromFolderScene(page, { fail: false });
    // 나중에 등록한 route가 먼저 맞는다(LIFO) - 장면의 응답을 더 늦춘 뒤 장면 핸들러로 넘긴다
    await page.route(
      (url) =>
        isApiPath(url, ENDPOINTS.bookmark.postFolder(removeScenePost.id, removeSceneFolder.id)),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_MS));
        await route.fallback();
      }
    );

    // 앞 칸을 둬야 뒤로가기가 한 번 더 나갔을 때 실제로 다른 페이지로 간다
    await page.goto('/post');
    const dialog = await openSheetOnFolderPage(page);
    const folderUrl = page.url();
    const response = page.waitForResponse((res) =>
      isApiPath(
        new URL(res.url()),
        ENDPOINTS.bookmark.postFolder(removeScenePost.id, removeSceneFolder.id)
      )
    );

    await dialog.getByRole('button', { name: removeSceneFolder.name }).click();
    await page.goBack();
    await expect(dialog).toHaveCount(0);

    await response;
    // 응답 뒤 닫기는 같은 태스크 안에서 돌지 않는다 - 뒤로가기가 나갔다면 주소가 바뀔 시간을 준다
    await page.waitForTimeout(500);
    expect(page.url()).toBe(folderUrl);
  });

  test('그 사이 다시 연 창은 응답 뒤에도 닫히지 않는다', async ({ page }) => {
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, SLOW_RESPONSE_MS));
        await route.fulfill({
          json: wrapResponse({
            postId: mockPost.id,
            isBookmarked: true,
            folderIds: [mockBookmarkFolder.id],
          }),
        });
      }
    );

    await page.goto('/post');
    // 행을 누르면 낙관적 갱신으로 버튼 이름이 "저장"에서 "변경"으로 바뀐다
    const bookmarkButton = page.getByRole('button', {
      name: new RegExp(`^(${TEXTS.ariaLabels.bookmarkSave}|${TEXTS.ariaLabels.bookmarkChange})$`),
    });
    await bookmarkButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    // 모달이 뜬 직후의 클릭은 더블클릭 관통으로 보고 무시한다(useOpenClickGuard) - e2e/bookmark.spec.ts와 같은 예외
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    const response = page.waitForResponse((res) =>
      isApiPath(
        new URL(res.url()),
        ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)
      )
    );
    await dialog.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await page.goBack();
    await expect(dialog).toHaveCount(0);

    await bookmarkButton.click();
    await expect(dialog).toBeVisible();

    await response;
    // 토스트를 띄운 직후가 닫기를 부르던 자리다. 닫혔다면 닫힘 애니메이션이 끝나 사라질 시간을 준다
    await expect(
      page.getByText(TEXTS.messages.success.bookmarkSavedTo(mockBookmarkFolder.name))
    ).toBeVisible();
    await page.waitForTimeout(500);
    await expect(dialog).toBeVisible();
  });
});
