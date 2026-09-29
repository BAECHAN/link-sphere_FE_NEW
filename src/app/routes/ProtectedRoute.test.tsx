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
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

/**
 * exp(초 단위)를 가진 가짜 JWT 모양 문자열을 만든다. 이 컴포넌트는 더 이상 토큰
 * 내용을 파싱하지 않으므로(실제 토큰은 불투명 문자열) 임의의 문자열이어도 되지만,
 * 기존 테스트와의 diff를 최소화하기 위해 형태만 유지한다.
 */
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

  it('복원이 끝나기 전(isAuthResolved=false)엔 children도 리다이렉트도 렌더하지 않는다', () => {
    renderProtectedRoute();

    // 이 계약은 지연 값과 무관하게 항상 참이어야 하므로 스피너 등장을 기다리지 않고 동기로 본다.
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-root')).not.toBeInTheDocument();
  });

  it('복원이 끝나기 전 상태가 길어지면 지연 후 전체화면 스피너를 띄운다', () => {
    // SpinnerOverlay는 delay 기본값(LOADING_INDICATOR_DELAY_MS)만큼 기다렸다가 노출된다.
    // 이 테스트는 네트워크를 타지 않으므로(더미 protected-content) fake timers를 켜도 안전하다.
    vi.useFakeTimers();

    renderProtectedRoute();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
    });

    expect(screen.getByRole('status')).toBeInTheDocument();

    vi.useRealTimers();
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

  it('[설계] 만료된 것처럼 보이는 accessToken이 있어도 이 컴포넌트는 사전에 refresh를 호출하지 않는다', async () => {
    // 버그가 아니다 — 만료 토큰의 실제 재검증은 이 컴포넌트가 아니라 client.ts의 401
    // 인터셉터가 실제 API 요청 시점에 담당한다(client.test.ts Case 1이 그 경로를 검증한다).
    // 2026-09-09에 이 동작을 "버그"로 오진했다가 재검증 끝에 정정한 사건이 docs/AUTH.md
    // §10에 있다 — 그 결론(이 컴포넌트는 애초에 사전 검증을 할 필요가 없다)을 그대로
    // 밀어붙여, 2026-09-29에는 "accessToken이 있으면 조기 반환하는 restoreAuth()를
    // 굳이 호출"하던 isVerifying 게이트 자체를 제거했다(BE #42로 토큰이 불투명해지면서
    // 그 게이트가 opaque 토큰마다 무조건 true로 평가돼 진입마다 스피너가 잠깐 깜빡이는
    // 부작용까지 생겼던 것도 계기). 이 테스트는 그 제거 이후에도 이 결론이 유지되는지
    // 지키는 회귀 가드다.
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
    // 이 테스트 범위 안에서는 토큰이 갱신되지 않은 채 남는다 - protected-content가 실제
    // API를 호출하지 않는 더미이기 때문이다. 실제 앱에서는 그 지점에서 client.ts 인터셉터가
    // 갱신을 대신한다(docs/AUTH.md §8-B).
    expect(useAuthStore.getState().accessToken).toBe(expiredToken);
  });
});
