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

// FolderTree 행의 hover 배경(hover-or-open, globals.css)도 PostCard와 같은 이유로
// ⋮ 드롭다운이 열려 있는 동안 유지돼야 한다 — DropdownMenuContent가 Portal로 렌더돼
// 커서가 메뉴로 들어가면 행은 더 이상 :hover 상태가 아니다.
test.describe('북마크 폴더 행 hover 유지 — 드롭다운이 열려 있는 동안', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => route.fulfill({ json: wrapResponse(mockBookmarkFolderListResponse) })
    );
  });

  test('⋮ 메뉴를 열고 커서를 메뉴 항목으로 옮겨도 행 배경이 유지된다', async ({ page }) => {
    await page.goto('/bookmark');
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();

    const menuButton = page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu });
    // FolderTree의 DropdownMenu는 modal(기본값, PostCard의 modal={false}와 다름)이라 열려
    // 있는 동안 Radix가 배경 콘텐츠에 aria-hidden을 건다(포커스 트랩) — getByRole 기반
    // locator는 접근성 트리를 보므로 이때 행을 못 찾는다(실측: DOM엔 그대로 있는데
    // getByRole 매치만 0으로 떨어짐). role에 기대지 않는 CSS locator로 행을 찾는다.
    // FolderTree.tsx의 행 래퍼 div만 group + hover-or-open 클래스를 가진다.
    const row = page.locator('div.group', { hasText: mockBookmarkFolder.name });

    // 배경색 토큰 값은 테마에 따라 달라질 수 있으므로 절대값 대신 "hover 전 대비 변화"만 본다.
    const baseColor = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    await expect(async () => {
      const hovered = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(hovered).not.toBe(baseColor);
    }).toPass();

    await menuButton.click();
    const menuItem = page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename });
    await expect(menuItem).toBeVisible();
    await menuItem.hover();

    // 커서가 행 DOM 밖(Portal)에 있어도 hover-or-open이 aria-expanded=true를 보고
    // hover:bg-accent를 유지해야 한다 — base(hover 전) 배경과 달라야 한다.
    const hoveredColor = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hoveredColor).not.toBe(baseColor);
  });
});
