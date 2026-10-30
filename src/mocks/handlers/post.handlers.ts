import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';

export const postHandlers = [
  // GET /post (목록)
  http.get('/post', () => {
    return MockEnvelopeUtil.json(mockPostListResponse);
  }),

  // GET /post/{id} (상세)
  http.get('/post/{id}', ({ params }) => {
    return MockEnvelopeUtil.json({ ...mockPost, id: params.id });
  }),

  // GET /link-preview (작성 중 링크 미리보기)
  http.get('/link-preview', ({ query }) => {
    const target = query.get('url') ?? '';
    return MockEnvelopeUtil.json({
      url: target,
      title: 'Quick Start – React',
      description: 'The library for web and native user interfaces',
      ogImage: null,
    });
  }),

  // POST /post (생성)
  http.post('/post', async () => {
    return MockEnvelopeUtil.json(mockPost, 201);
  }),

  // PATCH /post/{id} (수정)
  http.patch('/post/{id}', async ({ params }) => {
    return MockEnvelopeUtil.json({ ...mockPost, id: params.id });
  }),

  // DELETE /post/{id} (삭제) — 실제 BE는 204가 아니라 200 + 봉투(ApiResponse<Unit>)
  http.delete('/post/{id}', () => {
    return MockEnvelopeUtil.unit();
  }),

  // PUT /post/{postId}/like (좋아요)
  http.put('/post/{postId}/like', () => {
    return MockEnvelopeUtil.json({ isLiked: true, likeCount: mockPost.stats.likeCount + 1 });
  }),

  // DELETE /post/{postId}/like (좋아요 취소)
  http.delete('/post/{postId}/like', () => {
    return MockEnvelopeUtil.json({ isLiked: false, likeCount: mockPost.stats.likeCount });
  }),

  // PUT /post/{postId}/bookmark (북마크 저장 — 기존 폴더 소속 유지)
  http.put('/post/{postId}/bookmark', ({ params }) => {
    return MockEnvelopeUtil.json({ postId: params.postId, isBookmarked: true, folderIds: [] });
  }),

  // DELETE /post/{postId}/bookmark (북마크 해제 — 소속도 삭제)
  http.delete('/post/{postId}/bookmark', ({ params }) => {
    return MockEnvelopeUtil.json({ postId: params.postId, isBookmarked: false, folderIds: [] });
  }),
];
