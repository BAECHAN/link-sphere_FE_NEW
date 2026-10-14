import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import type {
  CommentLikeResponse,
  PostBookmarkResponse,
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

  // 북마크도 좋아요처럼 원하는 상태를 보낸다 — PUT은 저장(기존 폴더 소속 유지), DELETE는 해제(소속도 삭제)
  bookmarkPost: async (postId: string) => {
    return await apiClient.put<PostBookmarkResponse>(
      API_ENDPOINTS.post.postBookmark(postId),
      undefined
    );
  },

  unbookmarkPost: async (postId: string) => {
    return await apiClient.delete<PostBookmarkResponse>(API_ENDPOINTS.post.postBookmark(postId));
  },

  // 화면상 마지막 폴더를 빼며 해제 — 서버가 그 소속을 뺀 뒤 남은 소속이 없을 때만 북마크를 지운다.
  // 화면이 낡아 다른 기기가 추가한 폴더가 있으면 북마크와 그 소속이 남는다
  // (docs/plans/2026-10-14-last-folder-keeps-others.md)
  unbookmarkPostFromLastFolder: async (postId: string, folderId: string) => {
    return await apiClient.delete<PostBookmarkResponse>(
      API_ENDPOINTS.bookmark.postFolder(postId, folderId),
      undefined,
      { searchParams: { removeBookmarkIfEmpty: true } }
    );
  },
};
