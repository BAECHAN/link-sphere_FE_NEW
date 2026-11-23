import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { RouterEvents } from '@/shared/lib/router/router-events';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

type FilterHook = ReturnType<typeof usePostListFilter>;
type TestRouter = ReturnType<typeof createMemoryRouter>;

/** 범위 칩을 켜려면 로그인이 필요하다 - 켜는 동작을 보는 테스트가 렌더 전에 부른다(정리는 src/test/setup.ts) */
function signIn() {
  useAuthStore.getState().setAuth('token');
}

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
    signIn();
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
    signIn();
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
    signIn();
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

  // 범위 칩 4개는 로그인해야 뜻이 있다. 로그아웃 상태에서 켜려고 누르면 주소를 바꾸지 않고(= 목록을 요청하지 않고)
  // 로그인 창을 띄우며, 로그인하면 그 칩을 켠다(useAuthGuard의 resumeAfterLogin). 로그인 창을 여는 쪽이 라우터가
  // 가 있는 위치를 읽으므로(useBackClosableOverlay) 앱처럼 라우터를 RouterEvents에 주입한다.
  describe('로그아웃 상태의 범위 칩', () => {
    afterEach(() => {
      useLoginDialogStore.getState().setOnSuccess(undefined);
      useLoginDialogStore.getState().setPendingAction(undefined);
    });

    function renderFilterOnAppRouter(initialEntry: string) {
      const handles = renderFilter(initialEntry);

      RouterEvents.setSource(handles.router);

      return handles;
    }

    function isLoginDialogOpen(router: TestRouter) {
      const state = router.state.location.state as { loginDialogOpen?: boolean } | null;

      return Boolean(state?.loginDialogOpen);
    }

    /** 로그인 창이 하는 일을 순서대로 흉내 낸다 - 로그인 성공 → 창 닫힘(뒤로) → 재개 액션 실행(useLoginDialog.ts) */
    async function completeLogin(router: TestRouter) {
      act(() => {
        signIn();
      });
      await act(async () => {
        await router.navigate(-1);
      });
      act(() => {
        useLoginDialogStore.getState().pendingAction?.();
      });
    }

    it('꺼진 칩을 누르면 칩과 주소는 그대로 두고 로그인 창을 연다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/');

      act(() => {
        latest.current.handleToggleFilter('isMyPosts');
      });

      await waitFor(() => {
        expect(isLoginDialogOpen(router)).toBe(true);
      });
      expect(latest.current.isClickedMyPosts).toBe(false);
      expect(latest.current.appliedCount).toBe(0);
      expect(router.state.location.search).toBe('');
    });

    it('로그인하면 눌렀던 칩이 켜지고 주소에 필터가 붙는다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/');

      act(() => {
        latest.current.handleToggleFilter('isMyPosts');
      });
      await waitFor(() => {
        expect(isLoginDialogOpen(router)).toBe(true);
      });

      await completeLogin(router);

      expect(latest.current.isClickedMyPosts).toBe(true);
      await waitFor(() => {
        expect(router.state.location.search).toBe('?filter=isMyPosts');
      });
      expect(isLoginDialogOpen(router)).toBe(false);
    });

    it('로그인하지 않고 창을 닫으면 칩과 주소가 그대로다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/');

      act(() => {
        latest.current.handleToggleFilter('isMyPosts');
      });
      await waitFor(() => {
        expect(isLoginDialogOpen(router)).toBe(true);
      });

      await act(async () => {
        await router.navigate(-1);
      });

      expect(latest.current.isClickedMyPosts).toBe(false);
      expect(router.state.location.search).toBe('');
    });

    it('칩을 누른 뒤 검색어가 바뀐 채 로그인해도 검색어는 남고 필터가 붙는다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/');
      // 조건을 바꾼 전환이 끝나기 전에 누른 칩 - 누른 순간의 핸들러는 바뀌기 전 주소를 기억하고 있다
      const handleToggleFilterBeforeSearch = latest.current.handleToggleFilter;

      await act(async () => {
        await router.navigate(`/?q=${encodeURIComponent('리액트')}`);
      });
      act(() => {
        handleToggleFilterBeforeSearch('isMyPosts');
      });
      await waitFor(() => {
        expect(isLoginDialogOpen(router)).toBe(true);
      });

      await completeLogin(router);

      await waitFor(() => {
        const params = new URLSearchParams(router.state.location.search);

        expect(params.get('filter')).toBe('isMyPosts');
        expect(params.get('q')).toBe('리액트');
      });
      expect(latest.current.isClickedMyPosts).toBe(true);
    });

    it('재개할 때 그 칩이 이미 켜져 있으면 끄지 않는다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/');

      act(() => {
        latest.current.handleToggleFilter('isMyPosts');
      });
      await waitFor(() => {
        expect(isLoginDialogOpen(router)).toBe(true);
      });

      await act(async () => {
        await router.navigate('/?filter=isMyPosts');
      });
      act(() => {
        signIn();
      });
      act(() => {
        useLoginDialogStore.getState().pendingAction?.();
      });

      expect(latest.current.isClickedMyPosts).toBe(true);
      expect(router.state.location.search).toBe('?filter=isMyPosts');
    });

    it('켜진 칩은 로그인 없이 끌 수 있다', async () => {
      const { latest, router } = renderFilterOnAppRouter('/?filter=isBookmarked,isMyPosts');

      act(() => {
        latest.current.handleToggleFilter('isMyPosts');
      });

      expect(latest.current.isClickedMyPosts).toBe(false);
      expect(latest.current.isClickedBookmark).toBe(true);
      await waitFor(() => {
        expect(router.state.location.search).toBe('?filter=isBookmarked');
      });
      expect(isLoginDialogOpen(router)).toBe(false);
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
