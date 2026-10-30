import { specClient } from '@/shared/api/spec-client';
import NProgress from 'nprogress';

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
    // keepalive: 폼이 응답을 기다리는 동안 탭을 닫거나 새로고침해도
    // 브라우저가 이미 시작된 요청을 끝까지 전송하도록 보장한다.
    return await specClient.post('/post', { body: payload }, { keepalive: true });
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

      return await specClient.get('/post', { query: searchParams });
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
    return await specClient.get('/link-preview', { query: { url } });
  },

  fetchPostDetail: async (postId: string): Promise<Post> => {
    return await specClient.get('/post/{id}', { path: { id: postId } });
  },

  updatePostVisibility: async (postId: string, isPrivate: boolean): Promise<Post> => {
    return await specClient.patch('/post/{id}/visibility', {
      path: { id: postId },
      body: { isPrivate },
    });
  },

  updatePost: async (postId: string, payload: UpdatePost): Promise<Post> => {
    // keepalive: createPost와 동일한 이유 - 응답을 기다리는 동안 탭을 닫거나 새로고침해도
    // 브라우저가 이미 시작된 요청을 끝까지 전송하도록 보장한다.
    return await specClient.patch(
      '/post/{id}',
      { path: { id: postId }, body: payload },
      { keepalive: true }
    );
  },

  deletePost: async (postId: string): Promise<void> => {
    return await specClient.delete('/post/{id}', { path: { id: postId } });
  },
};
