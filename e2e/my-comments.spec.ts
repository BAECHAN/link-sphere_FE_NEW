import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import type { MyComment } from '@/entities/comment/model/comment.schema';
import { TEXTS } from '@/shared/config/texts';

const IMAGE_A = 'https://xyz.supabase.co/storage/v1/object/public/comment-images/a1b2.webp';
const IMAGE_B = 'https://xyz.supabase.co/storage/v1/object/public/comment-images/c3d4.png';

// BE는 첨부 이미지를 본문 끝에 "한 줄에 URL 하나"로 이어 붙여 저장한다(CommentService.buildFinalContent).
const myComments: MyComment[] = [
  {
    id: 'comment-text-only',
    content: '비슷한 문제를 겪었는데 staleTime을 줄이니까 해결됐어요.',
    createdAt: '2026-10-02T00:00:00.000Z',
    postId: 'post-uuid-1',
    postTitle: 'React Query 무효화 전략 정리',
  },
  {
    id: 'comment-text-images',
    content: `이 글 덕분에 캐시 무효화 순서를 이해했어요\n\n${IMAGE_A}\n${IMAGE_B}`,
    createdAt: '2026-10-01T00:00:00.000Z',
    postId: 'post-uuid-1',
    postTitle: 'React Query 무효화 전략 정리',
  },
  {
    id: 'comment-image-only',
    content: IMAGE_A,
    createdAt: '2026-09-30T00:00:00.000Z',
    postId: 'post-uuid-2',
    postTitle: '오늘 찍은 사무실 셋업',
  },
];

test.describe('내 댓글 카드', () => {
  test('첨부 이미지 주소는 글자로 노출하지 않고 개수로만 알린다', async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await page.route(
      (url) => isApiPath(url, '/comment/my'),
      (route) =>
        route.fulfill({
          json: wrapResponse({
            page: 0,
            size: 10,
            content: myComments,
            totalElements: myComments.length,
            totalPages: 1,
            last: true,
          }),
        })
    );

    await page.goto('/my/comments');

    await expect(
      page.getByText('비슷한 문제를 겪었는데 staleTime을 줄이니까 해결됐어요.')
    ).toBeVisible();
    await expect(page.getByText('이 글 덕분에 캐시 무효화 순서를 이해했어요')).toBeVisible();
    await expect(page.getByText(TEXTS.ariaLabels.myCommentImageCount(2))).toBeAttached();
    await expect(page.getByText(TEXTS.comment.myList.imageOnly(1))).toBeVisible();
    await expect(page.getByText(/supabase\.co/)).toHaveCount(0);
  });
});
