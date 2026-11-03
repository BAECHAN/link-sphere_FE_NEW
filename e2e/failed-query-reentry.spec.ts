import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import type { MyComment } from '@/entities/comment/model/comment.schema';
import { TEXTS } from '@/shared/config/texts';

// suspense 화면이 조회에 실패한 뒤 다른 화면에 갔다가 돌아오면 다시 요청하는지(#491 후속 3번). 실패한 쿼리가
// 캐시에 남으면 에러 경계가 리셋되기 전이라 요청 없이 같은 에러를 다시 던진다. 돌아올 때는 카드 클릭 대신
// 뒤로가기를 쓴다 - 카드 hover 미리 받기가 실패한 쿼리를 대신 지워 이 문제를 가린다.

type UrlMatcher = (url: URL) => boolean;

/** recover()를 부를 때까지 matcher에 맞는 요청을 500으로 끝내고, 그 뒤로는 먼저 등록한 목으로 넘긴다 */
async function failUntilRecovered(page: Page, matcher: UrlMatcher) {
  const state = { failing: true, requests: 0 };

  await page.route(matcher, (route) => {
    state.requests += 1;

    if (state.failing) {
      return route.fulfill({
        status: 500,
        json: { status: 500, message: 'server error', data: null, timestamp: '' },
      });
    }

    return route.fallback();
  });

  return {
    state,
    recover: () => {
      state.failing = false;
    },
  };
}

// 이동은 transition이라(RouterProvider.tsx의 v7_startTransition) 주소가 먼저 바뀌고 화면은 청크가 온 뒤에 바뀐다.
// 떠난 화면이 실제로 내려간 뒤에 돌아오도록 도착한 화면에만 있는 제목을 기다린다.
async function expectFeedShown(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Recent Links' })).toBeVisible();
  await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
}

const isPostDetail: UrlMatcher = (url) => /^\/api\/post\/[^/]+$/.test(url.pathname);
const isComments: UrlMatcher = (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname);
const isPostList: UrlMatcher = (url) => isApiPath(url, '/post');
const isMyComments: UrlMatcher = (url) => isApiPath(url, '/comment/my');

const myComment: MyComment = {
  id: 'my-comment-reentry',
  content: '다시 들어오면 보여야 하는 내 댓글',
  createdAt: '2026-11-03T00:00:00.000Z',
  postId: mockPost.id,
  postTitle: mockPost.title,
};

test.describe('조회에 실패한 화면에 다시 들어오기', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
    await page.route(isMyComments, (route) =>
      route.fulfill({
        json: wrapResponse({
          page: 0,
          size: 10,
          content: [myComment],
          totalElements: 1,
          totalPages: 1,
          last: true,
        }),
      })
    );
  });

  test('상세 조회가 실패한 뒤 피드에 갔다가 뒤로가기로 돌아오면 다시 요청해 글을 보여준다', async ({
    page,
  }) => {
    const detail = await failUntilRecovered(page, isPostDetail);

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toBeVisible();

    await page.getByRole('link', { name: TEXTS.nav.feed }).click();
    await expectFeedShown(page);
    detail.recover();
    const requestsBeforeReturn = detail.state.requests;

    await page.goBack();

    // 피드 카드 제목도 h3라, 피드가 내려가기 전에는 아래 제목 단정이 피드 카드로 먼저 통과해 버린다
    await expect(page.getByRole('heading', { level: 1, name: 'Recent Links' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toHaveCount(0);
    expect(detail.state.requests).toBeGreaterThan(requestsBeforeReturn);
  });

  test('댓글 조회가 실패한 뒤 피드에 갔다가 뒤로가기로 돌아오면 다시 요청해 댓글을 보여준다', async ({
    page,
  }) => {
    const comments = await failUntilRecovered(page, isComments);

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByText(TEXTS.errors.unexpected.title)).toBeVisible();

    await page.getByRole('link', { name: TEXTS.nav.feed }).click();
    await expectFeedShown(page);
    comments.recover();

    await page.goBack();

    await expect(page.getByText(mockComment.content)).toBeVisible();
    await expect(page.getByText(TEXTS.errors.unexpected.title)).toHaveCount(0);
  });

  test('피드 목록 조회가 실패한 뒤 북마크에 갔다가 뒤로가기로 돌아오면 다시 요청해 목록을 보여준다', async ({
    page,
  }) => {
    const list = await failUntilRecovered(page, isPostList);

    await page.goto('/post');
    await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toBeVisible();

    await page.getByRole('link', { name: TEXTS.nav.bookmark }).click();
    await expect(
      page.getByRole('textbox', { name: TEXTS.placeholders.bookmarkSearch })
    ).toBeVisible();
    list.recover();

    await page.goBack();

    await expectFeedShown(page);
    await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toHaveCount(0);
  });

  test('내 댓글 조회가 실패한 뒤 피드에 갔다가 뒤로가기로 돌아오면 다시 요청해 목록을 보여준다', async ({
    page,
  }) => {
    const myComments = await failUntilRecovered(page, isMyComments);

    await page.goto('/my/comments');
    await expect(page.getByText(TEXTS.comment.myList.loadError)).toBeVisible();

    await page.getByRole('link', { name: TEXTS.nav.feed }).click();
    await expectFeedShown(page);
    myComments.recover();

    await page.goBack();

    await expect(page.getByText(TEXTS.comment.myList.loadError)).toHaveCount(0);
    await expect(page.getByText(myComment.content)).toBeVisible();
  });
});
