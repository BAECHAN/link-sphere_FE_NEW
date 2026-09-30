import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail } from './mocks/post.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockComments } from './mocks/comment.mock';
import { mockLikePost } from './mocks/interaction.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import type { Locator, Page } from '@playwright/test';

// 설명·태그는 제목 링크의 ::after가 덮고 있어 locator.click()은 "다른 요소가 가로챈다"며
// 거부한다(Playwright 액션 가능성 검사) — 실제 사용자처럼 그 좌표를 마우스로 누른다.
async function clickCenter(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error('clickCenter: element has no bounding box');
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// 목록 PostCard는 제목 링크의 ::after를 카드 전체로 늘려(stretched link, PostCard.tsx) 여백·설명을
// 눌러도 상세로 간다. 대신 카드 안의 다른 버튼·링크는 그 위로 올라가 있어야 각자의 동작이
// 가로채이지 않는다 — 이 스펙은 그 두 가지를 함께 지킨다.
test.describe('PostCard 클릭 영역 — 카드 전체가 상세 진입, 내부 버튼은 그대로', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner(⋮ 메뉴 렌더)에 필수.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('설명을 누르면 상세로 이동한다', async ({ page }) => {
    await page.goto('/post');
    await clickCenter(page, page.getByText(mockPost.description!));

    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
  });

  test('태그를 누르면 상세로 이동한다', async ({ page }) => {
    await page.goto('/post');
    await clickCenter(page, page.getByText(mockPost.tags![0]!, { exact: true }));

    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
  });

  test('카드 안의 모든 버튼·링크는 stretched link에 가려지지 않는다', async ({ page }) => {
    await page.goto('/post');
    const titleLink = page.getByRole('link', { name: mockPost.title });
    await expect(titleLink).toBeVisible();

    // 각 인터랙티브 요소의 중심점에서 실제로 이벤트를 받는 요소가 그 요소 자신(또는 자손)인지
    // 확인한다 — 승격(relative z-raised)을 빠뜨린 요소가 있으면 제목 링크가 대신 잡힌다.
    const covered = await titleLink.evaluate((link) => {
      const card = link.closest('[class*="overflow-hidden"]')!;
      const targets = Array.from(card.querySelectorAll<HTMLElement>('a, button')).filter(
        (el) => el !== link
      );

      return targets
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );

          return !hit || !el.contains(hit);
        })
        .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName);
    });

    expect(covered).toEqual([]);
  });

  test('좋아요를 누르면 이동하지 않고 좋아요만 반영된다', async ({ page }) => {
    await mockLikePost(page);
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.postLike }).click();

    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.postUnlike })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('⋮ 메뉴를 누르면 이동하지 않고 메뉴만 열린다', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();

    await expect(page.getByRole('menuitem', { name: TEXTS.post.card.edit })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('썸네일을 누르면 원문이 새 탭으로 열리고 현재 페이지는 그대로다', async ({ page }) => {
    await page.goto('/post');
    const thumbnailLink = page.locator(`a[href="${mockPost.url}"]`);

    const [popup] = await Promise.all([page.waitForEvent('popup'), thumbnailLink.click()]);
    await popup.close();

    await expect(page).toHaveURL(/\/post$/);
  });

  test('상세 페이지의 카드는 설명을 눌러도 이동하지 않는다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    const description = page.getByText(mockPost.description!);
    await expect(description).toBeVisible();

    // 상세에서는 stretched link를 끈다(isDetail) — 제목 링크가 여백을 덮지 않아야 한다.
    const hitsTitleLink = await description.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

      return Boolean(hit?.closest('a[href^="/post/"]'));
    });

    expect(hitsTitleLink).toBe(false);
  });
});

// 카드의 카테고리 배지는 stretched link 위에 올라간 버튼이다 — 누르면 상세가 아니라 피드를 그
// 카테고리로 필터한다(usePostCard.handleCategoryClick). 칩과 달리 토글이 아니라 "교체"라서,
// 이미 다른 검색어가 있어도 q가 @카테고리 하나로 바뀐다(docs/SEARCH.md).
test.describe('PostCard 카테고리 배지 — 피드 카테고리 필터(교체)', () => {
  const category = mockPost.categories![0]!;
  const categoryButtonName = TEXTS.ariaLabels.postCategoryFilterBy(category.name);

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('피드에서 누르면 q가 @카테고리가 되고 목록을 그 카테고리로 다시 조회한다', async ({
    page,
  }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    const filteredListRequest = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === '/api/post' &&
        new URL(req.url()).searchParams.get('category') === category.name
    );
    await page.getByRole('button', { name: categoryButtonName }).click();

    await filteredListRequest;
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(`@${category.name}`);
  });

  test('목록 중간에서 눌러도 걸러진 목록을 맨 위부터 보여준다', async ({ page }) => {
    // 같은 경로에서 검색 파라미터만 바뀌고 목록 내용이 달라지면 스크롤이 리셋되지 않는다(직접
    // 측정) — handleCategoryClick의 window.scrollTo가 빠지면 이 테스트가 실패한다. 카테고리를
    // 무시하고 같은 목록을 돌려주는 목에서는 scrollTo 없이도 스크롤이 0이 돼 회귀를 못 잡으므로
    // (역시 직접 확인), 카테고리가 붙으면 더 짧지만 여전히 긴 다른 목록을 돌려준다(LIFO로 덮어씀).
    await page.route(
      (url) => url.pathname === '/api/post',
      (route) => {
        const isFiltered = new URL(route.request().url()).searchParams.has('category');
        const count = isFiltered ? 18 : 30;
        const content = Array.from({ length: count }, (_, index) => ({
          ...mockPost,
          id: `${isFiltered ? 'filtered' : 'all'}-${index}`,
          title: `${isFiltered ? 'Filtered' : 'All'} ${index}`,
        }));

        return route.fulfill({
          json: wrapResponse({
            page: 0,
            size: count,
            content,
            totalElements: count,
            totalPages: 1,
            last: true,
          }),
        });
      }
    );
    await page.goto('/post');
    await expect(page.getByRole('link', { name: 'All 0' })).toBeVisible();
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    // 화면 안에 보이는 카테고리 버튼 하나를 실제 좌표로 누른다(locator.click은 필요하면 스스로
    // 스크롤해버려 "목록 중간에서 누른다"는 전제가 흐려진다).
    const buttons = page.getByRole('button', { name: categoryButtonName });
    const viewportHeight = page.viewportSize()!.height;
    let clicked = false;

    for (const button of await buttons.all()) {
      const box = await button.boundingBox();

      if (box && box.y > 80 && box.y + box.height < viewportHeight) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        clicked = true;
        break;
      }
    }

    expect(clicked).toBe(true);

    await expect(page.getByRole('link', { name: 'Filtered 0' })).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('범위 칩(filter)은 그대로 두고 q만 바꾼다', async ({ page }) => {
    await page.goto('/post?filter=isMyPosts');
    await page.getByRole('button', { name: categoryButtonName }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(`@${category.name}`);
    expect(new URL(page.url()).searchParams.get('filter')).toBe('isMyPosts');
  });

  test('이미 다른 검색어가 있어도 @카테고리 하나로 교체한다', async ({ page }) => {
    await page.goto(`/post?q=${encodeURIComponent('리액트 #otheruser')}`);
    await page.getByRole('button', { name: categoryButtonName }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(`@${category.name}`);
  });

  test('상세 페이지에서 누르면 그 카테고리로 필터된 피드로 이동한다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    await page.getByRole('button', { name: categoryButtonName }).click();

    await expect(page).toHaveURL(/\/post\?q=/);
    expect(new URL(page.url()).searchParams.get('q')).toBe(`@${category.name}`);
  });
});
