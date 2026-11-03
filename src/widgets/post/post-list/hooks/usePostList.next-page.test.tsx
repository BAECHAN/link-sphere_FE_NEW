import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { delay, http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, waitRenderingEachStep } from '@/test/utils';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';

// 다음 페이지 요청이 실패한 뒤 무한 스크롤이 같은 요청을 계속 다시 보내는지(#491 1번).
// jsdom에서도 가상 행이 나온다 - useWindowGridVirtualizer가 첫 렌더 크기를 window.innerHeight로 잡는다.

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const TEST_GRID: CardGridSpec = {
  className: 'grid',
  minColumnWidth: 330,
  maxColumns: 3,
  rowGap: [{ minWidthRem: 0, gap: 12 }],
  rowHeightEstimate: {},
};

/**
 * 두 페이지(3개씩)짜리 목록. 다음 페이지는 recoverNextPage 전까지 status로 실패하고, holdFirstPage 동안은
 * 첫 페이지 응답을 붙잡아 재조회가 진행 중인 상태를 만든다. 페이지별 요청 수를 센다.
 */
function mockPostListPages(status: number) {
  const requests: number[] = [];
  let nextPageStatus: number | null = status;
  let firstPageGate: Promise<void> | null = null;

  server.use(
    http.get(url(API_ENDPOINTS.post.base), async ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
      requests.push(page);
      // 실제 네트워크처럼 왕복 시간을 둔다 - 없으면 '요청 중'과 '실패'가 한 번의 알림으로 합쳐져 렌더가 그 사이를 못 본다
      await delay(30);

      if (page === 0 && firstPageGate) {
        await firstPageGate;
      }

      if (page > 0 && nextPageStatus !== null) {
        return HttpResponse.json(
          { status: nextPageStatus, message: 'fail', data: null, timestamp: '' },
          { status: nextPageStatus }
        );
      }

      return HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: {
            page,
            size: 3,
            content: [1, 2, 3].map((n) => ({ ...mockPost, id: `post-${page}-${n}` })),
            totalElements: 6,
            totalPages: 2,
            last: page >= 1,
          },
          timestamp: '',
        },
        { status: 200 }
      );
    })
  );

  return {
    countPage: (page: number) => requests.filter((p) => p === page).length,
    recoverNextPage: () => {
      nextPageStatus = null;
    },
    holdFirstPage: () => {
      let release = () => {};
      firstPageGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      return () => {
        firstPageGate = null;
        release();
      };
    },
  };
}

function PostListProbe() {
  const { posts, containerRef, isNextPageFailed, retryNextPage } = usePostList(TEST_GRID);

  return (
    <>
      <div ref={containerRef} data-testid="post-count">
        {posts.length}
      </div>
      {isNextPageFailed && (
        <button type="button" onClick={retryNextPage}>
          retry
        </button>
      )}
    </>
  );
}

function renderPostList() {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Suspense fallback={<div data-testid="loading" />}>
          <PostListProbe />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
}

describe('usePostList — 다음 페이지 실패', () => {
  it.each([429, 500])(
    '다음 페이지가 %i로 실패하면 같은 요청을 다시 보내지 않는다',
    async (status) => {
      const { countPage } = mockPostListPages(status);

      renderPostList();

      await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('3'));
      await waitFor(() => expect(countPage(1)).toBeGreaterThanOrEqual(1));
      await waitRenderingEachStep(1000);

      expect(countPage(1)).toBe(1);
    }
  );

  it('다시 시도하면 다음 페이지를 다시 받는다', async () => {
    const pages = mockPostListPages(429);
    const user = userEvent.setup();

    renderPostList();

    const retryButton = await screen.findByRole('button', { name: 'retry' });
    pages.recoverNextPage();
    await user.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('6'));
    expect(pages.countPage(1)).toBe(2);
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument();
  });

  // 재조회가 시작되면 실패 기록이 지워져 다음 페이지 조건이 다시 참이 된다 - 이때 다음 페이지를 부르면
  // 진행 중인 재조회가 취소된다(fetchNextPage의 cancelRefetch 기본값 true)
  it('재조회 중에는 다음 페이지를 부르지 않고, 재조회가 성공하면 부른다', async () => {
    const pages = mockPostListPages(429);

    const queryClient = renderPostList();

    await screen.findByRole('button', { name: 'retry' });
    pages.recoverNextPage();
    const releaseFirstPage = pages.holdFirstPage();
    act(() => {
      void queryClient.refetchQueries();
    });

    await waitFor(() => expect(pages.countPage(0)).toBe(2));
    await waitRenderingEachStep(300);
    expect(pages.countPage(1)).toBe(1);

    releaseFirstPage();

    await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('6'));
    expect(pages.countPage(1)).toBe(2);
  });
});
