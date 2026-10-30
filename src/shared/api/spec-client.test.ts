import type { components } from '@/shared/api/generated/openapi.gen';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { specClient } from '@/shared/api/spec-client';

type AccountResponse = components['schemas']['AccountResponse'];
// entities/account의 Account처럼 스펙보다 좁힌 도메인 타입(shared는 entities를 import할 수 없어 여기서 흉내 낸다)
type NarrowedAccount = Omit<AccountResponse, 'role'> & { role: 'USER' | 'ADMIN' };

/**
 * 타입 테스트 — 실행하지 않고 `pnpm type-check`가 검사한다. 각 줄이 타입 오류를 내지 않으면
 * `@ts-expect-error`가 "Unused directive"로 실패한다.
 */
export const typeCases = async () => {
  // @ts-expect-error -- 스펙에 없는 경로
  await specClient.get('/post/{id}/unknown');

  // @ts-expect-error -- 스펙에 없는 메서드(/link-preview는 GET만)
  await specClient.post('/link-preview');

  // @ts-expect-error -- 경로 변수 누락
  await specClient.get('/post/{id}');

  // @ts-expect-error -- 경로 변수 이름이 스펙과 다름(/post/{id})
  await specClient.get('/post/{id}', { path: { postId: 'p1' } });

  // @ts-expect-error -- 필수 쿼리 누락
  await specClient.get('/auth/email-availability');

  // @ts-expect-error -- 스펙에 없는 쿼리 이름(email)
  await specClient.get('/auth/email-availability', { query: { mail: 'a@b.c' } });

  // @ts-expect-error -- 필수 본문 누락
  await specClient.post('/fcm/token');

  // @ts-expect-error -- 본문 필수 필드(token) 누락
  await specClient.post('/fcm/token', { body: { platform: 'WEB' } });

  await specClient.put('/post/{postId}/like', {
    path: { postId: 'p1' },
    // @ts-expect-error -- 본문을 받지 않는 엔드포인트에 본문
    body: { isLiked: true },
  });

  // @ts-expect-error -- R은 스펙 응답의 하위 타입만(role은 string)
  await specClient.get<'/auth/account', Omit<AccountResponse, 'role'> & { role: number }>(
    '/auth/account'
  );

  // @ts-expect-error -- 좁힌 도메인 타입에 스펙 응답을 그대로 대입
  const account: NarrowedAccount = await specClient.get('/auth/account');

  const deleted = await specClient.delete('/post/{id}', { path: { id: 'p1' } });
  // @ts-expect-error -- Unit 응답(data 없음)은 void
  void deleted.status;

  // 통과해야 하는 기준 케이스
  const narrowed = await specClient.get<'/auth/account', NarrowedAccount>('/auth/account');
  const posts = await specClient.get('/post', { query: { page: 0, size: 10 } });
  const allPosts = await specClient.get('/post');

  return [account, narrowed.role, posts.content, allPosts.content];
};

describe('specClient', () => {
  it('경로 변수를 인코딩해 치환하고 봉투를 벗긴 data를 돌려준다', async () => {
    let pathname = '';
    server.use(
      http.get('/post/{id}', ({ request, params }) => {
        pathname = new URL(request.url).pathname;

        return MockEnvelopeUtil.json({ id: params.id } as never);
      })
    );

    const post = await specClient.get('/post/{id}', { path: { id: 'a b/c' } });

    expect(pathname).toBe('/api/post/a%20b%2Fc');
    expect(post).toEqual({ id: 'a b/c' });
  });

  it('query를 쿼리스트링으로 붙이고 undefined 값은 뺀다', async () => {
    let search = '';
    server.use(
      http.get('/post', ({ request }) => {
        search = new URL(request.url).search;

        return MockEnvelopeUtil.json({ content: [] } as never);
      })
    );

    await specClient.get('/post', { query: { page: 1, size: 20, search: undefined } });

    expect(search).toBe('?page=1&size=20');
  });

  it('본문이 없는 PUT은 본문 없이 보낸다', async () => {
    let body: string | null = null;
    server.use(
      http.put('/post/{postId}/like', async ({ request }) => {
        body = await request.text();

        return MockEnvelopeUtil.json({ isLiked: true, likeCount: 3 });
      })
    );

    const result = await specClient.put('/post/{postId}/like', { path: { postId: 'p1' } });

    expect(body).toBe('');
    expect(result).toEqual({ isLiked: true, likeCount: 3 });
  });

  it('본문이 있는 DELETE는 본문을 JSON으로 보내고, Unit 응답은 빈 data를 그대로 넘긴다', async () => {
    let body: unknown = null;
    server.use(
      http.delete('/auth/account', async ({ request }) => {
        body = await request.json();

        return MockEnvelopeUtil.unit();
      })
    );

    const result = await specClient.delete('/auth/account', { body: { password: 'pw' } });

    expect(body).toEqual({ password: 'pw' });
    // 타입은 void라 호출부가 값을 쓸 수 없다 — 런타임에는 운영과 같은 빈 data(`{}`)가 그대로 지나간다
    expect(result).toEqual({});
  });

  it('options(keepalive 등)를 apiClient에 그대로 넘긴다', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined);

    await specClient.post(
      '/fcm/token',
      { body: { token: 't', platform: 'WEB' } },
      { keepalive: true }
    );

    expect(postSpy).toHaveBeenCalledWith(
      '/fcm/token',
      { token: 't', platform: 'WEB' },
      { keepalive: true, searchParams: undefined }
    );
  });
});
