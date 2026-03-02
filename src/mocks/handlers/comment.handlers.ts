import { http, HttpResponse } from 'msw';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { API_ENDPOINTS } from '@/shared/config/api';

export const commentHandlers = [
  // GET /post/:id/comment (댓글 목록)
  http.get(`${API_ENDPOINTS.post.postComment(':id')}`, () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: [mockComment],
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /post/:id/comment (댓글 생성)
  http.post(`${API_ENDPOINTS.post.postComment(':id')}`, () => {
    return HttpResponse.json(
      {
        status: 201,
        message: 'ok',
        data: mockComment,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // PATCH /comment/:id (댓글 수정)
  http.patch(`${API_ENDPOINTS.post.comment(':id')}`, ({ params }) => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { ...mockComment, id: String(params['id']) },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // DELETE /comment/:id (댓글 삭제)
  http.delete(`${API_ENDPOINTS.post.comment(':id')}`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /comment/:id/like (댓글 좋아요 토글)
  http.post(`${API_ENDPOINTS.post.toggleCommentLike(':id')}`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /comment/:id/reply (대댓글 생성)
  http.post(`${API_ENDPOINTS.post.commentReply(':id')}`, () => {
    return HttpResponse.json(
      {
        status: 201,
        message: 'ok',
        data: { ...mockComment, id: 'reply-uuid-1' },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),
];
