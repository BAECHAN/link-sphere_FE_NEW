import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { toast } from '@/shared/lib/toast/toast';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { useAuthStore } from '@/shared/store/auth.store';
import { useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';
import { GlobalAlerts } from '@/shared/ui/elements/dialog/alert/Alert';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { postKeys } from '@/entities/post/api/post.keys';
import type { Post } from '@/entities/post/model/post.schema';
import { useCreatePost } from '@/features/post/create/hooks/useCreatePost';

// useCreatePost.test.tsx는 useNavigate를 mock해 "호출됐다"만 본다 - 그 navigate가 이탈 가드에 다시
// 막히는지는 보이지 않는다. 여기서는 데이터 라우터 + 실제 가드 + 실제 확인창 + 응답을 붙잡는 MSW로
// "저장 중에 떠나려 할 때"의 경합을 결정적으로 재현한다(docs/UNSAVED-CHANGES-GUARD.md §10, 2026-10-21).

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const SUBMITTED_URL = 'https://example.com/new-article';
const SUBMIT_PATH = ROUTES_PATHS.POST.SUBMIT;

const newPost: Post = {
  ...mockPost,
  id: 'post-uuid-new',
  url: SUBMITTED_URL,
  title: 'New Article',
};

function GuardLayout() {
  useUnsavedChangesGuard();

  return (
    <>
      <Outlet />
      <GlobalAlerts />
    </>
  );
}

// 훅 결과를 바깥 변수에 담지 않고 화면에 그린다(useNewVersionReload.test.tsx와 같은 이유)
function CreatePostProbe() {
  const { form, onSubmit, submitError } = useCreatePost();

  return (
    <form onSubmit={onSubmit}>
      <input aria-label="url" {...form.register('url')} />
      <button type="submit">submit</button>
      <p data-testid="submit-error">{submitError?.message}</p>
    </form>
  );
}

/** 응답을 테스트가 원할 때 돌려준다. release는 요청이 핸들러에 닿은 뒤에 채워진다. */
function holdCreateResponse(respond: () => Response) {
  const gate: { release: (() => void) | null } = { release: null };

  server.use(
    http.post(url(API_ENDPOINTS.post.base), async () => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });

      return respond();
    })
  );

  return gate;
}

const createSucceeded = () =>
  HttpResponse.json({ status: 201, message: 'ok', data: newPost, timestamp: '' }, { status: 201 });

const createRateLimited = () =>
  HttpResponse.json(
    { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    { status: 429 }
  );

interface RenderOptions {
  queryClient?: QueryClient;
  /** 탭 화면 대신 쓸 라우트 요소 - 다음 화면이 suspend하는 구간을 재현할 때 넘긴다 */
  tabElement?: RouteObject['element'];
}

// 운영처럼 화면마다 Suspense로 감싼다(app/routes/index.tsx의 withSuspense) - 같은 자리의 Suspense가
// 재사용돼야 "다음 화면이 suspend하는 동안 이전 폼이 남는" 구간이 생긴다.
function renderCreatePost({
  queryClient = createTestQueryClient(),
  tabElement,
}: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      {
        element: <GuardLayout />,
        children: [
          {
            path: ROUTES_PATHS.POST.ROOT,
            element: (
              <Suspense fallback={null}>
                <div data-testid="feed" />
              </Suspense>
            ),
          },
          {
            path: SUBMIT_PATH,
            element: (
              <Suspense fallback={null}>
                <CreatePostProbe />
              </Suspense>
            ),
          },
          {
            path: ROUTES_PATHS.BOOKMARK,
            element: tabElement ?? (
              <Suspense fallback={null}>
                <div data-testid="other-tab" />
              </Suspense>
            ),
          },
        ],
      },
    ],
    { initialEntries: [ROUTES_PATHS.POST.ROOT, SUBMIT_PATH], initialIndex: 1 }
  );

  RouterEvents.setSource(router);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );

  return { router, queryClient };
}

async function fillAndSubmit(gate: { release: (() => void) | null }) {
  fireEvent.change(screen.getByLabelText('url'), { target: { value: SUBMITTED_URL } });
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));

  // 요청이 서버(핸들러)에 닿은 뒤에 다음 단계로 간다
  await waitFor(() => expect(gate.release).not.toBeNull());
}

type LeaveWay = 'tab' | 'back';

async function tryToLeave(router: ReturnType<typeof createMemoryRouter>, way: LeaveWay) {
  await act(async () => {
    await (way === 'tab' ? router.navigate(ROUTES_PATHS.BOOKMARK) : router.navigate(-1));
  });

  await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.title });
}

/** 확인창은 열린 직후 클릭을 무시한다(useOpenClickGuard) - 가드 시간을 흘려보낸 뒤 누른다. */
function clickConfirmButton(name: string) {
  vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
  fireEvent.click(screen.getByRole('button', { name }));
}

async function release(gate: { release: (() => void) | null }) {
  await act(async () => {
    gate.release?.();
  });
}

/** 응답 뒤 훅의 이어지는 처리(navigate 등)가 끝날 때까지 기다린다 - "아무 일도 없었다"를 단언하기 전에 쓴다. */
async function settle(queryClient: QueryClient) {
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function queryLeaveDialog() {
  return screen.queryByRole('alertdialog', { name: TEXTS.unsavedChanges.title });
}

describe('useCreatePost - 저장 중 이탈', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useAlertStore.setState({ alerts: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    useAuthStore.getState().setAuth('test-access-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    { way: 'tab' as const, label: '다른 탭을 눌러' },
    { way: 'back' as const, label: '뒤로가기로' },
  ])(
    '저장 중 $label 떠나려다 뜬 확인창이 열린 채 등록이 성공하면 확인창이 닫히고 피드로 간다',
    async ({ way }) => {
      const gate = holdCreateResponse(createSucceeded);
      const { router } = renderCreatePost();

      await fillAndSubmit(gate);
      await tryToLeave(router, way);

      expect(router.state.location.pathname).toBe(SUBMIT_PATH);

      await release(gate);

      await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
      expect(await screen.findByTestId('feed')).toBeInTheDocument();
      expect(queryLeaveDialog()).not.toBeInTheDocument();
    }
  );

  it('"계속 작성"으로 머문 뒤 등록이 성공하면 피드로 가고 새 글이 목록 맨 앞에 있다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    queryClient.setQueryData(postKeys.list(), {
      pages: [
        { page: 0, size: 10, content: [mockPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    });
    const gate = holdCreateResponse(createSucceeded);
    const { router } = renderCreatePost({ queryClient });

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.cancel);

    expect(queryLeaveDialog()).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(SUBMIT_PATH);

    await release(gate);

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
    const cached = queryClient.getQueryData<{ pages: { content: Post[] }[] }>(postKeys.list());
    expect(cached?.pages[0]?.content.map((post) => post.id)).toEqual([newPost.id, mockPost.id]);
  });

  it('확인창이 열린 채 등록이 실패하면 "계속 작성" 뒤에 입력과 실패 안내가 남는다', async () => {
    const gate = holdCreateResponse(createRateLimited);
    const { router, queryClient } = renderCreatePost();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    await release(gate);
    await settle(queryClient);

    // 실패하면 입력이 그대로라 "사라져요" 확인창의 전제도 그대로다
    expect(queryLeaveDialog()).toBeInTheDocument();

    clickConfirmButton(TEXTS.unsavedChanges.cancel);

    expect(router.state.location.pathname).toBe(SUBMIT_PATH);
    expect(screen.getByLabelText('url')).toHaveValue(SUBMITTED_URL);
    expect(screen.getByTestId('submit-error')).toHaveTextContent(
      TEXTS.messages.error.postSubmit.rateLimited
    );
  });

  it('응답 전에 "나가기"로 떠났으면 등록이 성공해도 떠난 화면에 머문다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(createSucceeded);
    const { router, queryClient } = renderCreatePost();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('응답 전에 "나가기"로 떠났으면 등록 실패를 토스트로 알린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(createRateLimited);
    const { router, queryClient } = renderCreatePost();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.postSubmit.rateLimited);
    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
  });

  it('떠나려 하지 않았으면 등록 성공 뒤 확인창 없이 피드로 간다', async () => {
    const gate = holdCreateResponse(createSucceeded);
    const { router } = renderCreatePost();

    await fillAndSubmit(gate);
    await release(gate);

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
    expect(await screen.findByTestId('feed')).toBeInTheDocument();
    expect(queryLeaveDialog()).not.toBeInTheDocument();
  });

  it('"나가기" 뒤 다음 화면을 불러오는 동안 등록이 성공해도 떠난 화면을 덮어쓰지 않는다', async () => {
    // 처음 가는 탭의 청크를 받는 동안을 붙잡아 둔다
    let loadTab!: () => void;
    const tabChunk = new Promise<{ default: () => JSX.Element }>((resolve) => {
      loadTab = () => resolve({ default: () => <div data-testid="other-tab" /> });
    });
    const LazyTab = lazy(() => tabChunk);
    const gate = holdCreateResponse(createSucceeded);
    const { router, queryClient } = renderCreatePost({
      tabElement: (
        <Suspense fallback={null}>
          <LazyTab />
        </Suspense>
      ),
    });

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.confirm);

    // 라우터는 이미 탭에 가 있지만 화면은 아직 폼이다(정지 구간)
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK));
    expect(screen.getByLabelText('url')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);

    await act(async () => {
      loadTab();
      await tabChunk;
    });

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();
  });

  it('저장 중 같은 경로 안에서 이동해도(폴더 선택 오버레이) 등록이 성공하면 피드로 간다', async () => {
    const gate = holdCreateResponse(createSucceeded);
    const { router } = renderCreatePost();

    await fillAndSubmit(gate);
    // useHistoryOverlay처럼 같은 경로에 state만 실어 push한다 - 경로가 같아 가드도 막지 않는다
    await act(async () => {
      await router.navigate(SUBMIT_PATH, { state: { postCreateBookmarkFolderOpen: true } });
    });

    expect(queryLeaveDialog()).not.toBeInTheDocument();

    await release(gate);

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
  });
});
