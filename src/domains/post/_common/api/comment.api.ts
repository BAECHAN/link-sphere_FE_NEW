import { apiClient } from '@/shared/api/client';
import { Comment, CreateComment } from '@/domains/post/_common/model/comment.schema';
import { API_ENDPOINTS } from '@/shared/config/api';

export const commentApi = {
  getComments: async (postId: string) => {
    return await apiClient.get<Comment[]>(API_ENDPOINTS.post.postComment(postId));
  },

  createComment: async (postId: string, payload: CreateComment) => {
    return await apiClient.post<Comment>(API_ENDPOINTS.post.postComment(postId), payload);
  },

  createReply: async (commentId: string, payload: { content: string }) => {
    return await apiClient.post<Comment>(API_ENDPOINTS.post.commentReply(commentId), payload);
  },

  deleteComment: async (commentId: string) => {
    await apiClient.delete(API_ENDPOINTS.post.comment(commentId));
  },
};
