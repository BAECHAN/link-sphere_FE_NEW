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
const NEW_POST = { ...mockPost, id: 'post-uuid-new', url: NEW_URL };

// CreatePostForm.tsx의 등록 버튼은 모바일에서 BottomTabBar 위에 고정된다 — 데스크톱
// 뷰포트에서는 폼 마지막에 그대로 있어 이 스펙은 mobile-chrome 프로젝트에서만 돈다.
test.describe('게시글 등록 — 모바일 등록 바', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
  });

  test('URL만 입력해도 스크롤 없이 등록 버튼이 보인다', async ({ page }) => {
    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다.
    await page.getByLabel(/^URL/).fill(NEW_URL);

    const submitButton = page.getByRole('button', { name: TEXTS.post.form.create.submit });

    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toBeInViewport();
  });

  test('URL 입력창에서 Enter를 누르면 제출된다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({ json: wrapResponse(NEW_POST) });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다.
    const urlInput = page.getByLabel(/^URL/);
    await urlInput.fill(NEW_URL);

    const created = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.request().method() === 'POST'
    );
    // 폼 안 submit 타입 버튼이 하나뿐이라 Enter로 암묵적 제출이 일어난다
    // (enterKeyHint="send"는 키보드 라벨만 바꾸고 이 동작 자체는 원래도 됐다).
    await urlInput.press('Enter');

    const createdRequestBody = (await created).request().postDataJSON();
    expect(createdRequestBody.url).toBe(NEW_URL);
  });
});
