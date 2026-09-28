import dayjs from 'dayjs';
import { Comment as PostComment } from '@/entities/comment/model/comment.schema';
import { useSuspenseComments } from '@/entities/comment/api/comment.queries';

/** 답글까지 포함한 전체 댓글 수 — 삭제된 톰스톤도 세어야 PostCard의 commentCount와 일치한다. */
function countComments(comments: PostComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

/**
 * 댓글 목록 데이터와 정렬·톰스톤 포함 카운트 파생을 포함하는 훅.
 * useSuspenseComments를 호출하므로 사용하는 컴포넌트가 Suspense에 의해 정지될 수 있다.
 */
export const useCommentList = (postId: string) => {
  const { data: comments } = useSuspenseComments(postId);
  const sorted = [...comments].sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  );
  const isEmpty = sorted.length === 0;
  const totalCount = countComments(comments);

  return { comments: sorted, isEmpty, totalCount };
};
