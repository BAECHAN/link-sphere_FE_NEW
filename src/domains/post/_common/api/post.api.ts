import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { CreatePost, CreatePostResponse } from '@/domains/post/_common/model/post.schema';

/**
 * 포스트 등록
 * @param payload - 회원 생성 정보
 * @returns CreatePostResponse
 */
const createPost = async (payload: CreatePost): Promise<CreatePostResponse> => {
  const response = await apiClient.post<CreatePostResponse>(API_ENDPOINTS.post.root, payload);
  return response;
};

export const postApi = {
  createPost,
};
