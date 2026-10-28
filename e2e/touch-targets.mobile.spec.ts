import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 태블릿을 세로로 들면(갤럭시 탭 S6 Lite 세로 약 800px) 폭은 md 이상이라 데스크톱 배치지만 입력은 터치다.
// 넓힌 터치 타깃은 폭이 아니라 주 입력이 마우스일 때만 되돌리고(md:pointer-fine:min-h-0), hover로만
// 드러나던 폴더 ⋮는 hover가 없는 터치에서 항상 보인다(responsive-ux skill "터치 타깃"·"hover와 밀도").
// 데스크톱 마우스에서 원래 밀도가 그대로인지는 touch-targets.spec.ts가 본다.
test.use({ viewport: { width: 800, height: 1280 } });

const TOUCH_TARGET_MIN = 44;

// Button의 transition-all과 다이얼로그 열림 애니메이션(zoom-in) 동안은 크기가 작게 잡혀 기다렸다 잰다
async function expectTouchTargets(buttons: Locator) {
  // all()은 그려지기를 기다리지 않는다
  await expect(buttons.first()).toBeVisible();

  for (const button of await buttons.all()) {
    await expect
      .poll(async () => (await button.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
  }
}

test.describe('태블릿 세로 폭 — 터치 타깃과 hover 메뉴', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, [mockComment]);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('북마크 사이드바의 폴더 ⋮ 메뉴가 hover 없이도 보인다', async ({ page }) => {
    await page.goto('/bookmark');

    // 이 스펙의 전제 - 에뮬레이션이 터치를 주 입력으로 보고해야 아래 단언이 의미가 있다
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);

    // 800은 md 이상이라 모바일 폴더 카드가 아니라 사이드바(FolderTree, <aside>)의 행이다
    const menuButton = page
      .locator('aside')
      .getByRole('button', { name: TEXTS.ariaLabels.folderMenu });
    await expect(menuButton).toBeVisible();
    // toBeVisible은 opacity를 보지 않는다
    await expect(menuButton).toHaveCSS('opacity', '1');
  });

  test('댓글의 좋아요·답글·수정·삭제 버튼이 44px 이상이다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);

    const replyButton = page.getByRole('button', { name: TEXTS.comment.item.reply });
    await expect(replyButton).toBeVisible();

    // 행동 버튼들은 한 줄(div)의 형제다
    const actionButtons = replyButton.locator('..').getByRole('button');
    await expect(actionButtons).toHaveCount(4);
    await expectTouchTargets(actionButtons);
  });

  test('글 등록 폼의 폴더 칸과 폴더 선택 창의 행이 44px 이상이다', async ({ page }) => {
    await page.goto('/post/submit');

    const folderField = page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone });
    await expectTouchTargets(folderField);

    await folderField.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectTouchTargets(dialog.getByRole('button', { name: mockBookmarkFolder.name }));
  });
});
