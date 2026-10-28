import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts, mockBookmarkFolderRename } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { UpdateBookmarkFolderRequest } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';

// 14자 — 폴더 화면 제목에서 두 줄로 보이는 이름
const LONG_NAME = '자바스크립트 심화 학습 자료';
const LONG_FOLDER = { ...mockBookmarkFolder, name: LONG_NAME };
const NEW_NAME = '프론트엔드 자료';

// 모바일 폴더 화면(BookmarkPage.tsx 모바일 분기)은 mobile-chrome 프로젝트에서만 그려진다
test.describe('모바일 — 폴더 화면 제목에서 이름 바꾸기', () => {
  let patchBodies: UpdateBookmarkFolderRequest[] = [];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    patchBodies = await mockBookmarkFolderRename(page, [LONG_FOLDER]);
  });

  test('연필로 연 입력에 긴 이름이 잘리지 않고 다 보이고, Enter로 저장하면 제목이 바뀐다', async ({
    page,
  }) => {
    await page.goto(`/bookmark?folder=${LONG_FOLDER.id}`);
    await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

    const input = page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await expect(input).toHaveValue(LONG_NAME);
    // 모바일은 칸이 좁아 제목 글꼴(20px 굵게)로는 앞이 잘려, 카드와 같은 기본 입력 크기를 쓴다(docs/BOOKMARK.md §5)
    expect(await input.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    await input.fill(NEW_NAME);
    await input.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });
});
