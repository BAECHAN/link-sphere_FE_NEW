import { apiClient } from '@/shared/api/client';
import { Comment } from '@/entities/comment/model/comment.schema';
import { API_ENDPOINTS } from '@/shared/config/api';

export const commentApi = {
  getComments: async (postId: string) => {
    return await apiClient.get<Comment[]>(API_ENDPOINTS.post.postComment(postId));
  },

  createComment: async (postId: string, payload: { content?: string; images?: File[] }) => {
    const formData = new FormData();
    if (payload.content) formData.append('content', payload.content);
    payload.images?.forEach((img) => formData.append('images', img));

    return await apiClient.post<Comment>(API_ENDPOINTS.post.postComment(postId), formData);
  },

  createReply: async (commentId: string, payload: { content?: string; images?: File[] }) => {
    const formData = new FormData();
    if (payload.content) formData.append('content', payload.content);
    payload.images?.forEach((img) => formData.append('images', img));

    return await apiClient.post<Comment>(API_ENDPOINTS.post.commentReply(commentId), formData);
  },

  deleteComment: async (commentId: string) => {
    await apiClient.delete(API_ENDPOINTS.post.comment(commentId));
  },

  updateComment: async (commentId: string, payload: { content?: string; images?: File[] }) => {
    const formData = new FormData();
    if (payload.content) formData.append('content', payload.content);
    payload.images?.forEach((img) => formData.append('images', img));

    return await apiClient.patch<Comment>(API_ENDPOINTS.post.comment(commentId), formData);
  },
};
