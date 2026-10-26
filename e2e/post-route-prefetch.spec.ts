import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';

// 피드·상세는 lazy 페이지 청크 밖(app/routes의 PostFeedRoute·PostDetailRoute)에서 게시글 목록·상세·댓글
// 요청을 시작한다 - 페이지 청크가 도착해 렌더된 뒤에야 요청하던 직렬 대기를 없앤 것이다(docs/PERFORMANCE.md
// "LCP 후보 이미지"). 페이지 모듈을 붙잡아 두면 청크가 늦게 오는 느린 회선을 그대로 흉내 낼 수 있다.

interface RequestLog {
  list: number;
  detail: number;
  comments: number;
}

function logPostRequests(page: Page, log: RequestLog): void {
  page.on('request', (request) => {
    const url = new URL(request.url());

    if (isApiPath(url, ENDPOINTS.post.base)) {
      log.list += 1;
    } else if (/^\/api\/post\/[^/]+$/.test(url.pathname)) {
      log.detail += 1;
    } else if (/^\/api\/post\/[^/]+\/comment$/.test(url.pathname)) {
      log.comments += 1;
    }
  });
}

/** Vite dev가 내려주는 페이지 모듈 요청을 release()를 부를 때까지 붙잡아 둔다 */
async function holdModule(page: Page, pathname: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = { requested: false };

  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      state.requested = true;
      await released;
      await route.continue();
    }
  );

  return { state, release };
}

test.describe('페이지 청크보다 먼저 시작하는 게시글 요청', () => {
  let log: RequestLog;

  test.beforeEach(async ({ page }) => {
    log = { list: 0, detail: 0, comments: 0 };
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page);
    logPostRequests(page, log);
  });

  test('피드 청크가 오기 전에 목록을 요청하고, 청크가 온 뒤에도 한 번만 요청한다', async ({
    page,
  }) => {
    const feedModule = await holdModule(page, '/src/pages/post/index.tsx');

    // 붙잡아 둔 모듈은 load 이벤트를 늦출 수 있어 문서 응답까지만 기다린다
    await page.goto('/post', { waitUntil: 'commit' });

    await expect.poll(() => feedModule.state.requested).toBe(true);
    await expect.poll(() => log.list).toBe(1);
    await expect(page.getByRole('link', { name: mockPost.title })).toHaveCount(0);

    feedModule.release();

    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    // 목록 화면이 같은 조건을 따로 요청하지 않는지 잠시 지켜본다
    await page.waitForTimeout(300);
    expect(log.list).toBe(1);
  });

  test('상세 청크가 오기 전에 게시글과 댓글을 요청하고, 청크가 온 뒤에도 각각 한 번만 요청한다', async ({
    page,
  }) => {
    const detailModule = await holdModule(page, '/src/pages/post/PostDetailPage.tsx');

    await page.goto(`/post/${mockPost.id}`, { waitUntil: 'commit' });

    await expect.poll(() => detailModule.state.requested).toBe(true);
    await expect.poll(() => log.detail).toBe(1);
    await expect.poll(() => log.comments).toBe(1);
    await expect(page.getByText(mockComment.content)).toHaveCount(0);

    detailModule.release();

    await expect(page.getByText(mockComment.content)).toBeVisible();
    await page.waitForTimeout(300);
    expect(log.detail).toBe(1);
    expect(log.comments).toBe(1);
  });
});
