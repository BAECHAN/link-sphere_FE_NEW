import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockLikePost, mockLikePostFailure } from './mocks/interaction.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

test.describe('좋아요 — 상세↔목록 캐시 전파', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    // 댓글 자체는 이 스펙의 검증 대상이 아니다 — 빈 배열로 등록한다(comment.mock.ts 주석 참고).
    await mockComments(page, []);
  });

  test('상세에서 좋아요를 누르면 재조회 없이 목록에도 반영된다', async ({ page }) => {
    await mockLikePost(page);

    // 목록 GET 요청이 정확히 1번(최초 진입)만 나가는지 센다 — 뒤로가기 이후 카운트가
    // 반영돼 있다면, 그건 서버가 새로 알려줘서가 아니라 onMutate가 postKeys.listRoot를
    // 직접 패치했기 때문임을 증명한다(interaction.queries.ts:41-71).
    let postListRequestCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/post') {
        postListRequestCount += 1;
      }
    });

    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    const likeButton = page.getByRole('button', { name: TEXTS.ariaLabels.postLike });
    await likeButton.click();

    // 낙관적 갱신 — 클릭 즉시 aria-label이 postUnlike로 바뀌고 카운트가 1이 된다
    // (interaction.queries.ts:19-39, 서버 응답을 기다리지 않는다).
    const likedButton = page.getByRole('button', { name: TEXTS.ariaLabels.postUnlike });
    await expect(likedButton).toBeVisible();
    await expect(likedButton).toContainText('1');

    await page.getByRole('button', { name: TEXTS.post.detail.backToList }).click();
    await expect(page).toHaveURL(/\/post$/);

    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.postUnlike })).toContainText(
      '1'
    );
    expect(postListRequestCount).toBe(1);
  });

  test('좋아요 요청이 실패하면 상세·목록 모두 원상복구된다', async ({ page }) => {
    // 이번에 고친 버그의 회귀 테스트 — 수정 전엔 onError가 detail만 롤백하고
    // 목록은 낙관적으로 뒤집힌 채 남았다(interaction.queries.ts, PR 커밋 참고).
    await mockLikePostFailure(page);

    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.getByRole('button', { name: TEXTS.ariaLabels.postLike }).click();

    const revertedDetailButton = page.getByRole('button', { name: TEXTS.ariaLabels.postLike });
    await expect(revertedDetailButton).toBeVisible();
    await expect(revertedDetailButton).toContainText('0');

    await page.getByRole('button', { name: TEXTS.post.detail.backToList }).click();
    await expect(page).toHaveURL(/\/post$/);

    const revertedListButton = page.getByRole('button', { name: TEXTS.ariaLabels.postLike });
    await expect(revertedListButton).toBeVisible();
    await expect(revertedListButton).toContainText('0');
  });
});
