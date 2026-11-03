import type { Query } from '@tanstack/react-query';

/**
 * 데이터 없이 실패한 채 아무 화면도 보고 있지 않은 쿼리인가. suspense 화면은 에러 경계가 리셋되기 전에는 이런 쿼리를
 * 마운트할 때 다시 요청하지 않고 그 에러를 그대로 던진다(react-query 5.90.16 errorBoundaryUtils.js:8-11의
 * retryOnMount=false, query-core queryObserver.js:442-443). 그래서 화면을 떠날 때 지워 다음에 들어오면 새로
 * 요청하게 한다. 데이터가 있는 쿼리(다음 쪽만 실패한 목록)는 남긴다 - 지우면 돌아왔을 때 처음부터 다시 받는다.
 */
export function isUnusedFailedQuery(query: Query): boolean {
  return (
    query.state.status === 'error' &&
    query.state.data === undefined &&
    query.getObserversCount() === 0
  );
}
