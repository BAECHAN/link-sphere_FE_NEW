import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { commentRemoveQueries } from '@/entities/comment/api/comment.keys';
import { Post } from '@/entities/post/@x/comment';

/**
 * 상세 화면을 떠날 때(알림으로 다른 글로 갈 때 포함) 그 글의 실패한 댓글 목록을 지운다. 남기면 gc(5분) 전에 다시 열었을
 * 때 요청 없이 같은 에러가 뜬다(commentRemoveQueries.erroredList). 라우트가 미리 받기를 거는 자리에서 함께 부른다.
 */
export function useRemoveErroredCommentsOnLeave(postId: Post['id']) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      commentRemoveQueries.erroredList(queryClient, postId);
    };
  }, [queryClient, postId]);
}
