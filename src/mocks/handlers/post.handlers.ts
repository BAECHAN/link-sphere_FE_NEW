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

  // POST /post/:id/like (좋아요 토글)
  http.post(url(API_ENDPOINTS.post.togglePostLike(':id')), () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /post/:id/bookmark (북마크 토글)
  http.post(url(API_ENDPOINTS.post.postBookmark(':id')), () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
