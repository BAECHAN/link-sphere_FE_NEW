import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { sendCloseRequest } from './mocks/close-request';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import {
  mockBookmarkFolderList,
  mockBookmarkFolderPosts,
  mockBookmarkFolderRename,
} from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 모바일 북마크 페이지(BookmarkPage.tsx 모바일 분기)의 인라인 입력 — 새 폴더 카드, 폴더 카드 이름 바꾸기, 폴더 화면 제목
// 이름 바꾸기. Pixel 5는 CloseWatcher + 터치 주 입력이라 입력이 열린 동안 Android 뒤로가기가 입력만 접는다
// (useBackCloseRequest). 뒤로가기는 Playwright로 보낼 수 없어 같은 닫기 요청을 sendCloseRequest로 만든다.
// 고치기 전에는 이 페이지에 CloseWatcher가 없어 닫기 요청이 아무것도 하지 않았다(실제 기기에서는 페이지를 떠났다).
const NEW_NAME = '프론트엔드 자료';

// 폴더 생성·이름 저장 요청을 붙잡아 두는 동안 닫기 요청을 보낸다. 풀면 500으로 실패시켜 입력이 다시 열리게 한다
function holdUntilReleased() {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { released, release: () => release() };
}

const FAILURE = {
  status: 500,
  json: { status: 500, message: 'server error', data: null, timestamp: '' },
};

test.describe('모바일 북마크 페이지 — 입력 중 뒤로가기(닫기 요청)는 입력만 접는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
  });

  test('폴더 목록의 새 폴더 입력은 접히고, 주소와 히스토리는 그대로다', async ({ page }) => {
    await mockBookmarkFolderList(page);
    await page.goto('/bookmark');
    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.new }).click();
    const nameInput = page.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
    await nameInput.fill(NEW_NAME);

    await sendCloseRequest(page);

    await expect(nameInput).toBeHidden();
    await expect(page.getByRole('button', { name: TEXTS.bookmark.folder.new })).toBeVisible();
    await expect(page).toHaveURL(/\/bookmark$/);
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  });

  test('새 폴더를 만드는 중에 온 닫기 요청은 입력을 접지 않는다', async ({ page }) => {
    await mockBookmarkFolderList(page);
    const create = holdUntilReleased();
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      async (route) => {
        if (route.request().method() !== 'POST') {
          return route.fallback();
        }

        await create.released;
        await route.fulfill(FAILURE);
      }
    );
    await page.goto('/bookmark');

    await page.getByRole('button', { name: TEXTS.bookmark.folder.new }).click();
    const nameInput = page.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
    await nameInput.fill(NEW_NAME);
    await page.getByRole('button', { name: TEXTS.bookmark.folder.createSubmit }).click();
    await expect(nameInput).toBeDisabled();

    await sendCloseRequest(page);

    await expect(nameInput).toBeVisible();

    create.release();

    await expect(nameInput).toBeEnabled();
    await expect(nameInput).toHaveValue(NEW_NAME);
  });

  test('폴더 카드 이름 바꾸기는 원래 이름으로 돌아가고 저장 요청을 보내지 않는다', async ({
    page,
  }) => {
    const patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
    await page.goto('/bookmark');

    await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();
    const nameInput = page.getByRole('textbox');
    await expect(nameInput).toHaveValue(mockBookmarkFolder.name);
    await nameInput.fill(NEW_NAME);

    await sendCloseRequest(page);

    await expect(nameInput).toBeHidden();
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    await expect(page).toHaveURL(/\/bookmark$/);
    expect(patchBodies).toEqual([]);
  });

  test('폴더 화면 제목 이름 바꾸기는 원래 이름으로 돌아가고 폴더 화면에 남는다', async ({
    page,
  }) => {
    const patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const historyLength = await page.evaluate(() => window.history.length);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();
    const nameInput = page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await nameInput.fill(NEW_NAME);

    await sendCloseRequest(page);

    await expect(nameInput).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`folder=${mockBookmarkFolder.id}`));
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
    expect(patchBodies).toEqual([]);
  });

  test('이름을 저장하는 중에 온 닫기 요청은 입력을 접지 않는다', async ({ page }) => {
    await mockBookmarkFolderList(page);
    const rename = holdUntilReleased();
    // 폴더 게시글(/folders/:key/posts)과 겹치지 않게 끝을 막는다(mockBookmarkFolderRename과 같은 매칭)
    await page.route(
      (url) => /^\/api\/bookmark\/folders\/[^/]+$/.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'PATCH') {
          return route.fallback();
        }

        await rename.released;
        await route.fulfill(FAILURE);
      }
    );
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();
    const nameInput = page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await nameInput.fill(NEW_NAME);
    await nameInput.press('Enter');
    await expect(nameInput).toBeDisabled();

    await sendCloseRequest(page);

    await expect(nameInput).toBeVisible();

    rename.release();

    // 실패하면 입력은 열린 채 원래 이름으로 돌아간다(useRenameBookmarkFolder의 기존 동작)
    await expect(nameInput).toBeEnabled();
    await expect(nameInput).toHaveValue(mockBookmarkFolder.name);
  });
});
