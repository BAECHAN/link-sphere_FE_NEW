import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 휴대폰을 가로로 돌리면(Pixel 5 가로 851px) CSS는 데스크톱 배치(md 이상)가 된다. useIsMobile이
// UA를 보던 때는 JS가 하단 댓글 바를 골랐는데 CSS가 그 바를 숨겨, 댓글 입력 수단이 아예 없었다.
// 모바일 UA·터치는 프로젝트(Pixel 5) 그대로 두고 폭만 바꾼다.
test.use({ viewport: { width: 851, height: 393 } });

test.describe('휴대폰 가로 폭 — 글 상세 댓글 입력', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => route.fulfill({ json: wrapResponse(mockPost) })
    );
    await mockComments(page, []);
  });

  test('데스크톱 배치와 같은 인라인 댓글 입력창이 보인다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    // 댓글 영역은 게시글과 따로 불러온다 - 그 제목이 뜰 때까지 먼저 기다린다(comment-icon-scroll과 같은
    // 방식). 제목 바로 아래가 데스크톱 인라인 폼, 모바일이면 그 자리가 비고 하단 바가 대신한다.
    await page
      .getByRole('heading', { level: 2, name: new RegExp(`^${TEXTS.comment.list.heading}`) })
      .waitFor();

    await expect(page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder)).toBeVisible();
  });
});
