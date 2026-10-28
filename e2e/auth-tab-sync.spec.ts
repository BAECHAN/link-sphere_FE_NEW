import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';

// 같은 브라우저 컨텍스트의 두 페이지는 localStorage를 공유하고 서로의 storage 이벤트를 받는다 -
// 실제 브라우저의 두 탭과 같다. 인증 세대(auth-epoch.util.ts)가 바뀌면 다른 탭이 useAuthEpochSync로
// 따라온다(docs/AUTH.md §8-H).

const VALID_PASSWORD = 'TestPass1!';
/** 만료 응답 뒤 refresh·재전송이 이어지지 않는지 지켜보는 시간 - 고치기 전 코드는 수 ms 안에 이어졌다 */
const NO_FOLLOW_UP_WAIT_MS = 500;

/** 페이지마다 route를 따로 건다(page.route는 페이지 단위) */
async function installMocks(page: Page) {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockLoginSuccess(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await mockBookmarkFolderList(page);
  await mockBookmarkFolderPosts(page);
}

test.describe('탭 간 로그인·로그아웃 동기화', () => {
  test('한 탭에서 로그아웃하면 보호 페이지에 있던 다른 탭도 로그아웃되고 /post로 옮긴다', async ({
    context,
  }) => {
    // 두 탭 모두 이전 로그인 흔적이 있는 상태로 연다(auth.fixture.ts와 같은 시딩을 컨텍스트 전체에)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const bookmarkTab = await context.newPage();
    const feedTab = await context.newPage();
    await installMocks(bookmarkTab);
    await installMocks(feedTab);

    await bookmarkTab.goto('/bookmark');
    await expect(
      bookmarkTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();

    await feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await feedTab.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await expect(bookmarkTab).toHaveURL(/\/post$/);
    await expect(bookmarkTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
  });

  test('한 탭에서 로그인하면 로그아웃 상태이던 다른 탭도 로그인된다', async ({ context }) => {
    const feedTab = await context.newPage();
    const loginTab = await context.newPage();
    await installMocks(feedTab);
    await installMocks(loginTab);

    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await loginTab.goto('/auth/login');
    await loginTab.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await loginTab.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await loginTab.getByRole('button', { name: TEXTS.auth.login.signIn }).click();
    await expect(loginTab).toHaveURL(/\/post$/);

    // 다른 탭은 쿠키로 세션을 받아들인다(여기서는 /auth/refresh 모킹)
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
  });

  test('다른 탭에서 다시 로그인한 순간 진행 중이던 요청은 TOKEN_EXPIRED를 받아도 갱신·재전송하지 않는다', async ({
    context,
  }) => {
    // 공유 refresh 쿠키가 이미 새 계정의 것일 수 있어, 갱신·재전송하면 그 요청이 새 계정으로 실행된다
    // (docs/AUTH.md §8-B "인증 세대가 바뀐 뒤 돌아온 401")
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const feedTab = await context.newPage();
    await installMocks(feedTab);

    let likeRequests = 0;
    let releaseLike!: () => void;
    const likeHeld = new Promise<void>((resolve) => {
      releaseLike = resolve;
    });
    await feedTab.route(
      (url) => /^\/api\/post\/[^/]+\/like$/.test(url.pathname),
      async (route) => {
        likeRequests += 1;

        // 첫 요청만 서버에 머물다 만료로 돌아온다 - 재전송되면 성공해 버린다(새 계정으로 실행된 것)
        if (likeRequests > 1) {
          return route.fulfill({
            json: {
              status: 200,
              message: 'ok',
              data: { isLiked: true, likeCount: 1 },
              timestamp: '',
            },
          });
        }

        await likeHeld;

        return route.fulfill({
          status: 401,
          json: {
            status: 401,
            code: SERVER_ERROR_CODE.TOKEN_EXPIRED,
            message: 'expired',
            timestamp: new Date().toISOString(),
          },
        });
      }
    );
    let refreshRequests = 0;
    feedTab.on('request', (request) => {
      if (isApiPath(new URL(request.url()), ENDPOINTS.auth.refresh)) {
        refreshRequests += 1;
      }
    });

    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    // exact — 이름 부분 일치면 피드의 "좋아요한" 범위 칩이 먼저 걸린다
    await feedTab
      .getByRole('button', { name: TEXTS.ariaLabels.postLike, exact: true })
      .first()
      .click();
    await expect.poll(() => likeRequests).toBe(1);

    // 좋아요가 서버에 가 있는 사이 다른 탭에서 로그인했다 - 이 탭은 쿠키로 새 세션을 받아들인다
    const otherTab = await context.newPage();
    await installMocks(otherTab);
    await otherTab.goto('/post');
    const refreshBeforeSignIn = refreshRequests;
    await otherTab.evaluate(
      ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
      [STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab'] as const
    );
    await expect.poll(() => refreshRequests).toBe(refreshBeforeSignIn + 1);

    const expiredResponse = feedTab.waitForResponse((response) =>
      /^\/api\/post\/[^/]+\/like$/.test(new URL(response.url()).pathname)
    );
    releaseLike();
    await expiredResponse;

    // 고치기 전에는 만료 응답 직후 refresh → 원 요청 재전송이 이어졌다. "더 나가지 않음"은 기다려 봐야 알 수 있다
    await feedTab.waitForTimeout(NO_FOLLOW_UP_WAIT_MS);
    expect(likeRequests).toBe(1);
    expect(refreshRequests).toBe(refreshBeforeSignIn + 1);
    // 서버 값으로 다시 맞춰진다(받아들이기의 재조회) - 재전송돼 성공했다면 좋아요 상태로 남는다
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.postUnlike })).toHaveCount(0);
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
  });

  test('받아들이려던 세션이 다른 계정이면(BE 409 SESSION_MISMATCH) 보호 화면을 떠나 그 계정으로 복원하고 알린다', async ({
    context,
  }) => {
    // 토큰을 든 살아 있는 탭이 다른 탭의 로그인을 받으면 같은 사람이라 보고 이동 없이 받아들이는데(§8-H), BE가
    // 들고 있던 토큰과 쿠키 주인이 다른 회원이라며 거절하면 이전 계정의 화면을 떠나야 한다(docs/AUTH.md §8-B)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const bookmarkTab = await context.newPage();
    await installMocks(bookmarkTab);
    // BE처럼: 토큰을 실어 보내면(이 탭의 옛 계정) 409, 없이 보내면(새로고침·로그아웃 뒤) 쿠키 주인 계정의 토큰
    const hints: Array<string | null> = [];
    await bookmarkTab.route(
      (url) => isApiPath(url, ENDPOINTS.auth.refresh),
      (route) => {
        const hint = route.request().headers()['x-access-token'] ?? null;
        hints.push(hint);

        if (hint) {
          return route.fulfill({
            status: 409,
            json: {
              status: 409,
              code: SERVER_ERROR_CODE.SESSION_MISMATCH,
              message: 'session mismatch',
              timestamp: new Date().toISOString(),
            },
          });
        }

        return route.fulfill({ json: wrapResponse(mockLoginResponse) });
      }
    );

    await bookmarkTab.goto('/bookmark');
    await expect(
      bookmarkTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();

    // 다른 탭에서 (다른 계정으로) 로그인했다
    const otherTab = await context.newPage();
    await installMocks(otherTab);
    await otherTab.goto('/post');
    await otherTab.evaluate(
      ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
      [STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab'] as const
    );

    await expect(bookmarkTab).toHaveURL(/\/post$/);
    await expect(bookmarkTab.getByText(TEXTS.messages.info.switchedToOtherAccount)).toBeVisible();
    await expect(
      bookmarkTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
    // 부트스트랩(헤더 없음) → 받아들이기(옛 토큰, 409) → 로그아웃 뒤 복원(헤더 없음)
    expect(hints).toEqual([null, mockLoginResponse.accessToken, null]);
  });
});

// 쓰는 중에 다른 탭이 로그아웃하면 그 탭은 화면을 떠나지 않고 그 자리에서 다시 로그인하게 한다 - 이동하면 쓰던 글이 확인 없이
// 사라진다(docs/plans/2026-10-28-keep-writing-in-place.md, AuthUtil.reflectSignOutFromElsewhere)
test.describe('쓰는 중에 다른 탭에서 로그아웃', () => {
  const NEW_URL = 'https://newlink.example.com/article';
  const NEW_POST = { ...mockPost, id: 'post-uuid-new', url: NEW_URL, title: '새로 등록한 링크' };
  const COMMENT_PATH = /^\/api\/post\/[^/]+\/comment$/;

  /** 두 탭 모두 이전 로그인 흔적이 있는 상태로 열고, 쓰는 탭과 로그아웃할 탭을 준비한다 */
  async function openWritingAndFeedTabs(context: BrowserContext) {
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const writingTab = await context.newPage();
    const feedTab = await context.newPage();
    await installMocks(writingTab);
    await installMocks(feedTab);

    return { writingTab, feedTab };
  }

  /** 등록 요청은 성공하고, 목록 조회는 그대로 둔다(mockPostList와 같은 경로) */
  async function mockPostCreate(page: Page) {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ json: wrapResponse(NEW_POST) })
          : route.fallback()
    );
  }

  async function startWritingPost(page: Page) {
    await page.goto('/post/submit');
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다
    await page.getByLabel(/^URL/).fill(NEW_URL);
  }

  /** 글 상세에서 댓글을 쓰기 시작한다 - 댓글 목록은 비어 있다 */
  async function startWritingComment(page: Page, content: string) {
    await mockPostDetail(page);
    await page.route(
      (url) => COMMENT_PATH.test(url.pathname),
      (route) => route.fulfill({ json: wrapResponse([]) })
    );
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    const commentInput = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    await commentInput.fill(content);

    return commentInput;
  }

  /** 다른 계정 - 로그인한 뒤의 계정 조회는 그 계정을 돌려준다 */
  async function mockSignInAsOtherMember(page: Page) {
    let signedInAsOther = false;
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.login),
      (route) => {
        signedInAsOther = true;
        return route.fulfill({
          json: wrapResponse({ ...mockLoginResponse, accessToken: 'other-member-token' }),
        });
      }
    );
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.account),
      (route) =>
        signedInAsOther
          ? route.fulfill({
              json: wrapResponse({ ...mockAccount, id: 'other-member-id', nickname: 'other' }),
            })
          : route.fallback()
    );
  }

  async function signOutFrom(page: Page) {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
  }

  async function signInFromDialog(page: Page, dialog: Locator) {
    await dialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await dialog.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    // dialog.tsx의 열린 직후 클릭 가드 - 위 fill 두 번이 그 시간을 채운다는 보장이 없다(protected-nav.spec.ts 선례)
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await dialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  /** 확인창은 열린 직후 클릭을 무시한다(useOpenClickGuard) - 가드 시간을 흘려보낸 뒤 누른다 */
  async function answerLeaveConfirm(page: Page, name: string) {
    const confirm = page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title });
    await expect(confirm).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirm.getByRole('button', { name }).click();
    await expect(confirm).toBeHidden();
  }

  test('글 등록 화면에서 쓰는 중이면 보호 화면이어도 옮기지 않고 그 자리에 로그인 창을 띄우며, 같은 계정으로 다시 로그인하면 이어서 등록한다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    await mockPostCreate(writingTab);
    await startWritingPost(writingTab);

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(TEXTS.auth.guard.signedOutElsewhere.description)).toBeVisible();
    await expect(writingTab).toHaveURL(/\/post\/submit$/);
    // 저장을 누르지 않았어도 로그아웃된 동안에는 폼 안에 안내가 보인다 - 저장 중 만료와 같다
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();

    await signInFromDialog(writingTab, dialog);

    await expect(writingTab).toHaveURL(/\/post\/submit$/);
    await expect(writingTab.getByLabel(/^URL/)).toHaveValue(NEW_URL);
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toHaveCount(0);

    await writingTab.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(writingTab).toHaveURL(/\/post$/);
    await expect(
      writingTab.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
    ).toHaveCount(0);
  });

  test('글 상세에서 댓글을 쓰는 중이면 그 자리에 로그인 창을 띄우고, 같은 계정으로 다시 로그인하면 쓰던 댓글을 등록한다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    await mockPostDetail(writingTab);
    let commentCreated = false;
    await writingTab.route(
      (url) => COMMENT_PATH.test(url.pathname),
      (route) => {
        if (route.request().method() === 'POST') {
          commentCreated = true;
          return route.fulfill({ status: 201, json: wrapResponse(mockComment) });
        }

        return route.fulfill({ json: wrapResponse(commentCreated ? [mockComment] : []) });
      }
    );

    await writingTab.goto(`/post/${mockPost.id}`);
    await expect(
      writingTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
    const commentInput = writingTab.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    await commentInput.fill('다른 탭 로그아웃 중에 쓴 댓글');

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await expect(dialog).toBeVisible();
    await expect(writingTab).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await signInFromDialog(writingTab, dialog);

    await expect(commentInput).toHaveValue('다른 탭 로그아웃 중에 쓴 댓글');
    await writingTab.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();

    await expect(writingTab.getByText(mockComment.content)).toBeVisible();
    expect(commentCreated).toBe(true);
  });

  test('로그인 없이 창을 닫으면 이탈 확인창이 묻고, 계속 작성을 고르면 그 자리에 남으며, 다른 메뉴로 가려 하면 다시 묻고 나가기를 고르면 떠난다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    await startWritingPost(writingTab);

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await expect(dialog).toBeVisible();
    await writingTab.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 보호 화면은 로그인 없이 쓸 수 없어 피드로 보내려 하고, 쓰는 중이라 이탈 확인창이 막는다
    await answerLeaveConfirm(writingTab, TEXTS.unsavedChanges.cancel);

    await expect(writingTab).toHaveURL(/\/post\/submit$/);
    await expect(writingTab.getByLabel(/^URL/)).toHaveValue(NEW_URL);
    // 창을 닫아도 로그아웃됐다는 것은 폼 안 안내로 남는다
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();
    // 계속 쓰기로 했으니 로그인 창을 다시 열거나 다시 묻지 않는다
    await writingTab.waitForTimeout(NO_FOLLOW_UP_WAIT_MS);
    await expect(writingTab.getByRole('dialog')).toHaveCount(0);
    await expect(writingTab.getByRole('alertdialog')).toHaveCount(0);

    await writingTab.getByRole('link', { name: TEXTS.nav.feed }).click();
    await answerLeaveConfirm(writingTab, TEXTS.unsavedChanges.confirm);

    await expect(writingTab).toHaveURL(/\/post$/);
  });

  test('로그인 없이 창을 닫고 계속 쓰다 등록을 누르면 보내지 않고 같은 로그인 창을 다시 띄우며, 로그인한 뒤 다시 누르면 등록한다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    let createRequests = 0;
    await writingTab.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) => {
        if (route.request().method() !== 'POST') {
          return route.fallback();
        }

        createRequests += 1;
        return route.fulfill({ json: wrapResponse(NEW_POST) });
      }
    );
    await startWritingPost(writingTab);

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await expect(dialog).toBeVisible();
    await writingTab.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await answerLeaveConfirm(writingTab, TEXTS.unsavedChanges.cancel);

    // 댓글·답글 등록과 같은 가드(useAuthGuard) - 로그인이 풀렸을 때 뜬 그 창이 다시 뜬다
    await writingTab.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(dialog).toBeVisible();
    expect(createRequests).toBe(0);
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();

    await signInFromDialog(writingTab, dialog);

    await expect(writingTab).toHaveURL(/\/post\/submit$/);
    await expect(writingTab.getByLabel(/^URL/)).toHaveValue(NEW_URL);
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toHaveCount(0);

    await writingTab.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(writingTab).toHaveURL(/\/post$/);
    expect(createRequests).toBe(1);
  });

  test('창에서 다른 계정으로 로그인하면 이전 계정으로 쓰던 글을 묻지 않고 버린 채 /post로 간다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    await mockSignInAsOtherMember(writingTab);
    await startWritingPost(writingTab);

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await signInFromDialog(writingTab, dialog);

    await expect(writingTab).toHaveURL(/\/post$/);
    await expect(
      writingTab.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
    ).toHaveCount(0);
    await expect(
      writingTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
  });

  test('글 상세에서 댓글을 쓰다 로그인 없이 창을 닫으면 그 자리에 남고, 다른 메뉴로 가려 하면 이탈 확인창이 묻고 나가기를 고르면 떠난다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    const commentInput = await startWritingComment(writingTab, '창을 닫고 남긴 댓글');

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await expect(dialog).toBeVisible();
    await writingTab.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 공개 화면이라 창을 닫아도 같은 주소에 남는다 - 이탈 확인창도 뜨지 않는다
    await expect(writingTab).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    await expect(commentInput).toHaveValue('창을 닫고 남긴 댓글');
    await expect(writingTab.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();
    await expect(writingTab.getByRole('alertdialog')).toHaveCount(0);

    await writingTab.getByRole('link', { name: TEXTS.nav.feed }).click();
    await answerLeaveConfirm(writingTab, TEXTS.unsavedChanges.confirm);

    await expect(writingTab).toHaveURL(/\/post$/);
  });

  test('글 상세에서 댓글을 쓰다 창에서 다른 계정으로 로그인하면 쓰던 댓글을 묻지 않고 버린 채 /post로 간다', async ({
    context,
  }) => {
    const { writingTab, feedTab } = await openWritingAndFeedTabs(context);
    await mockSignInAsOtherMember(writingTab);
    await startWritingComment(writingTab, '이전 계정으로 쓴 댓글');

    await signOutFrom(feedTab);

    const dialog = writingTab.getByRole('dialog', {
      name: TEXTS.auth.guard.signedOutElsewhere.title,
    });
    await signInFromDialog(writingTab, dialog);

    await expect(writingTab).toHaveURL(/\/post$/);
    await expect(
      writingTab.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
    ).toHaveCount(0);
    await expect(writingTab.getByText('이전 계정으로 쓴 댓글')).toHaveCount(0);
  });
});
