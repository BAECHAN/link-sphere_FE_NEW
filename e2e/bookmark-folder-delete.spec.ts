import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import {
  mockBookmarkFolder,
  mockBookmarkFolderListResponse,
} from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

test.describe('북마크 폴더 삭제', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    // /bookmark는 mockCategoryOptions/mockPostList를 부르지 않는다(Post 페이지 전용).
    await mockBookmarkFolderPosts(page);

    let deleted = false;
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) =>
        route.fulfill({
          json: wrapResponse(
            deleted ? { folders: [], uncategorizedCount: 1 } : mockBookmarkFolderListResponse
          ),
        })
    );
    // reorder(PATCH /bookmark/folders/reorder)와 정규식이 겹치므로 method 가드를 둔다 —
    // 이 스펙에선 안 쓰지만 미래에 조용히 잘못 매칭되지 않게.
    await page.route(
      (url) => /^\/api\/bookmark\/folders\/[^/]+$/.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'DELETE') {
          return route.fallback();
        }
        // 삭제가 in-flight인 동안 URL을 관측해야 onBeforeDelete를 증명할 수 있다.
        await new Promise((resolve) => setTimeout(resolve, 800));
        deleted = true;
        return route.fulfill({ status: 204 });
      }
    );
  });

  test('선택 중인 폴더를 삭제하면 DELETE 이전에 전체로 옮겨 가고, 죽은 폴더는 재조회되지 않는다', async ({
    page,
  }) => {
    await page.goto('/bookmark');
    await expect(
      page.getByRole('heading', { level: 1, name: TEXTS.bookmark.folder.all })
    ).toBeVisible();

    // 선택 상태를 먼저 만든다 — useFolderTree.ts의 onBeforeDelete는 selected일 때만
    // 동작한다. 이 클릭 없이는 검증 대상 분기를 안 타고도 테스트가 통과해버린다.
    await page.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(page).toHaveURL(new RegExp(`folder=${mockBookmarkFolder.id}`));
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();

    let folderPostsCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === `/api/bookmark/folders/${mockBookmarkFolder.id}/posts`) {
        folderPostsCount += 1;
      }
    });
    const beforeDeleteCount = folderPostsCount;

    await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.delete }).click();
    // FolderTree의 DropdownMenu는 기본 modal(PostCard는 modal={false})이라 PostCard와
    // 달리, confirm dialog를 만지기 전에 드롭다운이 완전히 닫힌 걸 먼저 확인한다.
    await expect(page.getByRole('menu')).toHaveCount(0);

    const confirmDialog = page.getByRole('dialog', {
      name: TEXTS.bookmark.folder.deleteConfirmTitle(mockBookmarkFolder.name),
    });
    await expect(confirmDialog).toBeVisible();

    const deleteReq = page.waitForRequest(
      (req) =>
        /^\/api\/bookmark\/folders\/[^/]+$/.test(new URL(req.url()).pathname) &&
        req.method() === 'DELETE'
    );
    const deleteRes = page.waitForResponse(
      (res) =>
        /^\/api\/bookmark\/folders\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    // DELETE는 나갔지만 응답은 아직 800ms 뒤다 — 이 시점에 이미 전체로 옮겨져 있다면
    // 폴더-missing 리다이렉트(응답 이후에만 발생)가 원인일 수 없고, onBeforeDelete가
    // DELETE보다 먼저 URL을 옮겼다는 것만이 유일한 설명이다.
    await deleteReq;
    await expect(page).toHaveURL(/\/bookmark$/);
    await expect(
      page.getByRole('heading', { level: 1, name: TEXTS.bookmark.folder.all })
    ).toBeVisible();

    await deleteRes;
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu })).toHaveCount(0);
    // 언마운트된(죽은) 폴더의 게시글 쿼리는 stale 마킹만 되고 재조회되지 않는다.
    expect(folderPostsCount).toBe(beforeDeleteCount);
    // Alert가 location.key 변경으로 자동 취소됐는지도 확인한다.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
