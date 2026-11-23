import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { createTestQueryClient, render, screen, waitFor } from '@/test/utils';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { appRoutes } from '@/app/routes/AppRoutes';
import { useAuthStore } from '@/shared/store/auth.store';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { RouterEvents } from '@/shared/lib/router/router-events';

// 피드 페이지 청크를 표식만 그리는 화면으로 바꾼다 - 이 테스트는 청크 밖에서 피드 라우트가 스스로 보내는 목록
// 요청(미리 받기)만 본다. 목록 화면 쪽의 같은 조건은 PostList.test.tsx가 본다.
vi.mock('@/pages/post/PostFeedPage', () => ({
  PostFeedPage: () => <div data-testid="feed-page" />,
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function findRoute(routes: RouteObject[], path: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.path === path) {
      return route;
    }

    const found = findRoute(route.children ?? [], path);

    if (found) {
      return found;
    }
  }

  return undefined;
}

/** 목록 요청마다 filter 값을 기록하고 빈 목록으로 응답한다 */
function mockPostList(): (string | null)[] {
  const filters: (string | null)[] = [];

  server.use(
    http.get(url(API_ENDPOINTS.post.base), ({ request }) => {
      filters.push(new URL(request.url).searchParams.get('filter'));

      return HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: { ...mockPostListResponse, content: [] },
          timestamp: '',
        },
        { status: 200 }
      );
    })
  );

  return filters;
}

/** 앱 라우트 정의의 피드 라우트를(레이아웃 없이 그 element만) 앱과 같은 데이터 라우터로 띄운다 */
function renderFeedRoute(search: string) {
  const feedRoute = findRoute(appRoutes, ROUTES_PATHS.POST.ROOT);

  if (!feedRoute) {
    throw new Error('feed route is missing from appRoutes');
  }

  const router = createMemoryRouter(
    [{ path: ROUTES_PATHS.POST.ROOT, element: feedRoute.element }],
    { initialEntries: [`${ROUTES_PATHS.POST.ROOT}${search}`] }
  );

  RouterEvents.setSource(router);

  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  useHideBotsStore.setState({ hideBots: false });
  server.use(
    http.get(url(API_ENDPOINTS.common.categoryOption), () =>
      HttpResponse.json({ status: 200, message: 'ok', data: [], timestamp: '' }, { status: 200 })
    )
  );
});

describe('피드 라우트 — 목록 미리 받기', () => {
  it('로그아웃 상태에서 주소에 로그인 전용 범위 필터가 있으면 목록을 미리 요청하지 않는다', async () => {
    const filters = mockPostList();

    renderFeedRoute('?filter=isPrivate');
    await screen.findByTestId('feed-page');
    // 미리 받기는 라우트의 첫 렌더에서 나간다 - 뒤늦게 나가는 요청이 없는지 잠시 더 지켜본다
    await wait(100);

    expect(filters).toEqual([]);
  });

  it('로그아웃 상태여도 로그인 전용 범위 필터가 없으면 목록을 미리 요청한다', async () => {
    const filters = mockPostList();

    renderFeedRoute('');

    await waitFor(() => expect(filters).toEqual([null]));
  });

  it('로그인 상태면 로그인 전용 범위 필터를 붙여 목록을 미리 요청한다', async () => {
    useAuthStore.getState().setAuth('token');
    const filters = mockPostList();

    renderFeedRoute('?filter=isPrivate');

    await waitFor(() => expect(filters).toEqual(['isPrivate']));
  });
});
