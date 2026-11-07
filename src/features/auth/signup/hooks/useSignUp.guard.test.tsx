import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, lazy, type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
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
import { useAlertDialogStore } from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { GlobalAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { SignUpForm } from '@/features/auth/signup/ui/SignUpForm';

// useSignUp.test.tsx는 훅만 렌더해 가드와 확인창이 보이지 않는다. 여기서는 데이터 라우터 + 실제 가드 +
// 실제 확인창 + 응답을 붙잡는 MSW로 "가입 요청 중에 떠나려 할 때"를 재현한다 - 제보된 하단 "로그인"
// 링크를 그대로 누르려고 훅 대신 SignUpForm을 렌더한다(useCreatePost.guard.test.tsx와 같은 틀,
// docs/UNSAVED-CHANGES-GUARD.md §5 "저장 요청 중 이탈").

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const SIGNUP_PATH = ROUTES_PATHS.AUTH.SIGNUP;
const LOGIN_PATH = ROUTES_PATHS.AUTH.LOGIN;
const VALID_PASSWORD = 'Passw0rd!';
// 가입 요청 중에 떠나려 하면 이미 요청했다는 문구로 확인창이 뜬다(usePendingSubmit)
const PENDING_TEXTS = TEXTS.unsavedChanges.pending.signup;

function GuardLayout() {
  useUnsavedChangesGuard();

  return (
    <>
      <Outlet />
      <GlobalAlertDialogs />
    </>
  );
}

/** 응답을 테스트가 원할 때 돌려준다. release는 요청이 핸들러에 닿은 뒤에 채워진다. */
function holdSignupResponse(respond: () => Response) {
  const gate: { release: (() => void) | null } = { release: null };

  server.use(
    http.post(url(API_ENDPOINTS.auth.signup), async () => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });

      return respond();
    })
  );

  return gate;
}

const signupSucceeded = () =>
  HttpResponse.json(
    { status: 201, message: 'ok', data: mockAccount, timestamp: '' },
    { status: 201 }
  );

const signupFailed = () =>
  HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' },
    { status: 500 }
  );

const signupDuplicated = (code: string) => () =>
  HttpResponse.json({ status: 409, code, message: 'Already exists' }, { status: 409 });

const LEFT_PAGE_FAILURE = TEXTS.messages.error.leftPageFailure;

interface RenderOptions {
  /** 로그인 화면 대신 쓸 라우트 요소 - 다음 화면이 suspend하는 구간을 재현할 때 넘긴다 */
  loginElement?: RouteObject['element'];
}

// 운영처럼 화면마다 Suspense로 감싼다(app/routes/AppRoutes.tsx의 withSuspense) - 같은 자리의 Suspense가
// 재사용돼야 "다음 화면이 suspend하는 동안 이전 폼이 남는" 구간이 생긴다.
function renderSignUp({ loginElement }: RenderOptions = {}) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <GuardLayout />,
        children: [
          {
            path: LOGIN_PATH,
            element: loginElement ?? (
              <Suspense fallback={null}>
                <div data-testid="login-page" />
              </Suspense>
            ),
          },
          {
            path: SIGNUP_PATH,
            element: (
              <Suspense fallback={null}>
                <SignUpForm />
              </Suspense>
            ),
          },
        ],
      },
    ],
    // 로그인 화면의 "회원가입" 링크로 들어온 상태 - 뒤로가기하면 로그인 화면이다
    { initialEntries: [LOGIN_PATH, SIGNUP_PATH], initialIndex: 1 }
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
  fireEvent.change(screen.getByPlaceholderText(TEXTS.placeholders.nickname), {
    target: { value: 'newNick' },
  });
  fireEvent.change(screen.getByPlaceholderText(TEXTS.placeholders.email), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(TEXTS.placeholders.password), {
    target: { value: VALID_PASSWORD },
  });
  fireEvent.change(screen.getByPlaceholderText(TEXTS.placeholders.confirmPassword), {
    target: { value: VALID_PASSWORD },
  });

  // 실사용처럼 이메일·닉네임 중복확인(디바운스 뒤 조회)이 끝난 뒤 제출한다
  await screen.findByText(TEXTS.auth.signup.emailAvailable, undefined, { timeout: 3000 });
  await screen.findByText(TEXTS.auth.signup.nicknameAvailable, undefined, { timeout: 3000 });

  fireEvent.click(screen.getByRole('button', { name: TEXTS.auth.signup.signUp }));

  // 요청이 서버(핸들러)에 닿은 뒤에 다음 단계로 간다
  await waitFor(() => expect(gate.release).not.toBeNull());
}

type LeaveWay = 'loginLink' | 'back';

async function tryToLeave(router: ReturnType<typeof createMemoryRouter>, way: LeaveWay) {
  if (way === 'loginLink') {
    fireEvent.click(screen.getByRole('link', { name: TEXTS.auth.signup.signIn }));
  } else {
    await act(async () => {
      await router.navigate(-1);
    });
  }

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

/** 응답 뒤 훅의 이어지는 처리가 끝날 때까지 기다린다 - "아무 일도 없었다"를 단언하기 전에 쓴다. */
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

describe('useSignUp - 가입 요청 중 이탈', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useAlertDialogStore.setState({ dialogs: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set(), pendingSubmits: new Map() });
    // 회원가입은 비로그인 화면이다(GuestGuard)
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    { way: 'loginLink' as const, label: '하단 "로그인" 링크를 눌러' },
    { way: 'back' as const, label: '뒤로가기로' },
  ])(
    '가입 요청 중 $label 떠나려 하면 확인창이 뜨고, 그 사이 가입이 성공하면 확인창이 닫히고 완료 화면이 보인다',
    async ({ way }) => {
      const successSpy = vi.spyOn(toast, 'success');
      const gate = holdSignupResponse(signupSucceeded);
      const { router } = renderSignUp();

      await fillAndSubmit(gate);
      await tryToLeave(router, way);

      expect(router.state.location.pathname).toBe(SIGNUP_PATH);

      await release(gate);

      expect(await screen.findByText(TEXTS.auth.signup.checkEmailTitle)).toBeInTheDocument();
      expect(queryLeaveDialog()).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe(SIGNUP_PATH);
      // 완료 화면이 결과를 보여주므로 토스트를 겹쳐 띄우지 않는다
      expect(successSpy).not.toHaveBeenCalled();
    }
  );

  it('확인창이 열린 채 가입이 실패하면 확인창이 닫히고 입력이 남으며, 다시 떠나려 하면 평소 확인창이 뜬다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdSignupResponse(signupFailed);
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    await release(gate);
    await settle(queryClient);

    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.accountCreateFailed);
    // 응답이 왔으니 "가입은 취소되지 않아요" 확인창의 전제가 사라졌다 - 닫고 막혔던 이동도 취소한다
    expect(queryLeaveDialog()).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(SIGNUP_PATH);
    expect(screen.getByPlaceholderText(TEXTS.placeholders.email)).toHaveValue('new@example.com');

    // 이제 요청 중이 아니라 입력만 남았으니 "그만둘까요?" 확인창이 뜬다
    fireEvent.click(screen.getByRole('link', { name: TEXTS.auth.signup.signIn }));

    expect(
      await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.signup.title })
    ).toBeInTheDocument();
  });

  it('응답 전에 "나가기"로 떠났으면 가입 성공을 토스트로 알리고 떠난 화면에 머문다', async () => {
    const successSpy = vi.spyOn(toast, 'success');
    const gate = holdSignupResponse(signupSucceeded);
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(successSpy).toHaveBeenCalledWith(TEXTS.messages.success.signUpCompleted);
    expect(router.state.location.pathname).toBe(LOGIN_PATH);
  });

  it.each([
    {
      cause: '서버 오류',
      respond: signupFailed,
      description: LEFT_PAGE_FAILURE.retryLater,
      actionLabel: TEXTS.buttons.signUpAgain,
    },
    {
      cause: '닉네임 중복',
      respond: signupDuplicated('DUPLICATE_NICKNAME'),
      description: LEFT_PAGE_FAILURE.signUpDuplicateNickname,
      actionLabel: TEXTS.buttons.signUpAgain,
    },
    {
      cause: '이메일 중복',
      respond: signupDuplicated('DUPLICATE_MEMBER'),
      description: TEXTS.auth.signup.emailDuplicate,
      actionLabel: TEXTS.buttons.login,
    },
  ])(
    '응답 전에 "나가기"로 떠난 뒤 $cause로 실패하면 닫을 때까지 남는 토스트로 알린다',
    async ({ respond, description, actionLabel }) => {
      const successSpy = vi.spyOn(toast, 'success');
      const errorSpy = vi.spyOn(toast, 'error');
      const gate = holdSignupResponse(respond);
      const { router, queryClient } = renderSignUp();

      await fillAndSubmit(gate);
      await tryToLeave(router, 'loginLink');
      clickConfirmButton(PENDING_TEXTS.confirm);

      expect(await screen.findByTestId('login-page')).toBeInTheDocument();

      await release(gate);
      await settle(queryClient);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        LEFT_PAGE_FAILURE.signUpTitle,
        expect.objectContaining({
          id: 'left-page-failure:auth-signup',
          duration: Infinity,
        })
      );
      expect(lastToastOptions(errorSpy)?.action).toMatchObject({ label: actionLabel });
      expectDescriptionLines(lastToastOptions(errorSpy), description);
      expect(successSpy).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe(LOGIN_PATH);
    }
  );

  it('응답 전에 "나가기"로 떠난 뒤 응답을 못 받으면 가입됐는지 모른다고 알린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdSignupResponse(() => HttpResponse.error());
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      LEFT_PAGE_FAILURE.outcomeUnknownTitle,
      expect.objectContaining({ id: 'left-page-failure:auth-signup', duration: Infinity })
    );
    expect(lastToastOptions(errorSpy)?.action).toMatchObject({
      label: TEXTS.buttons.signUpAgain,
    });
    expectDescriptionLines(
      lastToastOptions(errorSpy),
      TEXTS.messages.error.accountCreateOutcomeUnknown
    );
  });

  it('떠난 뒤 실패 토스트의 [다시 가입하기]를 누르면 닉네임·이메일만 되살리고, 되살린 입력도 떠날 때 확인창이 뜬다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdSignupResponse(signupFailed);
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);
    await screen.findByTestId('login-page');
    await release(gate);
    await settle(queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);

    await waitFor(() =>
      expect(screen.getByPlaceholderText(TEXTS.placeholders.email)).toHaveValue('new@example.com')
    );
    expect(router.state.location.pathname).toBe(SIGNUP_PATH);
    expect(screen.getByPlaceholderText(TEXTS.placeholders.nickname)).toHaveValue('newNick');
    expect(screen.getByPlaceholderText(TEXTS.placeholders.password)).toHaveValue('');
    expect(screen.getByPlaceholderText(TEXTS.placeholders.confirmPassword)).toHaveValue('');
    // 넘긴 값은 브라우저 방문 기록(history.state)에 남는다 - 비밀번호는 싣지 않는다
    expect(JSON.stringify(router.state.location.state)).not.toContain(VALID_PASSWORD);

    fireEvent.click(screen.getByRole('link', { name: TEXTS.auth.signup.signIn }));

    expect(
      await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.signup.title })
    ).toBeInTheDocument();
  });

  it('이메일 중복이면 토스트의 [로그인]이 그 이메일을 채운 로그인 화면으로 보낸다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdSignupResponse(signupDuplicated('DUPLICATE_MEMBER'));
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);
    await screen.findByTestId('login-page');
    await release(gate);
    await settle(queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);

    // useLogin이 location.state.email을 저장된 이메일보다 먼저 채운다
    expect(router.state.location.pathname).toBe(LOGIN_PATH);
    expect(router.state.location.state).toEqual({ email: 'new@example.com' });
  });

  it('가입 화면에 다시 들어와 새로 입력 중이면 [다시 가입하기]가 그 입력을 덮지 않는다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const gate = holdSignupResponse(signupFailed);
    const { router, queryClient } = renderSignUp();

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);
    await screen.findByTestId('login-page');

    await act(async () => {
      await router.navigate(SIGNUP_PATH);
    });
    fireEvent.change(await screen.findByPlaceholderText(TEXTS.placeholders.nickname), {
      target: { value: 'otherNick' },
    });

    await release(gate);
    await settle(queryClient);
    await clickToastAction(lastToastOptions(errorSpy), router);

    // 같은 경로 이동은 이탈 가드가 막지 않으므로, 덮으면 새 입력이 확인 없이 사라진다
    expect(screen.getByPlaceholderText(TEXTS.placeholders.nickname)).toHaveValue('otherNick');
    expect(screen.getByPlaceholderText(TEXTS.placeholders.email)).toHaveValue('');
  });

  it('떠나려 하지 않았으면 가입 성공 뒤 확인창·토스트 없이 완료 화면이 보인다', async () => {
    const successSpy = vi.spyOn(toast, 'success');
    const gate = holdSignupResponse(signupSucceeded);
    renderSignUp();

    await fillAndSubmit(gate);
    await release(gate);

    expect(await screen.findByText(TEXTS.auth.signup.checkEmailTitle)).toBeInTheDocument();
    expect(queryLeaveDialog()).not.toBeInTheDocument();
    expect(successSpy).not.toHaveBeenCalled();
  });

  it('"나가기" 뒤 다음 화면을 불러오는 동안 가입이 성공해도 완료 화면으로 덮지 않고 토스트로 알린다', async () => {
    // 처음 가는 로그인 화면의 청크를 받는 동안을 붙잡아 둔다
    let loadLogin!: () => void;
    const loginChunk = new Promise<{ default: () => JSX.Element }>((resolve) => {
      loadLogin = () => resolve({ default: () => <div data-testid="login-page" /> });
    });
    const LazyLogin = lazy(() => loginChunk);
    const successSpy = vi.spyOn(toast, 'success');
    const gate = holdSignupResponse(signupSucceeded);
    const { router, queryClient } = renderSignUp({
      loginElement: (
        <Suspense fallback={null}>
          <LazyLogin />
        </Suspense>
      ),
    });

    await fillAndSubmit(gate);
    await tryToLeave(router, 'loginLink');
    clickConfirmButton(PENDING_TEXTS.confirm);

    // 라우터는 이미 로그인 화면에 가 있지만 화면은 아직 가입 폼이다(정지 구간)
    await waitFor(() => expect(router.state.location.pathname).toBe(LOGIN_PATH));
    expect(screen.getByPlaceholderText(TEXTS.placeholders.email)).toBeInTheDocument();

    await release(gate);
    await settle(queryClient);

    expect(successSpy).toHaveBeenCalledWith(TEXTS.messages.success.signUpCompleted);
    expect(screen.queryByText(TEXTS.auth.signup.checkEmailTitle)).not.toBeInTheDocument();

    await act(async () => {
      loadLogin();
      await loginChunk;
    });

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});
