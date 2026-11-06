import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryRouter,
  useLocation,
  NavigationType,
  type Location,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { usePostListFilter } from '@/widgets/post/post-list/hooks/usePostListFilter';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { RouterEvents } from '@/shared/lib/router/router-events';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

type FilterHook = ReturnType<typeof usePostListFilter>;

beforeEach(() => {
  useHideBotsStore.setState({ hideBots: false });

  server.use(
    http.get(url(API_ENDPOINTS.common.categoryOption), () =>
      HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: [
            { id: 1, name: '백엔드', slug: 'backend', sortOrder: 0, createdAt: '2025-01-01' },
            { id: 2, name: '프론트', slug: 'frontend', sortOrder: 1, createdAt: '2025-01-01' },
          ],
          timestamp: '',
        },
        { status: 200 }
      )
    )
  );
});

function renderFilter(initialEntry: string) {
  const latest = { current: null as unknown as FilterHook };

  // 렌더마다 칩 상태와 그 시점에 커밋된 URL을 남긴다 - URL이 따라오기 전의 낙관적 반응을 보려는 용도
  const renders: {
    search: string;
    bookmark: boolean;
    liked: boolean;
    myPosts: boolean;
    categories: string[];
  }[] = [];

  function Probe() {
    const { search } = useLocation();
    const filter = usePostListFilter();

    latest.current = filter;
    renders.push({
      search,
      bookmark: filter.isClickedBookmark,
      liked: filter.isClickedLiked,
      myPosts: filter.isClickedMyPosts,
      categories: [...filter.selectedCategories],
    });

    return null;
  }

  const router = createMemoryRouter([{ path: '*', element: <Probe /> }], {
    initialEntries: [initialEntry],
  });

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { latest, router, renders };
}

/** 라우터는 이미 이동했지만 React가 커밋하지 못한 상태의 POP을 흉내 낸다 */
function injectPop(pathname: string, search: string) {
  let subscriber: Parameters<
    Parameters<typeof RouterEvents.setSource>[0]['subscribe']
  >[0] = () => {};
  const initial = { pathname: '/', search: '', hash: '', state: null, key: 'initial' } as Location;

  RouterEvents.setSource({
    state: { location: initial },
    subscribe: (fn) => {
      subscriber = fn;

      return () => {};
    },
  });

  act(() => {
    subscriber({
      location: { pathname, search, hash: '', state: null, key: 'popped' } as Location,
      historyAction: NavigationType.Pop,
    });
  });
}

describe('usePostListFilter', () => {
  it('URL의 범위 필터와 카테고리 태그를 칩 상태로 읽는다', () => {
    const { latest } = renderFilter(
      `/?filter=isBookmarked,isPrivate&q=${encodeURIComponent('@백엔드@프론트')}`
    );

    expect(latest.current.isClickedBookmark).toBe(true);
    expect(latest.current.isClickedLiked).toBe(false);
    expect(latest.current.isClickedMyPosts).toBe(false);
    expect(latest.current.isClickedPrivate).toBe(true);
    expect([...latest.current.selectedCategories]).toEqual(['백엔드', '프론트']);
  });

  it('필터와 태그가 없으면 어떤 칩도 켜지지 않는다', () => {
    const { latest } = renderFilter('/');

    expect(latest.current.isClickedBookmark).toBe(false);
    expect(latest.current.isClickedLiked).toBe(false);
    expect(latest.current.isClickedMyPosts).toBe(false);
    expect(latest.current.isClickedPrivate).toBe(false);
    expect(latest.current.selectedCategories.size).toBe(0);
    expect(latest.current.appliedCount).toBe(0);
  });

  it('카테고리 옵션 목록을 내려준다', async () => {
    const { latest } = renderFilter('/');

    await waitFor(() => {
      expect(latest.current.categoryOptionList).toEqual([
        { label: '백엔드', value: '1' },
        { label: '프론트', value: '2' },
      ]);
    });
  });

  it('적용 중 조건 수는 카테고리·닉네임·범위 필터·키워드를 각각 센다', () => {
    const { latest } = renderFilter(
      `/?filter=isLiked,isMyPosts&q=${encodeURIComponent('@백엔드 @프론트 #철수 #영희 리액트')}`
    );

    // 카테고리 2 + 닉네임 2 + 범위 필터 2 + 키워드 1
    expect(latest.current.appliedCount).toBe(7);
  });

  it('키워드 없이 닉네임 하나만 있어도 한 조건으로 센다', () => {
    const { latest } = renderFilter(`/?q=${encodeURIComponent('#철수')}`);

    expect(latest.current.appliedCount).toBe(1);
  });

  it('봇 글 숨기기는 적용 중 조건 수에 포함하지 않는다', () => {
    const { latest } = renderFilter('/');

    act(() => {
      latest.current.handleToggleHideBots();
    });

    expect(latest.current.hideBots).toBe(true);
    expect(latest.current.appliedCount).toBe(0);
  });

  it('봇 글 숨기기를 누를 때마다 켜짐과 꺼짐이 번갈아 바뀐다', () => {
    const { latest } = renderFilter('/');

    act(() => {
      latest.current.handleToggleHideBots();
    });
    expect(latest.current.hideBots).toBe(true);

    act(() => {
      latest.current.handleToggleHideBots();
    });
    expect(latest.current.hideBots).toBe(false);
  });

  it('범위 필터를 누르면 칩이 켜지고 URL에 반영되며, 다시 누르면 꺼진다', async () => {
    const { latest, router } = renderFilter('/');

    act(() => {
      latest.current.handleToggleFilter('isLiked');
    });

    expect(latest.current.isClickedLiked).toBe(true);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?filter=isLiked');
    });

    act(() => {
      latest.current.handleToggleFilter('isLiked');
    });

    expect(latest.current.isClickedLiked).toBe(false);
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('다른 필터가 켜져 있어도 하나를 끄면 나머지는 유지되고, 켜면 함께 쌓인다', async () => {
    const { latest, router } = renderFilter('/?filter=isBookmarked,isMyPosts');

    act(() => {
      latest.current.handleToggleFilter('isBookmarked');
    });

    expect(latest.current.isClickedBookmark).toBe(false);
    expect(latest.current.isClickedMyPosts).toBe(true);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?filter=isMyPosts');
    });

    act(() => {
      latest.current.handleToggleFilter('isPrivate');
    });

    expect(latest.current.isClickedMyPosts).toBe(true);
    expect(latest.current.isClickedPrivate).toBe(true);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?filter=isMyPosts%2CisPrivate');
    });
  });

  it('카테고리 칩을 누르면 선택되고 검색어에 @라벨이 들어가며, 다시 누르면 해제된다', async () => {
    const { latest, router } = renderFilter('/');
    const backend = { label: '백엔드', value: '1' };

    act(() => {
      latest.current.toggleCategoryTagInSearch(backend);
    });

    expect([...latest.current.selectedCategories]).toEqual(['백엔드']);
    expect(latest.current.appliedCount).toBe(1);
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('q')).toBe('@백엔드');
    });

    act(() => {
      latest.current.toggleCategoryTagInSearch(backend);
    });

    expect(latest.current.selectedCategories.size).toBe(0);
    expect(latest.current.appliedCount).toBe(0);
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('URL의 검색어가 바뀌면 카테고리 선택도 따라가고, 태그가 없어지면 비운다', async () => {
    const { latest, router } = renderFilter(`/?q=${encodeURIComponent('@백엔드')}`);

    expect([...latest.current.selectedCategories]).toEqual(['백엔드']);

    await act(async () => {
      await router.navigate(`/?q=${encodeURIComponent('@프론트')}`);
    });
    expect([...latest.current.selectedCategories]).toEqual(['프론트']);

    await act(async () => {
      await router.navigate(`/?q=${encodeURIComponent('리액트')}`);
    });
    expect(latest.current.selectedCategories.size).toBe(0);
  });

  it('URL의 필터가 바뀌면(뒤로가기 등) 칩도 URL에 맞춘다', async () => {
    const { latest, router } = renderFilter('/?filter=isLiked');

    await act(async () => {
      await router.navigate('/?filter=isPrivate');
    });

    expect(latest.current.isClickedLiked).toBe(false);
    expect(latest.current.isClickedPrivate).toBe(true);
  });

  it('범위 필터 칩은 URL이 따라오기 전에 먼저 켜진다', () => {
    const { latest, renders } = renderFilter('/');

    act(() => {
      latest.current.handleToggleFilter('isLiked');
    });

    expect(renders.some((r) => r.search === '' && r.liked)).toBe(true);
  });

  it('범위 필터 칩은 URL이 따라오기 전에 먼저 꺼지고, 다른 칩은 그대로 둔다', () => {
    const { latest, renders } = renderFilter('/?filter=isBookmarked,isMyPosts');

    act(() => {
      latest.current.handleToggleFilter('isBookmarked');
    });

    expect(
      renders.some((r) => r.search === '?filter=isBookmarked,isMyPosts' && !r.bookmark && r.myPosts)
    ).toBe(true);
  });

  it('카테고리 칩은 URL이 따라오기 전에 먼저 해제되어 비게 된다', () => {
    const { latest, renders } = renderFilter(`/?q=${encodeURIComponent('@백엔드')}`);

    act(() => {
      latest.current.toggleCategoryTagInSearch({ label: '백엔드', value: '1' });
    });

    expect(
      renders.some(
        (r) => r.search === `?q=${encodeURIComponent('@백엔드')}` && r.categories.length === 0
      )
    ).toBe(true);
  });

  it('조건이 없을 때 초기화를 눌러도 이동하지 않는다', () => {
    const { latest, router } = renderFilter('/');

    act(() => {
      latest.current.handleClearSearch();
    });

    expect(router.state.historyAction).toBe(NavigationType.Pop);
    expect(router.state.location.search).toBe('');
  });

  it('조건이 있으면 초기화로 검색어와 필터를 모두 비운다', async () => {
    const { latest, router } = renderFilter(
      `/?filter=isLiked&q=${encodeURIComponent('@백엔드 리액트')}`
    );

    act(() => {
      latest.current.handleClearSearch();
    });

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  describe('커밋 전 뒤로/앞으로 가기(POP)', () => {
    it('같은 페이지로 돌아가면 칩을 돌아간 URL의 필터와 카테고리로 맞춘다', () => {
      const { latest } = renderFilter('/?filter=isLiked');

      injectPop('/', `?filter=isBookmarked,isMyPosts&q=${encodeURIComponent('@백엔드@프론트')}`);

      expect(latest.current.isClickedLiked).toBe(false);
      expect(latest.current.isClickedBookmark).toBe(true);
      expect(latest.current.isClickedMyPosts).toBe(true);
      expect([...latest.current.selectedCategories]).toEqual(['백엔드', '프론트']);
    });

    it('돌아간 URL에 필터와 검색어가 없으면 칩과 카테고리를 모두 비운다', () => {
      const { latest } = renderFilter(`/?filter=isLiked&q=${encodeURIComponent('@백엔드')}`);

      injectPop('/', '');

      expect(latest.current.isClickedLiked).toBe(false);
      expect(latest.current.selectedCategories.size).toBe(0);
    });

    it('돌아간 URL에 카테고리 태그 없이 키워드만 있으면 카테고리를 비운다', () => {
      const { latest } = renderFilter(`/?q=${encodeURIComponent('@백엔드')}`);

      injectPop('/', `?q=${encodeURIComponent('리액트')}`);

      expect(latest.current.selectedCategories.size).toBe(0);
    });

    it('페이지를 옮긴 뒤에는 옮긴 페이지로의 POP을 기준으로 판단한다', async () => {
      const { latest, router } = renderFilter('/?filter=isLiked');

      await act(async () => {
        await router.navigate('/other?filter=isLiked');
      });

      injectPop('/other', '?filter=isPrivate');

      expect(latest.current.isClickedLiked).toBe(false);
      expect(latest.current.isClickedPrivate).toBe(true);
    });

    it('다른 페이지로 가는 POP이면 칩을 그대로 둔다', () => {
      const { latest } = renderFilter(`/?filter=isLiked&q=${encodeURIComponent('@백엔드')}`);

      injectPop('/other', '?filter=isPrivate');

      expect(latest.current.isClickedLiked).toBe(true);
      expect(latest.current.isClickedPrivate).toBe(false);
      expect([...latest.current.selectedCategories]).toEqual(['백엔드']);
    });
  });
});
