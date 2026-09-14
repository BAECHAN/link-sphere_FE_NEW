import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { TEXTS } from '@/shared/config/texts';

// PostDetailPage.tsx의 돌아가기 버튼은 데스크톱(md: 이상)에서만 렌더링되고, PR #100의
// sticky를 걷어내 평범한(비sticky) 위치로 되돌아갔다(docs/DECISIONS.md "상세 돌아가기
// 버튼: 모바일 제거 + 데스크톱 sticky 해제" 참고) — chromium(데스크톱) 프로젝트에서만
// 돈다.
test.describe('데스크톱 — 상세 돌아가기 버튼 (비sticky)', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    // 스크롤로 화면 밖까지 밀어내야 하므로 댓글 1개를 넣어 콘텐츠 높이를 확보한다.
    await mockComments(page, [mockComment]);
  });

  test('버튼이 보이고, 스크롤하면 Navbar와 달리 화면 밖으로 사라진다(sticky 아님)', async ({
    page,
  }) => {
    await page.goto(`/post/${mockPost.id}`);

    const backButton = page.getByRole('button', { name: TEXTS.post.detail.backToList });
    await expect(backButton).toBeVisible();
    await expect(backButton).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 버튼은 문서 흐름을 따라 함께 스크롤돼 화면 밖으로 나간다.
    await expect(backButton).not.toBeInViewport();
    // 반면 Navbar 검색창은 sticky라 스크롤해도 계속 보인다 — 대조군.
    await expect(page.getByPlaceholder(TEXTS.placeholders.postSearch)).toBeInViewport();
  });
});
