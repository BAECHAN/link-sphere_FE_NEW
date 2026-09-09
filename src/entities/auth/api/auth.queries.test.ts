import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { useCreateAccountMutation } from '@/entities/auth/api/auth.queries';
import { TEXTS } from '@/shared/config/texts';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const mockToastError = vi.fn();
vi.mock('@/shared/lib/toast/toast', () => ({
  toast: {
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
    success: vi.fn(),
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: createTestQueryClient() },
    createElement(MemoryRouter, null, children)
  );
}

describe('useCreateAccountMutation', () => {
  beforeEach(() => {
    mockToastError.mockClear();
  });

  it('네트워크 오류 등 일반 에러도 무반응 대신 일반 실패 메시지 토스트를 띄운다', async () => {
    // MSW의 네트워크 레벨 에러 - fetch가 TypeError를 던지는 실제 오프라인 상황과 동일하게 재현.
    // manualErrorHandling: true라 전역 핸들러가 개입하지 않으므로, 이 mutation 자체의 onError가
    // ApiError가 아닌 에러도 처리하지 못하면 토스트 없이 조용히 실패한다.
    server.use(http.post(url(API_ENDPOINTS.auth.signup), () => HttpResponse.error()));

    const { result } = renderHook(() => useCreateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        nickname: 'newNick',
        email: 'new@example.com',
        password: 'password1!',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(TEXTS.messages.error.accountCreateFailed);
  });

  it('닉네임 중복(DUPLICATE_NICKNAME)이면 이메일이 아닌 닉네임 전용 메시지를 보여준다', async () => {
    // 실제 BE ErrorResponse는 status/code/message/timestamp를 모두 담아 응답한다 - status가
    // 바디에 없으면 ApiError.status가 undefined가 되어 error.status === 409 분기가 무력화된다.
    server.use(
      http.post(url(API_ENDPOINTS.auth.signup), () =>
        HttpResponse.json(
          { status: 409, code: 'DUPLICATE_NICKNAME', message: 'Nickname already exists: newNick' },
          { status: 409 }
        )
      )
    );

    const { result } = renderHook(() => useCreateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        nickname: 'newNick',
        email: 'new@example.com',
        password: 'password1!',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(TEXTS.messages.error.nicknameDuplicate);
  });

  it('이메일 중복(DUPLICATE_MEMBER)이면 이메일 전용 메시지를 보여준다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.auth.signup), () =>
        HttpResponse.json(
          { status: 409, code: 'DUPLICATE_MEMBER', message: 'Email already exists' },
          { status: 409 }
        )
      )
    );

    const { result } = renderHook(() => useCreateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        nickname: 'newNick',
        email: 'taken@example.com',
        password: 'password1!',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(
      TEXTS.messages.error.accountCreateFailedDuplicateAccount
    );
  });
});
