import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockAddBookmarkFolder } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

/**
 * useAddBookmarkFolderMutation은 onMutate에서 낙관적 패치를 하지만, 성공 후
 * handleBookmarkFolderChangeSuccess(bookmark-folder.keys.ts:96-101)가
 * postInvalidateQueries.list()도 함께 호출해 GET /post를 다시 부른다. beforeEach의
 * 정적 mockPostList/mockAddBookmarkFolder만 쓰면 이 재조회가 항상 isBookmarked:false인
 * 고정값을 돌려줘, 방금 낙관적으로 채워진 아이콘을 도로 되돌리는 것처럼 보인다
 * (2026-09-11 실측 — post-visibility.spec.ts의 setupPostRoutes와 같은 이유의 상태
 * 유지 mock이 필요하다). 여기서 등록한 라우트가 나중에 등록되어(LIFO) beforeEach의
 * 정적 mock보다 먼저 매칭된다.
 */
function setupStatefulBookmarkRoutes(page: Page) {
  const state = { isBookmarked: false, folderIds: [] as string[] };
  const currentPost = () => ({
    ...mockPost,
    userInteractions: {
      ...mockPost.userInteractions,
      isBookmarked: state.isBookmarked,
      bookmarkFolderIds: state.folderIds,
    },
  });

  return Promise.all([
    page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({ json: wrapResponse({ ...mockPostListResponse, content: [currentPost()] }) })
    ),
    page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)),
      (route) => {
        state.isBookmarked = true;
        state.folderIds = [mockBookmarkFolder.id];
        return route.fulfill({
          json: wrapResponse({
            postId: mockPost.id,
            isBookmarked: true,
            folderIds: state.folderIds,
          }),
        });
      }
    ),
  ]).then(() => state);
}

test.describe('로그인 상태 — 게시글을 북마크 폴더에 저장', () => {
  test.beforeEach(async ({ page }) => {
    // 캐치올을 가장 먼저 등록한다 — auth.fixture.ts가 아니라 여기서 mockAuthRefresh를
    // 등록하는 이유도 같다(LIFO 등록 순서를 이 파일이 직접 통제).
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // Navbar가 로그인 상태에서 항상 GET /auth/account를 자동 호출한다(account.mock.ts
    // 참고) — 빠뜨리면 화면에 에러 토스트가 뜨는데 아래 assertion들은 이걸 못 잡는다.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await mockAddBookmarkFolder(page);
  });

  test('북마크 버튼 클릭 → 폴더 선택 → 저장 후 모달이 닫히고 아이콘이 북마크 상태로 바뀐다', async ({
    page,
  }) => {
    await setupStatefulBookmarkRoutes(page);

    // 계정 조회(GET /auth/account)가 실제로 모킹 응답을 받았는지 확인한다. 캐치올에
    // 막히면(abort) 이 요청은 'response' 이벤트 없이 'requestfailed'로 끝나서 아래
    // waitForResponse가 타임아웃으로 실패한다 — 토스트가 뜬 뒤에야 사라지는 타이밍에
    // 기대는 .not.toBeVisible() 방식은 스냅샷 시점이 토스트보다 빨라 조용히 통과해버리는
    // 걸 실측해서(2026-09-10) 네트워크 응답 자체를 기다리는 방식으로 바꿨다.
    const accountResponse = page.waitForResponse((res) => res.url().includes('/auth/account'));

    await page.goto('/post');

    // has-session 플래그가 있어 AppShellLayout이 /auth/refresh 완료까지 스피너를
    // 띄운다(AppShellLayout.tsx:19-21) — refresh가 성공하면 accessToken이 zustand
    // 메모리에 세팅되고(auth.store.ts) 목록이 렌더된다.
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await accountResponse;

    // 북마크 버튼(아직 미북마크 상태라 name은 '북마크 저장', BookmarkPostButton.tsx:45)
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

    const folderModal = page.getByRole('dialog');
    await expect(folderModal).toBeVisible();

    // handleBookmarkFolderChangeSuccess가 postInvalidateQueries.list()도 호출해 목록을
    // 재조회한다 — 낙관적 업데이트가 그 재조회로 되돌아가지 않고 그대로 유지되는지
    // 확인하려면 이 재조회 응답 자체를 기다려야 한다(setupStatefulBookmarkRoutes 참고).
    const listRefetch = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.status() === 200
    );

    // 폴더 행 탭 = 즉시 저장(PostCardBookmarkFolderModal.tsx) — 저장 성공 후 모달이 닫힌다
    await folderModal.getByRole('button', { name: mockBookmarkFolder.name }).click();
    await expect(folderModal).not.toBeVisible();

    await listRefetch;
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkChange })).toBeVisible();
  });
});
