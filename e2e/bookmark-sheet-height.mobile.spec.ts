import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { BookmarkFolderListResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// 폴더가 많을 때 북마크 폴더 창이 화면을 넘던 문제(2026-11-03, docs/BOOKMARK.md §5 "창 높이")의 회귀 검사.
// 목록에만 높이 상한이 있어 글 등록 폼(제목 설명·"북마크 안 함"·확인이 더 붙음)은 세로에서 위가 잘렸고, 가로로 돌린
// 폰(폭 768px 이상 → 중앙 모달)은 제목·닫기·확인이 화면 밖으로 나갔다. 창 위치를 실제로 재서 화면 안에 있는지 본다.
const folderList: BookmarkFolderListResponse = {
  folders: Array.from({ length: 12 }, (_, i) => ({
    ...mockBookmarkFolder,
    id: `folder-${i}`,
    name: `폴더 ${i + 1}`,
    sortOrder: i,
  })),
  uncategorizedCount: 2,
};

const SCREENS = [
  { name: '세로', viewport: { width: 393, height: 727 }, maxRatio: 0.7 },
  { name: '가로', viewport: { width: 851, height: 393 }, maxRatio: 1 },
];

async function measureDialog(page: Page) {
  // 열린 직후 클릭 가드(useOpenClickGuard)와 열림 애니메이션(300ms)이 끝나기를 기다린다
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

  return page.evaluate(() => {
    const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();

    if (!rect) {
      throw new Error('dialog not found');
    }

    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewport: window.innerHeight,
    };
  });
}

for (const { name, viewport, maxRatio } of SCREENS) {
  test.describe(`북마크 폴더 창 높이 — ${name} ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await installCatchAll(page);
      await mockAuthRefresh(page);
      await mockAccountQuery(page);
      await mockCategoryOptions(page);
      await mockPostList(page);
      await page.route(
        (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
        (route) => route.fulfill({ json: wrapResponse(folderList) })
      );
    });

    test('카드 북마크 버튼의 창이 화면 안에 들어오고 제목·닫기가 보인다', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();

      const dialog = page.getByRole('dialog');
      const box = await measureDialog(page);

      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(box.viewport);
      expect(box.height).toBeLessThanOrEqual(box.viewport * maxRatio + 1);
      await expect(dialog.getByText(TEXTS.bookmark.folder.selectorTitle)).toBeInViewport({
        ratio: 1,
      });
      await expect(dialog.getByRole('button', { name: TEXTS.ariaLabels.close })).toBeInViewport({
        ratio: 1,
      });
    });

    test('글 등록 폼의 창이 화면 안에 들어오고 제목·확인이 보인다', async ({ page }) => {
      await page.goto('/post/submit');
      await page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone }).click();

      const dialog = page.getByRole('dialog');
      const box = await measureDialog(page);

      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(box.viewport);
      expect(box.height).toBeLessThanOrEqual(box.viewport * maxRatio + 1);
      await expect(dialog.getByText(TEXTS.bookmark.folder.selectorTitle)).toBeInViewport({
        ratio: 1,
      });
      await expect(dialog.getByRole('button', { name: TEXTS.buttons.confirm })).toBeInViewport({
        ratio: 1,
      });
    });
  });
}
