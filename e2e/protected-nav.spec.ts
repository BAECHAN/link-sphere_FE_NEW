import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// useProtectedNavigate(entities/auth/hooks/useProtectedNavigate.ts:18-30) — 좋아요·북마크·
// 댓글을 막는 useAuthGuard(guest-guard.spec.ts)와는 다른 메커니즘이다. 저건 "액션 자체를
// 실행하지 않는다"이고 이건 "이동을 막고 로그인 성공 후 원래 목적지로 보낸다"라서 라우팅
// 가드가 실제로 성립하는지는 이 스펙에서만 검증된다. 이 fixture는 의도적으로 auth.fixture를
// 쓰지 않는다 — has-session 플래그가 있으면 /auth/refresh가 로그인 상태를 만들어 가드
// 자체를 못 탄다.
test.describe('보호 라우트 네비게이션 가드', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockLoginSuccess(page);
    // 로그인 성공 직후 Navbar가 GET /auth/account를 자동 호출한다(login.spec.ts와 동일 이유).
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('비로그인으로 Bookmark를 클릭하면 이동은 막히고 로그인 모달만 뜬다', async ({ page }) => {
    let folderListRequestCount = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/bookmark/folders') {
        folderListRequestCount += 1;
      }
    });

    await page.goto('/post');
    // 사이드바(데스크톱)·모바일 드로어·BottomTabBar 세 곳이 같은 라벨을 렌더한다 — Desktop
    // Chrome 뷰포트에서 뒤 둘은 display:none이라 제외되는 전제를 테스트 스스로 검증한다.
    const bookmarkLink = page.getByRole('link', { name: TEXTS.nav.bookmark });
    await expect(bookmarkLink).toHaveCount(1);
    await bookmarkLink.click();

    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
    // URL만 안 바뀐 게 아니라 BookmarkPage 자체가 마운트되지 않았음을 증명한다.
    expect(folderListRequestCount).toBe(0);
  });

  test('모달에서 로그인하면 /bookmark로 착지하고, 뒤로가기 1회로 /post 복귀 + 모달 재등장 없음', async ({
    page,
  }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: TEXTS.nav.bookmark }).click();

    const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
    // getByLabel은 기본 부분 일치라 'Email'만 쓰면 'Save Email' 체크박스까지 걸린다
    // (login.spec.ts의 실측 확인과 동일 — exact: true로 고정한다).
    await dialog.getByLabel('Email', { exact: true }).fill('test@example.com');
    await dialog.getByLabel('Password', { exact: true }).fill('TestPass1!');

    const folderPosts = page.waitForResponse(
      (res) =>
        /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(new URL(res.url()).pathname) &&
        res.status() === 200
    );
    await dialog.getByRole('button', { name: TEXTS.auth.login.signIn }).click();

    // useProtectedNavigate.ts:26 — replace 이동이라야 히스토리가 [/post, /bookmark] 2칸이다.
    // push였다면 로그인모달 엔트리가 그 사이에 orphan으로 남아 뒤로가기 1회로 모달이 재등장한다.
    await expect(page).toHaveURL(/\/bookmark$/);
    await folderPosts;

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
    // radix Dialog는 열려 있는 동안 나머지 트리에 aria-hidden을 건다 — 게시글 링크가 role
    // 쿼리로 잡힌다는 것 자체가 "모달이 안 떠 있다"의 양성 증거다.
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
