import type { QueryClient } from '@tanstack/react-query';
import { Post, postInvalidateQueries } from '@/entities/post/@x/interaction';
import { Comment, commentInvalidateQueries } from '@/entities/comment/@x/interaction';
import { bookmarkFolderInvalidateQueries } from '@/entities/bookmark/folder/@x/interaction';

const rootKey = ['interaction'] as const;

// 같은 대상의 좋아요 mutation을 묶는 키 — isMutating 필터와 scope id(직렬화)에 함께 쓴다.
// 북마크는 폴더 mutation과 줄을 공유해 scope(bookmarkPostScope)로 세므로 이 키는 식별용이다.
export const interactionMutationKeys = {
  likePost: (postId: Post['id']) => [...rootKey, 'likePost', postId] as const,
  likeComment: (commentId: Comment['id']) => [...rootKey, 'likeComment', commentId] as const,
  bookmarkPost: (postId: Post['id']) => [...rootKey, 'bookmarkPost', postId] as const,
};

/**
 * 좋아요 연타의 마지막 요청이 실패했을 때 — 낙관적 값을 스냅샷으로 되돌린 뒤 서버 값으로 다시
 * 맞춘다. 앞선 요청이 성공했는지 실패했는지 화면에서는 알 수 없어서(연속 실패면 스냅샷도 틀림)
 * 실패할 때만 다시 조회한다. 그 글이 그려지는 상세·피드·북마크 폴더 캐시가 대상이다.
 */
export const handleLikePostFailure = (queryClient: QueryClient, postId: Post['id']) => {
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
};

/** handleLikePostFailure 의 북마크판 — 북마크는 폴더 목록 수에도 드러나 그것까지 다시 맞춘다. */
export const handleBookmarkPostFailure = (queryClient: QueryClient, postId: Post['id']) => {
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
};

/** handleLikePostFailure 의 댓글판 — 댓글 좋아요는 그 글의 댓글 목록에만 그려진다. */
export const handleLikeCommentFailure = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
};
