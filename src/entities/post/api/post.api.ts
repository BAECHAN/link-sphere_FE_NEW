import { apiClient } from '@/shared/api/client';
import NProgress from 'nprogress';
import { API_ENDPOINTS } from '@/shared/config/api';

NProgress.configure({ showSpinner: false });
import {
  CreatePost,
  CreatePostResponse,
  LinkPreview,
  PostListResponse,
  PostListRequest,
  Post,
  UpdatePost,
} from '@/entities/post/model/post.schema';

export const postApi = {
  /**
   * 포스트 등록
   * @param payload - 회원 생성 정보
   * @returns CreatePostResponse
   */
  createPost: async (payload: CreatePost): Promise<CreatePostResponse> => {
    // keepalive: 제출 직후 폼을 리셋하고 페이지를 이동하므로, 탭을 닫아도
    // 브라우저가 이미 시작된 요청을 끝까지 전송하도록 보장한다.
    return await apiClient.post<CreatePostResponse>(API_ENDPOINTS.post.base, payload, {
      keepalive: true,
    });
  },

  /**
   * 포스트 목록 조회
   * @param payload - 페이지네이션 정보 + 검색 필터
   * @returns PostListResponse
   */
  fetchPostList: async (payload: PostListRequest): Promise<PostListResponse> => {
    const { page, size, search, category, filter, nickname } = payload;

    if (page === 0) {
      NProgress.start();
    }

    try {
      const searchParams: PostListRequest = {
        page,
        size,
        ...(search && { search }),
        ...(category && { category }),
        ...(filter && { filter }),
        ...(nickname && { nickname }),
      };

      return await apiClient.get<PostListResponse>(API_ENDPOINTS.post.base, { searchParams });
    } finally {
      if (page === 0) {
        NProgress.done();
      }
    }
  },

  /**
   * 작성 중 링크 미리보기 - 서버가 URL을 크롤링해 제목·설명·썸네일을 돌려준다(10분 캐시).
   * 등록 요청과 같은 정규화된 URL을 넘겨야 BE 캐시가 등록 때 재사용된다.
   * @param url - UrlUtil.normalizeUrl을 거친 URL
   */
  fetchLinkPreview: async (url: string): Promise<LinkPreview> => {
    return await apiClient.get<LinkPreview>(API_ENDPOINTS.post.linkPreview, {
      searchParams: { url },
    });
  },

  fetchPostDetail: async (postId: string): Promise<Post> => {
    return await apiClient.get<Post>(`${API_ENDPOINTS.post.base}/${postId}`);
  },

  updatePostVisibility: async (postId: string, isPrivate: boolean): Promise<Post> => {
    return await apiClient.patch<Post>(`${API_ENDPOINTS.post.base}/${postId}/visibility`, {
      isPrivate,
    });
  },

  updatePost: async (postId: string, payload: UpdatePost): Promise<Post> => {
    // keepalive: createPost와 동일한 이유 - 제출 직후 뒤로가기하므로, 탭을 닫아도
    // 브라우저가 이미 시작된 요청을 끝까지 전송하도록 보장한다.
    return await apiClient.patch<Post>(`${API_ENDPOINTS.post.base}/${postId}`, payload, {
      keepalive: true,
    });
  },

  deletePost: async (postId: string): Promise<void> => {
    return await apiClient.delete<void>(`${API_ENDPOINTS.post.base}/${postId}`);
  },
};
