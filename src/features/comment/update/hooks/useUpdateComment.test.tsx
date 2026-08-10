import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdateComment } from '@/features/comment/update/hooks/useUpdateComment';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

// 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경 요청 경로와
// 매칭되지 않는다(CommentQueries.test.tsx와 동일한 이유) - url()로 명시 등록.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useUpdateComment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('편집을 시작하면 원본 댓글 내용으로 초기화된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.form.getValues('content')).toBe(mockComment.content);
    expect(result.current.canSubmit).toBe(true);
  });

  it('본문과 이미지가 모두 없으면 canSubmit이 false가 된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.form.setValue('content', '', { shouldDirty: true });
    });

    expect(result.current.canSubmit).toBe(false);
  });

  it('제출에 성공하면 onSuccess가 호출된다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () =>
        HttpResponse.json(
          { status: 200, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
          { status: 200 }
        )
      )
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId, onSuccess }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', '수정된 내용', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
