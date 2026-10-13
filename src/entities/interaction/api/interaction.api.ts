import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import type {
  CommentLikeResponse,
  PostLikeResponse,
} from '@/entities/interaction/model/interaction.dto';

// 좋아요는 토글(POST)이 아니라 원하는 상태를 보낸다 — PUT은 좋아요, DELETE는 취소이고 같은
// 요청을 여러 번 보내도 결과가 같다(멱등). 근거: docs/plans/2026-10-13-like-concurrency.md
// 본문은 없다 — apiClient.put은 data가 필수 인자라 undefined를 넘긴다.
export const interactionApi = {
  likePost: async (postId: string) => {
    return await apiClient.put<PostLikeResponse>(API_ENDPOINTS.post.postLike(postId), undefined);
  },

  unlikePost: async (postId: string) => {
    return await apiClient.delete<PostLikeResponse>(API_ENDPOINTS.post.postLike(postId));
  },

  likeComment: async (commentId: string) => {
    return await apiClient.put<CommentLikeResponse>(
      API_ENDPOINTS.post.commentLike(commentId),
      undefined
    );
  },

  unlikeComment: async (commentId: string) => {
    return await apiClient.delete<CommentLikeResponse>(API_ENDPOINTS.post.commentLike(commentId));
  },

  toggleBookmarkPost: async (postId: string) => {
    return await apiClient.post<{ isBookmarked: boolean }>(API_ENDPOINTS.post.postBookmark(postId));
  },
};
