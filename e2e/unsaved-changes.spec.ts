import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// useUnsavedChangesGuard(shared/hooks/useUnsavedChangesGuard.ts) — React Router blocker
// 기반이라 실제 라우터 없이는 재현 불가능한 영역. 유닛 테스트 파일 자체가 없다
// (docs/UNSAVED-CHANGES-GUARD.md도 통합 테스트 확인 안 됐다고 명시).
test.describe('저장하지 않은 변경 가드', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // useUnsavedChangesGuard.ts:10-12 — 비인증이면 블로커가 무조건 통과시킨다. 로그인
    // 상태가 필수다.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    // '나가기' 후 목록 착지 확인 + 최초 진입 양쪽에 쓰인다.
    await mockPostList(page);
    await mockPostDetail(page);
    // 댓글이 있으면 CommentItem마다 별도 dirty 키가 등록돼 실패 원인이 흐려진다.
    await mockComments(page, []);
  });

  // 반드시 라우터 이동(카드 클릭)으로 상세에 들어가야 한다 — goto('/post/:id') 직입은
  // history state의 idx가 없어 POP 테스트(test 3)에서 blocker가 조용히 무시된다
  // (@remix-run/router가 delta를 계산 못 해 "fail silently in production" 경고만 내고
  // 그냥 이동해버린다).
  async function openDirtyDetail(page: Page) {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    await page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder).fill('작성 중인 댓글');
  }

  function guardDialog(page: Page) {
    return page.getByRole('dialog', { name: TEXTS.unsavedChanges.title });
  }

  test('PUSH 이동(사이드바 Feed) 시 모달이 뜨고 "계속 작성"이면 머문다', async ({ page }) => {
    await openDirtyDetail(page);

    // Feed는 requiresAuth가 없어 순수 <Link>(PUSH)로 동작하고 pathname이 실제로 바뀐다 —
    // '목록으로' 버튼은 useGoBack이 navigate(-1)(POP)이라 test 3과 중복돼 못 쓴다.
    const feedLink = page.getByRole('link', { name: TEXTS.nav.feed });
    await expect(feedLink).toHaveCount(1);
    await feedLink.click();

    await expect(guardDialog(page)).toBeVisible();
    await guardDialog(page).getByRole('button', { name: TEXTS.unsavedChanges.cancel }).click();

    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // URL 단언보다 강하다 — 같은 폼 인스턴스가 언마운트 없이 살아있다는 증거.
    await expect(page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder)).toHaveValue(
      '작성 중인 댓글'
    );
  });

  test('PUSH 이동에서 "나가기"를 누르면 실제로 이동한다', async ({ page }) => {
    await openDirtyDetail(page);

    await page.getByRole('link', { name: TEXTS.nav.feed }).click();
    await expect(guardDialog(page)).toBeVisible();
    await guardDialog(page).getByRole('button', { name: TEXTS.unsavedChanges.confirm }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
  });

  test('브라우저 뒤로가기(POP)도 같은 모달로 막힌다', async ({ page }) => {
    await openDirtyDetail(page);

    await page.goBack();
    // POP은 브라우저가 먼저 움직이고 라우터가 뒤늦게 URL을 되돌린다 — URL을 먼저 단언하면
    // 진짜 레이스다. 모달은 block 판정과 같은 틱에 뜨므로 이 순서가 안전하다.
    await expect(guardDialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await guardDialog(page).getByRole('button', { name: TEXTS.unsavedChanges.confirm }).click();
    await expect(page).toHaveURL(/\/post$/);
  });
});
