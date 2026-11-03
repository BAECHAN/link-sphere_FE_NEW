import { describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import { createQueryClientWithErrorToasts } from '@/test/utils';
import { ApiError } from '@/shared/types/common.type';
import {
  prefetchInfiniteQueryQuietly,
  prefetchQueryQuietly,
} from '@/shared/lib/react-query/prefetch-quietly';

const KEY = ['prefetch-quietly'];

// 화면이 없는 채 실패하면 지우는 기본 동작과 화면이 넘겨받은 경우는 엔티티 테스트(post·comment.queries.test.ts)가
// 실제 상세 화면 훅으로 확인한다. 여기서는 지우지 않아야 하는 나머지 갈래를 본다.
describe('prefetchQueryQuietly', () => {
  it('이미 데이터가 있던 쿼리는 다시 받다 실패해도 지우지 않고 데이터를 둔다', async () => {
    const { queryClient, errorToasts } = createQueryClientWithErrorToasts();
    queryClient.setQueryData(KEY, 'cached');

    await prefetchQueryQuietly(queryClient, {
      queryKey: KEY,
      queryFn: () => Promise.reject(new Error('fail')),
      retry: false,
    });

    expect(queryClient.getQueryData(KEY)).toBe('cached');
    expect(errorToasts).toEqual([]);
  });

  it('진행 중에 같은 키로 다시 불러도 한 번만 요청하고, 실패하면 지운다', async () => {
    const { queryClient } = createQueryClientWithErrorToasts();
    const queryFn = vi.fn(() => Promise.reject(new Error('fail')));

    await Promise.all([
      prefetchQueryQuietly(queryClient, { queryKey: KEY, queryFn, retry: false }),
      prefetchQueryQuietly(queryClient, { queryKey: KEY, queryFn, retry: false }),
    ]);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(KEY)).toBeUndefined();
  });

  it('구독 중인 화면이 있으면 실패해도 지우지 않는다', async () => {
    const { queryClient } = createQueryClientWithErrorToasts();
    const queryFn = () => Promise.reject(new Error('fail'));
    const observer = new QueryObserver(queryClient, { queryKey: KEY, queryFn, enabled: false });
    const unsubscribe = observer.subscribe(() => {});

    await prefetchQueryQuietly(queryClient, { queryKey: KEY, queryFn, retry: false });

    expect(queryClient.getQueryState(KEY)?.status).toBe('error');
    unsubscribe();
  });
});

// 실패 갈래는 prefetchQueryQuietly와 같아 엔티티 테스트(bookmark-folder.queries.test.ts)가 폴더 글 hover로 본다
describe('prefetchInfiniteQueryQuietly', () => {
  it('성공하면 무한 쿼리 모양(pages·pageParams)으로 첫 쪽을 채운다', async () => {
    const { queryClient, errorToasts } = createQueryClientWithErrorToasts();

    await prefetchInfiniteQueryQuietly(queryClient, {
      queryKey: KEY,
      queryFn: ({ pageParam }) => Promise.resolve(`page-${pageParam}`),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(queryClient.getQueryData(KEY)).toEqual({ pages: ['page-0'], pageParams: [0] });
    expect(errorToasts).toEqual([]);
  });

  it('실패하면 에러 토스트를 띄우지 않고, 실패한 쿼리를 지운다', async () => {
    const { queryClient, errorToasts } = createQueryClientWithErrorToasts();

    await prefetchInfiniteQueryQuietly(queryClient, {
      queryKey: KEY,
      queryFn: () =>
        Promise.reject(
          new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'fail', timestamp: '' })
        ),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      retry: false,
    });

    expect(queryClient.getQueryState(KEY)).toBeUndefined();
    expect(errorToasts).toEqual([]);
  });
});
