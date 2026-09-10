import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
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

    // useAuthGuard가 setOpen(true) 자체를 실행 안 하므로 PostCardBookmarkFolderModal이
    // 마운트되지 않는다 — 로그인 모달 하나만 떠야 한다.
    const dialogs = page.getByRole('dialog');
    await expect(dialogs).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    expect(folderListRequestCount).toBe(0);
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
