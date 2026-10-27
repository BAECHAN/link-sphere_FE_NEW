import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { PostListResponse } from '@/entities/post/model/post.schema';
import { TEXTS } from '@/shared/config/texts';

function postList(count: number): PostListResponse {
  return {
    page: 0,
    size: count,
    content: Array.from({ length: count }, (_, i) => ({
      ...mockPost,
      id: `post-uuid-${i}`,
      title: `Bookmarked post ${i}`,
    })),
    totalElements: count,
    totalPages: 1,
    last: true,
  };
}

async function mockBookmarkPage(page: Page, postCount: number): Promise<void> {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockAccountQuery(page);

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
    (route) => route.fulfill({ json: wrapResponse(mockBookmarkFolderListResponse) })
  );
  // 데스크톱 기본값 'all' 등 folderKey가 pathname에 끼어 있어 정규식으로 잡는다
  // (mockBookmarkFolderPosts와 같은 매칭, 응답 글 수만 다르다)
  await page.route(
    (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(postList(postCount)) })
  );
}

// 사이드바(sticky)는 바깥 줄 안에서만 붙어 있을 수 있다. 바깥 줄이 AppLayout의 아래 여백 위에서
// 끝나면 맨 아래까지 내렸을 때 48px 밀려 "전체" 행이 상단바 뒤로 들어갔다(docs/BOOKMARK.md §10).
// 글이 적으면 48px만 내려도 맨 아래라 바로 보였고, 글이 많아도 끝까지 내리면 같았다.
test.describe('북마크 사이드바 — 맨 아래까지 내려도 "전체" 행이 상단바에 가리지 않는다', () => {
  for (const [label, postCount] of [
    ['글 1개', 1],
    ['글 30개', 30],
  ] as const) {
    test(label, async ({ page }) => {
      await mockBookmarkPage(page, postCount);
      await page.goto('/bookmark');

      const allRow = page
        .getByRole('main', { name: TEXTS.ariaLabels.mainContent })
        .getByRole('button', { name: TEXTS.bookmark.folder.all, exact: true });
      await expect(allRow).toBeVisible();
      await expect(page.getByText('Bookmarked post 0')).toBeVisible();

      // 행 윗부분 바로 안쪽 점에 그 행이 그려져 있어야 한다 — 상단바가 덮으면 상단바 요소가 나온다.
      // 목록이 길면 가상화로 높이가 늦게 정해질 수 있어 매번 끝까지 다시 내린다.
      await expect(async () => {
        await page.evaluate(() =>
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
        );
        const box = await allRow.boundingBox();
        expect(box).not.toBeNull();

        const isOnTop = await allRow.evaluate(
          (el, point) => el.contains(document.elementFromPoint(point.x, point.y)),
          { x: box!.x + box!.width / 2, y: box!.y + 1 }
        );
        expect(isOnTop).toBe(true);
      }).toPass({ timeout: 3000 });
    });
  }
});
