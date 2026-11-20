import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import type { Post } from '@/entities/post/model/post.schema';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 글 카드의 공유 버튼(위젯)이 기억한 링크를 다른 글의 댓글 입력칸(기능)이 제안하는 연결과, 제안을 누를 때
// 실제 브라우저에서 바깥을 누르면 내려가고 제안을 누르면 클릭이 닿는지(mousedown이 입력칸 포커스를 지키는지) 본다
// (docs/COMMENT.md §5). 조건별 동작은 CommentForm.test.tsx가 맡는다.
const COPIED_POST: Post = { ...mockPost, id: 'e2e-copied-post', title: 'E2E Copied Post' };
const COMMENTED_POST: Post = { ...mockPost, id: 'e2e-commented-post', title: 'E2E Commented Post' };
const POSTS = [COPIED_POST, COMMENTED_POST];

// 헤드리스 Chromium은 클립보드 쓰기 권한이 없으면 공유 버튼의 writeText가 실패해 링크를 기억하지 않는다
test.use({ permissions: ['clipboard-write'] });

test.describe('복사한 글 링크를 댓글에 넣기', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockComments(page, []);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) => route.fulfill({ json: wrapResponse({ ...mockPostListResponse, content: POSTS }) })
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => {
        const postId = new URL(route.request().url()).pathname.split('/').pop();
        const post = POSTS.find((candidate) => candidate.id === postId);

        return post ? route.fulfill({ json: wrapResponse(post) }) : route.abort();
      }
    );
  });

  test('공유 버튼으로 복사한 글의 링크를 다른 글의 댓글 입력칸에서 한 번 눌러 넣는다', async ({
    page,
  }) => {
    await page.goto('/post');

    // 카드는 목록 순서대로 그려진다 - 첫 공유 버튼이 COPIED_POST의 것이다. 다른 카드를 눌렀다면 아래에서
    // 제안이 안 뜨거나(같은 글) 주소가 달라 실패한다
    await expect(page.getByRole('link', { name: COPIED_POST.title })).toBeVisible();
    await page.getByRole('button', { name: TEXTS.post.card.share }).first().click();
    await expect(page.getByText(TEXTS.messages.success.linkCopied)).toBeVisible();

    // 같은 탭에서 이동해야 기억이 남는다(새로고침·새 탭이면 사라진다)
    await page.getByRole('link', { name: COMMENTED_POST.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${COMMENTED_POST.id}$`));

    const textarea = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    const suggestion = page.getByRole('button', {
      name: TEXTS.comment.form.insertCopiedLink(COPIED_POST.title),
    });

    await expect(textarea).toBeVisible();
    await expect(suggestion).toHaveCount(0);

    await textarea.click();
    await expect(suggestion).toBeVisible();

    // 입력칸 밖(글 제목)을 누르면 내려가고, 입력칸을 다시 누르면 돌아온다
    await page.getByRole('heading', { name: COMMENTED_POST.title }).click();
    await expect(suggestion).toHaveCount(0);

    await textarea.click();
    await expect(suggestion).toBeVisible();

    await suggestion.click();

    await expect(textarea).toHaveValue(`${new URL(page.url()).origin}/post/${COPIED_POST.id} `);
    await expect(textarea).toBeFocused();
    await expect(suggestion).toHaveCount(0);
  });
});
