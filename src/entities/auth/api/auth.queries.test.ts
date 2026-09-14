import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { useCreateAccountMutation, useLoginMutation } from '@/entities/auth/api/auth.queries';
import { TEXTS } from '@/shared/config/texts';
import { ApiError } from '@/shared/types/common.type';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { postKeys } from '@/entities/post/api/post.keys';

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

describe('useLoginMutation', () => {
  // setQueryData/fetchQuery로 캐시 상태를 직접 심고 나중에 getQueryState로 검증하므로
  // gcTime: Infinity가 필요하다 - 기본값 0이면 옵저버 없는 쿼리가 다음 틱에 GC돼
  // 수정 전에도 통과하는 가짜 테스트가 된다(createTestQueryClient 참고).
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient({ gcTime: Infinity });
  });

  function LoginWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  // 로그아웃 시 clearQueries()의 resetQueries()가 토큰 없이 배경 재요청해 만드는 상태를
  // 그대로 재현한다. MSW로 실제 401을 태우면 ApiClient가 AuthUtil.clearAll()로 싱글턴
  // queryClient·NavigationService까지 건드려 테스트 격리가 깨지므로(client.ts의
  // NOT_LOGGED_IN 분기), fetchQuery로 상태만 직접 심는다.
  async function seedErrorQuery(queryKey: readonly unknown[]) {
    await queryClient
      .fetchQuery({
        queryKey,
        queryFn: () =>
          Promise.reject(
            new ApiError({
              status: 401,
              code: 'NOT_LOGGED_IN',
              message: 'Authentication required',
              timestamp: new Date().toISOString(),
            })
          ),
      })
      .catch(() => {});
  }

  it('로그아웃이 남긴 에러 상태 캐시(데이터 없음)를 로그인 성공 시 초기화한다', async () => {
    await seedErrorQuery(commentKeys.myRoot);

    // 사전 조건: 비활성(옵저버 없음) + error 상태로 고정해둔다.
    expect(queryClient.getQueryState(commentKeys.myRoot)?.status).toBe('error');
    expect(
      queryClient.getQueryCache().find({ queryKey: commentKeys.myRoot })?.getObserversCount()
    ).toBe(0);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const state = queryClient.getQueryState(commentKeys.myRoot);
    expect(state?.status).toBe('pending');
    expect(state?.error).toBeNull();
    expect(state?.data).toBeUndefined();
  });

  it('정상 데이터가 있는 쿼리는 로그인 후에도 캐시를 그대로 둔다', async () => {
    const seeded = [{ id: 'post-1' }];
    queryClient.setQueryData(postKeys.list(), seeded);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);
    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('success');
  });

  it('데이터를 들고 있는데 재요청만 실패한 쿼리는 건드리지 않는다 (제자리 로그인 깜빡임 방지)', async () => {
    const seeded = [{ id: 'post-1' }];
    queryClient.setQueryData(postKeys.list(), seeded);
    // 이미 데이터가 있는 쿼리의 배경 재요청만 실패한 상태를 재현한다 - data는 유지된 채
    // status만 error가 된다.
    await queryClient
      .fetchQuery({
        queryKey: postKeys.list(),
        queryFn: () => Promise.reject(new Error('background refetch failed')),
      })
      .catch(() => {});

    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('error');
    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // predicate가 data === undefined도 요구하므로, 데이터를 들고 있는 이 쿼리는 리셋되지 않는다.
    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);
  });
});

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
