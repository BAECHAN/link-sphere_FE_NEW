import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockOtherAccount } from '@/mocks/fixtures/account.fixtures';
import type { Comment } from '@/entities/comment/model/comment.schema';
import { TEXTS } from '@/shared/config/texts';

const OTHER_AUTHOR = {
  id: mockOtherAccount.id,
  nickname: mockOtherAccount.nickname,
  image: null,
};
const OTHER_COMMENT: Comment = {
  ...mockComment,
  id: 'comment-uuid-other',
  content: '다른 사람의 댓글',
  author: OTHER_AUTHOR,
};
const MY_REPLY: Comment = { ...mockComment, id: 'comment-uuid-reply', content: '내 답글' };
// 좋아요 0개면 "좋아요" 문구가 붙어 동작 줄이 가장 넓다 — 내 댓글(답글 달기·수정·삭제까지)이 넘침을 처음 밟는다
const COMMENTS: Comment[] = [{ ...mockComment, replies: [MY_REPLY] }, OTHER_COMMENT];

// 좁은 폰에서 내 댓글의 동작 줄이 화면 밖으로 밀려 페이지 전체가 가로로 움직이던 문제(docs/COMMENT.md §5 "내 댓글 메뉴")
test.describe('모바일 — 댓글 동작 줄', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // 내 댓글 판정(CommentItem.tsx의 isOwner)에 필요하다
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostDetail(page);
    await mockComments(page, COMMENTS);
  });

  for (const width of [320, 360, 375]) {
    test(`${width}px 폰에서 내 댓글이 있어도 페이지가 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 727 });
      await page.goto(`/post/${mockPost.id}`);
      await expect(page.getByText(OTHER_COMMENT.content)).toBeVisible();

      // 폰 에뮬레이션(isMobile)에서는 내용이 넓으면 innerWidth도 따라 늘어난다(360px에서 381로 실측) —
      // 그래서 innerWidth가 아니라 화면 폭과 비교한다
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);

      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test('수정·삭제는 내 댓글의 메뉴에만 있고, 메뉴가 있어도 이름 줄 높이는 남의 댓글과 같다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 727 });
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByText(OTHER_COMMENT.content)).toBeVisible();

    // 내 댓글 + 내 답글 두 개
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.commentMenu })).toHaveCount(2);
    await expect(
      page
        .locator(`#comment-${OTHER_COMMENT.id}`)
        .getByRole('button', { name: TEXTS.ariaLabels.commentMenu })
    ).toHaveCount(0);

    // 닉네임 span의 부모가 이름 줄이다(CommentItem.tsx). 내 답글도 같은 닉네임이라 첫 번째(부모 댓글)를 잰다
    const rowHeight = (commentId: string, nickname: string) =>
      page
        .locator(`#comment-${commentId}`)
        .getByText(nickname, { exact: true })
        .first()
        .evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().height);

    expect(await rowHeight(mockComment.id, mockComment.author.nickname)).toBe(
      await rowHeight(OTHER_COMMENT.id, OTHER_AUTHOR.nickname)
    );

    await page
      .locator(`#comment-${mockComment.id}`)
      .getByRole('button', { name: TEXTS.ariaLabels.commentMenu })
      .first()
      .click();
    await expect(page.getByRole('menuitem', { name: TEXTS.comment.item.edit })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: TEXTS.buttons.delete })).toBeVisible();
  });
});
