import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, userEvent } from '@/test/utils';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { PostList } from '@/widgets/post/post-list/ui/PostList';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';

// 목록 조회가 한 번 실패하면 PostList의 에러 경계가 에러 문구를 띄운다. 예전에는 경계에
// resetKeys가 없어 검색 조건을 바꿔도 새로고침 전까지 에러 문구가 남았다(docs/SEARCH.md §10).

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// 운영 gcTime(5분, queryClient.ts)과 같게 둔다 - 기본값 0이면 실패한 쿼리가 suspense 최소값(1초)
// 뒤 캐시에서 지워져, "실패한 쿼리가 캐시에 남은 채 같은 조건으로 돌아오는" 상황이 재현되지 않는다.
const PROD_GC_TIME_MS = 5 * 60 * 1000;

// useClickGuard(400ms)가 같은 칩의 빠른 재클릭을 무의식적 중복 클릭으로 보고 무시한다
const CLICK_GUARD_WAIT_MS = 450;

// 이 테스트는 그리드 치수와 무관하다 - 훅이 요구하는 값만 채운다
const TEST_GRID: CardGridSpec = {
  className: 'grid',
  minColumnWidth: 330,
  maxColumns: 3,
  rowGap: [{ minWidth: 0, gap: 12 }],
  rowHeightEstimate: {},
};

function renderTestPost() {
  return null;
}

/** failingCategories에 든 카테고리 요청만 500으로 실패시키고, 나머지는 빈 목록을 돌려준다 */
function mockPostList(failingCategories: Set<string>, requestedCategories: string[]) {
  server.use(
    http.get(url(API_ENDPOINTS.post.base), ({ request }) => {
      const category = new URL(request.url).searchParams.get('category') ?? '';
      requestedCategories.push(category);

      if (failingCategories.has(category)) {
        return HttpResponse.json(
          { status: 500, message: 'injected', code: 'INTERNAL_SERVER_ERROR', timestamp: '' },
          { status: 500 }
        );
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

function renderFeed() {
  const queryClient = createTestQueryClient({ gcTime: PROD_GC_TIME_MS });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true }}>
        <PostListSearch />
        <PostList renderPost={renderTestPost} grid={TEST_GRID} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function waitForClickGuard() {
  return new Promise((resolve) => setTimeout(resolve, CLICK_GUARD_WAIT_MS));
}

beforeEach(() => {
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

describe('PostList — 목록 조회 실패 후 복구', () => {
  it('실패한 뒤 검색 조건을 바꾸면 에러 문구가 사라지고 목록이 다시 그려진다', async () => {
    mockPostList(new Set(['백엔드']), []);
    const user = userEvent.setup();

    renderFeed();
    await screen.findByText(TEXTS.messages.info.noPosts);

    const chip = await screen.findByRole('button', { name: '@백엔드' });
    await user.click(chip);
    await screen.findByText(TEXTS.messages.error.fetchPosts);

    await waitForClickGuard();
    await user.click(chip);

    await screen.findByText(TEXTS.messages.info.noPosts);
    expect(screen.queryByText(TEXTS.messages.error.fetchPosts)).not.toBeInTheDocument();
  });

  it('실패했던 조건을 나중에 다시 고르면 캐시된 에러를 띄우지 않고 다시 요청한다', async () => {
    const failingCategories = new Set(['백엔드']);
    const requestedCategories: string[] = [];
    mockPostList(failingCategories, requestedCategories);
    const user = userEvent.setup();

    renderFeed();
    await screen.findByText(TEXTS.messages.info.noPosts);

    const chip = await screen.findByRole('button', { name: '@백엔드' });
    await user.click(chip);
    await screen.findByText(TEXTS.messages.error.fetchPosts);

    await waitForClickGuard();
    await user.click(chip);
    await screen.findByText(TEXTS.messages.info.noPosts);

    // 일시 장애가 풀린 상황 - 같은 라벨을 다시 고르면 새로 요청해 성공해야 한다
    failingCategories.clear();
    await waitForClickGuard();
    await user.click(chip);

    await waitFor(() => {
      expect(requestedCategories.filter((category) => category === '백엔드')).toHaveLength(2);
    });
    await screen.findByText(TEXTS.messages.info.noPosts);
    expect(screen.queryByText(TEXTS.messages.error.fetchPosts)).not.toBeInTheDocument();
  });
});
