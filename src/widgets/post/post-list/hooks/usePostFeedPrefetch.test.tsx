import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, userEvent } from '@/test/utils';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { postKeys } from '@/entities/post/api/post.keys';
import { PostList } from '@/widgets/post/post-list/ui/PostList';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';
import { usePostFeedPrefetch } from '@/widgets/post/post-list/hooks/usePostFeedPrefetch';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { useHideBotsStore } from '@/shared/store/hideBots.store';

// 피드 라우트(app/routes의 PostFeedRoute)는 lazy 페이지 청크 밖에서 목록 첫 페이지를 미리 요청한다.
// 미리 받은 캐시를 목록 화면이 그대로 이어받으려면 키가 같아야 하고, 같으면 요청은 한 번만 나간다.

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// 운영 gcTime(5분, queryClient.ts)과 같게 둔다 - 기본값 0이면 미리 받은 쿼리가 응답 직후 캐시에서 지워질 수
// 있다. 진행 중인 요청을 이어받는 쪽은 옵션을 넘기지 못하고(query-core query.js fetch), 조건을 바꾼 전환
// 렌더에서는 목록이 커밋되기 전까지 관찰자가 없어, 느린 CI에서 목록이 같은 조건을 다시 요청했다.
const PROD_GC_TIME_MS = 5 * 60 * 1000;

// 이 테스트는 그리드 치수와 무관하다 - 훅이 요구하는 값만 채운다
const TEST_GRID: CardGridSpec = {
  className: 'grid',
  minColumnWidth: 330,
  maxColumns: 3,
  rowGap: [{ minWidthRem: 0, gap: 12 }],
  rowHeightEstimate: {},
};

interface ListRequest {
  search: string | null;
  category: string | null;
  nickname: string | null;
  filter: string | null;
}

function renderTestPost() {
  return null;
}

function FeedPrefetch() {
  usePostFeedPrefetch();

  return null;
}

/** 목록 요청의 조건을 기록하고, 봇 숨기기 요청만 delayMs 늦게 빈 목록으로 응답한다 */
function mockPostList(requests: ListRequest[], hideBotsDelayMs = 0) {
  server.use(
    http.get(url(API_ENDPOINTS.post.base), async ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push({
        search: params.get('search'),
        category: params.get('category'),
        nickname: params.get('nickname'),
        filter: params.get('filter'),
      });

      if (params.get('filter')?.includes('excludeBots')) {
        await new Promise((resolve) => setTimeout(resolve, hideBotsDelayMs));
      }

      return HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: { ...mockPostListResponse, content: [], totalElements: 0 },
          timestamp: '',
        },
        { status: 200 }
      );
    })
  );
}

/** 앱처럼 데이터 라우터 + v7_startTransition으로 띄운다 - "적용 중" 판정이 라우터 구독을 쓴다 */
function renderRoute(element: ReactNode, initialEntry: string, queryClient: QueryClient) {
  const router = createMemoryRouter([{ path: '/', element }], { initialEntries: [initialEntry] });

  RouterEvents.setSource(router);

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );
}

function feedElement() {
  return (
    <>
      <FeedPrefetch />
      <PostListSearch />
      <PostList renderPost={renderTestPost} grid={TEST_GRID} />
    </>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  useHideBotsStore.setState({ hideBots: false });
  server.use(
    http.get(url(API_ENDPOINTS.common.categoryOption), () =>
      HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: [{ id: 1, name: '백엔드', slug: 'backend', sortOrder: 0, createdAt: '2025-01-01' }],
          timestamp: '',
        },
        { status: 200 }
      )
    )
  );
});

describe('usePostFeedPrefetch — 목록 화면과 같은 키', () => {
  it.each([
    {
      name: '조건 없음',
      search: '',
      hideBots: false,
      expected: { search: null, category: null, nickname: null, filter: null },
    },
    {
      name: '라벨·닉네임·검색어·필터 + 봇 숨기기',
      search: `?${new URLSearchParams({ q: '@DevOps #nick react', filter: 'bookmarked' })}`,
      hideBots: true,
      expected: {
        search: 'react',
        category: 'DevOps',
        nickname: 'nick',
        filter: 'bookmarked,excludeBots',
      },
    },
    {
      name: '옛 링크의 excludeBots는 무시하고 설정만 따른다',
      search: `?${new URLSearchParams({ filter: 'bookmarked,excludeBots' })}`,
      hideBots: false,
      expected: { search: null, category: null, nickname: null, filter: 'bookmarked' },
    },
  ])(
    '$name: 목록을 한 번만 요청하고 캐시 항목도 하나다',
    async ({ search, hideBots, expected }) => {
      useHideBotsStore.setState({ hideBots });
      const requests: ListRequest[] = [];
      mockPostList(requests);
      const queryClient = createTestQueryClient({ gcTime: PROD_GC_TIME_MS });

      renderRoute(feedElement(), `/${search}`, queryClient);
      await screen.findByText(TEXTS.messages.info.noPosts);

      expect(requests).toEqual([expected]);
      expect(queryClient.getQueryCache().findAll({ queryKey: postKeys.listRoot })).toHaveLength(1);
    }
  );

  it('페이지 청크가 아직 오지 않아도 목록을 요청한다', async () => {
    const requests: ListRequest[] = [];
    mockPostList(requests);
    // 끝내 도착하지 않는 lazy 페이지 청크
    const PendingPage = lazy(() => new Promise<{ default: ComponentType }>(() => {}));

    renderRoute(
      <>
        <FeedPrefetch />
        <Suspense fallback={null}>
          <PendingPage />
        </Suspense>
      </>,
      '/',
      createTestQueryClient({ gcTime: PROD_GC_TIME_MS })
    );

    await waitFor(() => expect(requests).toHaveLength(1));
  });
});

describe('usePostFeedPrefetch — 조건을 바꾼 뒤', () => {
  it('라벨을 고르면 새 조건을 한 번만 요청한다', async () => {
    const requests: ListRequest[] = [];
    mockPostList(requests);
    const user = userEvent.setup();

    renderRoute(feedElement(), '/', createTestQueryClient({ gcTime: PROD_GC_TIME_MS }));
    await screen.findByText(TEXTS.messages.info.noPosts);

    await user.click(await screen.findByRole('button', { name: '@백엔드' }));

    await waitFor(() =>
      expect(requests.filter((request) => request.category === '백엔드')).toHaveLength(1)
    );
    // 미리 받기와 목록이 같은 조건을 따로 보내지 않는지 잠시 더 지켜본다
    await wait(300);
    expect(requests.filter((request) => request.category === '백엔드')).toHaveLength(1);
  });

  // 미리 받기는 지금 설정값으로, 목록은 늦춘 값으로 조회한다 - 미리 받기가 한 박자 먼저 요청해도 목록은
  // 이전 결과를 보이는 채로 두고 같은 요청을 이어받아야 한다(docs/SEARCH.md §10의 봇 숨기기 전환)
  it('봇 글 숨기기를 켜면 이전 목록을 보이는 채로 두고, 새 조건은 한 번만 요청한다', async () => {
    const requests: ListRequest[] = [];
    mockPostList(requests, 1500);
    const user = userEvent.setup();

    renderRoute(feedElement(), '/', createTestQueryClient({ gcTime: PROD_GC_TIME_MS }));
    await screen.findByText(TEXTS.messages.info.noPosts);

    await user.click(screen.getByLabelText(TEXTS.buttons.hideBots));
    expect(screen.getByText(TEXTS.messages.info.noPosts)).toBeVisible();

    expect(
      await screen.findByText(TEXTS.post.search.applying, undefined, { timeout: 1200 })
    ).toBeInTheDocument();
    expect(screen.getByText(TEXTS.messages.info.noPosts)).toBeVisible();

    await waitFor(
      () => expect(screen.queryByText(TEXTS.post.search.applying)).not.toBeInTheDocument(),
      { timeout: 2500 }
    );
    expect(requests.filter((request) => request.filter === 'excludeBots')).toHaveLength(1);
  });
});
