import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

const NEW_TITLE = '수정된 제목';

test.describe('게시글 수정', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner(⋮ 메뉴 렌더) + /post/edit/:id 진입(ProtectedRoute) 양쪽에 필수.
    await mockAccountQuery(page);
    // 수정 폼의 '관심 분야' 체크박스 + 목록 검색 카드에 필요.
    await mockCategoryOptions(page);

    // useUpdatePostMutation.onSuccess(post.queries.ts)는 목록·상세 캐시를 direct patch한
    // '직후'에 invalidate까지 호출해 목록 GET이 한 번 더 나간다. 고정값 mock이면 이
    // 재조회가 direct patch를 옛 제목으로 덮어써버리므로, 이 스펙은 GET을 상태를 갖는
    // 로컬 핸들러로 재정의한다 — 같은 이유로 GET/PATCH를 핸들러 하나에서 method로
    // 분기하면 mockPostDetail 이후 route.fallback()을 쓰는 2단 체인이 필요 없어진다.
    let updated = false;
    const currentPost = () => (updated ? { ...mockPost, title: NEW_TITLE } : mockPost);

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPostListResponse, content: [currentPost()] }),
        })
    );

    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      async (route) => {
        if (route.request().method() === 'PATCH') {
          // 500ms 지연 게이트(MUTATION_PROGRESS_DELAY_MS)를 넉넉히 넘겨야 "수정 중..."
          // 오버레이가 실제로 뜬다 — 즉시 응답이면 게이트를 못 넘겨 오버레이가 안 보인다.
          await new Promise((resolve) => setTimeout(resolve, 1500));
          updated = true;
          return route.fulfill({ json: wrapResponse(currentPost()) });
        }
        return route.fulfill({ json: wrapResponse(currentPost()) });
      }
    );
  });

  test('목록 ⋮ → 수정 → 제출 즉시 목록 복귀 → "수정 중..." 오버레이 → 응답 후 새 제목 반영', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    // handleNavigateToEdit는 e.preventDefault() 후 PUSH 이동한다(usePostCard.ts) — 이
    // 진입 방식이어야 제출 후 goBack()이 POP으로 목록에 복귀한다(직접 goto라면 replace).
    await page.getByRole('menuitem', { name: TEXTS.post.card.edit }).click();
    await expect(page).toHaveURL(new RegExp(`/post/edit/${mockPost.id}$`));

    // 준비 게이트 — ProtectedRoute의 토큰 만료 판정으로 인한 한 틱의 스피너와, 폼
    // reset(resetFormWithFetchedPost)이 fill을 덮어쓰는 레이스를 동시에 막는다.
    const titleInput = page.getByLabel(TEXTS.post.form.update.titleLabel);
    await expect(titleInput).toHaveValue(mockPost.title);

    // URL 필드는 절대 건드리지 않는다 — clearDerivedFieldsOnUrlChange가 제목·카테고리를 비운다.
    await titleInput.fill(NEW_TITLE);

    const patched = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'PATCH'
    );
    const listRefetch = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.status() === 200
    );
    await page.getByRole('button', { name: TEXTS.post.form.update.update }).click();

    // 응답을 기다리지 않고 즉시 목록(POP)으로 복귀한다.
    await expect(page).toHaveURL(/\/post$/);
    // '수정 중...'은 카드 오버레이와 전역 진행 토스트에 동시에 렌더돼 getByText가
    // strict mode violation을 낸다 — aria-busy는 레포 전체에서 이 카드 하나뿐이라
    // 안전하게 스코프된다.
    await expect(page.locator('[aria-busy="true"]')).toContainText(TEXTS.common.updating);

    await patched;
    await expect(page.getByRole('link', { name: NEW_TITLE })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.success.postUpdated)).toBeVisible();

    // direct patch 후에도 invalidate가 돌아 목록 GET이 한 번 더 나간다 — post-delete와
    // 달리 "재조회 0건"은 주장할 수 없다. 이 재조회 응답도 새 제목을 담고 있어야 한다.
    const listBody = await (await listRefetch).json();
    expect(listBody.data.content[0].title).toBe(NEW_TITLE);
  });
});
