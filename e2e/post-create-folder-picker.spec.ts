import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

const TYPED_URL = 'https://example.com/typed';
const FOLDERS_PATH = '/api/bookmark/folders';

// 등록 폼의 북마크 폴더 선택 모달(PostCreateBookmarkFolderField)은 열림 상태를 같은 경로의
// 히스토리 엔트리로 둔다(useHistoryOverlay). 뒤로가기는 모달만 닫고, 같은 경로 안의 이동이라
// 이탈 확인(useUnsavedChangesGuard)도 뜨지 않는다.
test.describe('등록 폼 — 북마크 폴더 선택 모달 뒤로가기', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // /post/submit은 ProtectedLayout — 인증 판정에 필수
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
  });

  test('모달이 열린 채 뒤로가기를 누르면 모달만 닫히고, 입력·선택은 그대로다', async ({ page }) => {
    await page.goto('/post');
    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(TYPED_URL);

    await page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    // 가드(DOUBLE_CLICK_GUARD_MS)는 클릭 자체를 삼키므로 관측 가능한 이벤트로 대체할 수 없다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: mockBookmarkFolder.name }).click();

    await page.goBack();
    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/post\/submit$/);
    await expect(page.getByLabel(/^URL/)).toHaveValue(TYPED_URL);
    // 선택한 폴더가 트리거 문구로 남아 있다
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    // 같은 경로 안의 이동이라 이탈 확인창이 뜨지 않는다
    await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toHaveCount(0);
  });

  test('화면에 들어올 때는 폴더 목록을 부르지 않고, 필드에 마우스를 올리면 미리 불러와 열 때 바로 보인다', async ({
    page,
  }) => {
    const folderRequests: string[] = [];
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === FOLDERS_PATH) {
        folderRequests.push(req.url());
      }
    });

    await page.goto('/post/submit');
    const trigger = page.getByRole('button', { name: TEXTS.post.form.create.bookmarkNone });
    await expect(trigger).toBeVisible();
    // 진입 시 미리 불러오기는 기각된 안이다(북마크를 안 쓰고 등록만 해도 매번 요청이 나간다)
    expect(folderRequests).toHaveLength(0);

    const prefetch = page.waitForResponse((res) => new URL(res.url()).pathname === FOLDERS_PATH);
    await trigger.hover();
    await prefetch;

    await trigger.click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: mockBookmarkFolder.name })
    ).toBeVisible();

    expect(folderRequests).toHaveLength(1);
  });
});
