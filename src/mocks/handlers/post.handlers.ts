import { http, HttpResponse } from 'msw';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { API_ENDPOINTS } from '@/shared/config/api';

export const postHandlers = [
  // GET /post (목록)
  http.get(`${API_ENDPOINTS.post.base}`, () => {
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
  http.get(`${API_ENDPOINTS.post.base}/:id`, ({ params }) => {
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
  http.post(`${API_ENDPOINTS.post.base}`, async () => {
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
  http.patch(`${API_ENDPOINTS.post.base}/:id`, async ({ params }) => {
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
  http.delete(`${API_ENDPOINTS.post.base}/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /post/:id/like (좋아요 토글)
  http.post(`${API_ENDPOINTS.post.togglePostLike(':id')}`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /post/:id/bookmark (북마크 토글)
  http.post(`${API_ENDPOINTS.post.postBookmark(':id')}`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
