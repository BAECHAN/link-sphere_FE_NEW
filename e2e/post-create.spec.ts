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
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

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

  test('등록 화면에 들어오면 URL 칸에 바로 포커스가 있다', async ({ page }) => {
    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다.
    await expect(page.getByLabel(/^URL/)).toBeFocused();
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

    // 응답 후: /post로 이동하고, clearNow()가 blocker를 풀어 이탈 확인창이 뜨지 않는다 - 제목으로
    // 고르지 않는다: 요청 중 확인창(unsavedChanges.pending)은 제목이 달라 잘못 떠도 놓친다.
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
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

  test('응답이 끊긴 뒤 다시 누르면 같은 Idempotency-Key, 입력을 고치면 새 키, 새로고침 뒤 처음 내용이면 처음 키다', async ({
    page,
  }) => {
    const keys: (string | undefined)[] = [];

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          keys.push(route.request().headers()['idempotency-key']);

          return route.abort('failed');
        }
        return route.fulfill({ json: wrapResponse(mockPostListResponse) });
      }
    );

    const urlInput = page.getByLabel(/^URL/);
    const submitButton = page.getByRole('button', { name: TEXTS.post.form.create.submit });
    const submitAndFail = async (expectedCount: number) => {
      await submitButton.click();
      await expect.poll(() => keys.length).toBe(expectedCount);
      await expect(page.getByRole('alert')).toContainText(TEXTS.messages.error.postSubmit.network);
      await expect(submitButton).toBeEnabled();
    };

    // 누를 때마다 응답을 못 받아 1번 더 보내므로 2번씩 나간다
    await page.goto('/post/submit');
    await urlInput.fill(NEW_URL);
    await submitAndFail(2);
    await submitAndFail(4);

    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(keys).size).toBe(1);

    await urlInput.fill(`${NEW_URL}?edited=1`);
    await submitAndFail(6);

    expect(keys[4]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[4]).not.toBe(keys[0]);
    expect(keys[5]).toBe(keys[4]);

    // 작성 중이라 beforeunload 확인창이 뜰 수 있다 - 새로고침을 진행한다
    page.on('dialog', (dialog) => dialog.accept());
    await page.reload();
    await urlInput.fill(NEW_URL);
    await submitAndFail(8);

    expect(keys[6]).toBe(keys[0]);
    expect(keys[7]).toBe(keys[0]);
  });

  test('응답이 끊기면 같은 Idempotency-Key로 한 번 더 보내고, 저장되면 실패 안내 없이 피드로 돌아간다', async ({
    page,
  }) => {
    const keys: (string | undefined)[] = [];

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() !== 'POST') {
          return route.fulfill({ json: wrapResponse(mockPostListResponse) });
        }

        keys.push(route.request().headers()['idempotency-key']);

        if (keys.length === 1) {
          return route.abort('failed');
        }

        return route.fulfill({ status: 201, json: wrapResponse(NEW_POST) });
      }
    );

    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill(NEW_URL);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByText(TEXTS.messages.success.postCreated)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.postSubmit.network)).toHaveCount(0);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  test('등록 요청 중 "나가기"로 떠난 뒤 실패하면 무엇이 실패했는지 알리고, [다시 등록하기]를 누르면 입력과 안내를 되살린다', async ({
    page,
  }) => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      async (route) => {
        if (route.request().method() === 'POST') {
          // 떠난 뒤에 실패하도록 테스트가 풀 때까지 응답을 붙잡는다
          await released;
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
    await page.getByLabel(/^제목/).fill(NEW_TITLE);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();
    await expect(page.getByRole('button', { name: TEXTS.common.submitting })).toBeDisabled();

    const pendingTexts = TEXTS.unsavedChanges.pending.postCreate;
    const pendingDialog = page.getByRole('alertdialog', { name: pendingTexts.title });

    await page.getByRole('link', { name: TEXTS.nav.feed }).click();
    await expect(pendingDialog).toBeVisible();
    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) - 클릭 자체를 삼킨다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await pendingDialog.getByRole('button', { name: pendingTexts.confirm }).click();
    await expect(page).toHaveURL(/\/post$/);

    release();

    // 원인을 특정하지 못한 실패(500)라 설명은 할 일만 적는다(PostUtil.resolveSubmitError의 unclassified)
    const { leftPageFailure } = TEXTS.messages.error;
    await expect(page.getByText(leftPageFailure.postCreateTitle)).toBeVisible();
    await expect(page.getByText(leftPageFailure.retryLater)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.buttons.createPostAgain }).click();

    await expect(page).toHaveURL(/\/post\/submit$/);
    await expect(page.getByLabel(/^URL/)).toHaveValue(NEW_URL);
    await expect(page.getByLabel(/^제목/)).toHaveValue(NEW_TITLE);
    // 버튼을 누르면 토스트가 닫혀 이유가 사라지므로, 머물렀을 때와 같은 안내를 버튼 위에 다시 띄운다.
    // 화면 맨 위에서 시작하면 폼 맨 아래의 이 안내가 화면 밖이라 보이게 내린다(revealRestoredSubmitError)
    await expect(page.getByRole('alert')).toContainText(
      TEXTS.messages.error.postSubmit.createFailed
    );
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.getByText(leftPageFailure.postCreateTitle)).toHaveCount(0);
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
