import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// PostDetailPage.tsx의 돌아가기 버튼은 모바일(< md)에서 hidden md:inline-flex로 아예
// 렌더링하지 않는다(docs/DECISIONS.md "상세 돌아가기 버튼: 모바일 제거 + 데스크톱 sticky
// 해제" 참고) — 데스크톱 뷰포트에서는 이 회귀를 재현할 수 없어 mobile-chrome
// 프로젝트(playwright.config.ts)에서만 돈다.
test.describe('모바일 — 상세 돌아가기 버튼 없음', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('돌아가기 버튼이 없고, 하단 탭바의 Feed로 목록으로 돌아갈 수 있다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { name: mockPost.title })).toBeVisible();

    await expect(page.getByRole('button', { name: TEXTS.post.detail.backToList })).toHaveCount(0);
    await expect(page.getByRole('button', { name: TEXTS.post.detail.back })).toHaveCount(0);

    // BottomTabBar는 라우트와 무관하게 항상 떠 있다(md:hidden fixed bottom-0) — 버튼이
    // 없어도 갈 곳이 없는 게 아니라는 걸 증명한다. Sidebar가 데스크톱용(aside, hidden
    // md:flex)과 모바일 드로어용 두 벌의 "Feed" 링크를 더 갖고 있어(드로어는 닫힌
    // 상태에서도 translate로 화면 밖으로 밀 뿐 display/visibility는 그대로라 :visible로도
    // 안 걸러진다, 직접 실측 확인) role만으로는 strict mode 위반이 난다 — BottomTabBar의
    // 고유 클래스(`fixed bottom-0`, 이 조합을 쓰는 컴포넌트는 이거 하나뿐)로 직접 좁힌다.
    const bottomTabBar = page.locator('nav.fixed.bottom-0');
    const feedTab = bottomTabBar.getByRole('link', { name: TEXTS.nav.feed });
    await expect(feedTab).toBeVisible();
    await feedTab.click();
    await expect(page).toHaveURL(/\/post$/);
  });
});
