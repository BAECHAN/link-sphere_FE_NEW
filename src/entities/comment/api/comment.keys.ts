import type { QueryClient } from '@tanstack/react-query';
import { Post, postInvalidateQueries } from '@/entities/post/@x/comment';

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

export const handleCommentDeleteSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  commentInvalidateQueries.my(queryClient);
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};

export const handleCommentUpdateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  commentInvalidateQueries.my(queryClient);
};
