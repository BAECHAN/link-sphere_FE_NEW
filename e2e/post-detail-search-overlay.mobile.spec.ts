import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 모바일 헤더 검색을 열면 RecentSearchPanel(z-panel)이 화면을 덮는데, MobileCommentBar도
// 같은 z층이라 DOM 순서만으로 패널 위에 남는 겹침 버그를 재현·회귀 방지한다. jsdom에서는
// 실제 display:none/inert 반영 여부를 증명할 수 없어 브라우저에서만 검증 가능하다
// (mobile-chrome 프로젝트 전용 — playwright.config.ts).
test.describe('모바일 — 검색 오버레이가 열린 동안 댓글 작성바 숨김', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('검색을 열면 댓글바가 사라지고 탭바는 유지되며, 닫으면 작성 중이던 내용이 남는다', async ({
    page,
  }) => {
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { name: mockPost.title })).toBeVisible();

    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const textarea = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    await textarea.fill('작성중');

    await page.getByRole('button', { name: TEXTS.nav.toggleSearch }).click();

    // 댓글 작성 시트 — 접힘이 아니라 펼침 상태(z-scrim)로 숨어야 한다.
    await expect(textarea).toBeHidden();

    // 최근 검색 패널 — 기본(빈) 상태 문구로 존재를 확인한다.
    await expect(page.getByText(TEXTS.recentSearch.empty)).toBeVisible();

    // 탭바는 Navbar.tsx:228이 명시한 의도대로 검색 중에도 계속 눌려야 한다(z-nav > z-panel).
    const bottomTabBar = page.locator('nav.fixed.bottom-0');
    await expect(bottomTabBar).toBeVisible();

    // 배경(main) 전체가 inert로 잠겨 탭 포커스·클릭이 배경으로 새지 않는지 직접 확인한다.
    const mainIsInert = await page.locator('main').evaluate((el) => (el as HTMLElement).inert);
    expect(mainIsInert).toBe(true);

    // 뒤로가기(back 버튼)로 검색을 닫는다 — 입력 상태가 비어 있어 back/trailing X 둘 다
    // aria-label이 '닫기'로 같아지므로(MobileNavbarSearch.test.tsx와 동일한 이유) 첫 번째
    // (뒤로가기 버튼)를 클릭한다.
    await page.getByRole('button', { name: TEXTS.ariaLabels.close }).first().click();

    // 언마운트하지 않고 CSS로만 숨겼으므로 작성 중이던 내용이 그대로 남아야 한다.
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('작성중');

    const mainIsInertAfterClose = await page
      .locator('main')
      .evaluate((el) => (el as HTMLElement).inert);
    expect(mainIsInertAfterClose).toBe(false);
  });
});
