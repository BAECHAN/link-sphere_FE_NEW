import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

// useAuthGuard(entities/auth/hooks/useAuthGuard.ts:17-28) — isAuthenticated가 아니면
// action을 아예 실행하지 않고 로그인 모달만 연다. 지금까지 만든 다른 스펙은 전부 이미
// 로그인된 상태에서 시작해서 이 분기를 한 번도 타지 않았다 — comment.spec.ts를 작성할 때
// "별도 흐름 후보로 남긴다"고 남겨둔 항목이다.
test.describe('비로그인 인증 가드 — 요청 없이 로그인 모달만 뜬다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('좋아요 버튼 클릭 → 로그인 모달, POST /like 요청 없음', async ({ page }) => {
    let likeRequestCount = 0;
    page.on('request', (req) => {
      if (/^\/api\/post\/[^/]+\/like$/.test(new URL(req.url()).pathname)) {
        likeRequestCount += 1;
      }
    });

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.postLike }).click();

    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    expect(likeRequestCount).toBe(0);
  });

  test('북마크 버튼 클릭 → 로그인 모달, 폴더 선택 모달은 안 뜸', async ({ page }) => {
    let folderListRequestCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/bookmark/folders') {
        folderListRequestCount += 1;
      }
    });

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    // useAuthGuard는 클릭 시점엔 setOpen(true)를 실행하지 않고 pendingAction으로
    // 보류한다(로그인 성공 후 자동 재개 흐름은 아래 테스트) — 로그인 모달 하나만 떠야 한다.
    const dialogs = page.getByRole('dialog');
    await expect(dialogs).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    expect(folderListRequestCount).toBe(0);
  });

  test('북마크 버튼 클릭 → 로그인 성공 → 폴더 선택 모달이 자동으로 이어서 열린다', async ({
    page,
  }) => {
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);

    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const loginDialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
    await expect(loginDialog).toBeVisible();

    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('TestPass1!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // 겹침 회귀 확인: 폴더 모달을 보기 전에 로그인 모달이 실제로 사라졌는지 먼저 본다.
    await expect(loginDialog).not.toBeVisible();

    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    await expect(folderDialog.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('댓글 작성 시도 → 로그인 모달, POST /comment 요청 없음', async ({ page }) => {
    await mockPostDetail(page);
    await mockComments(page, []);

    let commentPostRequestCount = 0;
    page.on('request', (req) => {
      if (
        /^\/api\/post\/[^/]+\/comment$/.test(new URL(req.url()).pathname) &&
        req.method() === 'POST'
      ) {
        commentPostRequestCount += 1;
      }
    });

    await page.goto(`/post/${mockPost.id}`);
    await page
      .getByPlaceholder(TEXTS.comment.form.commentPlaceholder)
      .fill('로그인 없이 써보는 댓글');
    await page.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();

    // useCreateComment.ts:83-85 — zod 검증(내용 비어있지 않음)을 통과한 뒤에야
    // guard가 실제 mutate 호출 전체를 감싼다. 검증 자체는 통과하므로 비로그인이라도
    // 여기까지는 도달하고, 그 다음 guard가 막는다.
    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    expect(commentPostRequestCount).toBe(0);
  });
});
