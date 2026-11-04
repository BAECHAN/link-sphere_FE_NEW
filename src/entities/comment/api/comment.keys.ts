import type { QueryClient } from '@tanstack/react-query';
import { Post, postInvalidateQueries } from '@/entities/post/@x/comment';
import { isUnusedFailedQuery } from '@/shared/lib/react-query/unused-failed-query';

const rootKey = ['comments'] as const;

export const commentKeys = {
  root: rootKey,
  list: (postId: Post['id']) => [...rootKey, postId] as const,
  // 검색·정렬 옵션이 없어 filters 없이 단일 키로 쓴다 - 필요해지면 그때 posts(folderKey, sort, search)
  // 처럼 파라미터화한다(bookmarkFolderKeys.posts 선례).
  myRoot: [...rootKey, 'my'] as const,
};

export const commentInvalidateQueries = {
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (queryClient: QueryClient, postId: Post['id']) => {
    queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
  },
  my: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: commentKeys.myRoot });
  },
};

/** 데이터 없이 실패한 댓글 목록. 그 목록을 보여 주던 화면을 떠날 때 지운다(isUnusedFailedQuery 주석 참고). */
export const commentRemoveQueries = {
  erroredList: (queryClient: QueryClient, postId: Post['id']) => {
    queryClient.removeQueries({
      queryKey: commentKeys.list(postId),
      exact: true,
      predicate: isUnusedFailedQuery,
    });
  },
  erroredMy: (queryClient: QueryClient) => {
    queryClient.removeQueries({
      queryKey: commentKeys.myRoot,
      exact: true,
      predicate: isUnusedFailedQuery,
    });
  },
};

export const handleCommentCreateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  // 댓글 목록은 mutation의 onMutate/onSuccess가 낙관적으로 직접 갱신하므로 여기서 다시
  // invalidate하지 않는다 - 그러면 방금 그려진 결과를 지우고 GET을 한 번 더 태우게 된다.
  // commentCount가 걸린 게시글 상세/목록만 갱신한다.
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
  // "내 댓글" 목록은 위와 달리 낙관적으로 patch하지 않는다(원글 제목까지 새로 조립해야
  // 해서 비용 대비 이득이 낮음) - 무효화로 다음 진입 시 새로고침되게 한다.
  commentInvalidateQueries.my(queryClient);
};

// 등록 요청이 응답 없이 끝나(504·연결 끊김) 저장됐는지 모를 때 - 낙관적 댓글은 onError가 이미
// 되돌렸으니, 실제로 저장됐다면 다시 보이도록 목록과 댓글 수를 서버 기준으로 다시 불러온다.
export const handleCommentCreateOutcomeUnknown = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  handleCommentCreateSuccess(queryClient, postId);
};

export const handleCommentDeleteSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  commentInvalidateQueries.my(queryClient);
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};

// 삭제가 실패로 끝났을 때 - 응답만 끊겼다면 서버에선 지워졌을 수 있어, 성공 때와 같은 캐시를 서버 기준으로 다시 불러온다.
export const handleCommentDeleteFailure = (queryClient: QueryClient, postId: Post['id']) => {
  handleCommentDeleteSuccess(queryClient, postId);
};

export const handleCommentUpdateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  commentInvalidateQueries.my(queryClient);
};
