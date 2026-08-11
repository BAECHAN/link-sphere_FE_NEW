import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useSignUp } from '@/features/auth/signup/hooks/useSignUp';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// MSW 기본 핸들러(mocks/handlers/auth.handlers.ts)는 닉네임 'taken', 이메일
// 'taken@example.com'만 중복으로 취급한다.
describe('useSignUp', () => {
  it('사용 가능한 닉네임이면 디바운스 후 nicknameCheck.isAvailable이 true가 된다', async () => {
    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('nickname', 'newNick', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.nicknameCheck.isAvailable).toBe(true), {
      timeout: 2000,
    });
    expect(result.current.form.formState.errors.nickname).toBeFalsy();
  });

  it('사용 중인 닉네임이면 디바운스 후 인라인 오류를 띄우고 제출을 막는다', async () => {
    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('nickname', 'taken', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.nicknameCheck.isDuplicate).toBe(true), {
      timeout: 2000,
    });
    expect(result.current.form.formState.errors.nickname).toBeTruthy();
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it('사용 가능한 이메일이면 디바운스 후 emailCheck.isAvailable이 true가 된다', async () => {
    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'new@example.com', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.emailCheck.isAvailable).toBe(true), {
      timeout: 2000,
    });
    expect(result.current.form.formState.errors.email).toBeFalsy();
  });

  it('이미 가입된 이메일이면 디바운스 후 인라인 오류를 띄우고 제출을 막는다', async () => {
    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'taken@example.com', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.emailCheck.isDuplicate).toBe(true), {
      timeout: 2000,
    });
    expect(result.current.form.formState.errors.email).toBeTruthy();
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it('닉네임 형식이 잘못되면(zod 검증) 가용성 조회 없이 idle로 남는다', async () => {
    const checkCalled = vi.fn();
    server.use(
      http.get(url(API_ENDPOINTS.auth.nicknameAvailability), ({ request }) => {
        checkCalled(new URL(request.url).searchParams.get('nickname'));
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { available: true }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    // 2자 미만 - 형식(zod) 검증 자체를 통과 못한다
    act(() => {
      result.current.form.setValue('nickname', 'a', { shouldDirty: true });
    });

    // 디바운스가 정착할 시간을 넉넉히 기다려도 서버에 물어보지 않았어야 한다
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(checkCalled).not.toHaveBeenCalled();
    expect(result.current.nicknameCheck.status).toBe('idle');
  });

  it('가용성 조회 자체가 실패하면(네트워크 오류 등) 제출은 막지 않되 확인됐다고 속이지도 않는다', async () => {
    server.use(http.get(url(API_ENDPOINTS.auth.emailAvailability), () => HttpResponse.error()));

    const { result } = renderHook(() => useSignUp(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'new@example.com', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.emailCheck.isChecking).toBe(false), {
      timeout: 2000,
    });

    // "사용 가능"으로 확정된 것처럼 보이면 안 된다 - 그냥 idle이어야 한다
    expect(result.current.emailCheck.isAvailable).toBe(false);
    expect(result.current.emailCheck.isDuplicate).toBe(false);
    // 그러면서도 제출 자체는 막지 않는다 (에러도 없음 = 버튼이 비활성화되지 않음)
    expect(result.current.form.formState.errors.email).toBeFalsy();
    expect(result.current.isSubmitDisabled).toBe(false);
  });
});
