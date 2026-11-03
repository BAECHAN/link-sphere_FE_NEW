import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { useRemoveErroredMyCommentsOnLeave } from '@/entities/comment/hooks/useRemoveErroredMyCommentsOnLeave';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('useRemoveErroredMyCommentsOnLeave', () => {
  it('떠날 때 실패한 내 댓글 목록을 지운다', async () => {
    await queryClient.prefetchQuery({
      queryKey: commentKeys.myRoot,
      queryFn: () => Promise.reject(new Error('fail')),
    });
    const { unmount } = renderHook(() => useRemoveErroredMyCommentsOnLeave(), { wrapper: Wrapper });

    unmount();

    expect(queryClient.getQueryState(commentKeys.myRoot)).toBeUndefined();
  });

  // 같은 'comments' 루트 아래의 글별 댓글 목록은 건드리지 않는다
  it('글별 댓글 목록의 실패는 지우지 않는다', async () => {
    await queryClient.prefetchQuery({
      queryKey: commentKeys.list('failed-post'),
      queryFn: () => Promise.reject(new Error('fail')),
    });
    const { unmount } = renderHook(() => useRemoveErroredMyCommentsOnLeave(), { wrapper: Wrapper });

    unmount();

    expect(queryClient.getQueryState(commentKeys.list('failed-post'))?.status).toBe('error');
  });
});
