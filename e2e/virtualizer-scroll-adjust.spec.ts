import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';

// useWindowGridVirtualizer.ts의 shouldAdjustScrollOnItemResize 가드("캐시된 스크롤 위치가 실제와
// 한 화면 넘게 벌어졌으면 보정 생략", #261)가 정상 보정까지 막지 않는지 본다. 두 테스트 모두
// 현행 가드로는 30회 반복 통과(가드 발동 0회), 직접 확인한 변이:
// - 가드가 항상 보정을 생략하게 바꾸면: 늦은 높이 변화 테스트 10/10 실패(216px 밀림), ⌘B 8/10 실패
// - 열 수 변경 앵커 이펙트를 빼면: ⌘B 10/10 실패(앵커 행이 503px 아래)
// - 가드를 빼면(라이브러리 기본 판정만): 둘 다 통과 — 현행 가드는 이 두 경로에서 발동하지 않아
//   결과가 기본 판정과 같다. 다만 위 변이처럼 가드가 정상 보정까지 막으면 두 테스트가 잡아낸다
// 수치와 튕김 스크롤 계측은 docs/FE-ARCHITECTURE.md §25.

const POST_COUNT = 60;

function adjustPostTitle(index: number): string {
  return `Adjust post ${String(index).padStart(3, '0')}`;
}

/**
 * 6개씩 묶어 썸네일 있는 블록과 없는 블록을 번갈아 둔다 — 2열이든 3열이든 행 높이가
 * 추정치(post-card-grid.const.ts의 654/635)와 다르고 행끼리도 달라야 가상화 보정이 실제로 일어난다.
 * 썸네일 박스는 aspect-video로 로드 전부터 자리를 잡으므로(link-thumbnail.tsx) 이미지를 막아
 * 대체 박스가 떠도 높이는 같다.
 */
async function mockVariedHeightPosts(page: Page): Promise<void> {
  const content: Post[] = Array.from({ length: POST_COUNT }, (_, index) => ({
    ...mockPost,
    id: `adjust-post-${index}`,
    title: adjustPostTitle(index),
    ogImage: Math.floor(index / 6) % 2 === 0 ? `/e2e-og/${index}.png` : null,
  }));

  const body: PostListResponse = {
    page: 0,
    size: POST_COUNT,
    content,
    totalElements: POST_COUNT,
    totalPages: 1,
    last: true,
  };

  await page.route('**/e2e-og/**', (route) => route.abort());
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => route.fulfill({ json: wrapResponse(body) })
  );
}

interface RowBox {
  index: number;
  top: number;
  bottom: number;
  titles: string[];
}

/** 렌더된 가상 행(PostList.tsx의 data-index 행)의 뷰포트 기준 위치와 카드 제목 목록 */
async function readRows(page: Page): Promise<RowBox[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-index]'))
      .map((row) => {
        const rect = row.getBoundingClientRect();
        const titles = Array.from(row.querySelectorAll('a'))
          .map((link) => link.textContent?.trim() ?? '')
          .filter((text) => text.startsWith('Adjust post'));
        return { index: Number(row.dataset.index), top: rect.top, bottom: rect.bottom, titles };
      })
      .sort((a, b) => a.index - b.index)
  );
}

/** 뷰포트 맨 윗줄(y=0)에 걸친 행 — useWindowGridVirtualizer가 열 수 변경 때 앵커로 잡는 행과 같다 */
async function readTopRow(page: Page): Promise<RowBox> {
  const rows = await readRows(page);
  const top = rows.find((row) => row.top <= 0 && row.bottom > 0);
  expect(top, '뷰포트 맨 윗줄에 걸친 행이 있어야 한다').toBeDefined();
  return top!;
}

async function countColumns(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(
      '[data-index] > [style*="grid-template-columns"]'
    );
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
  });
}

/** scrollY가 300ms 동안 변하지 않을 때까지 — scrollToIndex의 rAF 재조정이 끝났다는 신호로 쓴다 */
async function waitForScrollSettled(page: Page): Promise<void> {
  let previous = -1;
  await expect
    .poll(
      async () => {
        const current = await page.evaluate(() => window.scrollY);
        const settled = current === previous;
        previous = current;
        return settled;
      },
      { intervals: [300] }
    )
    .toBe(true);
}

/** 제목 링크만 — 썸네일 링크도 이미지 alt(제목)가 이름에 들어가 부분 일치로는 두 개가 잡힌다 */
function firstCardLink(page: Page) {
  return page.getByRole('link', { name: adjustPostTitle(0), exact: true });
}

async function scrollDown(page: Page, minScrollY: number): Promise<void> {
  // 카드 위에 마우스가 있으면 hover 효과(-translate-y-0.5)와 상세 prefetch가 섞인다 — 스크롤할
  // 수 없는 사이드바 위에서 휠을 굴리면 window로 전달된다.
  await page.mouse.move(100, 700);
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, 900);
        return page.evaluate(() => window.scrollY);
      },
      { intervals: [200] }
    )
    .toBeGreaterThan(minScrollY);
  await waitForScrollSettled(page);
}

test.describe('가상 스크롤 보정 가드가 정상 보정을 막지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockVariedHeightPosts(page);
  });

  test('⌘B로 열 수가 바뀌어도 화면 맨 윗줄의 카드가 그대로 맨 윗줄에 남는다', async ({ page }) => {
    // 1200px는 사이드바가 펼쳐져 있으면 2열, 접히면 3열이 되는 실측 경계다
    // (post-card-footer-layout.spec.ts와 같은 값). 앵커 스크롤은 한 화면 넘게 움직여(2열→3열에서
    // 직접 측정 1502px) 가드 조건이 성립할 수 있는 경로다.
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/post');
    await expect(firstCardLink(page)).toBeVisible();

    await scrollDown(page, 2700);

    for (const direction of ['접기', '펴기']) {
      const columnsBefore = await countColumns(page);
      const anchor = await readTopRow(page);
      const anchorTitle = anchor.titles[0]!;

      await page.keyboard.press('Control+b');
      await expect.poll(() => countColumns(page), { message: direction }).not.toBe(columnsBefore);
      await waitForScrollSettled(page);

      const rows = await readRows(page);
      const anchorRow = rows.find((row) => row.titles.includes(anchorTitle));
      expect(
        anchorRow,
        `${direction}: 앵커 카드(${anchorTitle})가 렌더돼 있어야 한다`
      ).toBeDefined();
      // scrollToIndex(align: 'start')는 앵커 카드가 든 행의 시작을 뷰포트 맨 윗줄에 맞춘다 —
      // 직접 측정 40회(접기·펴기 각 20회) 모두 0px, 허용치 2px는 서브픽셀 반올림 여유다
      expect(Math.abs(anchorRow!.top), `${direction}: 앵커 행 top`).toBeLessThanOrEqual(2);
    }
  });

  test('화면 위쪽 행의 높이가 늦게 바뀌어도 보던 카드 위치가 그대로다', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/post');
    await expect(firstCardLink(page)).toBeVisible();

    await scrollDown(page, 2700);

    const rows = await readRows(page);
    const above = rows.filter((row) => row.bottom <= 0).at(-1);
    const reference = rows.find((row) => row.top >= 0);
    expect(above, '오버스캔으로 렌더된, 화면보다 위에 있는 행').toBeDefined();
    expect(reference, '화면 안에서 온전히 보이는 첫 행').toBeDefined();

    // 웹폰트(Pretendard dynamic subset, font-display: swap) 교체로 제목 줄 수가 바뀌는 상황을
    // 결정적으로 흉내 낸다 — 위쪽 행의 첫 카드 높이를 늘리면 그 행을 관찰하는 ResizeObserver가
    // 재측정(resizeItem)을 일으킨다. 썸네일은 aspect-video로 자리를 잡아 늦게 와도 높이가 안 바뀐다.
    await page.evaluate((index) => {
      const card = document.querySelector<HTMLElement>(`[data-index="${index}"] > div > div`);
      card!.style.paddingBottom = '240px';
    }, above!.index);

    // 높이를 늘린 직후엔 아래 행들이 아직 옛 translateY라 위쪽 행과 겹친다 — 가상화가 재측정해
    // 아래 행들을 다시 배치해야 겹침이 풀린다. 그 전에 단언하면 보정 여부와 무관하게 통과해 버린다.
    await expect
      .poll(async () => {
        const after = await readRows(page);
        const grown = after.find((row) => row.index === above!.index);
        const next = after.find((row) => row.index === above!.index + 1);
        return grown && next ? next.top - grown.bottom : -1;
      })
      .toBeGreaterThanOrEqual(0);

    const after = await readRows(page);
    const referenceAfter = after.find((row) => row.index === reference!.index);
    expect(
      Math.abs(referenceAfter!.top - reference!.top),
      '보던 행의 이동량(px)'
    ).toBeLessThanOrEqual(1);
  });
});
