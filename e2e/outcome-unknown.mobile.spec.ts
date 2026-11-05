import { test as guestTest } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery, mockNicknameAvailability } from './mocks/account.mock';
import { mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

const NEW_TITLE = '수정된 제목';
const NEW_NICKNAME = '새로운닉';
const NEW_FOLDER_NAME = '응답이 끊긴 폴더';

// 응답을 못 받은 쓰기 요청(docs/FE-ARCHITECTURE.md §28)의 터치 기기 경로 - 데스크톱 스펙과 같은 장면을 본다.
// 재전송은 mutation에서 돌아 화면과 무관하지만, 안내가 보이는지와 폼 입력·버튼이 남는지는 화면마다 따로 확인한다
test.describe('모바일 — 응답을 못 받은 쓰기 요청', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
  });

  test('글 수정의 응답이 끊기면 한 번 더 보내고, 저장되면 실패 안내 없이 목록으로 돌아간다', async ({
    page,
  }) => {
    let patchCount = 0;
    let saved = false;
    const currentPost = () => (saved ? { ...mockPost, title: NEW_TITLE } : mockPost);

    await mockCategoryOptions(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPostListResponse, content: [currentPost()] }),
        })
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => {
        if (route.request().method() !== 'PATCH') {
          return route.fulfill({ json: wrapResponse(currentPost()) });
        }

        patchCount += 1;

        if (patchCount === 1) {
          return route.abort('failed');
        }

        saved = true;

        return route.fulfill({ json: wrapResponse(currentPost()) });
      }
    );

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.post.card.edit }).click();

    const titleInput = page.getByLabel(TEXTS.post.form.update.titleLabel);
    await expect(titleInput).toHaveValue(mockPost.title);
    await titleInput.fill(NEW_TITLE);
    await page.getByRole('button', { name: TEXTS.post.form.update.update }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByText(TEXTS.messages.success.postUpdated)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.postSubmit.network)).toHaveCount(0);
    expect(patchCount).toBe(2);
  });

  test('폴더를 만드는 응답이 끊긴 뒤 다시 보낸 요청이 이름 중복이면 첫 요청이 만든 폴더로 받아들인다', async ({
    page,
  }) => {
    const createdFolder = { ...mockBookmarkFolder, id: 'folder-created', name: NEW_FOLDER_NAME };
    let postCount = 0;

    await mockBookmarkFolderPosts(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => {
        if (route.request().method() !== 'POST') {
          return route.fulfill({
            json: wrapResponse({
              folders: postCount > 0 ? [mockBookmarkFolder, createdFolder] : [mockBookmarkFolder],
              uncategorizedCount: 0,
            }),
          });
        }

        postCount += 1;

        return postCount === 1
          ? route.abort('failed')
          : route.fulfill({
              status: 409,
              json: { status: 409, code: 'DUPLICATE_FOLDER_NAME', message: '', timestamp: '' },
            });
      }
    );

    await page.goto('/bookmark');
    await page.getByRole('button', { name: TEXTS.bookmark.folder.new }).click();

    const input = page.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
    await input.fill(NEW_FOLDER_NAME);
    await input.press('Enter');

    await expect(page.getByRole('button', { name: NEW_FOLDER_NAME })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.folderNameDuplicate)).toHaveCount(0);
    await expect(page.getByText(TEXTS.messages.error.outcomeUnknown)).toHaveCount(0);
    expect(postCount).toBe(2);
  });

  test('프로필 저장의 응답이 두 번 다 없으면 확인하지 못했다고 안내하고, 입력값을 남겨 다시 누를 수 있다', async ({
    page,
  }) => {
    let patchCount = 0;
    let accountFetchCount = 0;

    await mockNicknameAvailability(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.account),
      (route) => {
        if (route.request().method() !== 'PATCH') {
          accountFetchCount += 1;

          return route.fallback();
        }

        patchCount += 1;

        return route.abort('failed');
      }
    );

    await page.goto('/my/account');

    const nickname = page.getByLabel(TEXTS.labels.nickname);
    const availability = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/api/auth/account/nickname-availability' &&
        res.status() === 200
    );
    await nickname.fill(NEW_NICKNAME);
    await availability;

    const save = page.getByRole('button', { name: TEXTS.mypage.save });
    await expect(save).toBeEnabled();

    const fetchCountBeforeSave = accountFetchCount;

    await save.click();

    await expect(page.getByText(TEXTS.messages.error.outcomeUnknown)).toBeVisible();
    expect(patchCount).toBe(2);
    // 저장됐을 수 있으니 서버 값을 다시 받는다
    await expect.poll(() => accountFetchCount).toBeGreaterThan(fetchCountBeforeSave);
    await expect(nickname).toHaveValue(NEW_NICKNAME);
    await expect(save).toBeEnabled();
  });
});

// 재설정 메일은 로그인하지 않은 화면이라 로그인 흔적을 심는 auth.fixture를 쓰지 않는다
guestTest(
  '모바일 — 재설정 메일 요청의 응답이 끊기면 1번만 보내고, 메일함을 먼저 확인하라고 안내한다',
  async ({ page }) => {
    let requestCount = 0;

    await installCatchAll(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.passwordResetRequest),
      (route) => {
        requestCount += 1;

        return route.abort('failed');
      }
    );

    await page.goto('/auth/forgot-password');
    await page.getByLabel(TEXTS.labels.email).fill('user@example.com');
    await page.getByRole('button', { name: TEXTS.auth.forgotPassword.submit }).click();

    await expect(page.getByText(TEXTS.messages.error.mailRequestOutcomeUnknown)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.passwordResetRequestFailed)).toHaveCount(0);
    expect(requestCount).toBe(1);
  }
);
