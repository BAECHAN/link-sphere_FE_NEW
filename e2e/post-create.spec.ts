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
// 벗어나는 별도 조사가 필요해 제외했다(2026-09-14, docs/plans 참고). 이후 #308에서 등록이 응답을
// 기다린 뒤 이동하도록 바뀌어 이 시나리오의 전제 자체가 사라졌다(docs/TESTING.md 제외 판정 표).
test.describe('게시글 등록', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // /post/submit은 ProtectedLayout — 인증 판정에 필수.
    await mockAccountQuery(page);
    // '관심 분야' 체크박스 렌더에 필요.
    await mockCategoryOptions(page);
  });

  test('등록을 제출하면 버튼이 "등록 중..."으로 바뀌고, 응답이 온 뒤 /post로 이동하며 저장하지 않은 변경 가드가 뜨지 않는다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          // 응답을 지연시켜, 응답 전에는 폼에 머물며 진행 라벨을 보여주는지 확인할 틈을 만든다.
          await new Promise((resolve) => setTimeout(resolve, 800));
          return route.fulfill({ json: wrapResponse(NEW_POST) });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다.
    await expect(page.getByLabel(/^URL/)).toBeVisible();

    await page.getByLabel(/^URL/).fill(NEW_URL);
    const submitButton = page.getByRole('button', { name: TEXTS.post.form.create.submit });
    await expect(submitButton).toBeEnabled();

    const created = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.request().method() === 'POST'
    );
    await submitButton.click();

    // 응답 전: 폼에 머물고 버튼이 진행 라벨로 바뀐다(useCreatePost.ts - 응답 대기).
    await expect(page.getByRole('button', { name: TEXTS.common.submitting })).toBeDisabled();
    await expect(page).toHaveURL(/\/post\/submit$/);

    const createdRequestBody = (await created).request().postDataJSON();
    expect(createdRequestBody.url).toBe(NEW_URL);

    // 응답 후: /post로 이동하고, clearNow()가 blocker를 풀어 미저장 변경 확인 모달이 뜨지 않는다.
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title })).toHaveCount(
      0
    );
  });

  test('등록이 실패하면 이동하지 않고 입력한 URL이 그대로 남는다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 500,
            json: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom' },
          });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    // 토스트가 아니라 버튼 위 안내(FormAlert, role=alert)에 남는다(PostUtil.resolveSubmitError)
    await expect(page.getByRole('alert')).toContainText(
      TEXTS.messages.error.postSubmit.createFailed
    );
    await expect(page).toHaveURL(/\/post\/submit$/);
    await expect(page.getByLabel(/^URL/)).toHaveValue(NEW_URL);
    await expect(page.getByRole('button', { name: TEXTS.post.form.create.submit })).toBeEnabled();
  });

  test('도메인을 찾을 수 없으면 URL 칸 아래에 고칠 수 있는 안내가 뜨고, URL을 고치면 사라진다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 400,
            json: { status: 400, code: 'URL_UNRESOLVABLE', message: 'Cannot resolve host' },
          });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(page.getByText(TEXTS.messages.error.postSubmit.urlUnresolvable)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByLabel(/^URL/).fill(`${NEW_URL}-fixed`);
    await expect(page.getByText(TEXTS.messages.error.postSubmit.urlUnresolvable)).toHaveCount(0);
  });

  test('요청 한도를 넘으면 Retry-After를 분으로 바꿔 버튼 위에 안내한다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status: 429,
            headers: { 'Retry-After': '900' },
            json: { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
          });
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(page.getByRole('alert')).toContainText(
      TEXTS.messages.error.postSubmit.rateLimitedIn(15)
    );
  });

  test('URL을 입력하면 등록 전에 미리보기 카드가 뜨고, 입력한 제목으로 보여준다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.linkPreview),
      async (route) => {
        // 응답을 지연시켜 같은 자리에 먼저 깔리는 로딩 상태를 확인할 틈을 만든다.
        await new Promise((resolve) => setTimeout(resolve, 800));
        return route.fulfill({
          json: wrapResponse({
            url: NEW_URL,
            title: '크롤링한 제목',
            description: '크롤링한 설명',
            ogImage: null,
          }),
        });
      }
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);

    const card = page.getByLabel(TEXTS.post.form.preview.ariaLabel);
    await expect(card).toContainText(TEXTS.post.form.preview.loading);
    await expect(card).toContainText('크롤링한 제목');
    await expect(card).toContainText('크롤링한 설명');

    await page.getByLabel(/^제목/).fill(NEW_TITLE);
    await expect(card).toContainText(NEW_TITLE);
  });

  test('미리보기에서 도메인을 찾을 수 없으면 제출 전에 URL 칸 아래에 안내한다', async ({
    page,
  }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.linkPreview),
      (route) =>
        route.fulfill({
          status: 400,
          json: { status: 400, code: 'URL_UNRESOLVABLE', message: 'Cannot resolve host' },
        })
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);

    await expect(page.getByText(TEXTS.messages.error.postSubmit.urlUnresolvable)).toBeVisible();
    await expect(page.getByLabel(TEXTS.post.form.preview.ariaLabel)).toHaveCount(0);
  });
});
