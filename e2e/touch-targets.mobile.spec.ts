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
// 데스크톱 마우스에서 원래 밀도가 그대로인지는 touch-targets.spec.ts가 본다. 북마크 페이지는 폰 세로(393px)
// 장면도 아래에서 따로 본다(docs/BOOKMARK.md §5 "터치 기기 버튼 44px").
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

// 아이콘만 있는 버튼은 폭도 좁아지기 쉬워 가로·세로 둘 다 본다
async function expectIconTouchTargets(buttons: Locator) {
  await expect(buttons.first()).toBeVisible();

  for (const button of await buttons.all()) {
    await expect
      .poll(async () => {
        const box = await button.boundingBox();

        return Math.min(box?.width ?? 0, box?.height ?? 0);
      })
      .toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
  }
}

// 새 폴더·이름 바꾸기 입력 옆의 [취소][생성/저장] — 게시글 카드의 "북마크 저장"과 섞이지 않게 이름을 정확히 맞춘다
function formButtons(scope: Locator, submitName: string) {
  return scope
    .getByRole('button', { name: TEXTS.buttons.cancel, exact: true })
    .or(scope.getByRole('button', { name: submitName, exact: true }));
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

  test('북마크 사이드바 행·⋮·새 폴더 만들기와 제목 연필·정렬이 44px 이상이다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);

    // 800은 md 이상이라 사이드바(FolderTree, <aside>) 배치다 — 전체·미분류·폴더 행·⋮·새 폴더 만들기.
    // 앱 사이드바(Sidebar.tsx)도 <aside>라 본문(main) 안의 것만 고른다
    const folderTree = page.locator('main aside');
    await expectTouchTargets(folderTree.getByRole('button'));
    await expectIconTouchTargets(
      folderTree.getByRole('button', { name: TEXTS.ariaLabels.folderMenu })
    );
    await expectIconTouchTargets(
      page.locator('main').getByRole('button', { name: TEXTS.bookmark.folder.rename })
    );
    await expectTouchTargets(
      page.getByRole('combobox', { name: TEXTS.ariaLabels.bookmarkSortSelect })
    );
  });

  test('북마크 사이드바·제목의 새 폴더·이름 바꾸기 버튼이 44px 이상이다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const aside = page.locator('main aside');

    await aside.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    await expectTouchTargets(formButtons(aside, TEXTS.bookmark.folder.createSubmit));
    await aside.getByRole('button', { name: TEXTS.buttons.cancel }).click();

    await aside.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();
    await expectTouchTargets(formButtons(aside, TEXTS.bookmark.folder.renameSubmit));
    await aside.getByRole('button', { name: TEXTS.buttons.cancel }).click();

    const main = page.locator('main');
    await main.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();
    await expectTouchTargets(formButtons(main, TEXTS.bookmark.folder.renameSubmit));
  });
});

// 폰 세로(BookmarkPage.tsx 모바일 분기) — 폴더 카드와 폴더 화면 헤더
test.describe('폰 세로 폭 — 북마크 페이지 버튼', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('폴더 카드 ⋮와 카드의 새 폴더·이름 바꾸기 버튼이 44px 이상이다', async ({ page }) => {
    await page.goto('/bookmark');
    const menuButton = page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu });
    await expectIconTouchTargets(menuButton);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.new }).click();
    await expectTouchTargets(formButtons(page.locator('main'), TEXTS.bookmark.folder.createSubmit));
    await page.getByRole('button', { name: TEXTS.buttons.cancel }).click();

    await menuButton.click();
    await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();
    await expectTouchTargets(formButtons(page.locator('main'), TEXTS.bookmark.folder.renameSubmit));
  });

  test('폴더 화면 헤더의 ←·연필·↕와 제목 편집 ✕ ✓가 44px 이상이다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const header = page.locator('main header');

    await expectIconTouchTargets(
      header.getByRole('button', { name: TEXTS.ariaLabels.backToFolderList })
    );
    await expectIconTouchTargets(
      header.getByRole('button', { name: TEXTS.bookmark.folder.rename })
    );
    await expectIconTouchTargets(header.getByRole('combobox'));

    await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();
    await expectIconTouchTargets(formButtons(header, TEXTS.bookmark.folder.renameSubmit));
  });
});
