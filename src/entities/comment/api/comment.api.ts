import { apiClient } from '@/shared/api/client';
import { Comment } from '@/entities/comment/model/comment.schema';
import { API_ENDPOINTS } from '@/shared/config/api';
import { uploadImageAndGetUrl } from '@/entities/upload/api/upload.api';

async function uploadCommentImages(images?: File[]): Promise<string[]> {
  if (!images || images.length === 0) {
    return [];
  }
  return Promise.all(images.map((file) => uploadImageAndGetUrl(file)));
}

export const commentApi = {
  getComments: async (postId: string) => {
    return await apiClient.get<Comment[]>(API_ENDPOINTS.post.postComment(postId));
  },

  createComment: async (postId: string, payload: { content?: string; images?: File[] }) => {
    const images = await uploadCommentImages(payload.images);
    return await apiClient.post<Comment>(API_ENDPOINTS.post.postComment(postId), {
      content: payload.content,
      images,
    });
  },

  createReply: async (commentId: string, payload: { content?: string; images?: File[] }) => {
    const images = await uploadCommentImages(payload.images);
    return await apiClient.post<Comment>(API_ENDPOINTS.post.commentReply(commentId), {
      content: payload.content,
      images,
    });
  },

  deleteComment: async (commentId: string) => {
    await apiClient.delete(API_ENDPOINTS.post.comment(commentId));
  },

  updateComment: async (commentId: string, payload: { content?: string; images?: File[] }) => {
    const images = await uploadCommentImages(payload.images);
    return await apiClient.patch<Comment>(API_ENDPOINTS.post.comment(commentId), {
      content: payload.content,
      images,
    });
  },
};
