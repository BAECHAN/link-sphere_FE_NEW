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

const NEW_URL = 'https://newlink.example.com/article';
const NEW_TITLE = '새로 등록한 링크';
const NEW_POST = { ...mockPost, id: 'post-uuid-new', url: NEW_URL, title: NEW_TITLE };

// 케이스 "등록 직후 시작된 목록 재조회가 취소돼, 뒤늦게 온 옛 응답이 새 글을 지우지 못한다"는
// e2e(page.clock 기반 in-flight 재현, 15~25% flaky)와 유닛(useFetchPostListQuery 실제
// 옵저버 + MSW 정밀 타이밍 제어) 양쪽에서 시도했으나 안정적으로 재현하지 못했다. 원인은
// cancelQueries의 기본 옵션(revert:true)이 handlePostCreateSuccess의 invalidateQueries가
// 만드는 후속 활성 재조회와 얽히는 React Query 내부 상호작용으로 보이며, 이 스펙의 범위를
// 벗어나는 별도 조사가 필요해 제외했다(2026-09-14, docs/plans 참고).
test.describe('게시글 등록', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // /post/submit은 ProtectedLayout — 인증 판정에 필수.
    await mockAccountQuery(page);
    // '관심 분야' 체크박스 렌더에 필요.
    await mockCategoryOptions(page);
  });

  test('등록을 제출하면 응답을 기다리지 않고 /post로 이동하고, 저장하지 않은 변경 가드가 뜨지 않는다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          // 응답을 약간 지연시켜, 이동이 "응답을 기다린 결과"가 아니라 응답 전에 이미
          // 일어났음을 명확히 구분한다.
          await new Promise((resolve) => setTimeout(resolve, 300));
          return route.fulfill({ json: wrapResponse(NEW_POST) });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    await expect(page.getByLabel('URL', { exact: true })).toBeVisible();

    await page.getByLabel('URL', { exact: true }).fill(NEW_URL);
    const submitButton = page.getByRole('button', { name: TEXTS.post.form.create.submit });
    await expect(submitButton).toBeEnabled();

    const created = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.request().method() === 'POST'
    );
    await submitButton.click();

    // POST 응답(300ms 지연 중)을 기다리지 않고 즉시 /post로 이동한다(useCreatePost.ts).
    await expect(page).toHaveURL(/\/post$/);
    // clearNow()가 blocker를 실제로 풀어, 미저장 변경 확인 모달이 뜨지 않는다.
    await expect(page.getByRole('dialog', { name: TEXTS.unsavedChanges.title })).toHaveCount(0);

    const createdRequestBody = (await created).request().postDataJSON();
    expect(createdRequestBody.url).toBe(NEW_URL);
  });
});
