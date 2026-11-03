import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { postRemoveQueries } from '@/entities/post/api/post.keys';

/**
 * 목록 화면을 떠날 때 데이터 없이 실패한 목록을 지운다. 남기면 gc(5분) 전에 같은 조건으로 돌아왔을 때 요청 없이 같은
 * 에러가 뜬다(postRemoveQueries.erroredLists). 1쪽이 있는 목록은 남는다.
 */
export function useRemoveErroredPostListsOnLeave() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      postRemoveQueries.erroredLists(queryClient);
    };
  }, [queryClient]);
}
