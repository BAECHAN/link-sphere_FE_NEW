import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 터치 기기에는 hover가 없지만 탭하면 브라우저가 mouseenter를 함께 보내 카드의 미리 받기가 돈다. 그래서 댓글이 0개인
// 글(목록 픽스처가 0개다)은 탭해도 데스크톱처럼 빈 목록이 심겨, 상세가 댓글 응답을 기다리지 않는다(seedEmptyComments).
test('댓글이 0개인 글을 탭하면 댓글 응답을 기다리지 않고 상세를 그린 뒤 한 번 다시 받는다', async ({
  page,
}) => {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await mockPostDetail(page);

  let commentRequests = 0;
  let releaseComments = () => {};
  const commentsReleased = new Promise<void>((resolve) => {
    releaseComments = resolve;
  });
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
    async (route) => {
      commentRequests += 1;
      await commentsReleased;
      await route.fulfill({ json: wrapResponse([mockComment]) });
    }
  );

  await page.goto('/post');
  await page.getByRole('link', { name: mockPost.title }).tap();

  // 댓글 응답을 붙잡아 둔 채로 보인다 - 기다렸다면 여기서 시간이 초과된다
  await expect(page.getByText(TEXTS.comment.list.empty)).toBeVisible();
  await expect.poll(() => commentRequests).toBe(1);

  releaseComments();

  await expect(page.getByText(mockComment.content)).toBeVisible();
  expect(commentRequests).toBe(1);
});
