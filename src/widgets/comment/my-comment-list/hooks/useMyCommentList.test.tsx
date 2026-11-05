import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { delay, http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, waitRenderingEachStep } from '@/test/utils';
import { useMyCommentList } from '@/widgets/comment/my-comment-list/hooks/useMyCommentList';

// 센티넬이 늘 화면 안에 있는 상황 - 관찰을 시작하면 곧바로 보인다고 알린다(브라우저 IntersectionObserver의
// 첫 콜백과 같다). setup.ts의 기본 스텁은 콜백을 부르지 않는다
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function IntersectingObserverMock(callback: IntersectionObserverCallback) {
    return {
      observe: vi.fn(() => {
        queueMicrotask(() =>
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
          )
        );
      }),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(),
    };
  })
);

/**
 * 두 페이지(3개씩)짜리 내 댓글 목록. 다음 페이지는 recoverNextPage 전까지 status로 실패하고, holdFirstPage
 * 동안은 첫 페이지 응답을 붙잡아 재조회가 진행 중인 상태를 만든다. 페이지별 요청 수를 센다.
 */
function mockMyCommentPages(status: number) {
  const requests: number[] = [];
  let nextPageStatus: number | null = status;
  let firstPageGate: Promise<void> | null = null;

  server.use(
    http.get(`${API_BASE_URL}${API_ENDPOINTS.post.myComments}`, async ({ request }) => {
      const page = new URL(request.url).searchParams.get('cursor') ? 1 : 0;
      requests.push(page);
      // 실제 네트워크처럼 왕복 시간을 둔다(waitRenderingEachStep 주석 참고)
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
            content: [1, 2, 3].map((n) => ({
              id: `comment-${page}-${n}`,
              content: `댓글 ${n}`,
              createdAt: '2026-11-01T00:00:00.000Z',
              postId: 'post-1',
              postTitle: '글',
            })),
            nextCursor: page >= 1 ? null : 'cursor-1',
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

// MyCommentList.tsx처럼 실패하면 센티넬 대신 다시 시도 버튼을 둔다
function MyCommentListProbe() {
  const { comments, hasNextPage, isNextPageFailed, retryNextPage, observerRef } =
    useMyCommentList();

  return (
    <>
      <div data-testid="comment-count">{comments.length}</div>
      {isNextPageFailed && (
        <button type="button" onClick={retryNextPage}>
          retry
        </button>
      )}
      {hasNextPage && !isNextPageFailed && <div ref={observerRef} />}
    </>
  );
}

function renderMyCommentList() {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mycomment']}>
        <Suspense fallback={<div data-testid="loading" />}>
          <MyCommentListProbe />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
}

describe('useMyCommentList — 다음 페이지 실패', () => {
  it.each([429, 500])(
    '다음 페이지가 %i로 실패하면 같은 요청을 다시 보내지 않는다',
    async (status) => {
      const { countPage } = mockMyCommentPages(status);

      renderMyCommentList();

      await waitFor(() => expect(screen.getByTestId('comment-count')).toHaveTextContent('3'));
      await waitFor(() => expect(countPage(1)).toBeGreaterThanOrEqual(1));
      await waitRenderingEachStep(1000);

      expect(countPage(1)).toBe(1);
    }
  );

  it('다시 시도하면 다음 페이지를 다시 받는다', async () => {
    const pages = mockMyCommentPages(429);
    const user = userEvent.setup();

    renderMyCommentList();

    const retryButton = await screen.findByRole('button', { name: 'retry' });
    pages.recoverNextPage();
    await user.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('comment-count')).toHaveTextContent('6'));
    expect(pages.countPage(1)).toBe(2);
  });

  it('재조회 중에는 다음 페이지를 부르지 않고, 재조회가 성공하면 부른다', async () => {
    const pages = mockMyCommentPages(429);

    const queryClient = renderMyCommentList();

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

    await waitFor(() => expect(screen.getByTestId('comment-count')).toHaveTextContent('6'));
    expect(pages.countPage(1)).toBe(2);
  });
});
