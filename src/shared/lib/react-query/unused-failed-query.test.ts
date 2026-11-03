import { describe, it, expect, beforeEach } from 'vitest';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { isUnusedFailedQuery } from '@/shared/lib/react-query/unused-failed-query';

const KEY = ['unused-failed-query-test'];

let queryClient: QueryClient;

/** queryFn이 실패해 데이터 없이 error 상태로 남긴다(prefetchQuery는 실패를 삼킨다) */
async function failWithoutData() {
  await queryClient.prefetchQuery({
    queryKey: KEY,
    queryFn: () => Promise.reject(new Error('fail')),
  });
}

function findQuery() {
  const query = queryClient.getQueryCache().find({ queryKey: KEY, exact: true });

  if (!query) {
    throw new Error('query not found');
  }

  return query;
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('isUnusedFailedQuery', () => {
  it('데이터 없이 실패했고 아무도 보고 있지 않으면 true', async () => {
    await failWithoutData();

    expect(isUnusedFailedQuery(findQuery())).toBe(true);
  });

  // 다음 쪽만 실패한 목록처럼 보여 줄 데이터가 있으면 지우지 않는다 - 지우면 돌아왔을 때 처음부터 다시 받는다
  it('데이터가 남아 있으면 실패했어도 false', async () => {
    queryClient.setQueryData(KEY, 'cached');
    await queryClient
      .fetchQuery({ queryKey: KEY, queryFn: () => Promise.reject(new Error('fail')) })
      .catch(() => undefined);

    expect(findQuery().state.status).toBe('error');
    expect(isUnusedFailedQuery(findQuery())).toBe(false);
  });

  it('보고 있는 화면(관찰자)이 있으면 false', async () => {
    await failWithoutData();
    const observer = new QueryObserver(queryClient, {
      queryKey: KEY,
      queryFn: () => Promise.reject(new Error('fail')),
      enabled: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    expect(isUnusedFailedQuery(findQuery())).toBe(false);

    unsubscribe();
  });

  it('성공한 쿼리는 false', async () => {
    await queryClient.prefetchQuery({ queryKey: KEY, queryFn: () => Promise.resolve('ok') });

    expect(isUnusedFailedQuery(findQuery())).toBe(false);
  });
});
