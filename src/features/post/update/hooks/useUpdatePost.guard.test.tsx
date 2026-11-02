import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
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
import { NavigationService } from '@/shared/lib/router/navigation';
import { useAuthStore } from '@/shared/store/auth.store';
import { useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';
import { GlobalAlerts } from '@/shared/ui/elements/dialog/alert/Alert';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { postKeys } from '@/entities/post/api/post.keys';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';

// useUpdatePost.test.tsx는 useGoBack을 mock해 "호출됐다"만 본다. 여기서는 데이터 라우터 + 실제 가드 +
// 실제 확인창으로, 저장 중 떠나려 할 때 goBack(navigate(-1))이 막히거나 엉뚱한 곳으로 가는지 본다
// (useCreatePost.guard.test.tsx와 같은 구성).

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const EDIT_PATH = ROUTES_PATHS.POST.EDIT.replace(':id', mockPost.id);
const EDITED_TITLE = '고친 제목';
// 저장 중에 떠나려 하면 이미 요청했다는 문구로 확인창이 뜬다(usePendingSubmit)
const PENDING_TEXTS = TEXTS.unsavedChanges.pending.postUpdate;

function GuardLayout() {
  useUnsavedChangesGuard();

  return (
    <>
      <Outlet />
      <GlobalAlerts />
    </>
  );
}

function UpdatePostProbe() {
  const { form, onSubmit, submitError, submitButtonRef } = useUpdatePost(mockPost.id);

  return (
    <form onSubmit={onSubmit}>
      <input aria-label="url" {...form.register('url')} />
      <input aria-label="title" {...form.register('title')} />
      <button ref={submitButtonRef} type="submit">
        submit
      </button>
      <p data-testid="submit-error">{submitError?.message}</p>
    </form>
  );
}

function holdUpdateResponse(respond: () => Response) {
  const gate: { release: (() => void) | null } = { release: null };

  server.use(
    http.patch(url(`${API_ENDPOINTS.post.base}/:id`), async () => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });

      return respond();
    })
  );

  return gate;
}

const updateSucceeded = () =>
  HttpResponse.json({
    status: 200,
    message: 'ok',
    data: { ...mockPost, title: EDITED_TITLE },
    timestamp: '',
  });

const updateFailed = () =>
  HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom' },
    { status: 500 }
  );

const updatePostDeleted = () =>
  HttpResponse.json({ status: 404, code: 'POST_NOT_FOUND', message: 'gone' }, { status: 404 });

const updateNotOwner = () =>
  HttpResponse.json({ status: 403, code: 'FORBIDDEN', message: 'nope' }, { status: 403 });

const LEFT_PAGE_FAILURE = TEXTS.messages.error.leftPageFailure;
const LEFT_PAGE_FAILURE_ID = `left-page-failure:post-update:${mockPost.id}`;
const EDITED_URL = 'https://example.com/edited-article';

// 목록에서 수정 화면으로 들어온 상태 - 첫 항목만 key가 'default'라 goBack이 navigate(-1)을 탄다
function renderUpdatePost() {
  const queryClient = createTestQueryClient({ staleTime: Infinity });
  queryClient.setQueryData(postKeys.detail(mockPost.id), mockPost);

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
            path: ROUTES_PATHS.POST.EDIT,
            element: (
              <Suspense fallback={null}>
                <UpdatePostProbe />
              </Suspense>
            ),
          },
          {
            path: ROUTES_PATHS.BOOKMARK,
            element: (
              <Suspense fallback={null}>
                <div data-testid="other-tab" />
              </Suspense>
            ),
          },
        ],
      },
    ],
    { initialEntries: [ROUTES_PATHS.POST.ROOT, EDIT_PATH], initialIndex: 1 }
  );

  RouterEvents.setSource(router);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  );

  return { router, queryClient };
}

async function editAndSubmit(gate: { release: (() => void) | null }) {
  await waitFor(() => expect(screen.getByLabelText('title')).toHaveValue(mockPost.title));

  fireEvent.change(screen.getByLabelText('title'), { target: { value: EDITED_TITLE } });
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));

  await waitFor(() => expect(gate.release).not.toBeNull());
}

type LeaveWay = 'tab' | 'back';

async function tryToLeave(router: ReturnType<typeof createMemoryRouter>, way: LeaveWay) {
  await act(async () => {
    await (way === 'tab' ? router.navigate(ROUTES_PATHS.BOOKMARK) : router.navigate(-1));
  });

  await screen.findByRole('alertdialog', { name: PENDING_TEXTS.title });
}

function clickConfirmButton(name: string) {
  vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
  fireEvent.click(screen.getByRole('button', { name }));
}

async function release(gate: { release: (() => void) | null }) {
  await act(async () => {
    gate.release?.();
  });
}

async function settle(queryClient: QueryClient) {
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
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
  await tryToLeave(router, 'tab');
  clickConfirmButton(PENDING_TEXTS.confirm);
  await screen.findByTestId('other-tab');
  await release(gate);
  await settle(queryClient);
}

describe('useUpdatePost - 저장 중 이탈', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useAlertStore.setState({ alerts: [] });
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
    '저장 중 $label 떠나려다 뜬 확인창이 열린 채 수정이 성공하면 확인창이 닫히고 들어온 화면으로 돌아간다',
    async ({ way }) => {
      const gate = holdUpdateResponse(updateSucceeded);
      const { router } = renderUpdatePost();

      await editAndSubmit(gate);
      await tryToLeave(router, way);

      expect(router.state.location.pathname).toBe(EDIT_PATH);

      await release(gate);

      await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.POST.ROOT));
      expect(await screen.findByTestId('feed')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    }
  );

  it('확인창이 열린 채 수정이 실패하면 확인창이 닫히고 입력과 실패 안내가 남는다', async () => {
    const gate = holdUpdateResponse(updateFailed);
    const { router, queryClient } = renderUpdatePost();

    await editAndSubmit(gate);
    await tryToLeave(router, 'tab');
    await release(gate);
    await settle(queryClient);

    // 응답이 왔으니 "수정은 취소되지 않아요" 확인창의 전제가 사라졌다 - 닫고 막혔던 이동도 취소한다
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(EDIT_PATH);
    expect(screen.getByLabelText('title')).toHaveValue(EDITED_TITLE);
    expect(screen.getByTestId('submit-error')).toHaveTextContent(
      TEXTS.messages.error.postSubmit.updateFailed
    );
  });

  it('응답 전에 "나가기"로 떠났으면 수정이 성공해도 떠난 화면에 머문다', async () => {
    const gate = holdUpdateResponse(updateSucceeded);
    const { router, queryClient } = renderUpdatePost();

    await editAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(PENDING_TEXTS.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    // 고치기 전에는 사라진 폼의 goBack(navigate(-1))이 떠난 화면에서 한 칸 더 뒤로 갔다
    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
  });

  it('응답 전에 "나가기"로 떠난 뒤 실패하면 닫을 때까지 남는 토스트로 알린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdUpdateResponse(updateFailed);
    const { router, queryClient } = renderUpdatePost();

    await editAndSubmit(gate);
    await leaveThenRespond(gate, router, queryClient);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      LEFT_PAGE_FAILURE.postUpdateTitle,
      expect.objectContaining({
        id: LEFT_PAGE_FAILURE_ID,
        duration: Infinity,
      })
    );
    expect(lastToastOptions(errorSpy)?.action).toMatchObject({
      label: TEXTS.buttons.updatePostAgain,
    });
    // 서버 오류는 원인을 특정하지 못한 실패라 제목과 겹치지 않게 할 일만 적는다
    expectDescriptionLines(lastToastOptions(errorSpy), LEFT_PAGE_FAILURE.retryLater);
    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
  });

  it.each([
    {
      cause: '글이 삭제돼',
      respond: updatePostDeleted,
      description: TEXTS.messages.error.postSubmit.postDeleted,
    },
    {
      cause: '남의 글이라',
      respond: updateNotOwner,
      description: TEXTS.messages.error.postSubmit.notOwner,
    },
  ])(
    '$cause 실패했으면 다시 수정해도 소용없어 버튼 없이 안내만 남긴다',
    async ({ respond, description }) => {
      const errorSpy = vi.spyOn(toast, 'error');
      const gate = holdUpdateResponse(respond);
      const { router, queryClient } = renderUpdatePost();

      await editAndSubmit(gate);
      await leaveThenRespond(gate, router, queryClient);

      const options = lastToastOptions(errorSpy);

      expect(errorSpy).toHaveBeenCalledWith(
        LEFT_PAGE_FAILURE.postUpdateTitle,
        expect.objectContaining({ id: LEFT_PAGE_FAILURE_ID, duration: Infinity })
      );
      expect(options).not.toHaveProperty('action');
      expectDescriptionLines(options, description);
    }
  );

  it('[다시 수정하기]를 누르면 바꾼 URL과 제목을 되살리고 버튼 위 안내도 다시 보인다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdUpdateResponse(updateFailed);
    const { router, queryClient } = renderUpdatePost();

    await waitFor(() => expect(screen.getByLabelText('title')).toHaveValue(mockPost.title));
    // URL을 바꾸면 제목이 비워지므로(clearDerivedFieldsOnUrlChange) 제목은 그 뒤에 다시 적는다
    fireEvent.change(screen.getByLabelText('url'), { target: { value: EDITED_URL } });
    await waitFor(() => expect(screen.getByLabelText('title')).toHaveValue(''));
    fireEvent.change(screen.getByLabelText('title'), { target: { value: EDITED_TITLE } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(gate.release).not.toBeNull());

    await leaveThenRespond(gate, router, queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);

    await waitFor(() => expect(screen.getByLabelText('url')).toHaveValue(EDITED_URL));
    expect(router.state.location.pathname).toBe(EDIT_PATH);
    // 되살린 URL이 원래와 달라도 되살린 제목을 다시 비우지 않는다
    expect(screen.getByLabelText('title')).toHaveValue(EDITED_TITLE);
    expect(screen.getByTestId('submit-error')).toHaveTextContent(
      TEXTS.messages.error.postSubmit.updateFailed
    );
    expect(useUnsavedChangesStore.getState().dirtyKeys.has(`post-update:${mockPost.id}`)).toBe(
      true
    );
    // 버튼 위 안내가 화면 밖이면 보이게 제출 버튼까지 내린다(useCreatePost.ts와 같은 이유)
    expect(scrolledElements()).toContain(screen.getByRole('button', { name: 'submit' }));
  });
});
