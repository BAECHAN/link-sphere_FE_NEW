import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail, mockDeletePost } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

const DETAIL_CHUNK_DELAY_MS = 300;

test.describe('게시글 삭제', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner 판정(usePostCard.ts)에 필수 — account.id === mockPost.author.id라 소유자로 간주된다.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    // 댓글 자체는 이 스펙의 검증 대상이 아니다(like.spec.ts와 동일 패턴).
    await mockComments(page, []);
    // mockPostDetail(GET)과 pathname이 완전히 같으므로 반드시 그 다음에 등록한다(post.mock.ts 주석).
    await mockDeletePost(page);
  });

  test('소유자가 상세에서 삭제하면 /post로 돌아오고, 재조회 없이 목록에서도 사라진다', async ({
    page,
  }) => {
    let postListRequestCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/post') {
        postListRequestCount += 1;
      }
    });

    // 상세 페이지 청크(lazy)를 일부러 늦춰, 상세가 뜨기 전에 조작하는 회귀가 매번 드러나게 한다
    // (아래 대기를 빼고 직접 확인: 20/20 실패 — 목록 카드에서 연 삭제 확인창의 버튼이 전환 커밋
    // 뒤 끝내 눌리지 않는다). vite dev 서버의 모듈 경로라 파일을 옮기면 이 경로도 바꾼다.
    await page.route('**/src/pages/post/PostDetailPage.tsx*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, DETAIL_CHUNK_DELAY_MS));
      await route.continue();
    });

    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // URL은 화면 전환보다 먼저 바뀐다 — RouterProvider의 v7_startTransition 아래에서 React가
    // lazy 상세 청크가 올 때까지 목록 화면을 그대로 두므로, 여기서 바로 ⋮를 누르면 목록 카드의
    // 메뉴가 열렸다가 목록째 사라진다("detached from DOM"). 직접 확인: 이 대기 없이 20회 중
    // 17회 실패했고 실패는 전부 목록 카드의 ⋮, 통과는 전부 상세 카드의 ⋮였다. 상세 GET은 매번
    // 1회였다(prefetch와 요청 공유 — 예전 주석의 "두 번째 GET이 Suspense를 재발동" 설명은 틀렸다).
    // 상세에만 있는 버튼으로 전환 커밋을 기다린다(docs/TESTING.md "자주 발생하는 문제" 13).
    await expect(page.getByRole('button', { name: TEXTS.post.detail.backToList })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.delete }).click();

    // usePostCard.ts의 e.preventDefault() 때문에 드롭다운이 자동으로 닫히지 않아, confirm이
    // 뜬 시점에 menuitem '삭제'가 아직 DOM에 남아있다(radix composeEventHandlers). role이
    // 달라(menuitem vs button) 충돌하지 않지만, 추론에 기대지 않고 alertdialog로 스코프한다.
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    // 메뉴에서 "삭제"를 직접 눌러야만 뜨는 다이얼로그라 이미 삭제를 결심한 상태다 -
    // 열리자마자 삭제 버튼에 포커스가 가 있어야 한다(usePostDelete.ts, § 2026-09-29).
    await expect(confirmDialog.getByRole('button', { name: TEXTS.buttons.delete })).toBeFocused();

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 클릭 자체를 삼키므로
    // waitForResponse 같은 관측 가능한 이벤트로 대체할 수 없다(bookmark.spec.ts 선례).
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    const deleted = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();
    await deleted;

    await expect(page).toHaveURL(/\/post$/);
    // "사라져야 한다"를 "나타나야 한다"로 뒤집는다 — 낙관적 제거로 content가 0개가 되어
    // 빈 상태 문구가 뜨는 것을 양성 단언한다(.not.toBeVisible()의 실측된 false negative 회피).
    await expect(page.getByText(TEXTS.messages.info.noPosts)).toBeVisible();
    // 목록이 재조회 없이(onSuccess가 post 목록을 invalidate하지 않음, bookmark-folder.keys.ts)
    // onMutate의 낙관적 patch만으로 비었음을 증명한다.
    expect(postListRequestCount).toBe(1);
  });

  test('상세에서 삭제한 뒤 뒤로가기하면 삭제된 글을 캐시로 다시 그리지 않는다', async ({
    page,
  }) => {
    let detailGetCount = 0;
    page.on('request', (req) => {
      if (/^\/api\/post\/[^/]+$/.test(new URL(req.url()).pathname) && req.method() === 'GET') {
        detailGetCount += 1;
      }
    });

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('button', { name: TEXTS.post.detail.backToList })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.delete }).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    const deleted = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();
    await deleted;
    await expect(page).toHaveURL(/\/post$/);

    // 상세가 떠 있는 동안 detail 캐시를 지워도 재조회가 일어나지 않아야 한다 — 일어나면
    // 이동 직전에 404 안내 화면이 깜빡인다.
    const getsBeforeBack = detailGetCount;
    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toHaveCount(0);

    // 서버에서 글이 지워진 상태를 재현한다(이후 상세 GET은 404). LIFO라 위 목들보다 먼저 탄다.
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({
              status: 404,
              json: {
                status: 404,
                code: 'POST_NOT_FOUND',
                message: '게시글을 찾을 수 없습니다.',
                timestamp: new Date().toISOString(),
              },
            })
          : route.fallback()
    );

    await page.goBack();

    // 캐시가 남아 있었다면 재조회 없이 삭제된 글이 그려졌다 — 지금은 다시 받아와 그 자리에서 404 안내를 띄운다.
    await expect(page.getByText(TEXTS.post.detail.notFound.title)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    expect(detailGetCount).toBeGreaterThan(getsBeforeBack);
  });
});
