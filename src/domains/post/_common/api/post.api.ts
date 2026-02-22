import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import {
  CreatePost,
  CreatePostResponse,
  PostListResponse,
  PostListRequest,
  Post,
} from '@/domains/post/_common/model/post.schema';

export const postApi = {
  /**
   * 포스트 등록
   * @param payload - 회원 생성 정보
   * @returns CreatePostResponse
   */
  createPost: async (payload: CreatePost): Promise<CreatePostResponse> => {
    return await apiClient.post<CreatePostResponse>(API_ENDPOINTS.post.base, payload);
  },

  /**
   * 포스트 목록 조회
   * @param payload - 페이지네이션 정보 + 검색 필터
   * @returns PostListResponse
   */
  fetchPostList: async (payload: PostListRequest): Promise<PostListResponse> => {
    const { page, size, search, category, filter, nickname } = payload;

    const searchParams: PostListRequest = {
      page,
      size,
      ...(search && { search }),
      ...(category && { category }),
      ...(filter && { filter }),
      ...(nickname && { nickname }),
    };

    return await apiClient.get<PostListResponse>(API_ENDPOINTS.post.base, { searchParams });
  },

  fetchPostDetail: async (postId: string): Promise<Post> => {
    return await apiClient.get<Post>(`${API_ENDPOINTS.post.base}/${postId}`);
  },

  updatePostVisibility: async (postId: string, isPrivate: boolean): Promise<Post> => {
    return await apiClient.patch<Post>(`${API_ENDPOINTS.post.base}/${postId}/visibility`, {
      isPrivate,
    });
  },

  deletePost: async (postId: string): Promise<void> => {
    return await apiClient.delete<void>(`${API_ENDPOINTS.post.base}/${postId}`);
  },
};
