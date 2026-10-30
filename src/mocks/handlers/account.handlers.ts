import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';

export const accountHandlers = [
  // GET /auth/account
  http.get('/auth/account', () => {
    return MockEnvelopeUtil.json(mockAccount);
  }),

  // PATCH /auth/account
  http.patch('/auth/account', async ({ request }) => {
    const body = (await request.json()) as { nickname?: string; image?: string };
    return MockEnvelopeUtil.json({ ...mockAccount, ...body });
  }),

  // GET /auth/account/nickname-availability - 'taken'만 중복으로 취급
  http.get('/auth/account/nickname-availability', ({ query }) => {
    const nickname = query.get('nickname');
    return MockEnvelopeUtil.json({ available: nickname !== 'taken' });
  }),

  // DELETE /auth/account
  http.delete('/auth/account', () => {
    return MockEnvelopeUtil.unit();
  }),
];
