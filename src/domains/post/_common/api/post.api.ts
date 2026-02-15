import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import {
  CreatePost,
  CreatePostResponse,
  PostListResponse,
} from '@/domains/post/_common/model/post.schema';

import { PaginationRequest } from '@/shared/api/common.schema';

export const postApi = {
  /**
   * 포스트 등록
   * @param payload - 회원 생성 정보
   * @returns CreatePostResponse
   */
  createPost: async (payload: CreatePost): Promise<CreatePostResponse> => {
    const response = await apiClient.post<CreatePostResponse>(API_ENDPOINTS.post.base, payload);
    return response;
  },

  /**
   * 포스트 목록 조회
   * @param params - 페이지네이션 정보
   * @returns PostListResponse
   */
  fetchPostList: async (params: PaginationRequest): Promise<PostListResponse> => {
    const response = await apiClient.get<PostListResponse>(API_ENDPOINTS.post.base, {
      searchParams: { page: params.page, size: params.size },
    });

    return response;
  },
};
