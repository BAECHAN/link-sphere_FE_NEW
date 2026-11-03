import { expect, type Page } from '@playwright/test';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type {
  BookmarkFolder,
  BookmarkFoldersResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import type { Post } from '@/entities/post/model/post.schema';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

// 북마크 페이지 "폴더에서 빼기" 장면 — 글 하나가 폴더 둘(A·B)에 들어 있고 A의 글 목록을 본다.
// 시트에서 A 행을 누르면 낙관적 갱신이 A 목록에서 카드를 바로 뺀다(useRemoveBookmarkFolderMutation).
// B에도 남아 있어 마지막 폴더가 아니므로 북마크 자체는 지우지 않는다.
export const removeSceneFolder = mockBookmarkFolder;
const otherFolder: BookmarkFolder = {
  id: 'folder-uuid-2',
  name: '디자인',
  sortOrder: 1,
  bookmarkCount: 1,
};
export const removeScenePost: Post = {
  ...mockPost,
  userInteractions: {
    ...mockPost.userInteractions,
    isBookmarked: true,
    bookmarkFolderIds: [removeSceneFolder.id, otherFolder.id],
  },
};

// 응답을 늦춰 "카드는 빠졌고 시트는 열려 있는" 순간을 관측한다
const REMOVE_RESPONSE_DELAY_MS = 500;

/**
 * 위 장면의 API 목. fail이면 DELETE가 500으로 실패하고, 롤백 재조회(postsRoot 무효화)가 카드를 되돌린다.
 * 성공하면 A 목록 재조회가 빈 목록을 받는다.
 */
export async function mockRemoveFromFolderScene(page: Page, { fail }: { fail: boolean }) {
  let removed = false;

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
    (route) =>
      route.fulfill({
        json: wrapResponse({
          folders: [{ ...removeSceneFolder, bookmarkCount: removed ? 0 : 1 }, otherFolder],
          uncategorizedCount: 0,
        }),
      })
  );
  await page.route(
    (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
    (route) => {
      const content =
        removed && route.request().url().includes(`/folders/${removeSceneFolder.id}/`)
          ? []
          : [removeScenePost];

      return route.fulfill({
        json: wrapResponse({
          page: 0,
          size: 10,
          content,
          totalElements: content.length,
          totalPages: 1,
          last: true,
        }),
      });
    }
  );
  await page.route(
    (url) =>
      isApiPath(url, ENDPOINTS.bookmark.postFolder(removeScenePost.id, removeSceneFolder.id)),
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, REMOVE_RESPONSE_DELAY_MS));

      if (fail) {
        return route.fulfill({
          status: 500,
          json: { status: 500, message: 'server error', data: null, timestamp: '' },
        });
      }

      removed = true;
      const data: BookmarkFoldersResponse = {
        postId: removeScenePost.id,
        isBookmarked: true,
        folderIds: [otherFolder.id],
      };

      return route.fulfill({ json: wrapResponse(data) });
    }
  );
}

/**
 * 카드 제목. 시트가 열린 동안 Radix가 배경을 aria-hidden으로 감춰 getByRole로는 카드가 있어도 못 찾으므로
 * 텍스트로 찾는다 - getByRole로 "빠졌다"를 단정하면 카드가 남아 있어도 통과한다.
 */
export function cardTitle(page: Page) {
  return page.getByText(removeScenePost.title, { exact: true });
}

/** A 폴더 글 목록에서 카드의 북마크 버튼으로 시트를 연다. 폴더 행이 그려질 때까지 기다린다 */
export async function openSheetOnFolderPage(page: Page) {
  await page.goto(`/bookmark?folder=${removeSceneFolder.id}`);
  await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkChange }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: removeSceneFolder.name })).toBeVisible();
  // 모달이 뜬 직후 DOUBLE_CLICK_GUARD_MS 동안의 클릭은 더블클릭 관통으로 보고 무시한다(useOpenClickGuard) -
  // 관측할 이벤트가 없어 시간으로 기다린다(e2e/bookmark.spec.ts와 같은 예외)
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

  return dialog;
}

/**
 * 지금 떠 있는 시트(role=dialog)의 이후 수명을 기록한다 — data-state 변화(open·closed), DOM에서 빠짐(removed),
 * 새로 들어옴(added). 닫힘 애니메이션을 거쳤는지(closed 뒤 removed), 다시 마운트됐는지(added)를 본다.
 * 시트가 카드 안에 있던 때는 카드가 빠지는 순간 closed 없이 removed가 찍혔다.
 */
export async function recordDialogLifecycle(page: Page) {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __dialogLog: string[] }).__dialogLog = log;

    const containsDialog = (node: Node) =>
      node instanceof Element &&
      (node.matches('[role="dialog"]') || node.querySelector('[role="dialog"]') !== null);

    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') {
          const target = record.target as Element;

          if (target.matches('[role="dialog"]')) {
            log.push(target.getAttribute('data-state') ?? '');
          }

          continue;
        }

        record.addedNodes.forEach((node) => {
          if (containsDialog(node)) {
            log.push('added');
          }
        });
        record.removedNodes.forEach((node) => {
          if (containsDialog(node)) {
            log.push('removed');
          }
        });
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
  });

  return () => page.evaluate(() => (window as unknown as { __dialogLog: string[] }).__dialogLog);
}
