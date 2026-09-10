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

  test('direct patch가 재조회 응답을 기다리지 않고 먼저 화면에 반영된다', async ({ page }) => {
    // 위 테스트는 "PATCH 응답 이후 최종적으로 새 제목이 보인다"만 증명한다 — direct
    // patch(onSuccess의 setQueriesData)와 그 직후 invalidate가 트리거하는 재조회가
    // 거의 동시에 일어나서, 둘 중 무엇이 화면을 그렸는지 구분이 안 된다. 극단적으로는
    // direct patch 코드가 통째로 없어져도 재조회가 알아서 새 제목을 채워주므로 그
    // 테스트는 계속 통과한다 — direct patch 자체의 회귀를 못 잡는 구멍이다.
    //
    // 이 테스트는 재조회(2번째 GET /api/post) 응답만 인위적으로 지연시켜, 그 응답이
    // 아직 안 왔는데도 카드 제목이 이미 새 제목인지 확인한다 — beforeEach가 등록한
    // 무상태 목을 이 테스트 안에서 다시 등록해 덮어쓴다(LIFO — 나중 등록이 먼저 실행).
    let updated = false;
    let listRequestCount = 0;
    const currentPost = () => (updated ? { ...mockPost, title: NEW_TITLE } : mockPost);

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        listRequestCount += 1;
        if (listRequestCount === 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        return route.fulfill({
          json: wrapResponse({ ...mockPostListResponse, content: [currentPost()] }),
        });
      }
    );

    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => {
        if (route.request().method() === 'PATCH') {
          updated = true;
        }
        return route.fulfill({ json: wrapResponse(currentPost()) });
      }
    );

    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.post.card.edit }).click();
    await expect(page).toHaveURL(new RegExp(`/post/edit/${mockPost.id}$`));

    const titleInput = page.getByLabel(TEXTS.post.form.update.titleLabel);
    await expect(titleInput).toHaveValue(mockPost.title);
    await titleInput.fill(NEW_TITLE);

    // 첫 진입 요청(1번째)은 이미 소진됐으니, 다음으로 잡히는 GET /post가 곧
    // invalidate가 트리거한 재조회(2번째, 2초 지연 중)다.
    const secondListRequest = page.waitForRequest(
      (req) => new URL(req.url()).pathname === '/api/post'
    );
    await page.getByRole('button', { name: TEXTS.post.form.update.update }).click();
    await expect(page).toHaveURL(/\/post$/);
    await secondListRequest;

    // 재조회 요청은 이미 나갔지만(listRequestCount===2) 응답은 아직 2초 지연 중이다.
    // 그런데도 카드 제목이 새 제목이라면, 재조회가 아니라 direct patch가 그렸다는 뜻이다.
    // ⚠️ 기본 expect 타임아웃(5초)은 이 2초 지연보다 길어서, direct patch가 없어도
    // toBeVisible이 응답을 기다렸다가 통과해버려 회귀를 못 잡는다 — 응답 지연보다
    // 짧은 타임아웃을 명시해야 "응답 전에 이미 반영됐는가"를 실제로 검증한다.
    expect(listRequestCount).toBe(2);
    await expect(page.getByRole('link', { name: NEW_TITLE })).toBeVisible({ timeout: 500 });
  });
});
