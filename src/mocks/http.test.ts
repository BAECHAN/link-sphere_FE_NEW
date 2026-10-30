import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import { server } from '@/mocks/server';

/**
 * 타입 테스트 — 실행하지 않고 `pnpm type-check`가 검사한다. 각 줄이 타입 오류를 내지 않으면
 * `@ts-expect-error`가 "Unused directive"로 실패한다.
 *
 * null 본문(`new HttpResponse(null)`·`HttpResponse.json(null)`)은 msw가 본문 타입과 무관하게
 * 허용해 여기서 잡을 수 없다 — 그래서 핸들러에서는 ESLint가 `HttpResponse` import를 막는다.
 */
export const typeCases = [
  // @ts-expect-error -- 스펙에 없는 경로
  http.get('/post/{id}/unknown', () => MockEnvelopeUtil.unit()),

  // @ts-expect-error -- 경로 변수 이름이 스펙과 다름(/post/{id})
  http.get('/post/{postId}', () => MockEnvelopeUtil.unit()),

  // @ts-expect-error -- 스펙에 없는 메서드(/link-preview는 GET만)
  http.post('/link-preview', () => MockEnvelopeUtil.unit()),

  // @ts-expect-error -- 필수 필드(data.url) 누락
  http.get('/link-preview', () => {
    return MockEnvelopeUtil.json({ title: 't', description: null, ogImage: null });
  }),

  // @ts-expect-error -- 필드 타입 오류(isLiked는 boolean)
  http.put('/post/{postId}/like', () => MockEnvelopeUtil.json({ isLiked: 'yes', likeCount: 1 })),

  http.get('/auth/email-availability', ({ query }) =>
    // @ts-expect-error -- 스펙에 없는 쿼리 이름(email)
    MockEnvelopeUtil.json({ available: query.get('mail') !== null })
  ),

  // @ts-expect-error -- data가 필요한 경로에 Unit 봉투
  http.put('/post/{postId}/like', () => MockEnvelopeUtil.unit()),

  // 통과해야 하는 기준 케이스
  http.delete('/post/{id}', () => MockEnvelopeUtil.unit()),
  http.put('/post/{postId}/like', () => MockEnvelopeUtil.json({ isLiked: true, likeCount: 1 })),
];

describe('스펙 타입 http', () => {
  it('스펙 경로 템플릿에 API_BASE_URL을 붙여 실제 요청 경로와 매칭한다', async () => {
    server.use(
      http.get('/link-preview', ({ query }) =>
        MockEnvelopeUtil.json({
          url: query.get('url') ?? '',
          title: 'override',
          description: null,
          ogImage: null,
        })
      )
    );

    const preview = await fetch('/api/link-preview?url=https%3A%2F%2Fa.com');
    // 기본 핸들러 — {folderId} 경로 변수가 params로 넘어오는지
    const pinned = await fetch('/api/bookmark/folders/folder-1/pin', { method: 'PUT' });

    expect(await preview.json()).toMatchObject({
      data: { url: 'https://a.com', title: 'override' },
    });
    expect(await pinned.json()).toMatchObject({ data: { id: 'folder-1' } });
  });

  it('Unit 응답은 운영처럼 200 + data: {} 봉투다', async () => {
    const res = await fetch('/api/post/abc', { method: 'DELETE' });
    const body = (await res.json()) as { status: number; data: unknown };

    expect(res.status).toBe(200);
    expect(body.status).toBe(200);
    expect(body.data).toEqual({});
  });
});
