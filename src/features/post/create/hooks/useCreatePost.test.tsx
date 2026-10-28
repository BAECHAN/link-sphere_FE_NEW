import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useCreatePost } from '@/features/post/create/hooks/useCreatePost';
import { useAuthStore } from '@/shared/store/auth.store';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { NavigationService } from '@/shared/lib/router/navigation';
import { SIGNED_OUT_IN_PLACE_DIALOG_STATE } from '@/shared/store/loginDialog.store';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const SUBMITTED_URL = 'https://example.com/article';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

async function fillAndSubmit(result: { current: ReturnType<typeof useCreatePost> }) {
  act(() => {
    result.current.form.setValue('url', SUBMITTED_URL, { shouldDirty: true, shouldValidate: true });
  });

  await act(async () => {
    await result.current.onSubmit();
  });
}

describe('useCreatePost', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    // 제출은 로그인 상태에서만 보낸다(useAuthGuard) - 셋업이 테스트마다 로그인 상태를 지운다
    useAuthStore.getState().setAuth('test-access-token');
  });

  it('등록이 성공한 뒤에만 폼을 비우고 목록으로 이동한다', async () => {
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
    expect(result.current.form.getValues('url')).toBe('');
  });

  it('등록이 실패하면 이동하지 않고 입력한 값을 그대로 남긴다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json(
          { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
          { status: 429 }
        )
      )
    );
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('url')).toBe(SUBMITTED_URL);
    // 입력칸과 무관한 실패라 버튼 위 안내로 남는다
    expect(result.current.submitError?.message).toBe(TEXTS.messages.error.postSubmit.rateLimited);
  });

  it('도메인을 찾을 수 없으면 URL 칸에 서버 에러를 붙이고 버튼 위 안내는 띄우지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json(
          { status: 400, code: 'URL_UNRESOLVABLE', message: 'Cannot resolve host' },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(result.current.form.getFieldState('url').error?.message).toBe(
      TEXTS.messages.error.postSubmit.urlUnresolvable
    );
    expect(result.current.submitError).toBeNull();
  });

  it('로그인이 풀린 채 그 화면에 머물다 누르면 보내지 않고 그 이유의 로그인 창을 연다', async () => {
    // 로그인 창을 닫고 그대로 누른 경우 - 댓글·답글 등록과 같은 창이 다시 뜨고, 입력은 그대로 남는다
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    let requestCount = 0;
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () => {
        requestCount += 1;
        return HttpResponse.json({ status: 200, message: 'ok', data: null });
      })
    );
    useAuthStore.getState().expireSession(ROUTES_PATHS.POST.SUBMIT);
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(requestCount).toBe(0);
    expect(dialogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: SIGNED_OUT_IN_PLACE_DIALOG_STATE.expired })
    );
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('url')).toBe(SUBMITTED_URL);
    // 로그아웃된 동안에는 저장을 눌렀든 안 눌렀든 폼 안에 같은 안내가 보인다(useSignedOutNotice)
    expect(result.current.submitError?.message).toBe(TEXTS.messages.error.signedOutBeforeSave);

    dialogSpy.mockRestore();
  });

  it('등록하는 사이 로그인이 만료되면 입력을 남기고 저장하지 못했다는 안내를 띄운다', async () => {
    // 만료 정리(AuthUtil.applySessionExpired)가 여는 로그인 창의 이동은 여기서 막는다
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json(
          { status: 401, code: SERVER_ERROR_CODE.TOKEN_EXPIRED, message: '' },
          { status: 401 }
        )
      ),
      http.post(url(API_ENDPOINTS.auth.refresh), () =>
        HttpResponse.json(
          { status: 401, code: 'INVALID_REFRESH_TOKEN', message: '' },
          { status: 401 }
        )
      )
    );
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('url')).toBe(SUBMITTED_URL);
    expect(result.current.submitError?.message).toBe(TEXTS.messages.error.signedOutBeforeSave);

    // 다시 로그인하면 안내가 사라진다 - 남으면 로그인한 뒤에도 아직 풀린 것처럼 읽힌다
    act(() => useAuthStore.getState().setAuth('test-access-token'));

    expect(result.current.submitError).toBeNull();
    expect(result.current.form.getValues('url')).toBe(SUBMITTED_URL);

    dialogSpy.mockRestore();
  });
});
