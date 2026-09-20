import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, userEvent } from '@/test/utils';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { PostListSearch } from '@/widgets/post/post-list/ui/PostListSearch';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';

// PostListSearch.test.tsx는 usePostList()를 호출하지 않아(=목록 쿼리가 suspend하지 않아)
// 이 파일이 다루는 버그 클래스(RouterProvider.tsx의 v7_startTransition 때문에 필터 변경이
// 커밋되기 전 "정지 구간"에서 또 조작하면 생기는 유실/되살아남)를 구조적으로 못 잡는다.
// 그래서 PostListSearch + 실제로 suspend하는 usePostList() 소비자를 함께 렌더하고, MSW
// 핸들러를 수동 게이트로 감싸 그 정지 구간을 결정적으로 재현한다.

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

interface Gate {
  promise: Promise<void>;
  resolve: () => void;
  resolved: boolean;
}

function createGate(): Gate {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  const gate: Gate = {
    promise,
    resolved: false,
    resolve: () => {
      gate.resolved = true;
      resolve();
    },
  };
  return gate;
}

function createGateRegistry() {
  const byKey = new Map<string, Gate>();
  const inOrder: Gate[] = [];

  function getGate(key: string): Gate {
    let gate = byKey.get(key);
    if (!gate) {
      gate = createGate();
      byKey.set(key, gate);
      inOrder.push(gate);
    }
    return gate;
  }

  return { getGate, inOrder };
}

/** 게시글 목록 API를 쿼리 조합별 게이트로 감싼다 - resolve() 전까지 응답을 미룬다. */
function mockGatedPostList(getGate: (key: string) => Gate) {
  server.use(
    http.get(url(API_ENDPOINTS.post.base), async ({ request }) => {
      const reqUrl = new URL(request.url);
      const key = [
        `filter=${reqUrl.searchParams.get('filter') ?? ''}`,
        `category=${reqUrl.searchParams.get('category') ?? ''}`,
      ].join('&');
      const gate = getGate(key);

      await gate.promise;

      return HttpResponse.json(
        { status: 200, message: 'ok', data: mockPostListResponse, timestamp: '' },
        { status: 200 }
      );
    })
  );
}

async function releaseAllGates(gates: Gate[]) {
  await act(async () => {
    gates.filter((g) => !g.resolved).forEach((g) => g.resolve());
    await Promise.resolve();
  });
}

/**
 * fetch가 실제로 MSW 핸들러에 도달해 게이트가 등록될 때까지 기다린다. userEvent.click()의
 * act()는 클릭에 대한 동기 렌더까지만 보장하고, 그 렌더가 시작한 네트워크 요청이 핸들러에
 * 닿는 것까지는 보장하지 않는다 - 이 대기 없이 releaseAllGates를 부르면 아직 생성되지
 * 않은 게이트는 그냥 지나쳐 영원히 안 풀린 채로 남는다.
 */
async function waitForGateCount(gates: Gate[], count: number) {
  await waitFor(() => {
    expect(gates.length).toBeGreaterThanOrEqual(count);
  });
}

function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function PostListProbe() {
  const { posts } = usePostList();
  return <div data-testid="post-count">{posts.length}</div>;
}

function renderPostList(initialEntry: string) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true }}>
        <PostListSearch />
        <Suspense fallback={<div data-testid="loading" />}>
          <PostListProbe />
        </Suspense>
        <LocationSearchProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
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

describe('usePostList — 정지 구간(v7_startTransition) 중 필터 조작', () => {
  it('시나리오 A: 로딩 중 다른 필터를 연속 클릭해도 둘 다 누적된다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder); // 최초 마운트 조회
    await screen.findByTestId('post-count');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await waitForGateCount(inOrder, 2);
    // 아직 release 전 — 정지 구간 안이라 커밋된 URL은 그대로다
    expect(screen.getByTestId('location-search')).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.myPosts }));
    await waitForGateCount(inOrder, 3);

    await releaseAllGates(inOrder);

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(decodeURIComponent(search)).toContain('filter=isBookmarked,isMyPosts');
    });
  });

  it('시나리오 B: 로딩 중 카테고리 칩과 범위 필터 칩을 연속 클릭해도 둘 다 살아남는다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    await user.click(screen.getByRole('button', { name: '@백엔드' }));
    await waitForGateCount(inOrder, 2);
    // 아직 release 전 — 정지 구간 안이라 커밋된 URL은 그대로다
    expect(screen.getByTestId('location-search')).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await waitForGateCount(inOrder, 3);

    await releaseAllGates(inOrder);

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      const decoded = decodeURIComponent(search);
      expect(decoded).toContain('q=@백엔드');
      expect(decoded).toContain('filter=isBookmarked');
    });
  });

  it('시나리오 C: 로딩 중 같은 필터를 즉시 재클릭하면 무의식적 더블클릭으로 보고 무시한다', async () => {
    // 과거(고정 이력)에는 이 시나리오가 "즉시 재클릭 = 취소"를 검증했으나, useClickGuard
    // (500ms, useClickGuard.ts) 도입으로 그 계약이 바뀌었다 - 즉시 재클릭은 의식적으로
    // 인지하고 다시 누른 게 아니라 무의식적 중복 클릭으로 보고 무시한다(docs/DECISIONS.md
    // 참고). "충분한 시간 뒤 재클릭하면 취소된다"는 아래 시나리오 C-2가 검증한다.
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await waitForGateCount(inOrder, 2);
    // 아직 커밋 전 — 정지 구간 안임을 확인
    expect(screen.getByTestId('location-search')).toHaveTextContent('');

    // 가드가 이 두 번째 클릭 자체를 막으므로 새 게이트가 생기지 않는다.
    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await releaseAllGates(inOrder);

    await waitFor(() =>
      expect(screen.getByTestId('location-search')).toHaveTextContent('filter=isBookmarked')
    );
  });

  it('시나리오 C-2: 충분한 시간(500ms) 뒤 같은 필터를 재클릭하면 정상적으로 취소된다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await waitForGateCount(inOrder, 2);
    await releaseAllGates(inOrder);
    await waitFor(() =>
      expect(screen.getByTestId('location-search')).toHaveTextContent('filter=isBookmarked')
    );

    await new Promise((resolve) => setTimeout(resolve, 550));

    // 재클릭의 목적지(filter 없음)는 초기 로드와 같은 쿼리 키라 캐시 히트로 새 네트워크
    // 요청 자체가 안 생길 수 있다 - 게이트 개수를 강제하지 않고 남은 미해결 게이트만 연다.
    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await releaseAllGates(inOrder);

    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''));
  });

  it('시나리오 D: 초기화 직후 로딩 중에 다른 칩을 클릭해도 지운 필터가 되살아나지 않는다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/?filter=isBookmarked');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.reset }));
    await waitForGateCount(inOrder, 2);

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.myPosts }));
    await waitForGateCount(inOrder, 3);

    await releaseAllGates(inOrder);

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(decodeURIComponent(search)).toContain('filter=isMyPosts');
      expect(search).not.toContain('isBookmarked');
    });
  });
});
