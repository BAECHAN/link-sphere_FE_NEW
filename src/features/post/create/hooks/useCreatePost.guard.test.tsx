import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, lazy, type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS, IDEMPOTENCY_KEY_HEADER } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { toast } from '@/shared/lib/toast/toast';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { NavigationService } from '@/shared/lib/router/navigation';
import { useAuthStore } from '@/shared/store/auth.store';
import { useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { useAlertDialogStore } from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { GlobalAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs';
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
// 저장 중에 떠나려 하면 이미 요청했다는 문구로 확인창이 뜬다(usePendingSubmit)
const PENDING_TEXTS = TEXTS.unsavedChanges.pending.postCreate;

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
      <GlobalAlertDialogs />
    </>
  );
}

// 훅 결과를 바깥 변수에 담지 않고 화면에 그린다(useNewVersionReload.test.tsx와 같은 이유)
function CreatePostProbe() {
  const { form, onSubmit, submitError, submitButtonRef } = useCreatePost();

  return (
    <form onSubmit={onSubmit}>
      <input aria-label="url" {...form.register('url')} />
      <button ref={submitButtonRef} type="submit">
        submit
      </button>
      <p data-testid="url-error">{form.formState.errors.url?.message}</p>
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

const createServerError = () =>
  HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' },
    { status: 500 }
  );

const createUrlUnresolvable = () =>
  HttpResponse.json(
    { status: 400, code: 'URL_UNRESOLVABLE', message: 'Unknown host' },
    { status: 400 }
  );

const LEFT_PAGE_FAILURE = TEXTS.messages.error.leftPageFailure;
const SUBMIT_MESSAGES = TEXTS.messages.error.postSubmit;

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

  await screen.findByRole('alertdialog', { name: PENDING_TEXTS.title });
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
  return screen.queryByRole('alertdialog');
}

type ToastOptions = Parameters<typeof toast.error>[1];

/** 떠난 뒤 실패 토스트(showLeftPageFailureToast)의 옵션 - 마지막 toast.error 호출에서 꺼낸다 */
function lastToastOptions(errorSpy: { mock: { calls: unknown[][] } }) {
  return errorSpy.mock.calls.at(-1)?.[1] as ToastOptions;
}

/** 설명은 문장마다 한 줄로 그린다 - 문장 하나하나가 자기 줄(요소)에 있는지 본다 */
function expectDescriptionLines(options: ToastOptions, text: string) {
  const { container } = render(<div>{options?.description as ReactNode}</div>);

  for (const sentence of text.split(/(?<=\.)\s+/)) {
    expect(within(container).getByText(sentence)).toBeInTheDocument();
  }
}

/** scrollIntoView가 불린 요소들 - setup.ts가 Element.prototype.scrollIntoView를 vi.fn으로 바꿔 둔다 */
function scrolledElements() {
  return vi.mocked(Element.prototype.scrollIntoView).mock.contexts;
}

/** 토스트 버튼을 누른다 - 버튼의 이동은 컴포넌트 밖 이동(NavigationService)이라 테스트 라우터로 잇는다 */
async function clickToastAction(
  options: ToastOptions,
  router: ReturnType<typeof createMemoryRouter>
) {
  vi.spyOn(NavigationService, 'navigate').mockImplementation((to, navigateOptions) => {
    void router.navigate(to, navigateOptions);
  });

  await act(async () => {
    (options?.action as unknown as { onClick: () => void }).onClick();
  });
}

/** 저장 중 "나가기"로 탭 화면에 간 뒤 응답을 돌려준다 */
async function leaveThenRespond(
  gate: { release: (() => void) | null },
  router: ReturnType<typeof createMemoryRouter>,
  queryClient: QueryClient
) {
  await fillAndSubmit(gate);
  await tryToLeave(router, 'tab');
  clickConfirmButton(PENDING_TEXTS.confirm);
  await screen.findByTestId('other-tab');
  await release(gate);
  await settle(queryClient);
}

describe('useCreatePost - 저장 중 이탈', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useAlertDialogStore.setState({ dialogs: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set(), pendingSubmits: new Map() });
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
      pages: [{ content: [mockPost], nextCursor: null }],
      pageParams: [null],
    });
    const gate = holdCreateResponse(createSucceeded);
    const { router } = renderCreatePost({ queryClient });

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(PENDING_TEXTS.cancel);

    expect(queryLeaveDialog()).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(SUBMIT_PATH);

    await release(gate);

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
    const cached = queryClient.getQueryData<{ pages: { content: Post[] }[] }>(postKeys.list());
    expect(cached?.pages[0]?.content.map((post) => post.id)).toEqual([newPost.id, mockPost.id]);
  });

  it('확인창이 열린 채 등록이 실패하면 확인창이 닫히고 입력과 실패 안내가 남는다', async () => {
    const gate = holdCreateResponse(createRateLimited);
    const { router, queryClient } = renderCreatePost();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    await release(gate);
    await settle(queryClient);

    // 응답이 왔으니 "등록은 취소되지 않아요" 확인창의 전제가 사라졌다 - 닫고 막혔던 이동도 취소한다
    expect(queryLeaveDialog()).not.toBeInTheDocument();
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
    clickConfirmButton(PENDING_TEXTS.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    { cause: '요청 한도', respond: createRateLimited, description: SUBMIT_MESSAGES.rateLimited },
    // 원인을 특정하지 못한 실패(PostUtil unclassified)는 제목과 겹치지 않게 할 일만 적는다
    { cause: '서버 오류', respond: createServerError, description: LEFT_PAGE_FAILURE.retryLater },
  ])(
    '응답 전에 "나가기"로 떠난 뒤 $cause로 실패하면 닫을 때까지 남는 토스트로 알린다',
    async ({ respond, description }) => {
      const errorSpy = vi.spyOn(toast, 'error');
      const gate = holdCreateResponse(respond);
      const { router, queryClient } = renderCreatePost();

      await leaveThenRespond(gate, router, queryClient);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        LEFT_PAGE_FAILURE.postCreateTitle,
        expect.objectContaining({
          id: 'left-page-failure:post-create',
          duration: Infinity,
        })
      );
      expect(lastToastOptions(errorSpy)?.action).toMatchObject({
        label: TEXTS.buttons.createPostAgain,
      });
      expectDescriptionLines(lastToastOptions(errorSpy), description);
      expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
    }
  );

  it('응답 전에 "나가기"로 떠난 뒤 다시 보낸 요청까지 응답을 못 받으면 실패라고 단정하지 않는 제목으로 알린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(() => {
      // 다시 보낸 요청은 붙잡지 않고 바로 끊는다
      server.use(http.post(url(API_ENDPOINTS.post.base), () => HttpResponse.error()));

      return HttpResponse.error();
    });
    const { router, queryClient } = renderCreatePost();

    await leaveThenRespond(gate, router, queryClient);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      LEFT_PAGE_FAILURE.outcomeUnknownTitle,
      expect.objectContaining({ id: 'left-page-failure:post-create', duration: Infinity })
    );
  });

  it('응답 전에 "나가기"로 떠난 뒤 첫 요청이 끊겨도 다시 보낸 요청이 저장되면 실패 안내가 없다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(() => {
      server.use(http.post(url(API_ENDPOINTS.post.base), () => createSucceeded()));

      return HttpResponse.error();
    });
    const { router, queryClient } = renderCreatePost();

    await leaveThenRespond(gate, router, queryClient);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    {
      cause: '요청 한도(버튼 위 안내)',
      respond: createRateLimited,
      testId: 'submit-error',
      message: SUBMIT_MESSAGES.rateLimited,
      revealsSubmitError: true,
    },
    {
      cause: '주소 오류(URL 칸 안내)',
      respond: createUrlUnresolvable,
      testId: 'url-error',
      message: SUBMIT_MESSAGES.urlUnresolvable,
      revealsSubmitError: false,
    },
  ])(
    '$cause로 실패한 토스트의 [다시 등록하기]를 누르면 입력과 머물렀을 때의 안내를 되살린다',
    async ({ respond, testId, message, revealsSubmitError }) => {
      const errorSpy = vi.spyOn(toast, 'error');
      const gate = holdCreateResponse(respond);
      const { router, queryClient } = renderCreatePost();

      await leaveThenRespond(gate, router, queryClient);
      await clickToastAction(lastToastOptions(errorSpy), router);

      await waitFor(() => expect(screen.getByLabelText('url')).toHaveValue(SUBMITTED_URL));
      expect(router.state.location.pathname).toBe(SUBMIT_PATH);
      expect(screen.getByTestId(testId)).toHaveTextContent(message);
      // 되살린 입력도 작성 중으로 잡아 떠날 때 확인창이 뜬다
      expect(useUnsavedChangesStore.getState().dirtyKeys.has('post-create')).toBe(true);
      // 버튼 위 안내는 화면 밖일 수 있어 제출 버튼까지 내린다 - URL 칸 안내는 그 칸으로 포커스가 간다
      expect(scrolledElements().includes(screen.getByRole('button', { name: 'submit' }))).toBe(
        revealsSubmitError
      );
    }
  );

  it('[다시 등록하기]로 되살린 입력을 다시 제출하면 첫 요청과 같은 키를 쓴다', async () => {
    sessionStorage.clear();
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(createServerError);
    const { router, queryClient } = renderCreatePost();
    const received: (string | null)[] = [];

    server.events.on('request:start', function capture({ request }) {
      if (
        request.method === 'POST' &&
        new URL(request.url).pathname === url(API_ENDPOINTS.post.base)
      ) {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));
      }
    });

    await leaveThenRespond(gate, router, queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);
    await waitFor(() => expect(screen.getByLabelText('url')).toHaveValue(SUBMITTED_URL));

    server.use(http.post(url(API_ENDPOINTS.post.base), createSucceeded));
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'submit' }).closest('form') as HTMLFormElement
      );
    });
    await settle(queryClient);
    server.events.removeAllListeners('request:start');

    expect(received).toHaveLength(2);
    expect(received[0]).toBeTruthy();
    expect(received[1]).toBe(received[0]);
  });

  it('등록 화면에 다시 들어와 새로 입력 중이면 [다시 등록하기]가 그 입력을 덮지 않는다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdCreateResponse(createRateLimited);
    const { router, queryClient } = renderCreatePost();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(PENDING_TEXTS.confirm);
    await screen.findByTestId('other-tab');

    await act(async () => {
      await router.navigate(SUBMIT_PATH);
    });
    fireEvent.change(await screen.findByLabelText('url'), {
      target: { value: 'https://example.com/other' },
    });

    await release(gate);
    await settle(queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);

    // 같은 경로 이동은 이탈 가드가 막지 않으므로, 덮으면 새 입력이 확인 없이 사라진다
    expect(screen.getByLabelText('url')).toHaveValue('https://example.com/other');
    expect(screen.getByTestId('submit-error')).toBeEmptyDOMElement();
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
    clickConfirmButton(PENDING_TEXTS.confirm);

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
