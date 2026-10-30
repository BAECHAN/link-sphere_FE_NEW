import { specClient } from '@/shared/api/spec-client';
import { Comment, MyCommentListResponse } from '@/entities/comment/model/comment.schema';
import { uploadImageAndGetUrl } from '@/shared/lib/upload/uploadImageAndGetUrl';
import { PaginationRequest } from '@/shared/types/common.type';

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
  getComments: async (postId: string): Promise<Comment[]> => {
    return await specClient.get('/post/{postId}/comment', { path: { postId } });
  },

  getMyComments: async (payload: PaginationRequest): Promise<MyCommentListResponse> => {
    const { page, size } = payload;
    return await specClient.get('/comment/my', { query: { page, size } });
  },

  createComment: async (
    postId: string,
    payload: { content?: string; images?: File[] }
  ): Promise<Comment> => {
    const images = await uploadCommentImages(payload.images);
    return await specClient.post('/post/{postId}/comment', {
      path: { postId },
      body: { content: payload.content, images },
    });
  },

  createReply: async (
    commentId: string,
    payload: { content?: string; images?: File[] }
  ): Promise<Comment> => {
    const images = await uploadCommentImages(payload.images);
    return await specClient.post('/comment/{commentId}/reply', {
      path: { commentId },
      body: { content: payload.content, images },
    });
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await specClient.delete('/comment/{commentId}', { path: { commentId } });
  },

  updateComment: async (
    commentId: string,
    payload: { content?: string; images?: File[]; existingImages?: string[] }
  ): Promise<Comment> => {
    const uploaded = await uploadCommentImages(payload.images);
    const images = [...(payload.existingImages ?? []), ...uploaded];
    return await specClient.patch('/comment/{commentId}', {
      path: { commentId },
      body: { content: payload.content, images },
    });
  },
};
