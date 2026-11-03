import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { useRemoveErroredCommentsOnLeave } from '@/entities/comment/hooks/useRemoveErroredCommentsOnLeave';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('useRemoveErroredCommentsOnLeave', () => {
  it('떠날 때 그 글의 실패한 댓글 목록을 지운다', async () => {
    await queryClient.prefetchQuery({
      queryKey: commentKeys.list('failed-post'),
      queryFn: () => Promise.reject(new Error('fail')),
    });
    const { unmount } = renderHook(() => useRemoveErroredCommentsOnLeave('failed-post'), {
      wrapper: Wrapper,
    });

    unmount();

    expect(queryClient.getQueryState(commentKeys.list('failed-post'))).toBeUndefined();
  });

  it('성공한 댓글 목록은 떠나도 남긴다', () => {
    queryClient.setQueryData(commentKeys.list('loaded-post'), [mockComment]);
    const { unmount } = renderHook(() => useRemoveErroredCommentsOnLeave('loaded-post'), {
      wrapper: Wrapper,
    });

    unmount();

    expect(queryClient.getQueryData(commentKeys.list('loaded-post'))).toEqual([mockComment]);
  });
});
