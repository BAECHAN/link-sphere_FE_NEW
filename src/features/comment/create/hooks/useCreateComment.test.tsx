import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { useAuthStore } from '@/shared/store/auth.store';
import { authKeys } from '@/entities/user/api/auth.queries';
import { mockAccount } from '@/mocks/fixtures/auth.fixtures';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/const';
import { toast } from '@/shared/lib/toast/toast';

// 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경 요청 경로와
// 매칭되지 않는다(CommentQueries.test.tsx와 동일한 이유) - url()로 명시 등록.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const POST_ID = 'post-uuid-1';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// useCreateComment는 guard() 안에서 useAccount()가 채워질 때까지 제출을 아무 일도 하지 않고
// 삼킨다 - 로그인 상태를 만든 뒤 계정 조회가 끝나기를 기다려야 제출 로직을 실제로 검증할 수 있다.
async function renderLoggedIn(queryClient: QueryClient, options: { onSuccess?: () => void } = {}) {
  useAuthStore.getState().setAuth('test-access-token');
  const { result } = renderHook(() => useCreateComment({ postId: POST_ID, ...options }), {
    wrapper: createWrapper(queryClient),
  });
  await waitFor(() => expect(queryClient.getQueryData(authKeys.account())).toEqual(mockAccount));
  return result;
}

describe('useCreateComment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('제출하면 서버 응답을 기다리지 않고 폼과 이미지가 즉시 비워진다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await new Promise(() => {}); // 응답 없이 pending 유지 - "즉시" 비워지는지만 확인한다.
      })
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '작성 중인 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.form.getValues('content')).toBe('');
    expect(result.current.images).toEqual([]);
  });

  it('등록이 실패하면 입력했던 내용이 폼에 복원된다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(result.current.form.getValues('content')).toBe('실패할 댓글'));
  });

  it('복원되기 전에 사용자가 새로 입력을 시작했다면 덮어쓰지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    // onSubmit이 반환하는 시점엔 아직 네트워크 응답 전이라 폼이 비어 있다 - 그 틈에 새로 입력한다.
    act(() => {
      result.current.form.setValue('content', '새로 쓰기 시작', { shouldDirty: true });
    });

    // 실패 응답의 onError가 실제로 처리될 시간을 준 뒤에도 덮어써지지 않았는지 확인한다.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(result.current.form.getValues('content')).toBe('새로 쓰기 시작');
  });

  it('본문이 상한을 넘으면 제출되지 않고 안내 토스트가 뜬다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    const { result } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    const overLong = '가'.repeat(Math.ceil(MAX_COMMENT_CONTENT_BYTES / 3) + 1);

    act(() => {
      result.current.form.setValue('content', overLong, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
