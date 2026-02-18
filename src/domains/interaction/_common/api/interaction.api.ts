import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';

export const interactionApi = {
  toggleLikePost: async (postId: string) => {
    return await apiClient.post<{ isLiked: boolean }>(
      API_ENDPOINTS.post.togglePostLike(postId),
      {}
    );
  },

  toggleLikeComment: async (commentId: string) => {
    return await apiClient.post<{ isLiked: boolean }>(
      API_ENDPOINTS.post.toggleCommentLike(commentId),
      {}
    );
  },

  toggleBookmarkPost: async (postId: string) => {
    return await apiClient.post<{ isBookmarked: boolean }>(
      API_ENDPOINTS.post.postBookmark(postId),
      {}
    );
  },
};
