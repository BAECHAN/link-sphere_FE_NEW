import { mockComment, mockMyCommentListResponse } from '@/mocks/fixtures/comment.fixtures';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';

export const commentHandlers = [
  // GET /comment/my (내 댓글 목록)
  http.get('/comment/my', () => {
    return MockEnvelopeUtil.json(mockMyCommentListResponse);
  }),

  // GET /post/{postId}/comment (댓글 목록)
  http.get('/post/{postId}/comment', () => {
    return MockEnvelopeUtil.json([mockComment]);
  }),

  // POST /post/{postId}/comment (댓글 생성)
  http.post('/post/{postId}/comment', () => {
    return MockEnvelopeUtil.json(mockComment, 201);
  }),

  // PATCH /comment/{commentId} (댓글 수정)
  http.patch('/comment/{commentId}', ({ params }) => {
    return MockEnvelopeUtil.json({ ...mockComment, id: params.commentId });
  }),

  // DELETE /comment/{commentId} (댓글 삭제) — 실제 BE는 204가 아니라 200 + 봉투(ApiResponse<Unit>)
  http.delete('/comment/{commentId}', () => {
    return MockEnvelopeUtil.unit();
  }),

  // PUT /comment/{commentId}/like (댓글 좋아요) — 실제 BE는 200 + CommentLikeResponse
  http.put('/comment/{commentId}/like', () => {
    return MockEnvelopeUtil.json({ isLiked: true });
  }),

  // DELETE /comment/{commentId}/like (댓글 좋아요 취소)
  http.delete('/comment/{commentId}/like', () => {
    return MockEnvelopeUtil.json({ isLiked: false });
  }),

  // POST /comment/{commentId}/reply (대댓글 생성)
  http.post('/comment/{commentId}/reply', () => {
    return MockEnvelopeUtil.json({ ...mockComment, id: 'reply-uuid-1' }, 201);
  }),
];
