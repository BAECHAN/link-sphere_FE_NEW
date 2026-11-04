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
export const useCommentList = (postId: string, commentCount: number) => {
  const { data: comments, dataUpdatedAt, isFetching } = useSuspenseComments(postId);
  const sorted = [...comments].sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  );
  const isEmpty = sorted.length === 0;
  const totalCount = countComments(comments);
  // seedEmptyComments가 updatedAt: 0으로 심은 값 — 다시 받으면 시각이 생긴다
  const isSeeded = dataUpdatedAt === 0;
  // 심어 둔 빈 목록인데 상세 응답의 최신 숫자는 댓글이 있다고 한다 — 피드 숫자가 옛값이었고 댓글이 오는 중이다.
  // 실패하면 isFetching이 꺼져 이 상태에 멈추지 않는다.
  const isAwaitingComments = isSeeded && isFetching && commentCount > 0;
  // totalCount와 합치지 않는다 — 해시 스크롤이 totalCount 변화로 도착을 알아 같은 숫자면 놓친다
  const headingCount = isAwaitingComments ? commentCount : totalCount;

  return { comments: sorted, isEmpty, totalCount, headingCount, isSeeded, isAwaitingComments };
};
