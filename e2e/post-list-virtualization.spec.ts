import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged } from './mocks/post.mock';

// 초기 자동 로드(약 30개, 뷰포트에 걸치는 행 + overscan + PREFETCH_ROW_LOOKAHEAD를 넘기려면
// 여러 페이지가 이어서 당겨진다 - usePostList.ts 참고)보다 훨씬 커야 "무한스크롤이 돌긴
// 했다"와 "가상화가 실제로 DOM을 줄였다"를 구분할 수 있다.
const TOTAL_POSTS = 200;

// 최소 12행(=118개 이상 로드)까지는 스크롤해야 초기 자동 로드분을 확실히 넘어선다.
const TARGET_ROW_INDEX = 39;

/** 지금 DOM에 실제로 렌더된 가상 "행"의 data-index를 오름차순으로 반환한다. */
async function renderedRowIndices(page: Page): Promise<number[]> {
  const raw = await page
    .locator('[data-index]')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-index'))));

  return raw.sort((a, b) => a - b);
}

/**
 * 렌더된 카드 수. a[href^="/post/"]는 카드당 2개(제목 링크 + 댓글 수 링크)라 쓰지 않는다 -
 * h3(PostCard.tsx의 제목)는 카드당 정확히 1개이고 data-index가 붙은 행 안에만 나온다.
 */
async function renderedCardCount(page: Page): Promise<number> {
  return page.locator('[data-index] h3').count();
}

async function domNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('*').length);
}

test.describe('피드 가상 스크롤 — DOM 절감 증명', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostListPaged(page, { total: TOTAL_POSTS });
  });

  test('많이 스크롤해도 렌더된 카드·DOM 노드가 일정 범위로 유지되고, 위/아래 행이 서로 교체된다', async ({
    page,
  }) => {
    // expect.poll로 스크롤+측정을 여러 번 반복하므로 기본 30초를 넘길 수 있다.
    test.setTimeout(60_000);

    await page.goto('/post');
    await expect(page.locator('[data-index] h3').first()).toBeVisible();

    const initialDomNodes = await domNodeCount(page);
    const topIndices = await renderedRowIndices(page);

    expect(topIndices).toContain(0);

    // 맨 아래까지 스크롤 → 다음 페이지 프리페치가 이어져 목표 행까지 로드될 때까지 반복한다.
    // 고정 시간 대기가 아니라 조건 수렴 대기라 flaky를 줄인다 — 이 레포 e2e에 첫 도입.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          const indices = await renderedRowIndices(page);
          return indices.at(-1) ?? -1;
        },
        { timeout: 30_000, intervals: [300] }
      )
      .toBeGreaterThanOrEqual(TARGET_ROW_INDEX);

    const bottomIndices = await renderedRowIndices(page);
    const bottomCardCount = await renderedCardCount(page);
    const bottomDomNodes = await domNodeCount(page);

    // 렌더된 카드 수가 상한 이내 — 가상화가 꺼지면(전부 렌더) 118개 이상이 그대로 남는다.
    expect(bottomCardCount).toBeLessThanOrEqual(36);
    expect(bottomCardCount * 3).toBeLessThan(TOTAL_POSTS);

    // DOM 노드 수 — Lighthouse "오류" 기준(1,400개)의 2배를 상한으로 둔다.
    // https://developer.chrome.com/docs/lighthouse/performance/dom-size
    // (직접 측정: 이 시나리오에서 initial≈1223, bottom≈1762 — 2배 상한은 그 실측값에
    // 여유를 두면서도, 가상화가 꺼졌을 때 나올 값(67행 전부 렌더 시 약 20,500)과는
    // 자릿수 이상 벌어져 있다)
    expect(bottomDomNodes).toBeLessThan(2800);
    expect(bottomDomNodes).toBeLessThan(initialDomNodes * 2);

    // 위에서 봤던 행과 아래에서 렌더된 행의 범위가 완전히 갈린다 — "DOM이 쌓이기만
    // 하는 게 아니라 교체된다"의 직접 증거.
    expect(bottomIndices[0]).toBeGreaterThan(topIndices.at(-1) ?? 0);

    // 다시 맨 위로 스크롤하면 아래에서 봤던 행이 사라지고 index 0이 다시 나타난다.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.scrollTo(0, 0));
          const indices = await renderedRowIndices(page);
          return indices[0] ?? -1;
        },
        { timeout: 30_000, intervals: [300] }
      )
      .toBe(0);

    const backAtTopIndices = await renderedRowIndices(page);

    expect(backAtTopIndices.at(-1)).toBeLessThan(bottomIndices[0] ?? Number.POSITIVE_INFINITY);
  });
});
