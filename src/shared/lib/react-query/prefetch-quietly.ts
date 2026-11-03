import type {
  DefaultError,
  FetchQueryOptions,
  Query,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

/**
 * 화면이 이 쿼리를 넘겨받지 않은 채 실패로 남았는가. 화면(관찰자)은 렌더 중에 생기며 쿼리 옵션을 meta까지 자기
 * 것으로 바꾸지만 구독은 커밋 뒤라, 그 사이에는 구독자 수만으로는 가릴 수 없다(query-core 5.90.16
 * queryObserver.js:26·94, 구독 48-50). 넘겨받았으면 지금처럼 그 화면이 토스트·에러 화면으로 처리한다.
 */
function isLeftByPrefetchOnly(query: Query): boolean {
  return (
    query.state.status === 'error' &&
    query.state.data === undefined &&
    query.getObserversCount() === 0 &&
    query.meta?.manualErrorHandling === true
  );
}

/**
 * hover처럼 화면이 아직 없을 때 미리 받는다. 실패해도 전역 에러 토스트를 띄우지 않고 실패한 쿼리를 지워, 나중에
 * 화면이 열리면 새로 요청하게 한다 - prefetchQuery는 promise 실패만 삼켜 토스트가 뜨고, 남은 에러 쿼리는
 * suspense 화면이 다시 요청하지 않는다(docs/POST.md "프리페치").
 */
export function prefetchQueryQuietly<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): Promise<void> {
  return queryClient
    .fetchQuery({ ...options, meta: { ...options.meta, manualErrorHandling: true } })
    .then(
      () => undefined,
      () => {
        const queryCache = queryClient.getQueryCache();
        const query = queryCache.find({ queryKey: options.queryKey, exact: true });

        if (query && isLeftByPrefetchOnly(query)) {
          queryCache.remove(query);
        }
      }
    );
}
