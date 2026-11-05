import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL } from '@/shared/config/api';
import { createTestQueryClient, waitRenderingEachStep } from '@/test/utils';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { useBookmarkPostList } from '@/widgets/bookmark/bookmark-post-list/hooks/useBookmarkPostList';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';

const FOLDER_POSTS_URL = `${API_BASE_URL}/bookmark/folders/:folderKey/posts`;

const TEST_GRID: CardGridSpec = {
  className: 'grid',
  minColumnWidth: 330,
  maxColumns: 3,
  rowGap: [{ minWidthRem: 0, gap: 12 }],
  rowHeightEstimate: {},
};

/**
 * 두 페이지(3개씩)짜리 폴더 글 목록. 다음 페이지는 recoverNextPage 전까지 status로 실패하고, holdFirstPage
 * 동안은 첫 페이지 응답을 붙잡아 재조회가 진행 중인 상태를 만든다. 페이지별 요청 수를 센다.
 */
function mockFolderPostPages(status: number) {
  const requests: number[] = [];
  let nextPageStatus: number | null = status;
  let firstPageGate: Promise<void> | null = null;

  server.use(
    http.get(FOLDER_POSTS_URL, async ({ request }) => {
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
            content: [1, 2, 3].map((n) => ({ ...mockPost, id: `post-${page}-${n}` })),
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

function BookmarkPostListProbe() {
  const { posts, containerRef, isPending, isFirstPageFailed, isNextPageFailed, retryNextPage } =
    useBookmarkPostList(TEST_GRID, 'all', 'latest');

  return (
    <>
      <div ref={containerRef} data-testid="post-count">
        {posts.length}
      </div>
      <div data-testid="pending">{String(isPending)}</div>
      <div data-testid="first-page-failed">{String(isFirstPageFailed)}</div>
      {isNextPageFailed && (
        <button type="button" onClick={retryNextPage}>
          retry
        </button>
      )}
    </>
  );
}

function renderBookmarkPostList() {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bookmark']}>
        <BookmarkPostListProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
}

describe('useBookmarkPostList — 다음 페이지 실패', () => {
  it.each([429, 500])(
    '다음 페이지가 %i로 실패하면 같은 요청을 다시 보내지 않는다',
    async (status) => {
      const { countPage } = mockFolderPostPages(status);

      renderBookmarkPostList();

      await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('3'));
      await waitFor(() => expect(countPage(1)).toBeGreaterThanOrEqual(1));
      await waitRenderingEachStep(1000);

      expect(countPage(1)).toBe(1);
      expect(screen.getByTestId('first-page-failed')).toHaveTextContent('false');
    }
  );

  it('다시 시도하면 다음 페이지를 다시 받는다', async () => {
    const pages = mockFolderPostPages(429);
    const user = userEvent.setup();

    renderBookmarkPostList();

    const retryButton = await screen.findByRole('button', { name: 'retry' });
    pages.recoverNextPage();
    await user.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('6'));
    expect(pages.countPage(1)).toBe(2);
  });

  it('재조회 중에는 다음 페이지를 부르지 않고, 재조회가 성공하면 부른다', async () => {
    const pages = mockFolderPostPages(429);

    const queryClient = renderBookmarkPostList();

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

describe('useBookmarkPostList — 첫 페이지 실패', () => {
  it('첫 페이지가 실패하면 빈 목록과 구분되는 실패 상태를 돌려준다', async () => {
    server.use(
      http.get(FOLDER_POSTS_URL, () =>
        HttpResponse.json(
          { status: 429, message: 'fail', data: null, timestamp: '' },
          { status: 429 }
        )
      )
    );

    renderBookmarkPostList();

    await waitFor(() => expect(screen.getByTestId('first-page-failed')).toHaveTextContent('true'));
    expect(screen.getByTestId('post-count')).toHaveTextContent('0');
  });
});

// 오프라인이면 첫 조회가 보내지지 않고 멈춘다(fetchStatus paused) - 이때 isLoading은 false라 "저장한 글이 없어요"로
// 보였다. 받기 전 상태(isPending)로 돌려줘 목록이 스피너를 그리게 한다.
describe('useBookmarkPostList — 오프라인', () => {
  it('오프라인이면 첫 쪽을 받기 전 상태로 돌려주고, 다시 연결되면 목록을 받는다', async () => {
    mockFolderPostPages(500);
    onlineManager.setOnline(false);

    try {
      renderBookmarkPostList();
      await waitRenderingEachStep(100);

      expect(screen.getByTestId('pending')).toHaveTextContent('true');
      expect(screen.getByTestId('post-count')).toHaveTextContent('0');
    } finally {
      act(() => {
        onlineManager.setOnline(true);
      });
    }

    await waitFor(() => expect(screen.getByTestId('post-count')).toHaveTextContent('3'));
    expect(screen.getByTestId('pending')).toHaveTextContent('false');
  });
});
