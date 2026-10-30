import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';

export const authHandlers = [
  // POST /auth/login
  http.post('/auth/login', () => {
    return MockEnvelopeUtil.json(mockLoginResponse);
  }),

  // POST /auth/signup - 실제 BE는 ApiResponse로 감싼 AccountResponse를 돌려준다(빈 바디 아님)
  http.post('/auth/signup', () => {
    return MockEnvelopeUtil.json(mockAccount, 201);
  }),

  // POST /auth/refresh
  http.post('/auth/refresh', () => {
    return MockEnvelopeUtil.json(mockLoginResponse);
  }),

  // POST /auth/logout — 실제 BE는 204가 아니라 200 + 봉투(ApiResponse<Unit>)
  http.post('/auth/logout', () => {
    return MockEnvelopeUtil.unit();
  }),

  // GET /auth/email-availability - 'taken@example.com'만 중복으로 취급 (가입 화면 전용)
  http.get('/auth/email-availability', ({ query }) => {
    const email = query.get('email');
    return MockEnvelopeUtil.json({ available: email !== 'taken@example.com' });
  }),

  // POST /auth/password-reset/request - 계정 존재 여부와 무관하게 항상 200
  http.post('/auth/password-reset/request', () => {
    return MockEnvelopeUtil.unit();
  }),

  // POST /auth/password-reset/confirm
  http.post('/auth/password-reset/confirm', () => {
    return MockEnvelopeUtil.unit();
  }),

  // PATCH /auth/account/password - 성공 시 실제 BE처럼 새 토큰 응답(TokenResponse)을 돌려준다
  http.patch('/auth/account/password', () => {
    return MockEnvelopeUtil.json(mockLoginResponse);
  }),

  // POST /auth/email-verification/request - 계정 존재·인증 여부와 무관하게 항상 200
  http.post('/auth/email-verification/request', () => {
    return MockEnvelopeUtil.unit();
  }),

  // POST /auth/email-verification/confirm
  http.post('/auth/email-verification/confirm', () => {
    return MockEnvelopeUtil.unit();
  }),
];
