import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail, mockPostListPaged } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// Pixel 5 에뮬레이션은 터치가 주 입력이고 CloseWatcher가 있어, 북마크 폴더 모달이 히스토리 없이 열리는
// 경로(useBackClosableOverlay)를 탄다. Android 뒤로가기는 Playwright로 보낼 수 없어(page.goBack()은 닫기
// 요청이 아니라 히스토리 이동이다) 같은 닫기 요청을 취소되지 않은 Esc로 만들어 확인한다.
// 데스크톱(히스토리 경로)은 bookmark-folder-dialog.spec.ts가 다룬다.
test.describe('모바일(터치) — 북마크 폴더 모달은 히스토리 없이 열린다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockBookmarkFolderList(page);
  });

  test('이 기기는 뒤로가기가 닫기 요청으로 오는 조건(CloseWatcher + 터치 주 입력)을 만족한다', async ({
    page,
  }) => {
    // 아래 테스트들의 전제 — 에뮬레이션이 바뀌어 이 조건이 깨지면 히스토리 경로를 검사하게 된다
    await mockPostList(page);
    await page.goto('/post');

    // e2e tsconfig는 src/types의 CloseWatcher 선언을 포함하지 않아 이름으로만 확인한다
    const device = await page.evaluate(() => ({
      closeWatcher: 'CloseWatcher' in window,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    }));

    expect(device).toEqual({ closeWatcher: true, coarsePointer: true });
  });

  test('폴더 창을 열어도 히스토리가 쌓이지 않고, X로 닫은 뒤 뒤로가기 한 번이면 이전 페이지로 간다', async ({
    page,
  }) => {
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { name: mockPost.title })).toBeVisible();

    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.ariaLabels.close }).click();
    await expect(folderDialog).not.toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('가로로 돌려 열 수가 바뀌고 카드가 다시 마운트돼도 폴더 창은 열린 채로 남는다', async ({
    page,
  }) => {
    // 행 키가 `${열 수}:${첫 카드 id}`라(useWindowGridVirtualizer.ts) 열 수가 바뀌면 카드가 다시 마운트된다.
    // 열림 상태를 카드 안에 두면 이때 창이 닫힌다 — 히스토리 경로(엔트리에 열림이 있음)와 같게 유지돼야 한다
    await mockPostListPaged(page, { total: 6 });
    await page.goto('/post');
    const grid = page.locator('[style*="grid-template-columns"]').first();
    await expect(grid).toHaveAttribute('style', /repeat\(1,/);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.setViewportSize({ width: 851, height: 393 });
    await expect(grid).toHaveAttribute('style', /repeat\(2,/);
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.ariaLabels.close }).click();
    await expect(folderDialog).not.toBeVisible();
  });

  test('닫기 요청이 오면 창만 닫히고 히스토리와 주소는 그대로다', async ({ page }) => {
    // Android 뒤로가기는 보낼 수 없어 같은 닫기 요청을 Esc로 만든다 — window 캡처 단계에서 전파만 끊어
    // Radix(document 캡처)에 닿지 않게 하면, 취소되지 않은 Esc를 Chromium이 닫기 요청으로 CloseWatcher에 보낸다
    await mockPostList(page);
    await page.goto('/post');
    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.evaluate(() => {
      window.addEventListener('keydown', (event) => event.stopImmediatePropagation(), {
        capture: true,
        once: true,
      });
    });
    await page.keyboard.press('Escape');

    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  });

  test('새 폴더 입력 중 ESC는 입력만 접고, ESC가 CloseWatcher에 닫기 요청으로 한 번 더 가지 않는다', async ({
    page,
  }) => {
    // Chromium은 취소되지 않은 Esc keydown을 닫기 요청으로도 보낸다(WHATWG close requests). 입력을 접는
    // onEscapeKeyDown과 Radix의 dismiss가 preventDefault를 부르므로 닫기 요청은 생기지 않아야 한다 —
    // 생기면 watcher.onclose가 입력만 접어야 할 ESC에 창까지 닫는다
    await mockPostList(page);
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    await folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder).fill('읽을거리');
    await page.keyboard.press('Escape');

    await expect(folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder)).toBeHidden();
    await expect(
      folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create })
    ).toBeVisible();
    await expect(folderDialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(folderDialog).not.toBeVisible();
  });
});
