import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
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
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';

// useUpdatePost.test.tsx는 useGoBack을 mock해 "호출됐다"만 본다. 여기서는 데이터 라우터 + 실제 가드 +
// 실제 확인창으로, 저장 중 떠나려 할 때 goBack(navigate(-1))이 막히거나 엉뚱한 곳으로 가는지 본다
// (useCreatePost.guard.test.tsx와 같은 구성).

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const EDIT_PATH = ROUTES_PATHS.POST.EDIT.replace(':id', mockPost.id);
const EDITED_TITLE = '고친 제목';

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
  const { form, onSubmit } = useUpdatePost(mockPost.id);

  return (
    <form onSubmit={onSubmit}>
      <input aria-label="title" {...form.register('title')} />
      <button type="submit">submit</button>
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

  await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.title });
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

describe('useUpdatePost - 저장 중 이탈', () => {
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
      expect(
        screen.queryByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
      ).not.toBeInTheDocument();
    }
  );

  it('응답 전에 "나가기"로 떠났으면 수정이 성공해도 떠난 화면에 머문다', async () => {
    const gate = holdUpdateResponse(updateSucceeded);
    const { router, queryClient } = renderUpdatePost();

    await editAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    // 고치기 전에는 사라진 폼의 goBack(navigate(-1))이 떠난 화면에서 한 칸 더 뒤로 갔다
    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
  });

  it('응답 전에 "나가기"로 떠났으면 수정 실패를 토스트로 알린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdUpdateResponse(updateFailed);
    const { router, queryClient } = renderUpdatePost();

    await editAndSubmit(gate);
    await tryToLeave(router, 'tab');
    clickConfirmButton(TEXTS.unsavedChanges.confirm);

    expect(await screen.findByTestId('other-tab')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.postSubmit.updateFailed);
    expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK);
  });
});
