import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { POST_BOOKMARK_FOLDER_DIALOG_KEY } from '@/features/bookmark/toggle/hooks/postBookmarkFolderDialog.store';

const FOLDERS_PATH = '/api/bookmark/folders';

// 북마크 폴더 선택 모달(BookmarkPostButton이 열고 RootLayout 호스트가 그리는 PostCardBookmarkFolderDialog)의 열림·닫힘 동작.
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
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    // 오버레이(화면 좌상단) 클릭 — 가드 시간 안이라 무시돼야 한다. 가드는 클릭을 삼킬
    // 뿐이라 관측 가능한 이벤트가 없어 시간 대기로 확인한다(bookmark.spec.ts와 같은 예외).
    await page.mouse.click(5, 5);
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await expect(folderDialog).toBeVisible();

    // 가드 시간이 지난 뒤의 바깥 클릭은 평소처럼 닫는다
    await page.mouse.click(5, 5);
    await expect(folderDialog).not.toBeVisible();
  });

  test('모달이 열린 채 뒤로가기를 누르면 페이지는 그대로 두고 모달만 닫힌다', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // URL은 화면 전환보다 먼저 바뀐다 — lazy 상세 청크가 올 때까지 목록이 남아 있어, 바로 누르면
    // 목록 카드의 북마크 버튼을 누른다(docs/TESTING.md "자주 발생하는 문제" 13). 상세에만 있는
    // 버튼으로 전환 커밋을 기다린다.
    await expect(page.getByRole('button', { name: TEXTS.post.detail.backToList })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    await expect(
      folderDialog.getByRole('heading', { name: TEXTS.bookmark.folder.selectorTitle })
    ).toBeVisible();

    await page.goBack();
    await expect(folderDialog).not.toBeVisible();
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
    // 위 테스트와 같은 이유로 상세 전환 커밋을 기다린다
    await expect(page.getByRole('button', { name: TEXTS.post.detail.backToList })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await folderDialog.getByRole('button', { name: TEXTS.ariaLabels.close }).click();
    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('새 목록을 기다리는 동안 창을 열어도 보이던 카드가 그대로 남고, 창은 누른 필터의 주소 위에 열린다', async ({
    page,
  }) => {
    // 창의 열림은 라우터가 가 있는 위치에서 동기 우선순위로 읽는다(useBackClosableOverlay). 필터를 바꾸고 새 목록을
    // 기다리는 중(정지 구간)에 그 렌더가 끼어도, 보이던 목록이 로딩 골격으로 바뀌면 안 된다 - 같은 구독을
    // usePostListApplying(usePostList.ts)이 useSyncExternalStore로 읽지 않는 이유가 이 위험이다
    const isBookmarkedListRequest = (url: URL) =>
      isApiPath(url, ENDPOINTS.post.base) && url.searchParams.get('filter') === 'isBookmarked';
    let releaseList = () => {};
    await page.route(isBookmarkedListRequest, async (route) => {
      await new Promise<void>((resolve) => {
        releaseList = resolve;
      });
      await route.fulfill({ json: wrapResponse(mockPostListResponse) });
    });
    await page.goto('/post');
    const card = page.getByRole('link', { name: mockPost.title });
    await expect(card).toBeVisible();

    const listRequest = page.waitForRequest((req) => isBookmarkedListRequest(new URL(req.url())));
    await page
      .getByRole('group', { name: TEXTS.ariaLabels.postScopeFilters })
      .getByRole('button', { name: TEXTS.buttons.bookmarkOnly })
      .click();
    await listRequest;

    // 기다림이 길어지면 목록 위에 '적용 중' 덮개가 올라와 마우스로는 못 누른다 - 그 시간에 기대지 않도록 키보드로 연다
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).focus();
    await page.keyboard.press('Enter');

    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    // 아직 새 목록을 기다리는 중이고(덮개), 로딩 골격이 이전 카드를 가리지 않았다. 창이 열린 동안 배경은
    // aria-hidden이라 역할로 찾을 때 숨은 요소까지 본다 - 화면에 보이는지는 toBeVisible이 따로 확인한다
    await expect(page.getByText(TEXTS.post.search.applying)).toBeVisible();
    await expect(
      page.getByRole('link', { name: mockPost.title, includeHidden: true })
    ).toBeVisible();

    releaseList();

    await expect(page.getByText(TEXTS.post.search.applying)).toBeHidden();
    await expect(folderDialog).toBeVisible();

    // 창의 칸은 이전 주소가 아니라 누른 필터의 칸 위에 쌓였다 - 뒤로가기는 창만 닫고 필터는 남는다
    await page.goBack();
    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/filter=isBookmarked/);
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

// 한 줄 문구에 버튼이 달린 토스트(같은 줄 배치)는 좁은 화면에서 문구와 버튼이 한 줄에 안 들어가면 문구를 접지 않고
// 버튼을 다음 줄로 내린다 - 접힌 문구 옆 세로 가운데에 버튼이 끼지 않는다(shared/lib/toast/toast-layout.ts)
test.describe('로그인 상태 — 좁은 화면의 폴더 저장 토스트', () => {
  const LONG_NAME_FOLDER = { ...mockBookmarkFolder, name: '가나다라마바사아자차카타파하가' };

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) =>
        route.fulfill({
          json: wrapResponse({ folders: [LONG_NAME_FOLDER], uncategorizedCount: 0 }),
        })
    );
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, LONG_NAME_FOLDER.id)),
      (route) =>
        route.fulfill({
          json: wrapResponse({
            postId: mockPost.id,
            isBookmarked: true,
            folderIds: [LONG_NAME_FOLDER.id],
          }),
        })
    );
  });

  async function saveAndMeasureToast(page: Page) {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: LONG_NAME_FOLDER.name })).toBeVisible();
    // 모달이 뜬 직후의 클릭은 더블클릭 관통으로 보고 무시한다(useOpenClickGuard)
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await dialog.getByRole('button', { name: LONG_NAME_FOLDER.name }).click();

    const savedToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: TEXTS.messages.success.bookmarkSavedTo(LONG_NAME_FOLDER.name) });
    await expect(savedToast).toBeVisible();

    return savedToast.evaluate((toastElement) => {
      const title = toastElement.querySelector('[data-title]')!;
      const titleBox = title.getBoundingClientRect();
      const buttonBox = toastElement.querySelector('[data-button]')!.getBoundingClientRect();

      return {
        titleLines: Math.round(titleBox.height / parseFloat(getComputedStyle(title).lineHeight)),
        titleTop: titleBox.top,
        titleBottom: titleBox.bottom,
        buttonTop: buttonBox.top,
        buttonBottom: buttonBox.bottom,
      };
    });
  }

  test('360px에서 15자 폴더 이름이면 문구는 한 줄로 두고 버튼이 문구 아래 줄로 내려간다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    const layout = await saveAndMeasureToast(page);

    expect(layout.titleLines).toBe(1);
    expect(layout.buttonTop).toBeGreaterThanOrEqual(layout.titleBottom);
  });

  test('한 줄에 들어가는 폭(375px)이면 버튼이 문구와 같은 줄에 있다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });

    const layout = await saveAndMeasureToast(page);

    expect(layout.titleLines).toBe(1);
    expect(layout.buttonTop).toBeLessThan(layout.titleBottom);
    expect(layout.buttonBottom).toBeGreaterThan(layout.titleTop);
  });
});

// sonner 토스트가 자리 잡는 애니메이션(400ms)보다 길게 - 확인용 스크린샷 직전에만 쓴다
const TOAST_SETTLE_MS = 600;

const BOOKMARK_LIMIT_EXCEEDED = {
  status: 409,
  json: { status: 409, code: 'BOOKMARK_LIMIT_EXCEEDED', message: 'limit', timestamp: '' },
};

// 회원당 북마크 저장 한도(BE 409 BOOKMARK_LIMIT_EXCEEDED)에 닿았을 때의 안내(docs/BOOKMARK.md §5 "북마크 저장 한도").
// 토스트 문구·버튼은 단위 테스트가 보고, 여기서는 실제 브라우저에서만 보이는 것 - 창 위 토스트의 버튼이 눌리고,
// 떠난 뒤 뒤로 와도 창이 다시 열리지 않는지 - 를 본다.
test.describe('로그인 상태 — 북마크 저장 한도 안내', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('폴더 담기가 한도로 거절되면 안내 1개가 뜨고, "북마크 보기"로 떠난 뒤 뒤로 와도 창이 다시 열리지 않는다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)),
      (route) => route.fulfill(BOOKMARK_LIMIT_EXCEEDED)
    );

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    // 가드(DOUBLE_CLICK_GUARD_MS)는 클릭 자체를 삼키므로 관측 가능한 이벤트로 대체할 수 없다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: mockBookmarkFolder.name }).click();

    await expect(page.getByText(TEXTS.messages.error.bookmarkLimitExceeded)).toHaveCount(1);
    await expect(page.getByText(TEXTS.messages.error.bookmarkSaveFailed)).toHaveCount(0);
    // 실패라 창은 열린 채다
    await expect(folderDialog).toBeVisible();
    const viewBookmarks = page.getByRole('button', {
      name: TEXTS.bookmark.folder.viewBookmarksAction,
    });
    // 토스트가 다 내려온 뒤의 화면을 남긴다(test-results, 커밋되지 않는다)
    await expect(viewBookmarks).toBeInViewport({ ratio: 1 });
    // 두 문장 문구라 버튼은 문구 아래 줄에 있고(문구 옆 세로 가운데에 끼지 않는다), 닫기 버튼도 있다
    const limitToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: TEXTS.messages.error.bookmarkLimitExceeded });
    const layout = await limitToast.evaluate((toastElement) => ({
      titleBottom: toastElement.querySelector('[data-title]')!.getBoundingClientRect().bottom,
      buttonTop: toastElement.querySelector('[data-button]')!.getBoundingClientRect().top,
    }));
    expect(layout.buttonTop).toBeGreaterThanOrEqual(layout.titleBottom);
    // 닫기 버튼 이름은 sonner 기본값이다
    await expect(limitToast.getByRole('button', { name: 'Close toast' })).toBeVisible();
    // 확인용 화면(test-results, 커밋되지 않는다) - 토스트가 내려오는 애니메이션이 끝난 뒤에 남긴다
    await page.waitForTimeout(TOAST_SETTLE_MS);
    await page.screenshot({ path: test.info().outputPath('limit-toast.png') });

    await viewBookmarks.click();
    await expect(page).toHaveURL(/\/bookmark$/);
    await expect(folderDialog).not.toBeVisible();

    // 창이 열려 있던 칸을 교체했으므로 뒤로 한 번이면 창 없는 목록이다. 창이 안 보이는 것만으로는 닫히는 중인지
    // 구분되지 않아 히스토리 칸의 열림 표시도 본다
    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
    await expect(folderDialog).not.toBeVisible();
    const isDialogEntry = await page.evaluate(
      (key) => Boolean(window.history.state?.usr?.[key]),
      POST_BOOKMARK_FOLDER_DIALOG_KEY
    );
    expect(isDialogEntry).toBe(false);
  });

  test('삭제를 되돌리다 한도로 거절되면 닫을 때까지 남는 안내에 "북마크 보기"와 닫기 버튼이 함께 있다', async ({
    page,
  }) => {
    const bookmarkedPost = {
      ...mockPost,
      userInteractions: {
        ...mockPost.userInteractions,
        isBookmarked: true,
        bookmarkFolderIds: [mockBookmarkFolder.id],
      },
    };
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPostListResponse, content: [bookmarkedPost] }),
        })
    );
    // 같은 주소다 - 마지막 폴더에서 빼기(DELETE, 북마크까지 삭제)는 성공, 되돌리기(POST 폴더 담기)는 한도로 거절
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)),
      (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({
            json: wrapResponse({ postId: mockPost.id, isBookmarked: false, folderIds: [] }),
          });
        }

        return route.fulfill(BOOKMARK_LIMIT_EXCEEDED);
      }
    );

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkChange }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(folderDialog).not.toBeVisible();

    await page.getByRole('button', { name: TEXTS.bookmark.folder.undoAction }).click();

    const notice = page
      .getByRole('listitem')
      .filter({ hasText: TEXTS.messages.error.bookmarkLimitExceeded });
    await expect(notice).toHaveCount(1);
    await expect(
      notice.getByRole('button', { name: TEXTS.bookmark.folder.viewBookmarksAction })
    ).toBeVisible();
    // 닫기 버튼 이름은 sonner 기본값이다
    await expect(notice.getByRole('button', { name: 'Close toast' })).toBeVisible();
    await page.waitForTimeout(TOAST_SETTLE_MS);
    await page.screenshot({ path: test.info().outputPath('limit-undo-toast.png') });
  });
});
