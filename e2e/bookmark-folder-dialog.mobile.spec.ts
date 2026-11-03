import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { sendCloseRequest } from './mocks/close-request';
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
    await mockPostList(page);
    await page.goto('/post');
    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await sendCloseRequest(page);

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

  test('새 폴더 입력 중 닫기 요청은 입력만 접고, 한 번 더 오면 창을 닫는다', async ({ page }) => {
    // 입력용 CloseWatcher는 "새 폴더 만들기" 탭 뒤에 만들어져 창 watcher와 다른 그룹이 된다 — 닫기 요청 하나가
    // 마지막 그룹(입력)만 닫는다(WHATWG close watcher, docs/BOOKMARK.md §5)
    await mockPostList(page);
    await page.goto('/post');
    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    await folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder).fill('읽을거리');
    await sendCloseRequest(page);

    await expect(folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder)).toBeHidden();
    // 창이 닫히는 중에도 닫힘 애니메이션 동안은 보이므로, 닫히기 시작하면 바로 바뀌는 data-state로 판별한다
    await expect(folderDialog).toHaveAttribute('data-state', 'open');
    await expect(
      folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create })
    ).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

    await sendCloseRequest(page);

    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('새 폴더를 만드는 중에 온 닫기 요청은 입력을 접지 않는다', async ({ page }) => {
    // 생성 요청 중엔 취소 버튼도 비활성이다 — 접어도 요청은 계속 가서 성공하면 폴더가 만들어지고 선택된다.
    // 생성(POST)은 목록 조회(GET)와 경로가 같아 나중에 등록한 이 route가 먼저 받고, GET은 목록 목으로 넘긴다
    let releaseCreate = () => {};
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      async (route) => {
        if (route.request().method() !== 'POST') {
          return route.fallback();
        }

        await new Promise<void>((resolve) => {
          releaseCreate = resolve;
        });
        await route.fulfill({
          status: 500,
          json: { status: 500, message: 'server error', data: null, timestamp: '' },
        });
      }
    );
    await mockPostList(page);
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    const nameInput = folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
    await nameInput.fill('읽을거리');
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.createSubmit }).click();
    await expect(nameInput).toBeDisabled();

    await sendCloseRequest(page);

    await expect(folderDialog).toHaveAttribute('data-state', 'open');
    await expect(nameInput).toBeVisible();

    releaseCreate();

    // 실패하면 입력이 그대로 남아 다시 쓸 수 있다 — 닫기 요청에 입력이 접혔거나 창이 닫혔으면 여기서 실패한다
    await expect(nameInput).toBeEnabled();
    await expect(folderDialog).toHaveAttribute('data-state', 'open');
  });
});
