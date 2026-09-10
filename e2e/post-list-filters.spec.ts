import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

// usePostList.ts:77-83 — URL의 filter(범위 칩 3개)에서 excludeBots는 무조건 제거한 뒤,
// localStorage 기반 useHideBotsStore가 true면 다시 붙인다. 이 합성 로직 자체를 검증하는
// 유닛은 없다 — search-parser.test.ts는 순수 파싱만, PostListSearch.test.tsx는 PostList를
// 렌더하지 않아 usePostList가 아예 안 돈다(카운트 표시만 봄).
test.describe('검색 필터 cross-layer — URL·localStorage·API 파라미터 합성', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  // 다음 GET /post 요청 하나를 잡아 filter 파라미터를 읽는다. 기존 스펙들은 pathname만
  // 봤지 searchParams를 읽은 선례는 없다 — 이 스펙이 처음이다.
  function nextPostListRequest(page: Page) {
    return page.waitForRequest((req) => new URL(req.url()).pathname === '/api/post');
  }

  function filterOf(req: Awaited<ReturnType<typeof nextPostListRequest>>) {
    return new URL(req.url()).searchParams.get('filter');
  }

  // hideBots(localStorage 개인 설정) 시딩. getInitialHideBots()가 스토어 모듈 평가
  // 시점에 1회만 읽으므로(hideBots.store.ts) goto 이후 evaluate로는 반영되지 않는다 —
  // auth.fixture.ts의 has-session 시딩과 같은 이유·같은 방식으로 goto 전에 심는다.
  async function seedHideBots(page: Page) {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.PREFERENCES.HIDE_BOTS);
  }

  // 캐시(staleTime 3분)로 한 테스트 안에서 A→B→A로 되돌아가면 A는 이미 fresh라 요청이
  // 안 나가 타임아웃 난다 — 그래서 4개로 쪼개 각 테스트가 "한 방향 전이 1회"만 한다.

  test('기본 상태엔 filter가 없고, 범위 칩을 켜면 그 값만 실린다', async ({ page }) => {
    const initial = nextPostListRequest(page);
    await page.goto('/post');
    expect(filterOf(await initial)).toBeNull();

    const afterClick = nextPostListRequest(page);
    await page
      .getByRole('group', { name: TEXTS.ariaLabels.postScopeFilters })
      .getByRole('button', { name: TEXTS.buttons.bookmarkOnly })
      .click();

    expect(filterOf(await afterClick)).toBe('isBookmarked');
    await expect(page).toHaveURL(/filter=isBookmarked/);
  });

  test('봇 글 숨기기 스위치는 URL을 건드리지 않고 API 파라미터만 바꾼다', async ({ page }) => {
    const initial = nextPostListRequest(page);
    await page.goto('/post');
    expect(filterOf(await initial)).toBeNull();

    const afterToggle = nextPostListRequest(page);
    const hideBotsSwitch = page.getByLabel(TEXTS.buttons.hideBots);
    await hideBotsSwitch.click();

    expect(filterOf(await afterToggle)).toBe('excludeBots');
    // 개인 설정은 URL 파라미터가 아니다 — 화면 이동 없이 API 요청만 바뀐다.
    await expect(page).toHaveURL(/\/post$/);
    await expect(hideBotsSwitch).toHaveAttribute('data-state', 'checked');
  });

  test('레거시 공유 링크의 ?filter=excludeBots는 스토어가 OFF면 무시된다', async ({ page }) => {
    const initial = nextPostListRequest(page);
    await page.goto('/post?filter=excludeBots');

    // URL엔 있지만 스토어(localStorage)가 OFF라 요청엔 실리지 않는다.
    expect(filterOf(await initial)).toBeNull();
  });

  test('스토어 ON + 범위 칩이 합쳐지고, 초기화는 개인 설정을 안 건드린다', async ({ page }) => {
    await seedHideBots(page);

    const initial = nextPostListRequest(page);
    await page.goto('/post?filter=isBookmarked');

    // 합성 순서: URL 필터가 먼저, excludeBots는 끝에 push된다(usePostList.ts:77-83).
    expect(filterOf(await initial)).toBe('isBookmarked,excludeBots');

    const afterReset = nextPostListRequest(page);
    await page.getByRole('button', { name: TEXTS.buttons.reset }).click();

    // 초기화는 URL 필터만 지운다 — hideBots는 개인 설정이라 살아남는다.
    expect(filterOf(await afterReset)).toBe('excludeBots');
    await expect(page).toHaveURL(/\/post$/);
  });
});
