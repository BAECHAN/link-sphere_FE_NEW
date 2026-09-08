import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/app/routes/ProtectedRoute';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

/** exp(초 단위)를 가진 가짜 JWT를 만든다. auth.util.test.ts의 헬퍼와 동일. */
function makeToken(expSecondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const body = btoa(JSON.stringify({ exp }));
  return `${header}.${body}.sig`;
}

/** /post로 리다이렉트된 뒤 pathname·loginModalOpen state를 확인하기 위한 프로브. */
function PostRootProbe() {
  const location = useLocation();
  const state = location.state as { loginModalOpen?: boolean } | null;
  return (
    <div>
      <div data-testid="post-root">post-root</div>
      <div data-testid="login-modal-open">{String(Boolean(state?.loginModalOpen))}</div>
    </div>
  );
}

function renderProtectedRoute(initialEntries: string[] = ['/bookmark']) {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/bookmark"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">content</div>
              </ProtectedRoute>
            }
          />
          <Route path={ROUTES_PATHS.POST.ROOT} element={<PostRootProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuthResolved(false);
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuthResolved(false);
    useLoginModalStore.getState().setOnSuccess(undefined);
    vi.restoreAllMocks();
  });

  it('복원이 끝나기 전(isAuthResolved=false)엔 children 대신 스피너를 렌더하고 리다이렉트하지 않는다', async () => {
    renderProtectedRoute();

    // SpinnerOverlay는 delay=0이어도 useDelayedLoading이 setTimeout(0)을 거쳐 켜진다.
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-root')).not.toBeInTheDocument();
  });

  it('복원이 끝나고 인증되어 있으면 children을 렌더한다', () => {
    useAuthStore.getState().setAuth(makeToken(3600));
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('복원이 끝났고 비로그인이면 /post로 리다이렉트하며 loginModalOpen을 싣는다', async () => {
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute();

    await waitFor(() => expect(screen.getByTestId('post-root')).toBeInTheDocument());
    expect(screen.getByTestId('login-modal-open')).toHaveTextContent('true');
  });

  it('로그인 상태였다가 로그아웃되면 같은 /post로 보내되 loginModalOpen 없이 조용히 이동한다', async () => {
    useAuthStore.getState().setAuth(makeToken(3600));
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute();
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();

    act(() => {
      useAuthStore.getState().clearAuth();
    });

    await waitFor(() => expect(screen.getByTestId('post-root')).toBeInTheDocument());
    expect(screen.getByTestId('login-modal-open')).toHaveTextContent('false');
  });

  it('비로그인 진입 시 로그인 성공 콜백이 설정되고, 실행하면 원래 경로(쿼리스트링 포함)로 복귀한다', async () => {
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute(['/bookmark?folder=work']);

    await waitFor(() => expect(useLoginModalStore.getState().onSuccess).toBeTypeOf('function'));

    act(() => {
      useAuthStore.getState().setAuth(makeToken(3600));
      useLoginModalStore.getState().onSuccess?.();
    });

    await waitFor(() => expect(screen.getByTestId('protected-content')).toBeInTheDocument());
  });

  it('로그인 상태에서는 로그인 성공 콜백을 설정하지 않는다', async () => {
    useAuthStore.getState().setAuth(makeToken(3600));
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(useLoginModalStore.getState().onSuccess).toBeUndefined();
  });

  it('[알려진 동작] 만료된 accessToken이 있어도 restoreAuth는 refresh를 호출하지 않고 통과시킨다', async () => {
    // 이 케이스는 버그를 고정한다 — 고치는 게 아니라 드러낸다.
    // 컴포넌트 주석(:24)은 "액세스 토큰이 있지만 만료됐으면 즉시 리프레시 시도"라고 말하지만,
    // useAuth.ts의 restoreAuth()는 `if (accessToken && isAuthenticated) return true`로 조기
    // 반환한다. accessToken이 존재하면 auth.store의 setAuth가 isAuthenticated도 항상 함께
    // true로 설정하므로(만료 여부와 무관), 이 가드는 토큰이 하나라도 있으면 항상 true를
    // 반환해 refresh를 호출하지 않는다 - "만료 시 즉시 재검증"이 실제로는 죽은 경로다.
    // 실측: server.use()로 요청 카운터를 심어 REQUEST COUNT: 0을 직접 확인했다.
    let requested = 0;
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), () => {
        requested += 1;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'refreshed-token' }, timestamp: '' },
          { status: 200 }
        );
      })
    );
    const expiredToken = makeToken(-10);
    useAuthStore.getState().setAuth(expiredToken);
    useAuthStore.getState().setAuthResolved(true);

    renderProtectedRoute();

    await waitFor(() => expect(screen.getByTestId('protected-content')).toBeInTheDocument());
    expect(requested).toBe(0);
    // 토큰도 갱신되지 않은 채(만료된 그대로) 남는다.
    expect(useAuthStore.getState().accessToken).toBe(expiredToken);
  });
});
