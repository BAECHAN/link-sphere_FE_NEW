import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { postKeys } from '@/entities/post/api/post.keys';
import { useRemoveErroredPostListsOnLeave } from '@/entities/post/hooks/useRemoveErroredPostListsOnLeave';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import type { PostListResponse } from '@/entities/post/model/post.schema';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const FAILED_KEY = postKeys.list({ search: 'failed' });
const NEXT_PAGE_FAILED_KEY = postKeys.list({ search: 'next-page-failed' });

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('useRemoveErroredPostListsOnLeave', () => {
  it('떠날 때 첫 쪽부터 실패한 목록을 지운다', async () => {
    await queryClient.prefetchQuery({
      queryKey: FAILED_KEY,
      queryFn: () => Promise.reject(new Error('fail')),
    });
    const { unmount } = renderHook(() => useRemoveErroredPostListsOnLeave(), { wrapper: Wrapper });

    unmount();

    expect(queryClient.getQueryState(FAILED_KEY)).toBeUndefined();
  });

  // 지우면 돌아왔을 때 1쪽부터 다시 받는다 - 남기면 1쪽과 "다시 시도" 행이 그대로 보인다(#494)
  it('1쪽이 있고 다음 쪽만 실패한 목록은 남긴다', async () => {
    const firstPage: InfiniteData<PostListResponse, number> = {
      pages: [mockPostListResponse],
      pageParams: [0],
    };
    queryClient.setQueryData(NEXT_PAGE_FAILED_KEY, firstPage);
    await queryClient
      .fetchQuery({
        queryKey: NEXT_PAGE_FAILED_KEY,
        queryFn: () => Promise.reject(new Error('fail')),
      })
      .catch(() => undefined);
    const { unmount } = renderHook(() => useRemoveErroredPostListsOnLeave(), { wrapper: Wrapper });

    unmount();

    expect(queryClient.getQueryState(NEXT_PAGE_FAILED_KEY)?.status).toBe('error');
    expect(queryClient.getQueryData(NEXT_PAGE_FAILED_KEY)).toEqual(firstPage);
  });
});
