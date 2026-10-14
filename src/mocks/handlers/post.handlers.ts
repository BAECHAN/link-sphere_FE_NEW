import { http, HttpResponse } from 'msw';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

/** 핸들러 URL에 API_BASE_URL prefix를 붙여 실제 요청 URL과 일치시킵니다. */
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

export const postHandlers = [
  // GET /post (목록)
  http.get(url(API_ENDPOINTS.post.base), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockPostListResponse,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // GET /post/:id (상세)
  http.get(url(`${API_ENDPOINTS.post.base}/:id`), ({ params }) => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { ...mockPost, id: String(params['id']) },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // GET /link-preview (작성 중 링크 미리보기)
  http.get(url(API_ENDPOINTS.post.linkPreview), ({ request }) => {
    const target = new URL(request.url).searchParams.get('url') ?? '';
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: {
          url: target,
          title: 'Quick Start – React',
          description: 'The library for web and native user interfaces',
          ogImage: null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /post (생성)
  http.post(url(API_ENDPOINTS.post.base), async () => {
    return HttpResponse.json(
      {
        status: 201,
        message: 'ok',
        data: mockPost,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // PATCH /post/:id (수정)
  http.patch(url(`${API_ENDPOINTS.post.base}/:id`), async ({ params }) => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { ...mockPost, id: String(params['id']) },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // DELETE /post/:id (삭제)
  http.delete(url(`${API_ENDPOINTS.post.base}/:id`), () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /post/:id/like (좋아요)
  http.put(url(API_ENDPOINTS.post.postLike(':id')), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: '좋아요 성공',
        data: { isLiked: true, likeCount: mockPost.stats.likeCount + 1 },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // DELETE /post/:id/like (좋아요 취소)
  http.delete(url(API_ENDPOINTS.post.postLike(':id')), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: '좋아요 취소 성공',
        data: { isLiked: false, likeCount: mockPost.stats.likeCount },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // PUT /post/:id/bookmark (북마크 저장 — 기존 폴더 소속 유지)
  http.put(url(API_ENDPOINTS.post.postBookmark(':id')), ({ params }) => {
    return HttpResponse.json(
      {
        status: 200,
        message: '북마크 성공',
        data: { postId: params.id, isBookmarked: true, folderIds: [] },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // DELETE /post/:id/bookmark (북마크 해제 — 소속도 삭제)
  http.delete(url(API_ENDPOINTS.post.postBookmark(':id')), ({ params }) => {
    return HttpResponse.json(
      {
        status: 200,
        message: '북마크 취소 성공',
        data: { postId: params.id, isBookmarked: false, folderIds: [] },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),
];
