import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { commentRemoveQueries } from '@/entities/comment/api/comment.keys';

/**
 * 내 댓글 화면을 떠날 때 데이터 없이 실패한 목록을 지운다. 남기면 gc(5분) 전에 다시 들어왔을 때 요청 없이 같은 에러가
 * 뜬다(commentRemoveQueries.erroredMy).
 */
export function useRemoveErroredMyCommentsOnLeave() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      commentRemoveQueries.erroredMy(queryClient);
    };
  }, [queryClient]);
}
