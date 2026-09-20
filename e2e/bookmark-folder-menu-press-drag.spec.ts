import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

/**
 * ⋮ 메뉴 트리거가 Radix onPointerDown에서 열리던 시절 재현하던 press-drag-release
 * 회귀. 트리거를 누른 채 손이 몇 px 움직이면 이미 열린 메뉴의 "이름 수정" 항목 위에서
 * pointerup이 발생해 그 항목에서 직접 누르지 않았어도 click이 강제 발동됐다
 * (react-menu의 MenuItem onPointerUp: `if (!isPointerDownRef.current) event.currentTarget?.click()`).
 * 원인 체인 전체는 docs/plans/2026-09-21-dropdown-trigger-click.md 참고.
 *
 * "이름 수정" 항목이 실제로 클릭된 적 있는지를 document 레벨 리스너로 직접 관찰한다 —
 * 다운스트림(rename → Input 마운트 → blur → 원복)은 이름이 그대로면 API 호출도 없어
 * 겉으로 드러나는 부수효과가 없으므로, 부수효과가 아니라 원인 메커니즘 자체를 검증한다.
 */
test.describe('북마크 폴더 ⋮ 메뉴 — press-drag-release', () => {
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

  test('⋮ 버튼을 누른 채 이름 수정 항목까지 손이 밀렸다 떼도 그 항목이 클릭되지 않는다', async ({
    page,
  }) => {
    await page.goto('/bookmark');
    await expect(
      page.getByRole('heading', { level: 1, name: TEXTS.bookmark.folder.all })
    ).toBeVisible();

    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu });

    // 트리거 좌표는 메뉴를 열기 전에 먼저 구한다 — FolderTree의 DropdownMenu는 modal이라
    // 열리면 MenuRootContentModal이 hideOthers()로 트리거를 포함한 나머지 트리 전체에
    // aria-hidden을 걸어(react-menu/dist/index.mjs) getByRole로 더 이상 찾을 수 없다.
    const triggerBox = await trigger.boundingBox();

    if (!triggerBox) {
      throw new Error('트리거의 bounding box를 가져오지 못했다');
    }

    // 1) 정상 클릭으로 한 번 열어 "이름 수정" 항목의 실제 좌표를 구한다 — sideOffset·padding
    // 값을 하드코딩해 추측하지 않고 실제 렌더 결과를 측정한다. 정상 클릭은 지금 구조에서도
    // (pointerdown이든 click이든) 항상 메뉴를 연다.
    await trigger.click();
    const renameItem = page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename });
    const renameBox = await renameItem.boundingBox();

    if (!renameBox) {
      throw new Error('메뉴 항목의 bounding box를 가져오지 못했다');
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // 2) "이름 수정" 항목이 실제로 클릭됐는지 document 레벨에서 직접 관찰한다.
    await page.evaluate(() => {
      (window as unknown as { __menuItemClicks: number }).__menuItemClicks = 0;
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        if (target.closest('[role="menuitem"]')) {
          (window as unknown as { __menuItemClicks: number }).__menuItemClicks += 1;
        }
      });
    });

    // 3) 트리거에서 누른 채, 방금 측정한 "이름 수정" 항목 중앙까지 손이 밀렸다 뗀다.
    const triggerX = triggerBox.x + triggerBox.width / 2;
    const triggerY = triggerBox.y + triggerBox.height / 2;
    const renameX = renameBox.x + renameBox.width / 2;
    const renameY = renameBox.y + renameBox.height / 2;

    await page.mouse.move(triggerX, triggerY);
    await page.mouse.down();
    await page.mouse.move(renameX, renameY, { steps: 8 });
    await page.mouse.up();

    const clickCount = await page.evaluate(
      () => (window as unknown as { __menuItemClicks: number }).__menuItemClicks
    );

    expect(clickCount).toBe(0);

    // 4) 이 시퀀스가 다른 걸 부수지 않았는지 — 정상 클릭으로 다시 열어보면 여전히 동작한다.
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename })).toBeVisible();
  });
});
