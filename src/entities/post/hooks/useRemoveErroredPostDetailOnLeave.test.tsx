import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { postKeys } from '@/entities/post/api/post.keys';
import { useRemoveErroredPostDetailOnLeave } from '@/entities/post/hooks/useRemoveErroredPostDetailOnLeave';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

async function failDetail(postId: string) {
  await queryClient.prefetchQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => Promise.reject(new Error('fail')),
  });
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('useRemoveErroredPostDetailOnLeave', () => {
  it('떠날 때 그 글의 실패한 상세를 지운다', async () => {
    await failDetail('failed-post');
    const { unmount } = renderHook(() => useRemoveErroredPostDetailOnLeave('failed-post'), {
      wrapper: Wrapper,
    });

    unmount();

    expect(queryClient.getQueryState(postKeys.detail('failed-post'))).toBeUndefined();
  });

  // 알림 클릭처럼 같은 화면에서 다른 글로 가면 앞 글의 실패만 지운다
  it('다른 글로 가면 앞 글의 실패한 상세를 지운다', async () => {
    await failDetail('failed-post');
    const { rerender } = renderHook(({ postId }) => useRemoveErroredPostDetailOnLeave(postId), {
      wrapper: Wrapper,
      initialProps: { postId: 'failed-post' },
    });

    rerender({ postId: 'next-post' });

    expect(queryClient.getQueryState(postKeys.detail('failed-post'))).toBeUndefined();
  });

  it('성공한 상세는 떠나도 남긴다', () => {
    queryClient.setQueryData(postKeys.detail(mockPost.id), mockPost);
    const { unmount } = renderHook(() => useRemoveErroredPostDetailOnLeave(mockPost.id), {
      wrapper: Wrapper,
    });

    unmount();

    expect(queryClient.getQueryData(postKeys.detail(mockPost.id))).toEqual(mockPost);
  });
});
