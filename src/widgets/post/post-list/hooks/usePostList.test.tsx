import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, userEvent } from '@/test/utils';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { PostListFilter } from '@/widgets/post/post-list/ui/PostListFilter';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { useLoginDialog } from '@/widgets/layout/login-dialog/hooks/useLoginDialog';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';

// PostListFilter.test.tsx는 usePostList()를 호출하지 않아(=목록 쿼리가 suspend하지 않아)
// 이 파일이 다루는 버그 클래스(RouterProvider.tsx의 v7_startTransition 때문에 필터 변경이
// 커밋되기 전 "정지 구간"에서 또 조작하면 생기는 유실/되살아남)를 구조적으로 못 잡는다.
// 그래서 PostListFilter + 실제로 suspend하는 usePostList() 소비자를 함께 렌더하고, MSW
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

// 이 테스트는 그리드 치수와 무관하다 - 훅이 요구하는 값만 채운다
const TEST_GRID: CardGridSpec = {
  className: 'grid',
  minColumnWidth: 330,
  maxColumns: 3,
  rowGap: [{ minWidthRem: 0, gap: 12 }],
  rowHeightEstimate: {},
};

function PostListProbe() {
  const { posts } = usePostList(TEST_GRID);
  return <div data-testid="post-count">{posts.length}</div>;
}

function renderPostList(initialEntry: string) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true }}>
        <PostListFilter />
        <Suspense fallback={<div data-testid="loading" />}>
          <PostListProbe />
        </Suspense>
        <LocationSearchProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** 로그인 창의 열림·닫힘·재개 로직만 돌린다 - 창(폼)은 그리지 않는다 */
function LoginDialogLogic() {
  useLoginDialog();

  return null;
}

/**
 * 뒤로가기(POP)는 라우터 구독(RouterEvents)으로만 잡히는데, 그건 데이터 라우터에만 있다 -
 * MemoryRouter 컴포넌트 대신 createMemoryRouter로 만들어 앱(RouterProvider.tsx)처럼 주입한다.
 * extra는 같은 라우트에 함께 그릴 것(로그인 창 로직 등)이다.
 */
function renderPostListWithDataRouter(initialEntry: string, extra?: ReactNode) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <PostListFilter />
            <Suspense fallback={<div data-testid="loading" />}>
              <PostListProbe />
            </Suspense>
            <LocationSearchProbe />
            {extra}
          </>
        ),
      },
    ],
    { initialEntries: [initialEntry] }
  );

  RouterEvents.setSource(router);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );

  return router;
}

function readCommittedParams() {
  return new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
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
  // 범위 칩은 로그인해야 켜진다(정리는 src/test/setup.ts)
  beforeEach(() => {
    useAuthStore.getState().setAuth('token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    // (useClickGuard.ts) 도입으로 그 계약이 바뀌었다 - 즉시 재클릭은 의식적으로 인지하고
    // 다시 누른 게 아니라 무의식적 중복 클릭으로 보고 무시한다(docs/DECISIONS.md 참고).
    // "충분한 시간 뒤 재클릭하면 취소된다"는 아래 시나리오 C-2가 검증한다.
    // 가드가 재는 실제 시계를 멈춰, 두 클릭 사이의 게이트 대기가 무거운 실행에서 400ms를 넘어도 즉시 재클릭으로
    // 남게 한다(Navbar.test.tsx의 같은 꼴 테스트와 같은 이유, 2026-11-26)
    vi.useFakeTimers({ toFake: ['Date'] });
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

  it('시나리오 C-2: 충분한 시간(400ms) 뒤 같은 필터를 재클릭하면 정상적으로 취소된다', async () => {
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

    // useClickGuard(400ms, useClickGuard.ts)가 그보다 짧은 재클릭을 무의식적 중복
    // 클릭으로 보고 무시하므로, 그 임계값을 넘는 지연을 둔다.
    await new Promise((resolve) => setTimeout(resolve, 450));

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
  it('시나리오 E: 로딩 중 라벨 두 개를 연달아 눌러도 먼저 누른 라벨이 남는다', async () => {
    server.use(
      http.get(url(API_ENDPOINTS.common.categoryOption), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: [
              { id: 1, name: '백엔드', slug: 'backend', sortOrder: 0, createdAt: '2025-01-01' },
              {
                id: 2,
                name: '프론트엔드',
                slug: 'frontend',
                sortOrder: 1,
                createdAt: '2025-01-01',
              },
            ],
            timestamp: '',
          },
          { status: 200 }
        )
      )
    );
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    renderPostList('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    const backendChip = await screen.findByRole('button', { name: '@백엔드' });
    const frontendChip = screen.getByRole('button', { name: '@프론트엔드' });

    await user.click(backendChip);
    await waitForGateCount(inOrder, 2);
    // 아직 release 전 — 정지 구간 안이라 커밋된 URL은 그대로다
    expect(screen.getByTestId('location-search')).toHaveTextContent('');

    await user.click(frontendChip);
    await waitForGateCount(inOrder, 3);
    // 커밋 전에도 두 칩이 모두 켜져 있다 - URL 갱신이 먼저 나가도 미러는 바로 반영된다
    expect(backendChip).toHaveClass('bg-bg-brand-solid');
    expect(frontendChip).toHaveClass('bg-bg-brand-solid');

    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(readCommittedParams().get('q')).toBe('@백엔드 @프론트엔드');
    });
  });

  it('시나리오 F: 로딩 중 뒤로가기를 하면 칩이 꺼지고, 다음 조작에 취소한 필터가 되살아나지 않는다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    const router = renderPostListWithDataRouter('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    const bookmarkChip = screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly });
    await user.click(bookmarkChip);
    await waitForGateCount(inOrder, 2);
    expect(bookmarkChip).toHaveClass('bg-bg-warning-solid');

    // 커밋 전에 원래 항목으로 돌아간다 - location.key가 처음과 같아 React 쪽에선 변화가 안 보인다
    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => expect(bookmarkChip).not.toHaveClass('bg-bg-warning-solid'));

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.myPosts }));
    await waitForGateCount(inOrder, 3);
    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(readCommittedParams().get('filter')).toBe('isMyPosts');
    });
    expect(bookmarkChip).not.toHaveClass('bg-bg-warning-solid');
  });

  it('시나리오 F-2: 로딩 중 뒤로가기를 하면 라벨 칩도 꺼지고 검색어가 남지 않는다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    const router = renderPostListWithDataRouter('/');
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    const backendChip = await screen.findByRole('button', { name: '@백엔드' });
    await user.click(backendChip);
    await waitForGateCount(inOrder, 2);
    expect(backendChip).toHaveClass('bg-bg-brand-solid');

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => expect(backendChip).not.toHaveClass('bg-bg-brand-solid'));

    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(readCommittedParams().get('q')).toBeNull();
    });
    expect(backendChip).not.toHaveClass('bg-bg-brand-solid');
  });
});

// 로그아웃 상태에서 누른 범위 칩은 로그인 뒤 로그인 창이 닫히고 나서 켜진다(useAuthGuard의 resumeAfterLogin).
// 그 재개는 클릭이 아니라 로그인 창 쪽 effect에서, 창이 닫히는 뒤로가기 직후에 불린다 - 칩 표시(낙관적 미러)와
// 주소 초안이 클릭 때와 다른 경로를 탄다. 불리는 시점이 결과를 바꾸므로(React가 뒤로가기를 커밋하기 전이다)
// 창의 열림·닫힘·재개 로직(useLoginDialog)을 실제로 돌려 그 순서 그대로 본다.
describe('usePostList — 로그아웃 상태에서 누른 범위 칩을 로그인 뒤 재개', () => {
  afterEach(() => {
    useLoginDialogStore.getState().setOnSuccess(undefined);
    useLoginDialogStore.getState().setPendingAction(undefined);
  });

  function isLoginDialogOpen(router: ReturnType<typeof renderPostListWithDataRouter>) {
    const state = router.state.location.state as { loginDialogOpen?: boolean } | null;

    return Boolean(state?.loginDialogOpen);
  }

  /** 로그인 성공 - 로그인 창이 스스로 닫히고(뒤로) 재개 액션을 부른다(useLoginDialog.ts) */
  async function signInThroughDialog(router: ReturnType<typeof renderPostListWithDataRouter>) {
    act(() => {
      useAuthStore.getState().setAuth('token');
    });

    await waitFor(() => expect(isLoginDialogOpen(router)).toBe(false));
  }

  it('시나리오 G: 재개하면 목록 응답 전에 칩이 켜지고, 이어 누른 칩도 함께 쌓인다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    const router = renderPostListWithDataRouter('/', <LoginDialogLogic />);
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    const myPostsChip = screen.getByRole('button', { name: TEXTS.buttons.myPosts });
    await user.click(myPostsChip);

    // 로그인 창만 열린다 - 칩도 주소도 그대로이고 목록을 새로 요청하지 않는다
    await waitFor(() => expect(isLoginDialogOpen(router)).toBe(true));
    expect(myPostsChip).not.toHaveClass('bg-bg-informative-solid');
    expect(inOrder).toHaveLength(1);

    await signInThroughDialog(router);

    // 새 조건의 응답을 아직 받지 못한 정지 구간 - 커밋된 주소는 그대로지만 칩은 켜져 있다
    await waitForGateCount(inOrder, 2);
    expect(readCommittedParams().get('filter')).toBeNull();
    expect(myPostsChip).toHaveClass('bg-bg-informative-solid');

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.bookmarkOnly }));
    await waitForGateCount(inOrder, 3);
    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(readCommittedParams().get('filter')).toBe('isMyPosts,isBookmarked');
    });
    expect(myPostsChip).toHaveClass('bg-bg-informative-solid');
  });

  it('시나리오 H: 라벨 칩의 응답을 기다리는 중에 범위 칩을 누르고 로그인해도 라벨이 주소에 남는다', async () => {
    const { getGate, inOrder } = createGateRegistry();
    mockGatedPostList(getGate);
    const user = userEvent.setup();

    const router = renderPostListWithDataRouter('/', <LoginDialogLogic />);
    await waitForGateCount(inOrder, 1);
    await releaseAllGates(inOrder);
    await screen.findByTestId('post-count');

    const backendChip = await screen.findByRole('button', { name: '@백엔드' });
    await user.click(backendChip);
    await waitForGateCount(inOrder, 2);
    // 아직 release 전 — 라우터는 라벨이 붙은 주소에 가 있지만 커밋된 주소는 그대로다
    expect(readCommittedParams().get('q')).toBeNull();

    const myPostsChip = screen.getByRole('button', { name: TEXTS.buttons.myPosts });
    await user.click(myPostsChip);
    await waitFor(() => expect(isLoginDialogOpen(router)).toBe(true));

    await signInThroughDialog(router);
    await waitForGateCount(inOrder, 3);
    await releaseAllGates(inOrder);

    await waitFor(() => {
      expect(readCommittedParams().get('q')).toBe('@백엔드');
    });
    expect(readCommittedParams().get('filter')).toBe('isMyPosts');
    expect(backendChip).toHaveClass('bg-bg-brand-solid');
    expect(myPostsChip).toHaveClass('bg-bg-informative-solid');
  });
});
