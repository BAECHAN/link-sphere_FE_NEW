import { apiClient } from '@/shared/api/client';
import { Comment } from '@/entities/comment/model/comment.schema';
import { API_ENDPOINTS } from '@/shared/config/api';
import { uploadImageAndGetUrl } from '@/entities/upload/api/upload.api';

// createImageBitmap은 파일 용량이 아니라 디코드된 픽셀 수만큼 메모리를 쓴다. 첨부 버튼으로
// 고해상도 이미지 여러 장을 한 번에 고르기 쉬워진 만큼, 동시 처리 수를 2로 제한해 최대 동시
// 디코드 메모리를 낮춘다. 순서는 유지해야 한다(buildFinalContent가 배열 순서대로 이어붙임).
async function uploadCommentImages(images?: File[]): Promise<string[]> {
  if (!images || images.length === 0) {
    return [];
  }
  const CONCURRENCY = 2;
  const results: string[] = new Array<string>(images.length);
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((file) => uploadImageAndGetUrl(file)));
    results.splice(i, batchResults.length, ...batchResults);
  }
  return results;
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

  updateComment: async (
    commentId: string,
    payload: { content?: string; images?: File[]; existingImages?: string[] }
  ) => {
    const uploaded = await uploadCommentImages(payload.images);
    const images = [...(payload.existingImages ?? []), ...uploaded];
    return await apiClient.patch<Comment>(API_ENDPOINTS.post.comment(commentId), {
      content: payload.content,
      images,
    });
  },
};
