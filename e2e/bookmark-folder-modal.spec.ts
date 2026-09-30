import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

const FOLDERS_PATH = '/api/bookmark/folders';

// 북마크 폴더 선택 모달(BookmarkPostButton → PostCardBookmarkFolderModal)의 열림·닫힘 동작.
// 저장 흐름 자체는 bookmark.spec.ts가 다룬다.
test.describe('로그인 상태 — 북마크 폴더 모달 열림·닫힘', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
    await mockBookmarkFolderList(page);
  });

  test('열린 직후 바깥 클릭으로는 닫히지 않는다 — <Dialog open={false}>로 미리 마운트된 모달에서도 가드가 열린 시점부터 잰다', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();

    // 오버레이(화면 좌상단) 클릭 — 가드 시간 안이라 무시돼야 한다. 가드는 클릭을 삼킬
    // 뿐이라 관측 가능한 이벤트가 없어 시간 대기로 확인한다(bookmark.spec.ts와 같은 예외).
    await page.mouse.click(5, 5);
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await expect(folderModal).toBeVisible();

    // 가드 시간이 지난 뒤의 바깥 클릭은 평소처럼 닫는다
    await page.mouse.click(5, 5);
    await expect(folderModal).not.toBeVisible();
  });

  test('모달이 열린 채 뒤로가기를 누르면 페이지는 그대로 두고 모달만 닫힌다', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();
    await expect(
      folderModal.getByRole('heading', { name: TEXTS.bookmark.folder.selectorTitle })
    ).toBeVisible();

    await page.goBack();
    await expect(folderModal).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    // 한 번 더 누르면 그때 이전 페이지(목록)로 간다
    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('X로 닫아도 페이지는 그대로이고, 이어서 뒤로가기하면 이전 페이지로 간다', async ({
    page,
  }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await folderModal.getByRole('button', { name: TEXTS.ariaLabels.close }).click();
    await expect(folderModal).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('북마크 버튼에 마우스를 올리면 폴더 목록을 미리 불러와, 열 때 추가 요청 없이 바로 보인다', async ({
    page,
  }) => {
    const folderRequests: string[] = [];
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === FOLDERS_PATH) {
        folderRequests.push(req.url());
      }
    });

    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    const prefetch = page.waitForResponse((res) => new URL(res.url()).pathname === FOLDERS_PATH);
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).hover();
    await prefetch;

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: mockBookmarkFolder.name })
    ).toBeVisible();

    expect(folderRequests).toHaveLength(1);
  });
});
