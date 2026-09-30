import { test as baseTest, expect } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail, mockDeletePost } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// 바깥 클릭 닫기 정책(docs/DECISIONS.md 2026-09-30) — 확인창은 바깥 클릭으로 닫히지 않고,
// 로그인 모달은 이메일·비밀번호를 입력했을 때만 바깥 클릭으로 닫히지 않는다. 둘 다 ESC로는
// 닫힌다. 가드(DOUBLE_CLICK_GUARD_MS)는 클릭 자체를 삼키므로 관측 가능한 이벤트로 대체할 수
// 없어 시간 대기를 쓴다(bookmark.spec.ts 선례).

// 모달 바깥(화면 좌상단, 오버레이 위) 클릭
const OUTSIDE_POINT = { x: 5, y: 5 };

authTest.describe('확인창(Confirm) — 바깥 클릭으로 닫히지 않는다', () => {
  authTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner 판정에 필수 — account.id === mockPost.author.id라 소유자로 간주된다
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
    await mockDeletePost(page);
  });

  authTest('게시글 삭제 확인창은 바깥을 눌러도 그대로 있고 ESC로 취소된다', async ({ page }) => {
    let deleteRequestCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'DELETE') {
        deleteRequestCount += 1;
      }
    });

    await page.goto(`/post/${mockPost.id}`);
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.delete }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await page.mouse.click(OUTSIDE_POINT.x, OUTSIDE_POINT.y);
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await expect(confirmDialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(confirmDialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    expect(deleteRequestCount).toBe(0);
  });
});

baseTest.describe('로그인 모달 — 입력이 있을 때만 바깥 클릭으로 닫히지 않는다', () => {
  baseTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  async function openLoginDialog(page: import('@playwright/test').Page) {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const loginDialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
    await expect(loginDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    return loginDialog;
  }

  baseTest('아무것도 입력하지 않았으면 바깥 클릭으로 닫힌다', async ({ page }) => {
    const loginDialog = await openLoginDialog(page);

    await page.mouse.click(OUTSIDE_POINT.x, OUTSIDE_POINT.y);
    await expect(loginDialog).not.toBeVisible();
  });

  baseTest('비밀번호를 입력했으면 바깥을 눌러도 그대로 있고, ESC로는 닫힌다', async ({ page }) => {
    const loginDialog = await openLoginDialog(page);

    // getByLabel은 label의 raw textContent로 매칭해 RequiredMark(*)까지 포함해야 한다
    // (guest-guard.spec.ts 주석 참고)
    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill('TestPass1!');

    await page.mouse.click(OUTSIDE_POINT.x, OUTSIDE_POINT.y);
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await expect(loginDialog).toBeVisible();
    await expect(page.getByLabel(`${TEXTS.labels.password}*`, { exact: true })).toHaveValue(
      'TestPass1!'
    );

    await page.keyboard.press('Escape');
    await expect(loginDialog).not.toBeVisible();
  });
});
