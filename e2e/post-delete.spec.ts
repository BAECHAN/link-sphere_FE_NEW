import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail, mockDeletePost } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

test.describe('게시글 삭제', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner 판정(usePostCard.ts)에 필수 — account.id === mockPost.author.id라 소유자로 간주된다.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    // 댓글 자체는 이 스펙의 검증 대상이 아니다(like.spec.ts와 동일 패턴).
    await mockComments(page, []);
    // mockPostDetail(GET)과 pathname이 완전히 같으므로 반드시 그 다음에 등록한다(post.mock.ts 주석).
    await mockDeletePost(page);
  });

  test('소유자가 상세에서 삭제하면 /post로 돌아오고, 재조회 없이 목록에서도 사라진다', async ({
    page,
  }) => {
    let postListRequestCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/post') {
        postListRequestCount += 1;
      }
    });

    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // 실측 발견: 목록 카드의 title Link가 onFocus로도 handlePrefetchDetail을 쏘는데
    // (usePostCard.ts), 클릭 자체가 그 Link를 focus시켜 이동 직후에도 같은 GET /post/:id를
    // 한 번 더 트리거한다. 이 응답이 상세 페이지 자신의 useSuspenseFetchPostDetailQuery와
    // 늦게 겹치면 Suspense가 재발동해 PostCard(⋮ 메뉴 포함)가 통째로 리마운트되며 방금 연
    // 드롭다운이 즉시 닫힌다(실측: data-state가 open→closed로 즉시 전환, PostCard
    // UNMOUNT/MOUNT 로그로 확인). 목록→상세 클릭 흐름 자체는 재조회 카운트 단언에 필요해
    // 유지하고, 이 잔여 네트워크가 가라앉을 때까지만 기다린다.
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.buttons.delete }).click();

    // usePostCard.ts의 e.preventDefault() 때문에 드롭다운이 자동으로 닫히지 않아, confirm이
    // 뜬 시점에 menuitem '삭제'가 아직 DOM에 남아있다(radix composeEventHandlers). role이
    // 달라(menuitem vs button) 충돌하지 않지만, 추론에 기대지 않고 dialog로 스코프한다.
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    const deleted = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();
    await deleted;

    await expect(page).toHaveURL(/\/post$/);
    // "사라져야 한다"를 "나타나야 한다"로 뒤집는다 — 낙관적 제거로 content가 0개가 되어
    // 빈 상태 문구가 뜨는 것을 양성 단언한다(.not.toBeVisible()의 실측된 false negative 회피).
    await expect(page.getByText(TEXTS.messages.info.noPosts)).toBeVisible();
    // 목록이 재조회 없이(onSuccess가 post 목록을 invalidate하지 않음, bookmark-folder.keys.ts)
    // onMutate의 낙관적 patch만으로 비었음을 증명한다.
    expect(postListRequestCount).toBe(1);
  });
});
