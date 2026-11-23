import { test, expect, type Locator, type Page } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockAuthRefresh, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

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
    await page
      .getByRole('button', { name: TEXTS.ariaLabels.likeWithCount(mockPost.stats.likeCount) })
      .click();

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

    // dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 아래 "로그인" 클릭이 가드
    // 시간 안에 떨어지면 삼켜진다. 클릭 자체를 삼키므로 관측 가능한 이벤트로 대체할 수 없다
    // (bookmark.spec.ts 선례). 2026-09-30 이전엔 미리 마운트된 모달에서 가드가 꺼져 있어
    // 이 대기 없이도 통과했다.
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    // getByLabel은 label 엘리먼트의 실제 텍스트로 매칭한다 - RequiredMark(*)가 aria-hidden이라
    // 접근성 트리 이름 계산에서는 빠지지만, label의 raw textContent에는 그대로 남아 getByLabel엔
    // 잡힌다(실측 확인, count()로 직접 검증). 그래서 '이메일'/'비밀번호' exact match는 0건이 되고,
    // '이메일*'/'비밀번호*'처럼 별표까지 포함해야 매칭된다 - 부분 일치로 두면 '이메일 저장'
    // 체크박스까지 같이 걸린다.
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill('TestPass1!');
    await page.getByRole('button', { name: TEXTS.auth.login.signIn }).click();

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

// 범위 칩 4개(북마크한·좋아요한·내가 작성한·나만 볼 수 있는)는 로그인해야 뜻이 있다. 로그아웃 상태에서는 칩을
// 눌러도, 주소에 그 필터가 남아 있어도 목록을 요청하지 않는다(usePostListFilter.ts, usePostListLoginGate.ts).
// 목은 서버가 토큰 없는 개인 필터 요청을 401 NOT_LOGGED_IN으로 거절하는 조건으로 둔다 - 화면이 그런 요청을
// 보내면 client.ts가 로그인 페이지로 보내므로, 요청이 새면 주소·화면 단언에서도 드러난다.

const SERVER_LOGIN_ONLY_FILTERS = ['isBookmarked', 'isLiked', 'isMyPosts', 'isPrivate'];
const LOGIN_NOTICE = TEXTS.post.list.loginRequired;

interface PostListRequest {
  filter: string | null;
  hasToken: boolean;
}

function isLoginOnly(filter: string | null) {
  return (filter ?? '')
    .split(',')
    .some((value) => SERVER_LOGIN_ONLY_FILTERS.includes(value.trim()));
}

/** GET /post — 받은 요청의 filter·토큰 유무를 기록하고, 토큰 없는 개인 필터 요청은 401로 거절한다 */
async function mockPostListRejectingGuestScope(page: Page): Promise<PostListRequest[]> {
  const requests: PostListRequest[] = [];

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => {
      const request = route.request();
      const filter = new URL(request.url()).searchParams.get('filter');
      const hasToken = Boolean(request.headers()['x-access-token']);

      requests.push({ filter, hasToken });

      if (!hasToken && isLoginOnly(filter)) {
        return route.fulfill({
          status: 401,
          json: {
            status: 401,
            code: SERVER_ERROR_CODE.NOT_LOGGED_IN,
            message: 'unauthorized',
            timestamp: new Date().toISOString(),
          },
        });
      }

      return route.fulfill({ json: wrapResponse(mockPostListResponse) });
    }
  );

  return requests;
}

function scopeChip(page: Page, name: string) {
  return page
    .getByRole('group', { name: TEXTS.ariaLabels.postScopeFilters })
    .getByRole('button', { name });
}

function loginNotice(page: Page) {
  return page.getByRole('heading', { name: LOGIN_NOTICE.title });
}

/** 이 화면 위에 열린 로그인 창에서 로그인한다(useLoginDialog가 성공을 보고 창을 닫는다) */
async function signInFromDialog(page: Page, dialog: Locator) {
  await dialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
  await dialog.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill('TestPass1!');
  // dialog.tsx의 열린 직후 클릭 가드 - 위 fill 두 번이 그 시간을 채운다는 보장이 없다(protected-nav.spec.ts 선례)
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
  await dialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function expectNoErrorFeedback(page: Page) {
  await expect(page.getByText(TEXTS.messages.error.loginRequired)).toHaveCount(0);
  await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
  await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toHaveCount(0);
}

test.describe('비로그인 범위 칩 — 요청 없이 로그인을 유도한다', () => {
  let requests: PostListRequest[];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    requests = await mockPostListRejectingGuestScope(page);
  });

  test('꺼진 범위 칩 클릭 → 로그인 창, 칩·주소는 그대로이고 개인 필터 요청 없음', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await scopeChip(page, TEXTS.buttons.myPosts).click();

    const loginDialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });

    await expect(loginDialog).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);

    // 창이 떠 있는 동안 뒤 화면은 접근성 트리에서 빠진다 - 로그인하지 않고 닫은 뒤에 칩을 본다
    await page.keyboard.press('Escape');
    await expect(loginDialog).toBeHidden();
    await expect(scopeChip(page, TEXTS.buttons.myPosts)).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\/post$/);
    expect(requests.filter((request) => request.filter !== null)).toEqual([]);
  });

  test('범위 칩 클릭 → 로그인 성공 → 그 칩이 켜지고 토큰과 함께 조회한다', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await scopeChip(page, TEXTS.buttons.myPosts).click();
    await signInFromDialog(page, page.getByRole('dialog', { name: TEXTS.auth.guard.title }));

    await expect(page).toHaveURL(/\/post\?filter=isMyPosts$/);
    await expect(scopeChip(page, TEXTS.buttons.myPosts)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expectNoErrorFeedback(page);

    const scopeRequests = requests.filter((request) => request.filter === 'isMyPosts');

    expect(scopeRequests.length).toBeGreaterThan(0);
    expect(scopeRequests.every((request) => request.hasToken)).toBe(true);
  });

  test('개인 필터 주소로 바로 들어오면 목록 대신 로그인 안내가 뜨고 목록을 요청하지 않는다', async ({
    page,
  }) => {
    await page.goto('/post?filter=isPrivate');

    await expect(loginNotice(page)).toBeVisible();
    await expect(page.getByText(LOGIN_NOTICE.description)).toBeVisible();
    await expect(scopeChip(page, TEXTS.buttons.privateOnly)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // 라벨 칩은 카테고리 응답을 받아야 그려진다 - 여기까지 왔으면 첫 렌더가 보낸 요청은 목에 닿았다
    await expect(
      page.getByRole('group', { name: TEXTS.ariaLabels.postCategoryFilters }).getByRole('button')
    ).not.toHaveCount(0);

    expect(requests).toEqual([]);
    await expect(page).toHaveURL(/\/post\?filter=isPrivate$/);
    await expectNoErrorFeedback(page);
  });

  test('로그인 안내에서 칩을 끄면 로그인 없이 일반 목록으로 돌아간다', async ({ page }) => {
    await page.goto('/post?filter=isPrivate');
    await expect(loginNotice(page)).toBeVisible();

    await scopeChip(page, TEXTS.buttons.privateOnly).click();

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(loginNotice(page)).toBeHidden();
    await expect(page).toHaveURL(/\/post$/);
    expect(requests).toEqual([{ filter: null, hasToken: false }]);
  });
});

authTest.describe('범위 칩을 켠 채 로그인이 풀리거나, 로그인 복원 중일 때', () => {
  let requests: PostListRequest[];

  authTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    requests = await mockPostListRejectingGuestScope(page);
  });

  /** 칩을 켠 채(로그인 상태) 들어와 로그아웃한다 - 로그아웃이 끝나면 목록 자리가 로그인 안내로 바뀐다 */
  async function signOutWithScopeChipOn(page: Page) {
    await page.goto('/post?filter=isMyPosts');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();

    await expect(loginNotice(page)).toBeVisible();
  }

  authTest('칩을 켠 채 로그아웃하면 그 자리에서 로그인 안내로 바뀐다', async ({ page }) => {
    await signOutWithScopeChipOn(page);

    await expect(page.getByRole('link', { name: mockPost.title })).toBeHidden();
    // 로그인 페이지로 보내지 않고, 실패 안내도 띄우지 않는다
    await expect(page).toHaveURL(/\/post\?filter=isMyPosts$/);
    await expectNoErrorFeedback(page);

    // 로그아웃하는 순간 아직 떠 있던 목록이 토큰 없이 한 번 다시 요청할 수 있다(AuthUtil.clearQueries의
    // resetQueries, docs/AUTH.md §8-E) - 그 한 건 말고는 토큰 없는 개인 필터 요청이 없어야 한다
    const guestScopeRequests = requests.filter(
      (request) => !request.hasToken && isLoginOnly(request.filter)
    );

    expect(guestScopeRequests.length).toBeLessThanOrEqual(1);
  });

  authTest('로그인 안내의 버튼으로 다시 로그인하면 그 조건의 목록이 나온다', async ({ page }) => {
    await signOutWithScopeChipOn(page);

    const requestCountBeforeSignIn = requests.length;

    await page.getByRole('main').getByRole('button', { name: TEXTS.buttons.login }).click();
    await signInFromDialog(page, page.getByRole('dialog', { name: TEXTS.auth.guard.title }));

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(loginNotice(page)).toBeHidden();
    await expect(page).toHaveURL(/\/post\?filter=isMyPosts$/);
    await expectNoErrorFeedback(page);

    const requestsAfterSignIn = requests.slice(requestCountBeforeSignIn);

    expect(requestsAfterSignIn.length).toBeGreaterThan(0);
    expect(requestsAfterSignIn.every((request) => request.hasToken)).toBe(true);
  });

  authTest('로그인 복원이 끝나기 전에는 개인 필터 목록을 요청하지 않는다', async ({ page }) => {
    // 새로고침 직후 - 세션 흔적은 있지만 토큰은 refresh 응답이 와야 생긴다. 그 응답을 늦춰 복원 전 구간을 만든다
    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.refresh),
      async (route) => {
        await refreshGate;
        await route.fulfill({ json: wrapResponse(mockLoginResponse) });
      }
    );

    const refreshRequest = page.waitForRequest((request) =>
      isApiPath(new URL(request.url()), ENDPOINTS.auth.refresh)
    );

    await page.goto('/post?filter=isMyPosts');
    await refreshRequest;
    // 복원을 기다리는 동안 목록·미리 받기 요청이 나갔다면 목에 닿았을 시간
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);

    resolveRefresh();

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(loginNotice(page)).toBeHidden();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((request) => request.hasToken && request.filter === 'isMyPosts')).toBe(
      true
    );
  });
});
